import { supabase, supabaseAdmin } from '@/config/supabase';
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

/** Criar novo membro — usa Admin API para skip de email confirmation */
export async function createMember(member: {
  email: string;
  password: string;
  full_name: string;
  whatsapp?: string;
  cargo?: string;
  role: 'admin' | 'operacao';
}) {
  // Usar supabaseAdmin para criar o user já confirmado (sem email)
  if (!supabaseAdmin) {
    throw new Error('Service role key não configurada. Adicione VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: member.email,
    password: member.password,
    email_confirm: true, // Já confirmado, sem enviar email
    user_metadata: {
      full_name: member.full_name,
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Erro ao criar usuário');

  // Aguardar o trigger handle_new_user criar o profile
  await new Promise((r) => setTimeout(r, 1000));

  // Atualizar campos extras no profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: member.full_name,
      whatsapp: member.whatsapp || null,
      cargo: member.cargo || null,
      role: member.role,
    })
    .eq('id', authData.user.id);

  if (profileError) {
    console.error('[memberService] Erro ao atualizar profile:', profileError);
  }

  return authData.user;
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

/** Alterar senha do membro (Admin) — via service_role key */
export async function updateMemberPassword(userId: string, newPassword: string) {
  if (!supabaseAdmin) {
    throw new Error('Service role key não configurada. Adicione VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (newPassword.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) throw error;
  return data.user;
}
