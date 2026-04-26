import { requireUser, jsonOk, jsonError } from '../_lib/admin.js';

export const config = {
  runtime: 'nodejs',
  // Em hobby plan o limite real é ~4.5MB; ajustamos pra 4MB pra ter folga
  maxDuration: 30,
} as const;

const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL;
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
]);

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

function sanitizeIdSegment(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // só aceita UUIDs ou strings safe (alfanum + - _)
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) return null;
  return value;
}

function pickExtension(filename: string | undefined, mime: string): string {
  const fromName = (filename || '').split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
  };
  return map[mime] || 'bin';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed');

  if (!BUNNY_STORAGE_URL || !BUNNY_ACCESS_KEY || !BUNNY_CDN_URL) {
    return jsonError(500, 'Bunny CDN env vars not configured on server');
  }

  try {
    await requireUser(req);
  } catch (resp) {
    return resp as Response;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, 'Expected multipart/form-data body');
  }

  const file = form.get('file');
  const boardId = sanitizeIdSegment(form.get('boardId'));
  const taskId = sanitizeIdSegment(form.get('taskId'));

  if (!(file instanceof File)) return jsonError(400, 'file is required');
  if (!boardId) return jsonError(400, 'boardId is required (uuid-like)');
  if (!taskId) return jsonError(400, 'taskId is required (uuid-like)');

  const mime = (file.type || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return jsonError(400, `Unsupported mime type: ${mime}`);
  }
  if (file.size > MAX_BYTES) {
    return jsonError(413, `File too large (max ${MAX_BYTES} bytes)`);
  }

  const ext = pickExtension(file.name, mime);
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `boards/${boardId}/${taskId}/${safeName}`;
  const url = `${BUNNY_STORAGE_URL.replace(/\/$/, '')}/${filePath}`;

  const buf = await file.arrayBuffer();

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_ACCESS_KEY,
      'Content-Type': mime,
    },
    body: buf,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return jsonError(502, `Bunny upload failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const publicUrl = `${BUNNY_CDN_URL.replace(/\/$/, '')}/${filePath}`;
  return jsonOk({ url: publicUrl, path: filePath, size: file.size, mime });
}
