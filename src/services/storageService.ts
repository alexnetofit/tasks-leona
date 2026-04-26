import { supabase } from '@/config/supabase';

/** Helper: pega o JWT da sessão atual */
async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Você precisa estar autenticado.');
  return `Bearer ${session.access_token}`;
}

const UPLOAD_TIMEOUT_MS = 45_000;

/** fetch com timeout via AbortController */
async function fetchWithTimeout(input: RequestInfo, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = UPLOAD_TIMEOUT_MS, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Upload de arquivo via Vercel Function — a access key do Bunny fica no servidor */
async function uploadViaApi(
  boardId: string,
  taskId: string,
  file: File | Blob,
  fileName?: string
): Promise<string> {
  const auth = await getAuthHeader();
  const form = new FormData();
  const fileToSend =
    file instanceof File ? file : new File([file], fileName || `paste_${Date.now()}.png`, { type: file.type });
  form.append('file', fileToSend);
  form.append('boardId', boardId);
  form.append('taskId', taskId);

  let res: Response;
  try {
    res = await fetchWithTimeout('/api/storage/upload', {
      method: 'POST',
      headers: { authorization: auth },
      body: form,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Upload demorou demais (timeout). Tente um arquivo menor.');
    }
    throw new Error(`Erro de rede no upload: ${err?.message || 'desconhecido'}`);
  }

  let json: any = null;
  const text = await res.text().catch(() => '');
  try { json = text ? JSON.parse(text) : null; } catch { /* não-JSON */ }

  if (!res.ok) {
    const detail = json?.error || text?.slice(0, 200) || `HTTP ${res.status}`;
    console.error('[storageService] upload falhou:', res.status, detail);
    throw new Error(detail);
  }
  if (!json?.url) {
    throw new Error('Resposta inválida do servidor (sem URL)');
  }
  return json.url as string;
}

/** Delete via Vercel Function */
async function deleteViaApi(fileUrl: string): Promise<void> {
  const auth = await getAuthHeader();
  try {
    const res = await fetchWithTimeout('/api/storage/delete', {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ url: fileUrl }),
      timeoutMs: 15_000,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[storageService] delete falhou:', res.status, text.slice(0, 200));
    }
  } catch (err: any) {
    console.warn('[storageService] delete erro de rede:', err?.message || err);
  }
}

/** Upload de imagem/arquivo */
export async function uploadTaskImage(
  boardId: string,
  taskId: string,
  file: File
): Promise<string> {
  return uploadViaApi(boardId, taskId, file, file.name);
}

/** Upload de imagem de clipboard (paste) */
export async function uploadClipboardImage(
  boardId: string,
  taskId: string,
  blob: Blob
): Promise<string> {
  return uploadViaApi(boardId, taskId, blob, `paste_${Date.now()}.png`);
}

/** Registrar attachment no banco */
export async function registerAttachment(attachment: {
  task_id: string;
  file_url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
}) {
  const { data, error } = await supabase
    .from('task_attachments')
    .insert(attachment)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Excluir attachment (banco + Bunny CDN via API) */
export async function deleteAttachment(id: string, fileUrl: string) {
  await deleteViaApi(fileUrl);

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
