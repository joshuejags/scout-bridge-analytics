import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Fetches a media URL (video/thumbnail served from the protected /uploads
 * route) as an authenticated blob and returns a local object URL suitable
 * for <video src> / <img src>. Native media elements make their own browser
 * request and can't attach an Authorization header, so this is the
 * workaround: fetch via axios (which the global interceptor attaches the
 * token to), then hand the element a blob: URL instead of the real one.
 */
export const useAuthedMedia = (url) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    let objectUrl;
    let cancelled = false;
    setError(null);

    axios
      .get(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { blobUrl, error };
};
