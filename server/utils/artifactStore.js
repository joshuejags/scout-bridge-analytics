const fs = require('fs');
const path = require('path');
const { storeFile, isCloudBackend } = require('./storage');
const { v4: uuidv4 } = require('uuid');

async function uploadJsonObject(key, obj) {
  if (!isCloudBackend()) {
    const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    const target = path.join(root, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(obj));
    return { backend: 'local', key, localPath: target };
  }

  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const fname = path.join(tmpDir, `${uuidv4()}.json`);
  fs.writeFileSync(fname, JSON.stringify(obj));
  return storeFile(fname, key);
}

module.exports = { uploadJsonObject, isCloudBackend };
