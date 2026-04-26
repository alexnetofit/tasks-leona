import { supabase } from '@/config/supabase';

/** Helper: pega o JWT da sessão atual */
async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Você precisa estar autenticado.');
  return `Bearer ${session.access_token}`;
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

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: { authorization: auth },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Upload falhou (${res.status})`);
  return json.url as string;
}

/** Delete via Vercel Function */
async function deleteViaApi(fileUrl: string): Promise<void> {
  const auth = await getAuthHeader();
  const res = await fetch('/api/storage/delete', {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ url: fileUrl }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    console.warn('[storageService] delete falhou:', json?.error || res.status);
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
