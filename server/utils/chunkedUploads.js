const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');

// multer's existing single-shot /api/videos/upload already streams straight
// to disk (diskStorage, not memoryStorage) — it was never actually
// buffering whole files in memory. What it doesn't give up is resumability:
// one very large file is still one very long-lived HTTP request, which is
// exactly what drops on a flaky connection and what a lot of reverse
// proxies/load balancers time out on their own. This module lets a client
// upload a file as many smaller sequential chunks instead, so a dropped
// connection only costs the current chunk, and progress survives a page
// reload by re-querying getSession() for bytesReceived.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const TEMP_DIR = path.join(UPLOAD_DIR, '.chunked-uploads');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// uploadId -> { tempPath, bytesReceived, expectedSize, meta, createdAt }
const sessions = new Map();

// Sessions nobody ever finishes (browser closed mid-upload, network died
// for good) would otherwise leak a partial file on disk forever.
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const sweepTimer = setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [uploadId, session] of sessions) {
    if (session.createdAt < cutoff) abort(uploadId);
  }
}, SWEEP_INTERVAL_MS);
sweepTimer.unref(); // don't keep the process alive just for this

function createSession({ expectedSize, meta }) {
  const uploadId = crypto.randomBytes(16).toString('hex');
  const tempPath = path.join(TEMP_DIR, `${uploadId}.part`);
  fs.writeFileSync(tempPath, Buffer.alloc(0));
  sessions.set(uploadId, {
    tempPath,
    bytesReceived: 0,
    expectedSize,
    meta,
    createdAt: Date.now(),
  });
  return uploadId;
}

function getSession(uploadId) {
  return sessions.get(uploadId) || null;
}

/**
 * Append one chunk to the session's partial file. Synchronous so each
 * chunk is durably on disk before the HTTP response for it is sent (if the
 * process crashes between chunk requests, whatever was appended so far
 * survives) — a chunk is at most a few MB, so the event-loop-blocking cost
 * of a sync write is small and bounded regardless of total file size.
 */
function appendChunk(uploadId, buffer) {
  const session = sessions.get(uploadId);
  if (!session) {
    throw new Error('Unknown or expired upload session');
  }
  fs.appendFileSync(session.tempPath, buffer);
  session.bytesReceived += buffer.length;
  return session.bytesReceived;
}

/**
 * Assembles the finished upload and hands it to whichever storage backend
 * is configured (see utils/storage.js). Always lands on local disk first
 * (the chunk-by-chunk append above only knows how to write to a local temp
 * file) — for the local backend that IS the final destination; for s3,
 * storage.storeFile then uploads that local file and deletes it, so
 * nothing sits on local disk once this resolves either way.
 */
async function finalize(uploadId, finalFilename) {
  const session = sessions.get(uploadId);
  if (!session) {
    throw new Error('Unknown or expired upload session');
  }
  if (session.bytesReceived !== session.expectedSize) {
    throw new Error(
      `Upload incomplete: received ${session.bytesReceived} of ${session.expectedSize} declared bytes`
    );
  }
  const localPath = path.join(UPLOAD_DIR, finalFilename);
  fs.renameSync(session.tempPath, localPath);
  sessions.delete(uploadId);
  return storage.storeFile(localPath, finalFilename);
}

function abort(uploadId) {
  const session = sessions.get(uploadId);
  if (!session) return;
  fs.unlink(session.tempPath, () => {});
  sessions.delete(uploadId);
}

module.exports = { createSession, getSession, appendChunk, finalize, abort, UPLOAD_DIR };
