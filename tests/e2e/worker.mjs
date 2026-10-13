// Worker da IA com um "Ollama" de mentira: confere que o laudo volta como rascunho e a tarefa conclui.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const SUPABASE = "http://127.0.0.1:54321";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const o = { auth: { persistSession: false, autoRefreshToken: false } };
const adm = createClient(SUPABASE, chaves.ANON_KEY, o);
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };
await um(adm.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));

// chave de teste criada direto no banco (hash sha256)
const { gerarChave } = await import("node:crypto").then(({ createHash, randomBytes }) => ({
  gerarChave: () => { const chave = "sp_ia_" + randomBytes(32).toString("base64url"); return { chave, hash: createHash("sha256").update(chave).digest("hex") }; },
}));
const { chave, hash } = gerarChave();
await um(adm.from("chaves_ia").insert({ nome: "worker-teste", hash, prefixo: chave.slice(0, 10) }));

const cliente = await um(adm.from("clientes").insert({ nome: "Produtor Worker" }).select("id").single());
const fazenda = await um(adm.from("fazendas").insert({ cliente_id: cliente.id, nome: "Faz Worker" }).select("id").single());
const safra = await um(adm.from("safras").insert({ fazenda_id: fazenda.id, ano_agricola: "2026/27", cultura: "Milho" }).select("id").single());
const t = await um(adm.from("tarefas_ia").insert({ tipo: "gerar_laudo_final", cliente_id: cliente.id, referencia_id: safra.id }).select("id").single());
const t2 = await um(adm.from("tarefas_ia").insert({ tipo: "extrair_laudo_solo", cliente_id: cliente.id }).select("id").single());

let prompt = "";
const falso = createServer((req, res) => {
  let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { prompt = JSON.parse(b).prompt; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ response: "Laudo final de teste: lavoura em boa condição. Sugestão técnica. A recomendação final é do agrônomo responsável." })); });
}).listen(0);
await new Promise((r) => falso.once("listening", r));
// fileURLToPath e não .pathname: no Windows o pathname vem como "/C:/..." e vira "C:\C:\...".
const saida = (await promisify(execFile)("node", [fileURLToPath(new URL("../../ia-local/worker.mjs", import.meta.url)), "--uma-vez"], {
  env: { ...process.env, SOLOPLAN_URL: APP, SOLOPLAN_CHAVE: chave, OLLAMA_URL: `http://127.0.0.1:${falso.address().port}` },
})).stdout;
falso.close();
console.log(saida);

assert.match(prompt, /Milho 2026\/27/);
const laudos = await um(adm.from("laudos_safra").select("tipo, status, conteudo").eq("safra_id", safra.id));
assert.equal(laudos.length, 1); assert.equal(laudos[0].status, "rascunho_ia"); assert.equal(laudos[0].tipo, "final");
assert.equal((await um(adm.from("tarefas_ia").select("status").eq("id", t.id).single())).status, "concluida");
// a tarefa de ler laudo de solo não é do tipo que o worker pega: continua na fila
assert.equal((await um(adm.from("tarefas_ia").select("status").eq("id", t2.id).single())).status, "pendente");
await um(adm.from("chaves_ia").update({ revogada_em: new Date().toISOString() }).eq("hash", hash));
console.log("✓ worker: laudo final voltou como rascunho_ia e a tarefa foi concluída; tarefa de tipo que o programa ainda não faz ficou na fila");
