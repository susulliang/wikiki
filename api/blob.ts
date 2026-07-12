/**
 * Vercel Blob API proxy.
 *
 * Reads BLOB_STORE_ID and BLOB_READ_WRITE_TOKEN from env vars (set
 * automatically when a Blob store is linked to the Vercel project) and
 * makes REST calls to the Vercel Blob API server-to-server, bypassing
 * both CORS and the SDK's store-ID parsing bug.
 *
 * Routes (all handled by this single function at /api/blob):
 *   GET    /api/blob?limit=N           → list blobs
 *   GET    /api/blob?download=<key>    → download blob content
 *   POST   /api/blob?pathname=<key>    → upload blob
 *   POST   /api/blob/delete            → delete blob(s) by key
 */
import type { IncomingMessage, ServerResponse } from 'http';

const BLOB_API_BASE = 'https://vercel.com/api/blob';
const BLOB_API_VERSION = '12';

/** Read and normalize the store ID from env (strips `store_` prefix). */
function getStoreId(): string {
  const raw = process.env.BLOB_STORE_ID || '';
  return raw.startsWith('store_') ? raw.slice('store_'.length) : raw;
}

/** Read the read-write token from env. */
function getToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN || '';
}

/** Common headers for Vercel Blob API requests. */
function blobHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    authorization: `Bearer ${getToken()}`,
    'x-vercel-blob-store-id': getStoreId(),
    'x-api-version': BLOB_API_VERSION,
    ...extra,
  };
}

/** Construct the public blob URL for a given key. */
function blobUrl(key: string): string {
  return `https://${getStoreId()}.public.blob.vercel-storage.com/${key}`;
}

/** Hop-by-hop response headers to skip. */
const SKIP_RES_HEADERS = new Set([
  'transfer-encoding',
  'content-length',
  'content-encoding',
  'connection',
]);

async function forwardResponse(upstream: Response, res: ServerResponse): Promise<void> {
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (SKIP_RES_HEADERS.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Check credentials first
  if (!getToken()) {
    json(res, { error: 'BLOB_READ_WRITE_TOKEN env var not set. Link your Blob store to the Vercel project.' }, 500);
    return;
  }

  const method = req.method ?? 'GET';
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    if (method === 'GET') {
      // List blobs
      if (url.searchParams.has('limit')) {
        const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '1', 10) || 1);
        const upstream = await fetch(`${BLOB_API_BASE}?limit=${limit}`, {
          method: 'GET',
          headers: blobHeaders(),
        });
        await forwardResponse(upstream, res);
        return;
      }

      // Download blob by key
      const downloadKey = url.searchParams.get('download');
      if (downloadKey) {
        const upstream = await fetch(blobUrl(downloadKey), {
          method: 'GET',
          headers: { authorization: `Bearer ${getToken()}` },
        });
        if (upstream.status === 404) {
          res.statusCode = 404;
          res.end();
          return;
        }
        await forwardResponse(upstream, res);
        return;
      }

      json(res, { error: 'Missing "limit" or "download" query parameter' }, 400);
      return;
    }

    if (method === 'POST') {
      // Collect request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const body = Buffer.concat(chunks);

      // Upload blob
      const pathname = url.searchParams.get('pathname');
      if (pathname) {
        const contentType = (req.headers['content-type'] as string | undefined) || 'application/octet-stream';
        const upstream = await fetch(`${BLOB_API_BASE}?pathname=${encodeURIComponent(pathname)}`, {
          method: 'POST',
          headers: blobHeaders({
            'x-vercel-blob-access': 'public',
            'x-add-random-suffix': '0',
            'x-allow-overwrite': '1',
            'content-type': contentType,
          }),
          body,
        });
        await forwardResponse(upstream, res);
        return;
      }

      // Delete blob(s) — URL path contains "delete" (e.g. /api/blob/delete)
      if (url.pathname.includes('delete')) {
        let keys: string[] = [];
        try {
          const parsed = JSON.parse(body.length > 0 ? body.toString() : '{}');
          keys = Array.isArray(parsed.keys) ? parsed.keys : Array.isArray(parsed.urls) ? parsed.urls : [];
        } catch {
          keys = [];
        }
        const urls = keys.map(blobUrl);
        const upstream = await fetch(`${BLOB_API_BASE}/delete`, {
          method: 'POST',
          headers: blobHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ urls }),
        });
        if (upstream.status === 404) {
          json(res, { success: true });
          return;
        }
        await forwardResponse(upstream, res);
        return;
      }

      json(res, { error: 'Missing "pathname" query param or "/delete" path' }, 400);
      return;
    }

    json(res, { error: 'Method not allowed' }, 405);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    json(res, { error: message }, 502);
  }
}
