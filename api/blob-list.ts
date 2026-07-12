/**
 * Blob list endpoint (server-side).
 *
 * Lists blobs using the @vercel/blob SDK's list() function.
 * Used for testConnection() and listing uploaded collections.
 *
 * GET /api/blob-list?limit=N
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { list } from '@vercel/blob';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10) || 100);

  try {
    const result = await list({ limit });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('List failed:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}
