import axios from 'axios';
import { apiUrl } from './api';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_PART_CONCURRENCY = 4;

/**
 * Uploads through the Node API in resumable chunks. This remains the
 * development/local-storage path and works when STORAGE_BACKEND != s3.
 */
export const uploadFileInChunks = async (file, meta = {}, { onProgress } = {}) => {
  const initRes = await axios.post(apiUrl('/videos/upload/init'), {
    originalName: file.name,
    fileSize: file.size,
    ...meta,
  });
  const { uploadId, chunkSizeHint } = initRes.data;
  const chunkSize = chunkSizeHint || DEFAULT_CHUNK_SIZE;

  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    await axios.post(apiUrl(`/videos/upload/${uploadId}/chunk`), chunk, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    offset += chunk.size;
    if (onProgress) onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
  }

  const completeRes = await axios.post(apiUrl(`/videos/upload/${uploadId}/complete`));
  return completeRes.data;
};

/**
 * Uploads video parts directly from the browser to S3/R2 using presigned
 * URLs. The Node API only signs the upload and records metadata after S3
 * completes, so large video bytes never pass through Express.
 *
 * Set REACT_APP_DIRECT_S3_UPLOADS=true in the frontend build when the
 * server uses STORAGE_BACKEND=s3.
 */
export const uploadFileDirectToS3 = async (
  file,
  meta = {},
  { onProgress, partConcurrency = DEFAULT_PART_CONCURRENCY } = {}
) => {
  const partSize = DEFAULT_CHUNK_SIZE;
  const partCount = Math.ceil(file.size / partSize);

  const initRes = await axios.post(apiUrl('/videos/upload/presign-multipart/init'), {
    filename: file.name,
    fileSize: file.size,
    partCount,
    contentType: file.type || 'application/octet-stream',
  });

  const { uploadId, key, presignedUrls } = initRes.data;
  if (!uploadId || !key || !Array.isArray(presignedUrls) || presignedUrls.length !== partCount) {
    throw new Error('Server returned an invalid multipart upload session');
  }

  const completedParts = new Array(partCount);
  let completedBytes = 0;
  let nextPart = 0;
  const concurrency = Math.max(1, Math.min(Number(partConcurrency) || 1, partCount));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const uploadPartWithRetry = async (index) => {
    const start = index * partSize;
    const body = file.slice(start, Math.min(start + partSize, file.size));
    let lastError;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await axios.put(presignedUrls[index].url, body, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          transformRequest: [(data) => data],
        });

        const etag = response.headers.etag || response.headers.ETag;
        if (!etag) {
          throw new Error(
            'S3 did not expose the multipart ETag. Enable ETag in the bucket CORS ExposeHeaders setting.'
          );
        }

        return { PartNumber: index + 1, ETag: etag, bytes: body.size };
      } catch (error) {
        lastError = error;
        if (attempt < 2) await sleep(500 * (2 ** attempt));
      }
    }

    throw lastError;
  };

  const abortUpload = async () => {
    try {
      await axios.post(apiUrl(`/videos/upload/presign-multipart/${encodeURIComponent(uploadId)}/abort`));
    } catch (abortError) {
      console.error('[direct-upload] Failed to abort multipart upload:', abortError);
    }
  };

  try {
    const uploadPart = async () => {
      while (true) {
        const index = nextPart++;
        if (index >= partCount) return;

        const result = await uploadPartWithRetry(index);
        completedParts[index] = {
          PartNumber: result.PartNumber,
          ETag: result.ETag,
        };
        completedBytes += result.bytes;
        if (onProgress) {
          onProgress(Math.min(100, Math.round((completedBytes / file.size) * 100)));
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, uploadPart));

    const completeRes = await axios.post(apiUrl('/videos/upload/presign-multipart/complete'), {
      filename: key,
      uploadId,
      fileSize: file.size,
      parts: completedParts,
      ...meta,
    });

    return completeRes.data;
  } catch (error) {
    await abortUpload();
    throw error;
  }
};
export const isDirectS3UploadEnabled =
  process.env.REACT_APP_DIRECT_S3_UPLOADS === 'true';
