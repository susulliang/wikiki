/**
 * Vercel Blob API proxy using the @vercel/blob SDK.
 *
 * The SDK's API endpoint (vercel.com/api/blob) does NOT support browser CORS.
 * This serverless function acts as a same-origin proxy: the browser calls
 * /api/blob (same origin, no CORS), and this function uses the SDK server-side
 * (no CORS restrictions).
 *
 * Credential resolution: the SDK reads VERCEL_OIDC_TOKEN + BLOB_STORE_ID (or
 * BLOB_READ_WRITE_TOKEN) from env vars automatically. These are set when you
 * link a Vercel Blob store to your Vercel project. We intentionally do NOT
 * pass the browser-provided token to the SDK, because the SDK's
 * parseStoreIdFromReadWriteToken uses split("_")[3] which breaks on store IDs
 * containing underscores (e.g. store_N5ZvP5mdd6dJBs7i).
 *
 * Routes handled:
 *   GET    /api/blob?limit=N           → list blobs
 *   GET    /api/blob?download=<key>    → download blob content
 *   POST   /api/blob?pathname=<key>    → upload blob
 *   POST   /api/blob/delete            → delete blob(s) by key
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { put, list, del, get } from '@vercel/blob';

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

  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    if (method === 'GET') {
      await handleGet(req, res, parsed);
    } else {
      await handlePost(req, res, parsed);
    }
  } catch (e) {
    console.error('Blob proxy error:', e);
    const message = e instanceof Error ? e.message : String(e);
    // Map known SDK errors to HTTP status codes
    const status = message.includes('No blob credentials')
      ? 500
      : message.includes('not found')
        ? 404
        : message.includes('access')
          ? 403
          : 500;
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}

async function handleGet(
  _req: IncomingMessage,
  res: ServerResponse,
  parsed: URL,
): Promise<void> {
  // List blobs
  if (parsed.searchParams.has('limit')) {
    const limitStr = parsed.searchParams.get('limit') || '1';
    const limit = Math.max(1, parseInt(limitStr, 10) || 1);
    const result = await list({ limit });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
    return;
  }

  // Download blob by key
  const downloadKey = parsed.searchParams.get('download');
  if (downloadKey) {
    const result = await get(downloadKey, { access: 'public' });
    if (!result) {
      res.statusCode = 404;
      res.end();
      return;
    }
    // Forward useful headers
    const ct = result.blob.contentType;
    if (ct) res.setHeader('Content-Type', ct);
    // Stream the blob content to the response
    const reader = result.stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
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
    const result = await put(pathname, body, {
      access: 'public',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType,
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
    return;
  }

  // Delete blob(s) by key — the SDK accepts pathname directly
  if (parsed.pathname.includes('delete')) {
    let keys: string[] = [];
    try {
      const parsed_body = JSON.parse(body.length > 0 ? body.toString() : '{}');
      keys = Array.isArray(parsed_body.keys)
        ? parsed_body.keys
        : Array.isArray(parsed_body.urls)
          ? parsed_body.urls
          : [];
    } catch {
      keys = [];
    }
    if (keys.length > 0) {
      await del(keys);
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Missing "pathname" query param or "/delete" path' }));
}
