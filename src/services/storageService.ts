import { supabase } from '@/config/supabase';

/** Upload de imagem para o Supabase Storage */
export async function uploadTaskImage(
  boardId: string,
  taskId: string,
  file: File
): Promise<string> {
  const ext = file.name?.split('.').pop() || 'png';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${boardId}/${taskId}/${fileName}`;

  const { error } = await supabase.storage
    .from('task-attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  // Gerar URL pública
  const { data: urlData } = supabase.storage
    .from('task-attachments')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
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

/** Excluir attachment */
export async function deleteAttachment(id: string, filePath: string) {
  // Remover do storage
  await supabase.storage.from('task-attachments').remove([filePath]);

  // Remover do banco
  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
