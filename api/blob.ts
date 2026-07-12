/**
 * Vercel Blob API proxy (Edge Runtime).
 *
 * Uses the Edge Runtime with standard Web Request/Response API for better
 * ESM support and to avoid Node.js runtime routing issues that caused 405
 * Method Not Allowed on POST requests.
 *
 * Reads BLOB_STORE_ID and BLOB_READ_WRITE_TOKEN from env vars (set
 * automatically when a Blob store is linked to the Vercel project) and
 * makes REST calls to the Vercel Blob API server-to-server.
 *
 * Routes:
 *   GET    /api/blob?limit=N           → list blobs
 *   GET    /api/blob?download=<key>    → download blob content
 *   POST   /api/blob?pathname=<key>    → upload blob
 *   POST   /api/blob/delete            → delete blob(s) by key
 */
export const config = { runtime: 'edge' };

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const method = req.method;

  if (!getToken()) {
    return json(
      {
        error:
          'BLOB_READ_WRITE_TOKEN env var not set. Link your Blob store to the Vercel project.',
      },
      500,
    );
  }

  const url = new URL(req.url);

  try {
    if (method === 'GET') {
      // List blobs
      if (url.searchParams.has('limit')) {
        const limit = Math.max(
          1,
          parseInt(url.searchParams.get('limit') || '1', 10) || 1,
        );
        const upstream = await fetch(`${BLOB_API_BASE}?limit=${limit}`, {
          method: 'GET',
          headers: blobHeaders(),
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }

      // Download blob by key — fetch from the public blob URL directly
      const downloadKey = url.searchParams.get('download');
      if (downloadKey) {
        const upstream = await fetch(blobUrl(downloadKey), {
          method: 'GET',
          headers: { authorization: `Bearer ${getToken()}` },
        });
        if (upstream.status === 404) {
          return new Response(null, { status: 404 });
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }

      return json({ error: 'Missing "limit" or "download" query parameter' }, 400);
    }

    if (method === 'POST') {
      const pathname = url.searchParams.get('pathname');

      // Upload blob
      if (pathname) {
        const contentType =
          req.headers.get('content-type') || 'application/octet-stream';
        const body = await req.arrayBuffer();
        const upstream = await fetch(
          `${BLOB_API_BASE}?pathname=${encodeURIComponent(pathname)}`,
          {
            method: 'POST',
            headers: blobHeaders({
              'x-vercel-blob-access': 'public',
              'x-add-random-suffix': '0',
              'x-allow-overwrite': '1',
              'content-type': contentType,
            }),
            body,
          },
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }

      // Delete blob(s) by key — Vercel API expects blob URLs
      if (url.pathname.includes('delete')) {
        const bodyText = await req.text();
        let keys: string[] = [];
        try {
          const parsed = JSON.parse(bodyText || '{}');
          keys = Array.isArray(parsed.keys)
            ? parsed.keys
            : Array.isArray(parsed.urls)
              ? parsed.urls
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
        if (upstream.status === 404) {
          return json({ success: true });
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }

      return json(
        { error: 'Missing "pathname" query param or "/delete" path' },
        400,
      );
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 502);
  }
}
