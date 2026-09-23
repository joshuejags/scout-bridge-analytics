const { createClient } = require('redis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_DB = Number(process.env.REDIS_DB || 0);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const PREFIX = 'scoutbridge:multipart:';
const TTL_SECONDS = Number(process.env.MULTIPART_UPLOAD_SESSION_TTL || 7200);

let client = null;
let connectPromise = null;

function getClient() {
  if (client) return client;
  client = createClient({
    socket: { host: REDIS_HOST, port: REDIS_PORT, connectTimeout: 2000 },
    database: REDIS_DB,
    ...(REDIS_PASSWORD && { password: REDIS_PASSWORD }),
  });
  client.on('error', (error) => {
    console.error('[multipartSessions] Redis error:', error.message);
  });
  return client;
}

async function ensureConnected() {
  const redis = getClient();
  if (redis.isReady) return redis;
  if (!connectPromise) {
    connectPromise = redis.connect().finally(() => {
      connectPromise = null;
    });
  }
  await connectPromise;
  return redis;
}

function key(uploadId) {
  return `${PREFIX}${uploadId}`;
}

async function createSession(uploadId, data) {
  const redis = await ensureConnected();
  await redis.set(key(uploadId), JSON.stringify(data), { EX: TTL_SECONDS });
  return data;
}

async function getSession(uploadId) {
  if (!uploadId) return null;
  const redis = await ensureConnected();
  const raw = await redis.get(key(uploadId));
  return raw ? JSON.parse(raw) : null;
}

async function deleteSession(uploadId) {
  if (!uploadId) return;
  const redis = await ensureConnected();
  await redis.del(key(uploadId));
}

async function close() {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  close,
  TTL_SECONDS,
};
