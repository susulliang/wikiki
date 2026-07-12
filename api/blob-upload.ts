/**
 * Client upload token endpoint.
 *
 * Generates short-lived client tokens for browser-side uploads via the
 * @vercel/blob `upload()` function. The browser calls this endpoint to
 * get a token, then uploads directly to Vercel Blob (bypassing the proxy
 * entirely for uploads).
 *
 * Uses env vars BLOB_READ_WRITE_TOKEN and VERCEL_OIDC_TOKEN (set
 * automatically when a Blob store is linked to the Vercel project).
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob';

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

  // Read request body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const bodyText = Buffer.concat(chunks).toString();

  let body: { type?: string; payload?: { pathname?: string } };
  try {
    body = JSON.parse(bodyText);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  // Only handle token generation requests
  if (body.type !== 'blob.generate-client-token') {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Unsupported event type: ${body.type}` }));
    return;
  }

  const pathname = body.payload?.pathname;
  if (!pathname) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing pathname in payload' }));
    return;
  }

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ clientToken }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Token generation failed:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}
