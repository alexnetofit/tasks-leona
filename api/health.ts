export const config = { runtime: 'nodejs' } as const;

/** Endpoint de diagnóstico — confirma se as functions Vercel sobem
 *  e se as env vars críticas estão setadas (sem expor os valores). */
export default async function handler(_req: Request): Promise<Response> {
  const envs = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    BUNNY_STORAGE_URL: !!process.env.BUNNY_STORAGE_URL,
    BUNNY_ACCESS_KEY: !!process.env.BUNNY_ACCESS_KEY,
    BUNNY_CDN_URL: !!process.env.BUNNY_CDN_URL,
  };
  const missing = Object.entries(envs)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return new Response(
    JSON.stringify(
      {
        ok: missing.length === 0,
        runtime: 'nodejs',
        node: process.version,
        envs_present: envs,
        envs_missing: missing,
        time: new Date().toISOString(),
      },
      null,
      2
    ),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
