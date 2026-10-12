#!/usr/bin/env bash
# Sobe o ambiente de desenvolvimento inteiro: Postgres, login/API/arquivos (Supabase local) e o site.
# Uso: dev/subir-tudo.sh   (pode rodar de novo a qualquer hora; o que já está no ar é mantido)
cd "$(dirname "$0")/.."
LOG=${LOG_DIR:-/tmp/soloplan-dev}; mkdir -p "$LOG"
pg_isready -h 127.0.0.1 -q || { service postgresql start >/dev/null 2>&1; sleep 3; }
pg_isready -h 127.0.0.1 -q || { echo "Postgres não subiu"; exit 1; }
[ -f dev/.keys ] || node dev/jwt.mjs "${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}" > dev/.keys
if ! curl -s -o /dev/null http://127.0.0.1:54321/auth/v1/health; then
  pkill -f "dist/start/server.js" 2>/dev/null; pkill -f "dev/proxy.mjs" 2>/dev/null; sleep 1
  dev/supabase-local.sh start > /dev/null 2>&1
fi
if ! curl -s -o /dev/null http://127.0.0.1:3000/entrar; then
  (cd web && nohup npx next dev -p 3000 > "$LOG/next.log" 2>&1 &)
fi
for i in $(seq 1 90); do
  a=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/auth/v1/health)
  r=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/rest/v1/)
  s=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/storage/v1/status)
  w=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/entrar)
  [ "$a$r$w" = "200200200" ] && [ "$s" != "000" ] && [ "$s" != "502" ] && break; sleep 2
done
echo "login=$a api=$r arquivos=$s site=$w"
