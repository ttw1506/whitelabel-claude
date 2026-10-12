// Porta única como no Supabase: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST. Só para desenvolvimento.
import http from "node:http";
const rotas = [["/auth/v1", 9999], ["/rest/v1", 3001]];
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, prefer, range, x-client-info, accept-profile, content-profile, x-supabase-api-version",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range, content-profile",
};
http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const rota = rotas.find(([p]) => req.url.startsWith(p));
  if (!rota) { res.writeHead(404, cors); return res.end("não encontrado"); }
  const up = http.request({ host: "127.0.0.1", port: rota[1], path: req.url.slice(rota[0].length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${rota[1]}` } }, (r) => {
    res.writeHead(r.statusCode, { ...r.headers, ...cors });
    r.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502, cors); res.end(e.message); });
  req.pipe(up);
}).listen(54321, "127.0.0.1", () => console.log("Supabase local em http://127.0.0.1:54321"));
