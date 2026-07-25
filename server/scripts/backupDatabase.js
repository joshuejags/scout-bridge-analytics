/**
 * Dumps the whole MongoDB database and uploads the archive to S3 (or any
 * S3-compatible provider — MinIO, R2, Spaces), then prunes old backups
 * beyond the retention window. This is the concrete piece of "no backup
 * strategy" — the actual mechanism, not just documentation of intent.
 *
 * Requires the `mongodump` binary (part of MongoDB Database Tools —
 * https://www.mongodb.com/try/download/database-tools) to be on PATH.
 * Streams the dump straight into the S3 upload rather than buffering it
 * in memory or on local disk first, since it can be large.
 *
 * Usage: node scripts/backupDatabase.js
 * Intended to run on a schedule — see .github/workflows/backup.yml, which
 * needs MONGODB_URI, BACKUP_S3_BUCKET, and S3 credentials as repo secrets
 * to actually run (see that file's own comments for the full list).
 */
const path = require('path');
const { spawn } = require('child_process');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics';
const BUCKET = process.env.BACKUP_S3_BUCKET;
const PREFIX = 'backups/';
const RETENTION_DAYS = process.env.BACKUP_RETENTION_DAYS
  ? Number(process.env.BACKUP_RETENTION_DAYS)
  : 30;

function requireConfig() {
  if (!BUCKET) {
    console.error(
      'BACKUP_S3_BUCKET is not set — nowhere to upload the backup to. ' +
        'See README.md "Backups" for the full list of required variables.'
    );
    process.exit(1);
  }
}

// Reuses the same AWS-compatible credential vars utils/storage.js uses for
// video storage (S3_REGION/S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY)
// since they're just "how to authenticate to S3", not specific to what's
// being stored — but BACKUP_S3_BUCKET is deliberately its own variable, so
// backups can (and should, for real safety) live in a different bucket
// than the video storage they're separate from.
function getS3Client() {
  const config = { region: process.env.S3_REGION || 'us-east-1' };
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
  }
  return new S3Client(config);
}

/**
 * Spawns `mongodump --archive --gzip` and returns its stdout stream
 * directly — the caller pipes that straight into the S3 upload instead of
 * this function buffering the whole (potentially large) dump itself.
 */
function startDump() {
  const child = spawn(
    'mongodump',
    ['--uri', MONGODB_URI, '--archive', '--gzip'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitPromise = new Promise((resolve, reject) => {
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'mongodump not found on PATH. Install MongoDB Database Tools: ' +
              'https://www.mongodb.com/try/download/database-tools'
          )
        );
      } else {
        reject(err);
      }
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mongodump exited with code ${code}: ${stderr.trim()}`));
    });
  });

  return { stream: child.stdout, done: exitPromise };
}

async function uploadDump(client, key, stream) {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: stream, ContentType: 'application/gzip' })
  );
}

/**
 * Deletes backups older than RETENTION_DAYS. Not "keep the last N" — date-
 * based, so a gap in the schedule (a missed day) doesn't cascade into
 * losing more history than intended.
 */
async function pruneOldBackups(client) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const listing = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
  );
  const stale = (listing.Contents || []).filter(
    (obj) => obj.LastModified && obj.LastModified.getTime() < cutoff
  );
  if (stale.length === 0) return 0;

  await client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: stale.map((obj) => ({ Key: obj.Key })) },
    })
  );
  return stale.length;
}

async function main() {
  requireConfig();
  const client = getS3Client();
  const key = `${PREFIX}scout-bridge-analytics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.archive.gz`;

  console.log(`[backup] Starting mongodump -> s3://${BUCKET}/${key}`);
  const { stream, done } = startDump();
  await Promise.all([uploadDump(client, key, stream), done]);
  console.log('[backup] Upload complete.');

  const pruned = await pruneOldBackups(client);
  if (pruned > 0) {
    console.log(`[backup] Pruned ${pruned} backup(s) older than ${RETENTION_DAYS} days.`);
  }
}

main().catch((err) => {
  console.error('[backup] Failed:', err.message);
  process.exit(1);
});
