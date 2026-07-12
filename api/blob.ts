/**
 * Vercel Blob API proxy (direct REST, bypassing SDK store-ID bug).
 *
 * The @vercel/blob SDK's `parseStoreIdFromReadWriteToken` uses
 * `token.split("_")[3]` which breaks on store IDs containing underscores
 * (e.g. `store_N5ZvP5mdd6dJBs7i` → returns `"store"` instead of the full ID).
 * This causes 403 Forbidden on all operations.
 *
 * This proxy reads `BLOB_STORE_ID` and `BLOB_READ_WRITE_TOKEN` from env vars
 * directly (set automatically when a Blob store is linked to the Vercel
 * project) and makes REST calls to the Vercel Blob API server-to-server,
 * bypassing both CORS and the SDK's store-ID parsing bug.
 *
 * Routes:
 *   GET    /api/blob?limit=N           → list blobs
 *   GET    /api/blob?download=<key>    → download blob content
 *   POST   /api/blob?pathname=<key>    → upload blob
 *   POST   /api/blob/delete            → delete blob(s) by key
 */
import type { IncomingMessage, ServerResponse } from 'http';

const BLOB_API_BASE = 'https://vercel.com/api/blob';
const BLOB_API_VERSION = '12';

/** Hop-by-hop headers that must not be forwarded. */
const SKIP_RES_HEADERS = new Set([
  'transfer-encoding',
  'content-length',
  'content-encoding',
  'connection',
]);

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

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!getToken()) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error:
          'BLOB_READ_WRITE_TOKEN env var not set. Link your Blob store to the Vercel project.',
      }),
    );
    return;
  }

  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    if (method === 'GET') {
      await handleGet(res, parsed);
    } else {
      await handlePost(req, res, parsed);
    }
  } catch (e) {
    console.error('Blob proxy error:', e);
    const message = e instanceof Error ? e.message : String(e);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}

async function handleGet(res: ServerResponse, parsed: URL): Promise<void> {
  // List blobs
  if (parsed.searchParams.has('limit')) {
    const limit = Math.max(1, parseInt(parsed.searchParams.get('limit') || '1', 10) || 1);
    const upstream = await fetch(`${BLOB_API_BASE}?limit=${limit}`, {
      method: 'GET',
      headers: blobHeaders(),
    });
    forwardResponse(upstream, res);
    return;
  }

  // Download blob by key — fetch from the public blob URL directly
  const downloadKey = parsed.searchParams.get('download');
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
    forwardResponse(upstream, res);
    return;
  }

  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Missing "limit" or "download" query parameter' }));
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  parsed: URL,
): Promise<void> {
  // Collect request body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);

  // Upload blob
  const pathname = parsed.searchParams.get('pathname');
  if (pathname) {
    const contentType =
      (req.headers['content-type'] as string | undefined) ||
      'application/octet-stream';
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
    forwardResponse(upstream, res);
    return;
  }

  // Delete blob(s) by key — Vercel API expects blob URLs
  if (parsed.pathname.includes('delete')) {
    let keys: string[] = [];
    try {
      const parsedBody = JSON.parse(body.length > 0 ? body.toString() : '{}');
      keys = Array.isArray(parsedBody.keys)
        ? parsedBody.keys
        : Array.isArray(parsedBody.urls)
          ? parsedBody.urls
          : [];
    } catch {
      keys = [];
    }
    const urls = keys.map(blobUrl);
    const upstream = await fetch(`${BLOB_API_BASE}/delete`, {
      method: 'POST',
      headers: blobHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ urls }),
    });
    // 404 on delete is fine (blob already gone)
    if (upstream.status === 404) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
      return;
    }
    forwardResponse(upstream, res);
    return;
  }

  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({ error: 'Missing "pathname" query param or "/delete" path' }),
  );
}

/** Forward an upstream fetch Response to the ServerResponse. */
async function forwardResponse(upstream: Response, res: ServerResponse): Promise<void> {
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (SKIP_RES_HEADERS.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}
