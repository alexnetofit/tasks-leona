export const config = { runtime: 'edge' };

/** Endpoint mais simples possível pra confirmar que functions sobem.
 *  Não depende de nenhuma env nem import externo. */
export default function handler(_req: Request): Response {
  return new Response(
    JSON.stringify({ pong: true, time: new Date().toISOString() }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
