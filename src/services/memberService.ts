import { supabase } from '@/config/supabase';
import type { Profile } from '@/types';

/** Buscar todos os membros ativos */
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

/** Criar novo membro (cria user no Auth + profile) */
export async function createMember(member: {
  email: string;
  password: string;
  full_name: string;
  whatsapp?: string;
  cargo?: string;
  role: 'admin' | 'operacao';
}) {
  // Criar user via service role não disponível no client
  // Usamos signUp normal e depois atualizamos o profile
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: member.email,
    password: member.password,
    options: {
      data: {
        full_name: member.full_name,
      },
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Erro ao criar usuário');

  // O trigger handle_new_user criará o profile automaticamente
  // Mas precisamos atualizar os campos extras
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
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
