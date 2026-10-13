// Programa da IA: análise de foto (modelo de imagem), explicação do CAR e a trava de dose. Ollama de mentira.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const o = { auth: { persistSession: false, autoRefreshToken: false } };
const adm = createClient("http://127.0.0.1:54321", chaves.ANON_KEY, o);
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };
await um(adm.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));

const chave = "sp_ia_" + randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(chave).digest("hex");
await um(adm.from("chaves_ia").insert({ nome: "worker-visao", hash, prefixo: chave.slice(0, 10) }));

const HEX = "A1B2C3D4E5F60718293A4B5C6D7E8F90";
const cliente = await um(adm.from("clientes").insert({ nome: "Produtor Visão" }).select("id").single());
const fazenda = await um(adm.from("fazendas").insert({ cliente_id: cliente.id, nome: "Faz Visão", uf: "GO", codigo_ibge: "5218508", car_numero: `GO-5218508-${HEX}`, area_total_ha: 1000, area_consolidada_ha: 800, app_ha: 150, reserva_legal_ha: 100 }).select("id").single());
const safra = await um(adm.from("safras").insert({ fazenda_id: fazenda.id, ano_agricola: "2026/27", cultura: "Soja" }).select("id").single());
const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
const novaFoto = async () => {
  const id = crypto.randomUUID(), path = `clientes/${cliente.id}/safras/${safra.id}/${id}.jpg`;
  await um(Promise.resolve(adm.storage.from("fotos").upload(path, jpeg, { contentType: "image/jpeg" })).then((r) => ({ error: r.error })));
  return (await um(adm.from("fotos").insert({ id, safra_id: safra.id, estadio: "V3", arquivo_path: path }).select("id").single())).id;
};
const foto1 = await novaFoto(), foto2 = await novaFoto();
const tarefa = async (tipo, referencia_id) => (await um(adm.from("tarefas_ia").insert({ tipo, referencia_id, cliente_id: cliente.id, max_tentativas: 1 }).select("id").single())).id;
const tFoto = await tarefa("analisar_foto", foto1), tCar = await tarefa("conferir_car", fazenda.id);

// A foto responde nas partes A, B e C (COMO_A_IA_FUNCIONA.md, seção 4); o CAR segue no formato antigo.
const FOTO_BOA = {
  o_que_se_ve: "Folhas com manchas amareladas nas bordas, mais fortes na parte baixa da planta.",
  inconclusivo: false,
  hipoteses: [{ tipo: "doenca", nome: "Mancha foliar", apoia: "Lesões nas bordas das folhas baixeiras.",
    impede_confirmar: "A foto não mostra o verso da folha.", confianca: "baixa",
    motivo_confianca: "O sintoma é inespecífico nesta imagem." }],
  o_que_falta: ["Foto escura", "Não vejo o caule"],
};
let pedidos = [], modo = "bom";
const falso = createServer((req, res) => {
  let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
    const p = JSON.parse(b); pedidos.push(p);
    const resposta = modo === "dose"
      ? JSON.stringify({ ...FOTO_BOA, o_que_se_ve: "Folhas com manchas. Recomendo aplicar 1,5 L/ha de fungicida em toda a área agora." })
      : p.images
        ? JSON.stringify(FOTO_BOA)
        : JSON.stringify({ observacao: "A reserva legal está em 10% da área total, abaixo do mínimo de 20%. Os números de área também somam mais que o total.", incertezas: [] });
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ response: resposta }));
  });
}).listen(0);
await new Promise((r) => falso.once("listening", r));
// fileURLToPath e não .pathname: no Windows o pathname vem como "/C:/..." e vira "C:\C:\...".
const rodar = async () => (await promisify(execFile)("node", [fileURLToPath(new URL("../../ia-local/worker.mjs", import.meta.url)), "--uma-vez"], {
  env: { ...process.env, SOLOPLAN_URL: APP, SOLOPLAN_CHAVE: chave, OLLAMA_URL: `http://127.0.0.1:${falso.address().port}` },
})).stdout;

console.log(await rodar());
const obs = await um(adm.from("observacoes_ia").select("tipo, status, texto, incertezas, foto_id, fazenda_id").in("tipo", ["foto", "car"]).or(`foto_id.eq.${foto1},fazenda_id.eq.${fazenda.id}`));
const f = obs.find((x) => x.tipo === "foto"), c = obs.find((x) => x.tipo === "car");
assert.ok(f && c, "uma observação de foto e uma de CAR");
assert.equal(f.status, "rascunho_ia"); assert.equal(c.status, "rascunho_ia");
assert.deepEqual(f.incertezas, ["Foto escura", "Não vejo o caule"]);
// Partes A, B e C montadas pelo ia-local/foto.mjs, com confiança qualitativa e sem porcentagem.
assert.match(f.texto, /^A\. O que se vê/); assert.match(f.texto, /B\. Hipóteses/); assert.match(f.texto, /C\. O que falta/);
assert.match(f.texto, /Mancha foliar — doença · confiança baixa/);
assert.doesNotMatch(f.texto, /\d\s*%/, "confiança nunca em porcentagem");
assert.match(f.texto, /Não é receituário\.$/);
const pedidoFoto = pedidos.find((p) => p.images), pedidoCar = pedidos.find((p) => !p.images);
assert.equal(pedidoFoto.model, process.env.OLLAMA_MODELO_VISAO || "gemma4:e4b-it-qat", "foto vai para o modelo de visão configurado");
assert.equal(pedidoFoto.format?.properties?.hipoteses?.maxItems, 3, "o esquema limita a 3 hipóteses");
assert.ok(pedidoFoto.images[0].length > 10, "a imagem vai em base64");
assert.match(pedidoFoto.prompt, /Soja/); assert.match(pedidoFoto.prompt, /NÃO cite produto/);
assert.match(pedidoFoto.prompt, /NUNCA use porcentagem/);
assert.match(pedidoCar.prompt, /Reserva legal/i, "o CAR é explicado a partir do que o sistema calculou");
for (const t of [tFoto, tCar]) assert.equal((await um(adm.from("tarefas_ia").select("status").eq("id", t).single())).status, "concluida");
console.log("✓ foto e CAR: observações viram rascunho_ia, a foto vai ao modelo de imagem, o CAR é explicado com o cálculo do sistema");

// O modelo erra e fala em dose: o servidor recusa, nada é gravado e a tarefa falha com o motivo.
const tDose = await tarefa("analisar_foto", foto2); modo = "dose";
console.log(await rodar());
assert.equal((await um(adm.from("observacoes_ia").select("id").eq("foto_id", foto2))).length, 0, "nada gravado");
const t = await um(adm.from("tarefas_ia").select("status, erro").eq("id", tDose).single());
assert.equal(t.status, "falhou"); assert.match(t.erro, /dose|produto|agr[ôo]nomo/i);
console.log("✓ trava de dose: observação com dose é recusada, a tarefa falha e mostra o motivo");

falso.close();
await um(adm.from("chaves_ia").update({ revogada_em: new Date().toISOString() }).eq("hash", hash));
console.log("\nIA com imagem: tudo certo.");
