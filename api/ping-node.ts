/** Endpoint estilo Node clássico (req, res) — pra comparar com /api/ping (edge). */
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ pong: true, style: 'node-classic', time: new Date().toISOString() }));
}
