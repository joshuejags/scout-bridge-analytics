const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Mirrors the same path-resolution comment in analysisWorkerPool.js: this
// file lives in server/utils/, so PROJECT_ROOT assumes a full repo
// checkout (true for local dev), overridable via env for Docker (only
// server/ is copied into the image there).
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'venv', 'bin', 'python'));

const CV_DIR = process.env.CV_DIR || path.join(PROJECT_ROOT, 'server', 'cv');
const DOWNLOAD_SCRIPT = path.join(CV_DIR, 'download_video.py');

// Matches download_video.py's RESULT_MARKER. The result is found by this
// prefix rather than "the last line of stdout" because yt-dlp's own
// progress meter also writes to stdout (carriage-return-updated, not
// newline-terminated), which would otherwise land on the same unterminated
// line as the JSON that follows it.
const RESULT_MARKER = 'RESULT_JSON:';

// A single import is one yt-dlp process holding a network connection for
// as long as the source video takes to download, unlike the persistent,
// pooled analysis workers (which are CPU-bound and reused across jobs).
// Bounded instead by IMPORT_TIMEOUT_MS below and the existing uploadLimiter
// rate limit on the route itself, rather than a pool of its own.
const IMPORT_TIMEOUT_MS = process.env.URL_IMPORT_TIMEOUT_MS
  ? Number(process.env.URL_IMPORT_TIMEOUT_MS)
  : 10 * 60 * 1000;

/**
 * Downloads `url` into `outputTemplate` (a yt-dlp output template, e.g.
 * ".../uploads/<videoId>.%(ext)s") via download_video.py, and resolves with
 * the same shape that script prints: { filePath, title, duration, width,
 * height, extractor }. Rejects with a plain Error whose message is safe to
 * show a user (yt-dlp's own error text, or a timeout message) - never a
 * stack trace or internal path.
 */
function importFromUrl(url, outputTemplate) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DOWNLOAD_SCRIPT)) {
      return reject(new Error(`Download script not found at ${DOWNLOAD_SCRIPT}`));
    }

    const proc = spawn(PYTHON_BIN, [DOWNLOAD_SCRIPT, url, outputTemplate], {
      cwd: CV_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, IMPORT_TIMEOUT_MS);

    proc.stdout.on('data', (b) => {
      stdout += b.toString();
    });
    proc.stderr.on('data', (b) => {
      stderr += b.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start download process: ${err.message}`));
    });

    proc.on('close', () => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new Error(`Download timed out after ${Math.round(IMPORT_TIMEOUT_MS / 1000)}s`));
      }

      // yt-dlp's progress meter uses \r, not \n, to redraw itself in
      // place — normalize those to \n before splitting, or the marker line
      // could be glued onto the tail of the last progress update instead
      // of standing on its own.
      const markerLine = stdout
        .replace(/\r/g, '\n')
        .split('\n')
        .reverse()
        .find((line) => line.startsWith(RESULT_MARKER));

      let result;
      try {
        result = JSON.parse(markerLine.slice(RESULT_MARKER.length));
      } catch (e) {
        console.error(`[video-import] Unparseable output from download_video.py: ${stderr || stdout}`);
        return reject(new Error('Download failed: unexpected response from the import process'));
      }

      if (!result.ok) {
        return reject(new Error(result.error || 'Download failed'));
      }
      resolve(result);
    });
  });
}

module.exports = { importFromUrl };
