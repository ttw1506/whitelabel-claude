// Banco de teste descartável: aplica o "shim" do Supabase e todas as migrações num banco novo.
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const URL_ADMIN = process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const raiz = new URL("..", import.meta.url).pathname;

export async function criarBanco() {
  const nome = `soloplan_teste_${process.pid}_${Date.now()}`;
  const mestre = new pg.Client({ connectionString: URL_ADMIN });
  await mestre.connect();
  await mestre.query(`create database ${nome}`);
  await mestre.end();

  const url = URL_ADMIN.replace(/\/[^/]*$/, `/${nome}`);
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  await db.query(readFileSync(`${raiz}tests/supabase_shim.sql`, "utf8"));
  for (const f of readdirSync(`${raiz}migrations`).sort()) {
    await db.query(readFileSync(`${raiz}migrations/${f}`, "utf8"));
  }

  async function usuario(nomeUsuario, papel, clienteId = null) {
    const id = randomUUID();
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [id, `${id.slice(0, 8)}@teste.local`, { nome: nomeUsuario }]);
    if (papel) await db.query("update perfis set papel = $2, cliente_id = $3 where usuario_id = $1", [id, papel, clienteId]);
    return id;
  }

  // Executa fn como o usuário logado (papel authenticated + JWT com sub), numa transação.
  async function como(usuarioId, fn) {
    await db.query("begin");
    try {
      await db.query(usuarioId ? "set local role authenticated" : "set local role anon");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(usuarioId ? { sub: usuarioId, role: "authenticated" } : {})]);
      const r = await fn((sql, params) => db.query(sql, params));
      await db.query("commit");
      return r;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }

  async function encerrar() {
    await db.end();
    const m = new pg.Client({ connectionString: URL_ADMIN });
    await m.connect();
    await m.query(`drop database if exists ${nome} with (force)`);
    await m.end();
  }

  return { db, usuario, como, encerrar };
}
