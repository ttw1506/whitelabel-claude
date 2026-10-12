// Etapa 8: o que o app do celular assume sobre o servidor. Reenvio não duplica; foto sobe duas vezes sem erro;
// ocorrência entra antes da foto que aponta para ela. Precisa do Supabase local.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(SUPABASE, chaves.SERVICE_ROLE_KEY, opcoes);
const marca = randomUUID().slice(0, 8);
let func, cliente, ids = {};

async function usuario(nome, papel, clienteId = null) {
  const email = `${nome.toLowerCase().replace(/\W+/g, "")}.${marca}@teste.local`;
  const { data, error } = await servico.auth.admin.createUser({ email, password: "teste-123456", email_confirm: true, user_metadata: { nome } });
  if (error) throw error;
  await servico.from("perfis").update({ papel, cliente_id: clienteId }).eq("usuario_id", data.user.id);
  const c = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
  const s = await c.auth.signInWithPassword({ email, password: "teste-123456" });
  if (s.error) throw s.error;
  return c;
}
const jpeg = () => new Blob([Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex")], { type: "image/jpeg" });

before(async () => {
  const admin = await usuario("Admin Visita", "admin");
  func = await usuario("Func Visita", "funcionario");
  const ins = async (t, l) => { const r = await admin.from(t).insert(l).select("*").single(); if (r.error) throw r.error; return r.data; };
  ids.c = (await ins("clientes", { nome: `Cliente Visita ${marca}` })).id;
  ids.f = (await ins("fazendas", { cliente_id: ids.c, nome: "Faz Visita" })).id;
  ids.s = await ins("safras", { fazenda_id: ids.f, ano_agricola: "2026/27", cultura: "Soja" });
  cliente = await usuario("Cliente Visita", "cliente", ids.c);
});

test("ocorrência enviada duas vezes com o mesmo id: a segunda é 23505 (o app trata como já enviada)", async () => {
  const id = randomUUID();
  const linha = { id, safra_id: ids.s.id, tipo: "praga", nome: "Percevejo", data: "2026-10-12" };
  assert.equal((await func.from("ocorrencias").insert(linha)).error, null);
  const dup = await func.from("ocorrencias").insert(linha);
  assert.equal(dup.error?.code, "23505");
  const { count } = await func.from("ocorrencias").select("id", { count: "exact", head: true }).eq("id", id);
  assert.equal(count, 1);
});

test("foto: sobe duas vezes (upsert), registra com id do aparelho, duplicada vira 23505, e liga à ocorrência", async () => {
  const oc = randomUUID(), foto = randomUUID();
  await func.from("ocorrencias").insert({ id: oc, safra_id: ids.s.id, tipo: "doenca", nome: "Ferrugem", data: "2026-10-12" });
  const caminho = `clientes/${ids.s.cliente_id}/safras/${ids.s.id}/${foto}.jpg`;
  for (let i = 0; i < 2; i++) assert.equal((await func.storage.from("fotos").upload(caminho, jpeg(), { contentType: "image/jpeg", upsert: true })).error, null, `envio ${i + 1}`);
  const linha = { id: foto, safra_id: ids.s.id, ocorrencia_id: oc, estadio: "V3", arquivo_path: caminho, tirada_em: "2026-10-12T12:00:00Z", latitude: -18.44, longitude: -50.45 };
  assert.equal((await func.from("fotos").insert(linha)).error, null);
  assert.equal((await func.from("fotos").insert(linha)).error?.code, "23505");
  const { data } = await func.from("fotos").select("ocorrencia_id, cliente_id").eq("id", foto).single();
  assert.equal(data.ocorrencia_id, oc);
  assert.equal(data.cliente_id, ids.s.cliente_id, "cliente herdado da safra");
});

test("produtor não consegue registrar visita pelo app (recusa definitiva, sem repetir)", async () => {
  const r = await cliente.from("ocorrencias").insert({ id: randomUUID(), safra_id: ids.s.id, tipo: "praga", nome: "x", data: "2026-10-12" });
  assert.ok(r.error);
  assert.ok([401, 403].includes(r.status), `status ${r.status}`);
  const up = await cliente.storage.from("fotos").upload(`clientes/${ids.c}/safras/${ids.s.id}/${randomUUID()}.jpg`, jpeg(), { contentType: "image/jpeg" });
  assert.ok(up.error);
});
