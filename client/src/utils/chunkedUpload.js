import axios from 'axios';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB, overridden by the server's chunkSizeHint if given

/**
 * Uploads a File as a sequence of smaller requests instead of one
 * long-lived multipart POST holding the whole file. A dropped connection
 * only costs the current chunk (init/complete are cheap to retry, and
 * chunk requests are themselves idempotent to re-send), and reverse
 * proxies/load balancers that time out long-idle single requests are no
 * longer a concern once no single request runs longer than one chunk's
 * transfer time.
 *
 * meta: { team, opponentTeam, sport, players } — the owning user is
 * derived server-side from the auth token, not sent by the client.
 * onProgress(percent): called after each chunk finishes uploading
 */
export const uploadFileInChunks = async (file, meta = {}, { onProgress } = {}) => {
  const apiUrl = process.env.REACT_APP_API_URL;

  const initRes = await axios.post(`${apiUrl}/videos/upload/init`, {
    originalName: file.name,
    fileSize: file.size,
    ...meta,
  });
  const { uploadId, chunkSizeHint } = initRes.data;
  const chunkSize = chunkSizeHint || DEFAULT_CHUNK_SIZE;

  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    await axios.post(`${apiUrl}/videos/upload/${uploadId}/chunk`, chunk, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    offset += chunk.size;
    if (onProgress) onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
  }

  const completeRes = await axios.post(`${apiUrl}/videos/upload/${uploadId}/complete`);
  return completeRes.data;
};
