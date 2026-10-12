// Etapa 3: isolamento das fotos no armazenamento, pelo caminho real do Supabase (login + Storage + API).
// Precisa do Supabase local rodando (npm run dev:supabase). Uso: node --test tests/integracao/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(SUPABASE, chaves.SERVICE_ROLE_KEY, opcoes);
const SENHA = "teste-123456";
const marca = randomUUID().slice(0, 8);

async function usuario(nome, papel, clienteId = null) {
  const email = `${nome.toLowerCase().replace(/\W+/g, "")}.${marca}@teste.local`;
  const { data, error } = await servico.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { nome } });
  if (error) throw error;
  const r = await servico.from("perfis").update({ papel, cliente_id: clienteId }).eq("usuario_id", data.user.id);
  if (r.error) throw r.error;
  const c = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
  const s = await c.auth.signInWithPassword({ email, password: SENHA });
  if (s.error) throw s.error;
  return c;
}

const jpeg = () => new Blob([Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex")], { type: "image/jpeg" });
let admin, func, cliA, cliB, anonimo, ids = {};

before(async () => {
  admin = await usuario("Admin Teste", "admin");
  func = await usuario("Func Teste", "funcionario");
  const ins = async (tabela, linha) => { const r = await admin.from(tabela).insert(linha).select("id").single(); if (r.error) throw r.error; return r.data.id; };
  ids.cA = await ins("clientes", { nome: `Cliente A ${marca}` });
  ids.cB = await ins("clientes", { nome: `Cliente B ${marca}` });
  ids.fA = await ins("fazendas", { cliente_id: ids.cA, nome: "Fazenda A" });
  ids.sA = await ins("safras", { fazenda_id: ids.fA, ano_agricola: "2026/27", cultura: "Soja" });
  cliA = await usuario("Cliente A", "cliente", ids.cA);
  cliB = await usuario("Cliente B", "cliente", ids.cB);
  anonimo = createClient(SUPABASE, chaves.ANON_KEY, opcoes);

  ids.liberada = `clientes/${ids.cA}/safras/${ids.sA}/${randomUUID()}.jpg`;
  ids.revisao = `clientes/${ids.cA}/safras/${ids.sA}/${randomUUID()}.jpg`;
  for (const caminho of [ids.liberada, ids.revisao]) {
    const up = await func.storage.from("fotos").upload(caminho, jpeg(), { contentType: "image/jpeg" });
    assert.ifError(up.error);
  }
  assert.ifError((await func.from("fotos").insert({ safra_id: ids.sA, estadio: "V3", arquivo_path: ids.liberada })).error);
  assert.ifError((await func.from("fotos").insert({ safra_id: ids.sA, estadio: "V3", arquivo_path: ids.revisao, status: "em_revisao" })).error);
});

test("o produtor baixa a foto liberada da própria safra", async () => {
  const r = await cliA.storage.from("fotos").download(ids.liberada);
  assert.ifError(r.error);
  assert.ok(r.data.size > 0);
});

test("outro produtor não baixa nem lista a foto", async () => {
  assert.ok((await cliB.storage.from("fotos").download(ids.liberada)).error);
  const lista = await cliB.storage.from("fotos").list(`clientes/${ids.cA}/safras/${ids.sA}`);
  assert.deepEqual(lista.data ?? [], []);
});

test("o produtor não vê foto que ainda não foi liberada", async () => {
  assert.ok((await cliA.storage.from("fotos").download(ids.revisao)).error);
});

test("visitante sem login não baixa nada", async () => {
  assert.ok((await anonimo.storage.from("fotos").download(ids.liberada)).error);
});

test("produtor não envia fotos; funcionário envia mas não apaga; admin apaga", async () => {
  const caminho = `clientes/${ids.cA}/safras/${ids.sA}/${randomUUID()}.jpg`;
  assert.ok((await cliA.storage.from("fotos").upload(caminho, jpeg(), { contentType: "image/jpeg" })).error, "cliente não envia");
  assert.ifError((await func.storage.from("fotos").upload(caminho, jpeg(), { contentType: "image/jpeg" })).error);
  const apagouFunc = await func.storage.from("fotos").remove([caminho]);
  assert.equal((apagouFunc.data ?? []).length, 0, "funcionário não apaga");
  const apagouAdmin = await admin.storage.from("fotos").remove([caminho]);
  assert.ifError(apagouAdmin.error);
  assert.equal(apagouAdmin.data.length, 1, "admin apaga");
});

test("o depósito de fotos não é público", async () => {
  const { data } = admin.storage.from("fotos").getPublicUrl(ids.liberada);
  const r = await fetch(data.publicUrl);
  assert.notEqual(r.status, 200);
});
