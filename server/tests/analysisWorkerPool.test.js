const { EventEmitter } = require('events');

jest.mock('child_process');

const makeFakeProc = () => {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: jest.fn() };
  proc.kill = jest.fn(() => proc.emit('exit', null));
  return proc;
};

const emitLine = (proc, obj) => {
  proc.stdout.emit('data', Buffer.from(JSON.stringify(obj) + '\n'));
};

describe('analysisWorkerPool', () => {
  let spawn;
  let spawnedProcs;
  let pool;

  beforeEach(() => {
    jest.resetModules();
    spawnedProcs = [];
    ({ spawn } = require('child_process'));
    spawn.mockReset();
    spawn.mockImplementation(() => {
      const proc = makeFakeProc();
      spawnedProcs.push(proc);
      return proc;
    });
    process.env.ANALYSIS_WORKER_POOL_SIZE = '1';
    pool = require('../utils/analysisWorkerPool');
  });

  afterEach(() => {
    pool.shutdown();
    delete process.env.ANALYSIS_WORKER_POOL_SIZE;
  });

  it('resolves a submitted job with the worker\'s result message', async () => {
    const jobPromise = pool.submitJob({ videoPath: '/tmp/a.mp4' });

    expect(spawnedProcs).toHaveLength(1);
    emitLine(spawnedProcs[0], { type: 'ready' });
    emitLine(spawnedProcs[0], { jobId: '1', type: 'result', data: { summary: { totalPlayers: 3 } } });

    const result = await jobPromise;
    expect(result).toEqual({ summary: { totalPlayers: 3 } });
  });

  it('rejects a submitted job with the worker\'s error message', async () => {
    const jobPromise = pool.submitJob({ videoPath: '/tmp/a.mp4' });
    emitLine(spawnedProcs[0], { type: 'ready' });
    emitLine(spawnedProcs[0], { jobId: '1', type: 'error', message: 'boom' });

    await expect(jobPromise).rejects.toThrow('boom');
  });

  it('calls onProgress for progress messages carrying the right job', async () => {
    const onProgress = jest.fn();
    const jobPromise = pool.submitJob({ videoPath: '/tmp/a.mp4' }, { onProgress });
    emitLine(spawnedProcs[0], { type: 'ready' });
    emitLine(spawnedProcs[0], { jobId: '1', type: 'progress', frame: 30, total: 100 });
    emitLine(spawnedProcs[0], { jobId: '1', type: 'result', data: {} });
    await jobPromise;

    expect(onProgress).toHaveBeenCalledWith({ frame: 30, total: 100, progress: 30 });
  });

  it('queues a second job when the single pooled worker is busy, and calls onQueued', async () => {
    const job1 = pool.submitJob({ videoPath: '/tmp/a.mp4' });
    emitLine(spawnedProcs[0], { type: 'ready' });

    const onQueued = jest.fn();
    const job2 = pool.submitJob({ videoPath: '/tmp/b.mp4' }, { onQueued });

    // Only one worker was spawned (pool size 1); job2 has nowhere to go yet.
    expect(spawnedProcs).toHaveLength(1);
    expect(onQueued).toHaveBeenCalled();
    // The still-busy worker's stdin should only have been written to once so far.
    expect(spawnedProcs[0].stdin.write).toHaveBeenCalledTimes(1);

    emitLine(spawnedProcs[0], { jobId: '1', type: 'result', data: { job: 1 } });
    await job1;

    // Freed up by job1 finishing, the worker should now pick up job2.
    expect(spawnedProcs[0].stdin.write).toHaveBeenCalledTimes(2);
    emitLine(spawnedProcs[0], { jobId: '2', type: 'result', data: { job: 2 } });
    await expect(job2).resolves.toEqual({ job: 2 });
  });

  it('rejects the in-flight job and respawns a replacement when a worker exits unexpectedly', async () => {
    const jobPromise = pool.submitJob({ videoPath: '/tmp/a.mp4' });
    emitLine(spawnedProcs[0], { type: 'ready' });

    spawnedProcs[0].emit('exit', 1);

    await expect(jobPromise).rejects.toThrow('Analysis worker exited unexpectedly');
    // shutdown() wasn't called, so the pool should have spawned a replacement.
    expect(spawnedProcs).toHaveLength(2);
  });
});
