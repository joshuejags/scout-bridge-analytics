import axios from 'axios';
import { uploadFileInChunks } from '../chunkedUpload';

jest.mock('axios');

const makeFile = (sizeBytes, name = 'clip.mp4') => {
  const content = new Uint8Array(sizeBytes).fill(1);
  return new File([content], name, { type: 'video/mp4' });
};

describe('uploadFileInChunks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads a small file in a single chunk and reports 100% progress', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { uploadId: 'u1', chunkSizeHint: 5 * 1024 * 1024 } })
      .mockResolvedValueOnce({ data: { bytesReceived: 100, expectedSize: 100 } })
      .mockResolvedValueOnce({ data: { _id: 'v1' } });

    const onProgress = jest.fn();
    const result = await uploadFileInChunks(makeFile(100), { sport: 'soccer' }, { onProgress });

    expect(result).toEqual({ _id: 'v1' });
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it('splits a file larger than the chunk size into multiple sequential chunk requests', async () => {
    // chunkSizeHint of 10 bytes against a 25-byte file -> 3 chunks (10, 10, 5).
    axios.post
      .mockResolvedValueOnce({ data: { uploadId: 'u2', chunkSizeHint: 10 } })
      .mockResolvedValueOnce({ data: { bytesReceived: 10, expectedSize: 25 } })
      .mockResolvedValueOnce({ data: { bytesReceived: 20, expectedSize: 25 } })
      .mockResolvedValueOnce({ data: { bytesReceived: 25, expectedSize: 25 } })
      .mockResolvedValueOnce({ data: { _id: 'v2' } });

    const onProgress = jest.fn();
    await uploadFileInChunks(makeFile(25), {}, { onProgress });

    expect(axios.post).toHaveBeenCalledTimes(5); // init + 3 chunks + complete
    const [chunk1Url, chunk1Body] = axios.post.mock.calls[1];
    expect(chunk1Url).toContain('/videos/upload/u2/chunk');
    expect(chunk1Body.size).toBe(10);
    const [, chunk3Body] = axios.post.mock.calls[3];
    expect(chunk3Body.size).toBe(5); // final, smaller remainder chunk

    expect(onProgress).toHaveBeenNthCalledWith(1, 40); // 10/25
    expect(onProgress).toHaveBeenNthCalledWith(2, 80); // 20/25
    expect(onProgress).toHaveBeenNthCalledWith(3, 100); // 25/25
  });

  it('sends the declared metadata and file info in the init request', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { uploadId: 'u3', chunkSizeHint: 1024 } })
      .mockResolvedValueOnce({ data: { bytesReceived: 50, expectedSize: 50 } })
      .mockResolvedValueOnce({ data: { _id: 'v3' } });

    await uploadFileInChunks(makeFile(50, 'highlight.mp4'), { sport: 'hockey', team: 't1' });

    const [, initBody] = axios.post.mock.calls[0];
    expect(initBody).toEqual({
      originalName: 'highlight.mp4',
      fileSize: 50,
      sport: 'hockey',
      team: 't1',
    });
  });

  it('propagates an error from the init request without attempting any chunk uploads', async () => {
    axios.post.mockRejectedValueOnce(new Error('init failed'));

    await expect(uploadFileInChunks(makeFile(10), {})).rejects.toThrow('init failed');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
