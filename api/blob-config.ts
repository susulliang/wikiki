/**
 * Blob config endpoint.
 *
 * Returns the public blob store ID so the browser can construct
 * direct download URLs: https://<storeId>.public.blob.vercel-storage.com/<key>
 *
 * GET /api/blob-config
 */
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const storeId = process.env.BLOB_STORE_ID || '';
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      storeId,
      configured: Boolean(token),
    }),
  );
}
