const fs = require('fs');
const path = require('path');
const { resolvePythonBinary } = require('../utils/pythonRuntime');

describe('pythonRuntime', () => {
  const originalBin = process.env.PYTHON_BIN;
  const originalVenv = process.env.VIRTUAL_ENV;
  const realExistsSync = fs.existsSync;

  afterEach(() => {
    if (originalBin === undefined) {
      delete process.env.PYTHON_BIN;
    } else {
      process.env.PYTHON_BIN = originalBin;
    }
    if (originalVenv === undefined) {
      delete process.env.VIRTUAL_ENV;
    } else {
      process.env.VIRTUAL_ENV = originalVenv;
    }
    fs.existsSync = realExistsSync;
  });

  it('uses the configured PYTHON_BIN when provided', () => {
    process.env.PYTHON_BIN = '/custom/bin/python';
    expect(resolvePythonBinary()).toBe('/custom/bin/python');
  });

  it('falls back to a system interpreter when no project venv is present', () => {
    delete process.env.PYTHON_BIN;
    delete process.env.VIRTUAL_ENV;

    fs.existsSync = (candidate) => {
      const projectRoot = path.resolve(__dirname, '..', '..');
      const projectVenvCandidates = [
        path.join(projectRoot, 'venv', 'Scripts', 'python.exe'),
        path.join(projectRoot, 'venv', 'bin', 'python'),
        path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
        path.join(projectRoot, '.venv', 'bin', 'python'),
      ];

      const normalizedCandidate = String(candidate).replace(/\\/g, '/');
      if (projectVenvCandidates.some((v) => String(v).replace(/\\/g, '/') === normalizedCandidate)) {
        return false;
      }
      return realExistsSync(candidate);
    };

    expect(resolvePythonBinary()).toBe(process.platform === 'win32' ? 'python' : 'python3');
  });
});
