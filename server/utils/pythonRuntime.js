const fs = require('fs');
const path = require('path');

function getProjectRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolvePythonBinary() {
  const explicit = process.env.PYTHON_BIN;
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const root = getProjectRoot();
  const candidates = [];

  if (process.env.VIRTUAL_ENV) {
    candidates.push(
      process.platform === 'win32'
        ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe')
        : path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
    );
  }

  const venvNames = ['venv', '.venv'];
  for (const venvName of venvNames) {
    candidates.push(
      process.platform === 'win32'
        ? path.join(root, venvName, 'Scripts', 'python.exe')
        : path.join(root, venvName, 'bin', 'python')
    );
  }

  candidates.push(process.platform === 'win32' ? 'python.exe' : 'python3');
  candidates.push(process.platform === 'win32' ? 'python' : 'python');

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

module.exports = {
  getProjectRoot,
  resolvePythonBinary,
};
