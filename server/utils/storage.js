const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');

/**
 * Pluggable storage backend for uploaded video files (thumbnails, which
 * are small derived JPEGs written directly by the analysis worker, stay on
 * local disk regardless of backend — the real "local-disk only" gap this
 * closes is the large video files, not those).
 *
 * Defaults to 'local' (today's behavior, completely unchanged when
 * unconfigured — mirrors utils/email.js's console-fallback pattern: safe
 * and fully functional with zero configuration, real cloud storage
 * requires the operator to actually provide bucket/credentials). Set
 * STORAGE_BACKEND=s3 plus S3_BUCKET/S3_REGION (and S3_ACCESS_KEY_ID/
 * S3_SECRET_ACCESS_KEY, or rely on the AWS SDK's normal credential chain —
 * an IAM role, shared config file, etc. — same as any standard AWS setup)
 * to switch. S3_ENDPOINT + forcePathStyle also make this work against any
 * S3-compatible provider (Cloudflare R2, DigitalOcean Spaces, MinIO), not
 * just AWS.
 */
const BACKEND = (process.env.STORAGE_BACKEND || 'local').toLowerCase();

function getBackendName() {
  return BACKEND;
}

function isCloudBackend() {
  return BACKEND === 's3';
}

let s3Client = null;
function getS3Client() {
  if (s3Client) return s3Client;
  const config = { region: process.env.S3_REGION || 'us-east-1' };
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true; // required by most non-AWS S3-compatible providers
  }
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
  }
  s3Client = new S3Client(config);
  return s3Client;
}

function requireBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('STORAGE_BACKEND=s3 requires S3_BUCKET to be set');
  }
  return bucket;
}

/**
 * Moves a file that's already been assembled on local disk (by multer or
 * chunkedUploads.finalize()) into permanent storage under `key`. For the
 * local backend this is a no-op — the file is already where it needs to
 * be. For s3, uploads it and deletes the local temp copy, since S3 becomes
 * the sole source of truth for that video from here on.
 *
 * Returns { backend, key, localPath } — localPath is null once a file has
 * moved to s3, since there's nothing left on disk to point at.
 */
async function storeFile(localPath, key) {
  if (!isCloudBackend()) {
    return { backend: 'local', key, localPath };
  }
  const bucket = requireBucket();
  const client = getS3Client();
  const stat = fs.statSync(localPath);
  const body = fs.createReadStream(localPath);
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentLength: stat.size })
  );
  fs.unlink(localPath, () => {}); // best-effort cleanup; S3 already has the durable copy
  return { backend: 's3', key, localPath: null };
}

/**
 * Streams an S3 object straight into an Express response (headers +
 * piping + error handling in one place), for proxying /uploads/* requests
 * for videos whose storageBackend is 's3'. Local-backend files skip this
 * entirely and are served by express.static instead — more efficient
 * (real range-request/caching support) than reimplementing that here.
 */
async function pipeObjectToResponse(key, res) {
  const bucket = requireBucket();
  const client = getS3Client();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (result.ContentType) res.setHeader('Content-Type', result.ContentType);
  if (result.ContentLength != null) res.setHeader('Content-Length', result.ContentLength);
  result.Body.on('error', (err) => {
    if (!res.headersSent) res.status(500);
    res.end();
    console.error(`[storage] error streaming s3://${bucket}/${key}: ${err.message}`);
  });
  result.Body.pipe(res);
}

async function deleteObject(key) {
  const bucket = requireBucket();
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Connectivity/config check, analogous to email.js's verifySmtpConnection
 * — confirms the configured bucket is reachable with the given
 * credentials without uploading anything. Returns null (not false) when
 * the local backend is active, distinct from "s3 configured but broken".
 */
async function verifyStorageConnection() {
  if (!isCloudBackend()) return null;
  try {
    const bucket = requireBucket();
    const client = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  getBackendName,
  isCloudBackend,
  storeFile,
  pipeObjectToResponse,
  deleteObject,
  verifyStorageConnection,
};
