/**
 * Blob delete endpoint (server-side).
 *
 * Deletes blobs by key using the @vercel/blob SDK's del() function.
 * The SDK uses env vars (BLOB_READ_WRITE_TOKEN) for authentication.
 *
 * POST /api/blob-delete
 * Body: { keys: string[] }
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { del } from '@vercel/blob';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const bodyText = Buffer.concat(chunks).toString();

  let keys: string[] = [];
  try {
    const parsed = JSON.parse(bodyText || '{}');
    keys = Array.isArray(parsed.keys) ? parsed.keys : [];
  } catch {
    keys = [];
  }

  if (keys.length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No keys provided' }));
    return;
  }

  try {
    await del(keys);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Delete failed:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}
