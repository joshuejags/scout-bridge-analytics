jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('analysis daemon manager', () => {
  let spawn;
  let startAnalysisDaemon;
  let stopAnalysisDaemon;

  beforeEach(() => {
    jest.resetModules();
    spawn = require('child_process').spawn;
    ({ startAnalysisDaemon, stopAnalysisDaemon } = require('../utils/analysisDaemonManager'));
    jest.clearAllMocks();
  });

  it('starts the analysis daemon script when the server boots', () => {
    const proc = {
      pid: 4321,
      exitCode: null,
      killed: false,
      on: jest.fn(),
      kill: jest.fn(),
    };
    spawn.mockReturnValue(proc);

    const started = startAnalysisDaemon();

    expect(started).toBe(proc);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringContaining('analysisDaemon.js')],
      expect.objectContaining({
        cwd: expect.any(String),
        stdio: 'inherit',
      })
    );
    expect(proc.on).toHaveBeenCalledWith('exit', expect.any(Function));
    expect(proc.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('stops a running daemon cleanly', () => {
    const proc = {
      pid: 4322,
      exitCode: null,
      killed: false,
      on: jest.fn(),
      kill: jest.fn(),
    };
    spawn.mockReturnValue(proc);
    startAnalysisDaemon();

    stopAnalysisDaemon();

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
