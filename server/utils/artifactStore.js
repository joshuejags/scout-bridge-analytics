const fs = require('fs');
const path = require('path');
const { storeFile, isCloudBackend, readObject, deleteObject, deletePrefix } = require('./storage');
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

async function readJsonObject(key, { backend } = {}) {
  const buffer = await readObject(key, { backend });
  return JSON.parse(buffer.toString('utf8'));
}

async function deleteJsonObject(key, { backend } = {}) {
  await deleteObject(key, { backend });
}

async function deleteAnalysisArtifacts(analysisId) {
  if (!analysisId) return { deleted: 0 };
  return deletePrefix(`artifacts/analysis/${analysisId}/`);
}

module.exports = { uploadJsonObject, readJsonObject, deleteJsonObject, deleteAnalysisArtifacts, isCloudBackend };
