import { supabase } from '@/config/supabase';

const BUNNY_STORAGE_URL = import.meta.env.VITE_BUNNY_STORAGE_URL || 'https://ny.storage.bunnycdn.com/leonastorage';
const BUNNY_ACCESS_KEY = import.meta.env.VITE_BUNNY_ACCESS_KEY || '';
const BUNNY_CDN_URL = import.meta.env.VITE_BUNNY_CDN_URL || 'https://leona-flow.b-cdn.net';

/**
 * Upload de arquivo para o Bunny CDN Storage
 * PUT https://{region}.storage.bunnycdn.com/{storageZoneName}/{path}/{fileName}
 *
 * NOTA: Bunny Storage aceita CORS para PUT de qualquer origem.
 * A Pull Zone deve estar configurada no painel Bunny para servir os arquivos publicamente.
 */
async function uploadToBunny(filePath: string, file: File | Blob): Promise<string> {
  const url = `${BUNNY_STORAGE_URL}/${filePath}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_ACCESS_KEY,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[Bunny] Upload failed: ${response.status} - ${errorText}`);
    throw new Error(`Bunny Upload Error: ${response.status} - ${errorText}`);
  }

  // URL pública via CDN Pull Zone
  return `${BUNNY_CDN_URL}/${filePath}`;
}

/**
 * Deletar arquivo do Bunny CDN Storage
 * DELETE https://{region}.storage.bunnycdn.com/{storageZoneName}/{path}/{fileName}
 */
async function deleteFromBunny(filePath: string): Promise<void> {
  const url = `${BUNNY_STORAGE_URL}/${filePath}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNY_ACCESS_KEY,
      },
    });

    // 404 = arquivo já não existe, consideramos sucesso
    if (!response.ok && response.status !== 404) {
      console.warn(`[Bunny] Falha ao deletar ${filePath}: ${response.status}`);
    }
  } catch (err) {
    console.warn('[Bunny] Erro ao deletar:', err);
  }
}

/**
 * Extrair o path relativo de uma URL pública do Bunny CDN
 * Ex: https://leona-storage.b-cdn.net/boards/123/file.png → boards/123/file.png
 */
function extractBunnyPath(publicUrl: string): string {
  if (publicUrl.startsWith(BUNNY_CDN_URL)) {
    return publicUrl.replace(`${BUNNY_CDN_URL}/`, '');
  }
  if (publicUrl.startsWith(BUNNY_STORAGE_URL)) {
    return publicUrl.replace(`${BUNNY_STORAGE_URL}/`, '');
  }
  // Fallback: pegar tudo depois do hostname
  try {
    const u = new URL(publicUrl);
    return u.pathname.replace(/^\//, '');
  } catch {
    return publicUrl;
  }
}

/** Upload de imagem/arquivo para o Bunny CDN */
export async function uploadTaskImage(
  boardId: string,
  taskId: string,
  file: File
): Promise<string> {
  const ext = file.name?.split('.').pop() || 'png';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `boards/${boardId}/${taskId}/${safeName}`;

  return uploadToBunny(filePath, file);
}

/** Upload de imagem de clipboard (paste) */
export async function uploadClipboardImage(
  boardId: string,
  taskId: string,
  blob: Blob
): Promise<string> {
  const file = new File([blob], `paste_${Date.now()}.png`, { type: blob.type });
  return uploadTaskImage(boardId, taskId, file);
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

/** Excluir attachment (banco + Bunny CDN) */
export async function deleteAttachment(id: string, fileUrl: string) {
  // Remover do Bunny CDN
  const filePath = extractBunnyPath(fileUrl);
  await deleteFromBunny(filePath);

  // Remover do banco
  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
