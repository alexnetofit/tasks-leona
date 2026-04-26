import { requireAdmin, getAdminClient, jsonOk, jsonError, readJson } from '../../_shared/admin.js';

export const config = { runtime: 'edge' };

type Payload = {
  user_id?: string;
  new_password?: string;
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

  if (!body.user_id || !body.new_password) {
    return jsonError(400, 'user_id e new_password são obrigatórios');
  }
  if (body.new_password.length < 6) {
    return jsonError(400, 'Senha deve ter no mínimo 6 caracteres');
  }

  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(body.user_id, {
    password: body.new_password,
  });

  if (error) {
    return jsonError(400, error.message);
  }

  return jsonOk({ user: { id: data.user?.id, email: data.user?.email } });
}
