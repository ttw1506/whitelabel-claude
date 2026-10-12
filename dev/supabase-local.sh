#!/usr/bin/env bash
# Supabase local sem Docker: Postgres + GoTrue (login) + PostgREST (API) + proxy.
# Uso: dev/supabase-local.sh reset   (recria o banco e aplica as migrações)
#      dev/supabase-local.sh start   (sobe os serviços)
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=${SUPABASE_BIN:-/home/user/tools/sb}
PG=${PG_ADMIN_URL:-postgres://postgres:postgres@127.0.0.1:5432}
DB=soloplan_dev
SEGREDO=${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}
LOG=${LOG_DIR:-/tmp/soloplan-dev}; mkdir -p "$LOG"
STORAGE_DIR=${STORAGE_DIR:-/home/user/tools/storage-api}   # supabase/storage compilado (serviço de arquivos)
NODE24=${NODE24:-/home/user/tools/node24/bin/node}

iniciar_storage() {
  eval "$(node dev/jwt.mjs "$SEGREDO" | sed 's/^/export /')"
  mkdir -p "$LOG/arquivos"
  : > "$LOG/storage.log"
  (cd "$STORAGE_DIR" && SERVER_HOST=127.0.0.1 SERVER_PORT=5000 SERVER_ADMIN_PORT=5001 IS_MULTITENANT=false TENANT_ID=soloplan REGION=local \
    AUTH_JWT_SECRET="$SEGREDO" AUTH_JWT_ALGORITHM=HS256 ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
    DATABASE_URL="$PG/$DB" DB_INSTALL_ROLES=true DB_SUPER_USER=postgres DB_ANON_ROLE=anon DB_SERVICE_ROLE=service_role DB_AUTHENTICATED_ROLE=authenticated \
    STORAGE_BACKEND=file STORAGE_FILE_BACKEND_PATH="$LOG/arquivos" GLOBAL_S3_BUCKET=soloplan FILE_SIZE_LIMIT=52428800 \
    IMAGE_TRANSFORMATION_ENABLED=false RATE_LIMITER_ENABLED=false NODE_ENV=production \
    nohup "$NODE24" dist/start/server.js >> "$LOG/storage.log" 2>&1 & echo $! > "$LOG/storage.pid")
}

parar_storage() {
  [ -f "$LOG/storage.pid" ] && kill "$(cat "$LOG/storage.pid")" 2>/dev/null; rm -f "$LOG/storage.pid"; sleep 1
}

reset() {
  psql "$PG/postgres" -qc "drop database if exists $DB with (force)" -c "create database $DB"
  psql "$PG/$DB" -q -v ON_ERROR_STOP=1 <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login password 'authenticator' noinherit; end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema if not exists auth;
SQL
  GOTRUE_DB_DRIVER=postgres DATABASE_URL="$PG/$DB?search_path=auth" GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations" \
    API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_SITE_URL=http://127.0.0.1:3000 GOTRUE_JWT_SECRET="$SEGREDO" \
    "$BIN/auth" migrate > "$LOG/auth-migrate.log" 2>&1
  psql "$PG/$DB" -q -v ON_ERROR_STOP=1 -c "grant usage on schema auth to anon, authenticated, service_role" \
    -c "grant execute on all functions in schema auth to anon, authenticated, service_role"
  # O Supabase de verdade já traz o schema storage; aqui o próprio serviço de arquivos o cria na primeira vez.
  if [ -d "$STORAGE_DIR/dist" ]; then
    iniciar_storage
    for i in $(seq 1 60); do grep -q "Started Successfully" "$LOG/storage.log" 2>/dev/null && break; sleep 1; done
    parar_storage
  fi
  for f in supabase/migrations/*.sql; do psql "$PG/$DB" -q -v ON_ERROR_STOP=1 -f "$f"; done
  psql "$PG/$DB" -q -c "grant all on all tables in schema public to service_role" -c "notify pgrst, 'reload schema'"
  echo "Banco $DB pronto."
}

start() {
  GOTRUE_DB_DRIVER=postgres DATABASE_URL="$PG/$DB?search_path=auth" API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
    GOTRUE_SITE_URL=http://127.0.0.1:3000 GOTRUE_JWT_SECRET="$SEGREDO" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
    GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_MAILER_AUTOCONFIRM=true \
    GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false PORT=9999 GOTRUE_API_HOST=127.0.0.1 \
    nohup "$BIN/auth" serve > "$LOG/auth.log" 2>&1 &
  PGRST_DB_URI="postgres://authenticator:authenticator@127.0.0.1:5432/$DB" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
    PGRST_JWT_SECRET="$SEGREDO" PGRST_SERVER_PORT=3001 PGRST_DB_EXTRA_SEARCH_PATH=public \
    nohup "$BIN/postgrest" > "$LOG/rest.log" 2>&1 &
  [ -d "$STORAGE_DIR/dist" ] && iniciar_storage
  nohup node dev/proxy.mjs > "$LOG/proxy.log" 2>&1 &
  sleep 2
  node dev/jwt.mjs "$SEGREDO"
}

"${1:-start}"
