import { requireUser, jsonOk, jsonError, readJson } from '../_lib/admin.js';

export const config = { runtime: 'nodejs' } as const;

const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL;
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;

type Payload = { path?: string; url?: string };

/** Extrai o caminho relativo a partir de uma URL pública ou storage URL */
function extractPath(input: string): string | null {
  const cdn = (BUNNY_CDN_URL || '').replace(/\/$/, '');
  const storage = (BUNNY_STORAGE_URL || '').replace(/\/$/, '');

  if (cdn && input.startsWith(cdn + '/')) return input.slice(cdn.length + 1);
  if (storage && input.startsWith(storage + '/')) return input.slice(storage.length + 1);

  // fallback: pegar pathname e remover o primeiro segmento (storage zone)
  try {
    const u = new URL(input);
    const parts = u.pathname.replace(/^\//, '').split('/');
    if (parts.length > 1) return parts.slice(1).join('/');
    return null;
  } catch {
    return null;
  }
}

function isSafePath(p: string): boolean {
  if (!p || p.length > 500) return false;
  if (p.includes('..') || p.includes('\\')) return false;
  if (p.startsWith('/')) return false;
  // Apenas paths dentro de boards/<uuid-ish>/<uuid-ish>/<file>
  return /^boards\/[a-zA-Z0-9_-]{1,64}\/[a-zA-Z0-9_-]{1,64}\/[a-zA-Z0-9_.\-]{1,200}$/.test(p);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed');

  if (!BUNNY_STORAGE_URL || !BUNNY_ACCESS_KEY) {
    return jsonError(500, 'Bunny CDN env vars not configured on server');
  }

  try {
    await requireUser(req);
  } catch (resp) {
    return resp as Response;
  }

  let body: Payload;
  try {
    body = await readJson<Payload>(req);
  } catch (resp) {
    return resp as Response;
  }

  let filePath = body.path;
  if (!filePath && body.url) {
    filePath = extractPath(body.url) || undefined;
  }

  if (!filePath || !isSafePath(filePath)) {
    return jsonError(400, 'Invalid path');
  }

  const url = `${BUNNY_STORAGE_URL.replace(/\/$/, '')}/${filePath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { AccessKey: BUNNY_ACCESS_KEY },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => '');
    return jsonError(502, `Bunny delete failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  return jsonOk({ ok: true });
}
