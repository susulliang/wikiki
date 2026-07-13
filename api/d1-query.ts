/**
 * Cloudflare D1 query proxy.
 *
 * Executes SQL queries on a Cloudflare D1 database via the D1 REST API.
 * The browser sends SQL + params in the POST body, and credentials via
 * headers (x-cf-account-id, x-cf-d1-token). If env vars are set
 * (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN), those take precedence.
 *
 * Database ID is hardcoded (wikiki database).
 *
 * POST /api/d1-query
 * Headers: x-cf-account-id, x-cf-d1-token
 * Body: { sql: string, params?: (string|null)[] }
 */
import type { IncomingMessage, ServerResponse } from 'http';

const D1_DATABASE_ID = 'df91007d-d0f0-4003-bce4-c3f0078bdbeb';
const D1_API_BASE = 'https://api.cloudflare.com/client/v4';

interface D1QueryBody {
  sql: string;
  params?: (string | number | null)[];
}

interface D1Response {
  result?: Array<{
    results?: Record<string, unknown>[];
    success: boolean;
    meta?: Record<string, unknown>;
  }>;
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: unknown[];
}

/** Send a JSON response with CORS headers. */
function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cf-account-id, x-cf-d1-token');
  res.end(JSON.stringify(data));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, {});
    return;
  }

  // GET → health check (visit /api/d1-query in browser to verify function is live)
  if (req.method === 'GET') {
    sendJSON(res, 200, { ok: true, function: 'd1-query', method: 'GET' });
    return;
  }

  if (req.method !== 'POST') {
    sendJSON(res, 405, { error: 'Method not allowed' });
    return;
  }

  // Collect body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const bodyText = Buffer.concat(chunks).toString();

  let body: D1QueryBody;
  try {
    body = JSON.parse(bodyText);
  } catch {
    sendJSON(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!body.sql) {
    sendJSON(res, 400, { error: 'Missing "sql" in body' });
    return;
  }

  // Credentials: headers take precedence, fall back to env vars
  const accountId =
    (req.headers['x-cf-account-id'] as string | undefined) ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    '';
  const apiToken =
    (req.headers['x-cf-d1-token'] as string | undefined) ||
    process.env.CLOUDFLARE_D1_API_TOKEN ||
    '';

  if (!accountId || !apiToken) {
    sendJSON(res, 401, {
      error:
        'Missing Cloudflare credentials. Provide x-cf-account-id and x-cf-d1-token headers, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_D1_API_TOKEN env vars.',
    });
    return;
  }

  const url = `${D1_API_BASE}/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: body.sql,
        params: body.params ?? [],
      }),
    });

    const data = (await upstream.json()) as D1Response;

    if (!upstream.ok || !data.success) {
      const errMsg = data.errors?.[0]?.message || `HTTP ${upstream.status}`;
      sendJSON(res, upstream.ok ? 502 : upstream.status, { error: errMsg, details: data.errors });
      return;
    }

    // Return the first result set (we only execute single statements)
    const result = data.result?.[0];
    sendJSON(res, 200, {
      results: result?.results ?? [],
      meta: result?.meta ?? {},
      success: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('D1 query proxy error:', message);
    sendJSON(res, 502, { error: message });
  }
}
