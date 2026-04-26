import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL env var is required');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY env var is required');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is required');
}

/** Cliente admin (service role) — só pode ser usado em código server-side */
export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente público — usado para validar o JWT do caller */
function getAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AuthedUser = {
  id: string;
  email: string;
  role: 'admin' | 'operacao';
  full_name: string;
};

/**
 * Garante que o request vem de um usuário autenticado e ativo (qualquer role).
 * Lança Response 401/403 se não for o caso.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw jsonError(401, 'Missing or invalid Authorization header');
  }
  const token = auth.slice(7).trim();
  if (!token) throw jsonError(401, 'Empty bearer token');

  const anon = getAnonClient();
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw jsonError(401, 'Invalid session token');
  }
  const user = userData.user;

  const admin = getAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id,email,role,full_name,is_active')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    throw jsonError(403, 'Profile not found');
  }
  if (!profile.is_active) {
    throw jsonError(403, 'Account is deactivated');
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    full_name: profile.full_name,
  };
}

/**
 * Garante que o request vem de um usuário autenticado COM role=admin.
 */
export async function requireAdmin(req: Request): Promise<AuthedUser> {
  const user = await requireUser(req);
  if (user.role !== 'admin') {
    throw jsonError(403, 'Admin role required');
  }
  return user;
}

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw jsonError(400, 'Invalid JSON body');
  }
}
