const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('@aws-sdk/client-s3');

describe('utils/storage', () => {
  const ORIGINAL_ENV = { ...process.env };
  let sendMock;
  let storage;

  const freshModule = () => {
    jest.resetModules();
    const {
      S3Client,
      PutObjectCommand,
      GetObjectCommand,
      DeleteObjectCommand,
      HeadBucketCommand,
    } = require('@aws-sdk/client-s3');
    sendMock = jest.fn();
    S3Client.mockImplementation(() => ({ send: sendMock }));
    // Preserve the constructor identity so `new PutObjectCommand({...})`
    // instances can be inspected via sendMock's call args in tests below.
    PutObjectCommand.mockImplementation((input) => ({ __type: 'PutObjectCommand', input }));
    GetObjectCommand.mockImplementation((input) => ({ __type: 'GetObjectCommand', input }));
    DeleteObjectCommand.mockImplementation((input) => ({ __type: 'DeleteObjectCommand', input }));
    HeadBucketCommand.mockImplementation((input) => ({ __type: 'HeadBucketCommand', input }));
    storage = require('../utils/storage');
  };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('local backend (default)', () => {
    beforeEach(() => {
      delete process.env.STORAGE_BACKEND;
      freshModule();
    });

    it('reports the local backend and treats it as non-cloud', () => {
      expect(storage.getBackendName()).toBe('local');
      expect(storage.isCloudBackend()).toBe(false);
    });

    it('storeFile is a no-op that returns the same local path untouched', async () => {
      const tmp = path.join(os.tmpdir(), `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
      fs.writeFileSync(tmp, 'hello');
      const result = await storage.storeFile(tmp, 'some-key.txt');
      expect(result).toEqual({ backend: 'local', key: 'some-key.txt', localPath: tmp });
      expect(fs.existsSync(tmp)).toBe(true); // never touched
      fs.unlinkSync(tmp);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('verifyStorageConnection returns null (not false) when local is active', async () => {
      const result = await storage.verifyStorageConnection();
      expect(result).toBeNull();
    });
  });

  describe('s3 backend', () => {
    beforeEach(() => {
      process.env.STORAGE_BACKEND = 's3';
      process.env.S3_BUCKET = 'test-bucket';
      process.env.S3_REGION = 'us-east-1';
      freshModule();
    });

    it('reports the s3 backend and treats it as cloud', () => {
      expect(storage.getBackendName()).toBe('s3');
      expect(storage.isCloudBackend()).toBe(true);
    });

    it('storeFile uploads the local file to S3 and deletes the local copy', async () => {
      // The real SDK fully drains a stream Body before send() resolves
      // (it has to, to complete the upload) — a mock that resolves without
      // reading it races the file-open triggered by piping/reading against
      // storeFile's own cleanup unlink. Draining it here matches real
      // behavior instead of masking that ordering assumption.
      sendMock.mockImplementation(async (command) => {
        if (command.__type === 'PutObjectCommand' && command.input.Body) {
          await new Promise((resolve, reject) => {
            command.input.Body.on('data', () => {});
            command.input.Body.on('end', resolve);
            command.input.Body.on('error', reject);
          });
        }
        return {};
      });
      const tmp = path.join(os.tmpdir(), `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
      fs.writeFileSync(tmp, 'hello world');

      const result = await storage.storeFile(tmp, 'videos/some-key.mp4');

      expect(result).toEqual({ backend: 's3', key: 'videos/some-key.mp4', localPath: null });
      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command.__type).toBe('PutObjectCommand');
      expect(command.input).toMatchObject({ Bucket: 'test-bucket', Key: 'videos/some-key.mp4' });

      // Local temp file cleanup is fire-and-forget (fs.unlink callback
      // style) — give it a tick to run before asserting.
      await new Promise((r) => setTimeout(r, 50));
      expect(fs.existsSync(tmp)).toBe(false);
    });

    it('deleteObject sends a DeleteObjectCommand for the given key', async () => {
      sendMock.mockResolvedValue({});
      await storage.deleteObject('videos/to-delete.mp4');
      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command.__type).toBe('DeleteObjectCommand');
      expect(command.input).toMatchObject({ Bucket: 'test-bucket', Key: 'videos/to-delete.mp4' });
    });

    it('throws a clear error if S3_BUCKET is missing', async () => {
      delete process.env.S3_BUCKET;
      freshModule();
      await expect(storage.deleteObject('some-key')).rejects.toThrow('S3_BUCKET');
    });

    it('verifyStorageConnection reports ok: true when the bucket is reachable', async () => {
      sendMock.mockResolvedValue({});
      const result = await storage.verifyStorageConnection();
      expect(result).toEqual({ ok: true });
      expect(sendMock.mock.calls[0][0].__type).toBe('HeadBucketCommand');
    });

    it('verifyStorageConnection reports ok: false with the error when the bucket is unreachable', async () => {
      sendMock.mockRejectedValue(new Error('Forbidden'));
      const result = await storage.verifyStorageConnection();
      expect(result).toEqual({ ok: false, error: 'Forbidden' });
    });

    it('pipeObjectToResponse sets headers from the S3 response and pipes the body', async () => {
      const { PassThrough } = require('stream');
      const body = new PassThrough();
      // Real .pipe() plumbing needs a fully stream-compliant destination;
      // this test only cares that pipeObjectToResponse *calls* pipe(res)
      // with the right headers set first, so stub it rather than requiring
      // the plain mock res object below to implement the whole Writable API.
      const pipeSpy = jest.spyOn(body, 'pipe').mockImplementation(() => body);
      sendMock.mockResolvedValue({ ContentType: 'video/mp4', ContentLength: 1234, Body: body });

      const res = { setHeader: jest.fn(), on: jest.fn() };
      await storage.pipeObjectToResponse('videos/x.mp4', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 1234);
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });
  });
});
