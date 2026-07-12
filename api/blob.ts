/**
 * Vercel Blob API proxy.
 *
 * The @vercel/blob SDK calls `https://vercel.com/api/blob` which does NOT
 * support CORS — it's designed for server-side use. This serverless function
 * acts as a same-origin proxy: the browser calls `/api/blob` (same origin,
 * no CORS), and this function forwards the request to the Vercel Blob API
 * server-to-server (no CORS restrictions).
 *
 * The browser sends the auth token and store ID via headers; this function
 * is fully transparent — it just forwards everything.
 *
 * Routes handled:
 *   GET    /api/blob?limit=N                    → list blobs
 *   POST   /api/blob?pathname=<key>             → upload blob
 *   POST   /api/blob/delete                     → delete blob
 *   GET    /api/blob?url=<url>                  → head (metadata)
 *   GET    /api/blob?download=<key>             → download blob data (proxied
 *                                                 from blob.vercel-storage.com)
 */
import type { IncomingMessage, ServerResponse } from 'http';

const BLOB_API_BASE = 'https://vercel.com/api/blob';

/** Hop-by-hop headers that must not be forwarded. */
const SKIP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'proxy-connection',
]);

/** Headers that should not be copied from the upstream response. */
const SKIP_RESPONSE_HEADERS = new Set([
  'transfer-encoding',
  'content-length',
  'content-encoding',
  'connection',
]);

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Only allow safe methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Build the full URL from the request
  const reqUrl = req.url || '';
  const parsed = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);

  // Special case: download blob data by key.
  // The browser sends GET /api/blob?download=<key>, and we fetch from the
  // blob storage URL directly (server-side, no CORS).
  const downloadKey = parsed.searchParams.get('download');
  if (downloadKey && req.method === 'GET') {
    await handleDownload(req, res, downloadKey);
    return;
  }

  // For all other requests, forward to the Vercel Blob API.
  // Reconstruct the path: the original URL might be /api/blob/delete or
  // /api/blob?limit=1 or /api/blob/?pathname=...
  let apiPath = parsed.pathname.replace(/^\/api\/blob\/?/, '');
  if (apiPath) {
    // e.g. "/delete"
    apiPath = `/${apiPath}`;
  }
  const targetUrl = `${BLOB_API_BASE}${apiPath}${parsed.search}`;

  // Collect request headers
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (SKIP_HEADERS.has(key.toLowerCase())) continue;
    if (typeof value === 'string') {
      forwardHeaders[key] = value;
    }
  }

  // Collect request body for POST
  let body: Buffer | undefined;
  if (req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    body = Buffer.concat(chunks);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body ?? undefined,
    });

    // Forward status code
    res.statusCode = upstream.status;

    // Forward response headers (excluding hop-by-hop)
    upstream.headers.forEach((value, key) => {
      if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    // Stream the response body
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (e) {
    console.error('Blob proxy error:', e);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Blob proxy error', message: e instanceof Error ? e.message : String(e) }));
  }
}

/**
 * Download blob data by key. Fetches from the blob storage URL directly
 * (server-side), so CORS doesn't apply.
 *
 * The store ID is extracted from the Authorization Bearer token.
 * Token format: vercel_blob_rw_<storeId>_<random>
 */
async function handleDownload(
  req: IncomingMessage,
  res: ServerResponse,
  key: string,
): Promise<void> {
  // Extract store ID from the auth header
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const parts = token.split('_');
  // vercel_blob_rw_<storeId>_<random> → parts[3] = storeId
  const storeId = parts[3] || '';
  if (!storeId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Could not extract store ID from token' }));
    return;
  }

  const blobUrl = `https://${storeId}.public.blob.vercel-storage.com/${key}`;

  try {
    const upstream = await fetch(blobUrl, { method: 'GET' });

    if (upstream.status === 404) {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (!upstream.ok) {
      res.statusCode = upstream.status;
      const text = await upstream.text();
      res.end(text);
      return;
    }

    // Forward content-type and other useful headers
    upstream.headers.forEach((value, key) => {
      if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (e) {
    console.error('Blob download proxy error:', e);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Blob download error', message: e instanceof Error ? e.message : String(e) }));
  }
}
