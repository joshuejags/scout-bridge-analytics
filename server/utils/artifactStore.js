const fs = require('fs');
const path = require('path');
const os = require('os');
const { storeFile, isCloudBackend } = require('./storage');
const { v4: uuidv4 } = require('uuid');

async function uploadJsonObject(key, obj) {
  // write to temp file and use storeFile which handles local vs s3
  const tmpDir = path.join(process.cwd(), 'server', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const fname = path.join(tmpDir, `${uuidv4()}.json`);
  fs.writeFileSync(fname, JSON.stringify(obj));
  const res = await storeFile(fname, key);
  return res;
}

module.exports = { uploadJsonObject, isCloudBackend };
