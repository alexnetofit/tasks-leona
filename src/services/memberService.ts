import { supabase } from '@/config/supabase';
import type { Profile } from '@/types';

/** Buscar todos os membros */
export async function getMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data || []) as Profile[];
}

/** Buscar apenas membros ativos */
export async function getActiveMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data || []) as Profile[];
}

/** Helper: faz fetch nas APIs admin server-side, autenticado com o JWT atual */
async function callAdminApi<T = any>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Você precisa estar autenticado.');
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Erro ${res.status}`);
  }
  return json as T;
}

/** Criar novo membro — chama a Vercel Function /api/admin/create-member */
export async function createMember(member: {
  email: string;
  password: string;
  full_name: string;
  whatsapp?: string;
  cargo?: string;
  role: 'admin' | 'operacao';
}) {
  const result = await callAdminApi<{ user: { id: string; email: string } }>(
    '/api/admin/create-member',
    member
  );
  return result.user;
}

/** Atualizar dados do membro */
export async function updateMember(id: string, updates: Partial<Profile>) {
  const cleanPayload = { ...updates };
  delete (cleanPayload as any).id;
  delete (cleanPayload as any).email;
  delete (cleanPayload as any).created_at;

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...cleanPayload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

/** Desativar membro (soft-delete) */
export async function deactivateMember(id: string) {
  return updateMember(id, { is_active: false });
}

/** Reativar membro */
export async function reactivateMember(id: string) {
  return updateMember(id, { is_active: true });
}

/** Alterar senha do membro (Admin) — chama a Vercel Function /api/admin/update-password */
export async function updateMemberPassword(userId: string, newPassword: string) {
  if (newPassword.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }
  const result = await callAdminApi<{ user: { id: string; email: string } }>(
    '/api/admin/update-password',
    { user_id: userId, new_password: newPassword }
  );
  return result.user;
}
