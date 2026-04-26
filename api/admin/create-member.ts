import { requireAdmin, getAdminClient, jsonOk, jsonError, readJson } from '../../_shared/admin.js';


type Payload = {
  email?: string;
  password?: string;
  full_name?: string;
  whatsapp?: string | null;
  cargo?: string | null;
  role?: 'admin' | 'operacao';
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed');
  }

  try {
    await requireAdmin(req);
  } catch (resp) {
    return resp as Response;
  }

  let body: Payload;
  try {
    body = await readJson<Payload>(req);
  } catch (resp) {
    return resp as Response;
  }

  if (!body.email || !body.password || !body.full_name || !body.role) {
    return jsonError(400, 'email, password, full_name e role são obrigatórios');
  }
  if (body.password.length < 6) {
    return jsonError(400, 'Senha deve ter no mínimo 6 caracteres');
  }
  if (body.role !== 'admin' && body.role !== 'operacao') {
    return jsonError(400, 'role deve ser "admin" ou "operacao"');
  }

  const admin = getAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name },
  });

  if (createErr || !created?.user) {
    return jsonError(400, createErr?.message || 'Falha ao criar usuário');
  }

  // Aguardar trigger handle_new_user criar o profile
  await new Promise((r) => setTimeout(r, 800));

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      full_name: body.full_name,
      whatsapp: body.whatsapp ?? null,
      cargo: body.cargo ?? null,
      role: body.role,
    })
    .eq('id', created.user.id);

  if (updateErr) {
    return jsonError(500, `Usuário criado mas falha ao atualizar profile: ${updateErr.message}`);
  }

  return jsonOk({ user: { id: created.user.id, email: created.user.email } }, 201);
}
