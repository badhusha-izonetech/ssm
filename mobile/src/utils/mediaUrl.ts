import { API_BASE_URL } from '../api/client';

/**
 * Resolves media URLs (MinIO presigned or local uploads) for mobile rendering.
 * If the backend returns a URL pointing to localhost/127.0.0.1, this replaces
 * the host with the actual API server host so physical devices can load the media.
 */
export function resolveMediaUri(url: string | null | undefined): string {
  if (!url) return '';
  if (!url.includes('://')) return url;

  try {
    // Extract the host/IP configured for API_BASE_URL
    const match = API_BASE_URL.match(/^https?:\/\/([^:/]+)/i);
    const apiHost = match ? match[1] : null;

    if (apiHost && (url.includes('localhost:') || url.includes('127.0.0.1:'))) {
      return url
        .replace(/https?:\/\/localhost(:[0-9]+)?/i, (m, port) => `http://${apiHost}${port || ''}`)
        .replace(/https?:\/\/127\.0\.0\.1(:[0-9]+)?/i, (m, port) => `http://${apiHost}${port || ''}`);
    }
  } catch {
    // Fallback to original url on any error
  }

  return url;
}
