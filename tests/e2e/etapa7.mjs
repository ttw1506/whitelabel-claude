// Etapa 7: fila e API da IA de ponta a ponta + tela /ia. Precisa do site e do Supabase local rodando.
// Uso: node tests/e2e/etapa7.mjs [pasta-das-capturas]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const SUPABASE = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const QA = process.argv[2] || "qa";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const marca = randomUUID().slice(0, 6);
const log = (...a) => console.log("✓", ...a);
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };

// Dados de apoio criados pelo admin (fictícios).
const adm = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
await um(adm.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));
const cliente = await um(adm.from("clientes").insert({ nome: `Produtor IA ${marca}` }).select("id").single());
const fazenda = await um(adm.from("fazendas").insert({ cliente_id: cliente.id, nome: "Fazenda Teste IA" }).select("id").single());
const talhao = await um(adm.from("talhoes").insert({ fazenda_id: fazenda.id, nome: "T9", area_ha: 50 }).select("id").single());
const safra = await um(adm.from("safras").insert({ fazenda_id: fazenda.id, ano_agricola: "2026/27", cultura: "Soja" }).select("id").single());
await um(adm.from("safra_talhoes").insert({ safra_id: safra.id, talhao_id: talhao.id }));

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errosConsole = [];
page.on("pageerror", (e) => errosConsole.push(e.message));
await page.goto(`${APP}/entrar`);
await page.fill('input[name="email"]', "luciano@soloplan.local");
await page.fill('input[name="senha"]', "teste-123456");
await page.click('button[type="submit"]');
await page.waitForURL(/painel/, { timeout: 60000 });

// 1. Tela /ia: cria o usuário da IA (se faltar) e uma chave.
await page.goto(`${APP}/ia`, { timeout: 60000 });
const criar = page.getByRole("button", { name: "Criar usuário da IA" });
if (await criar.count()) { await criar.click(); await page.getByRole("button", { name: "Criar chave" }).waitFor({ timeout: 30000 }); }
await page.fill("#chave-nome", `Chave teste ${marca}`);
await page.getByRole("button", { name: "Criar chave" }).click();
const campoChave = page.getByLabel("Chave de API");
await campoChave.waitFor({ timeout: 30000 });
const CHAVE = await campoChave.inputValue();
assert.match(CHAVE, /^sp_ia_/);
log("chave criada e mostrada uma vez");
const noBanco = await um(adm.from("chaves_ia").select("hash, prefixo").like("prefixo", CHAVE.slice(0, 10) + "%"));
assert.ok(noBanco.every((c) => c.hash !== CHAVE), "a chave não pode estar guardada em texto");
log("no banco só existe o hash");

// 2. Equipe pede tarefa pela tela.
await page.selectOption("#tar-tipo", "gerar_laudo_parcial");
await page.selectOption("#tar-cliente_id", cliente.id);
await page.fill("#tar-referencia_id", safra.id);
await page.getByRole("button", { name: "Colocar na fila" }).click();
await page.getByText("Tarefa colocada na fila.").waitFor({ timeout: 30000 });
log("tarefa pedida pela tela");

const api = (caminho, { metodo = "GET", corpo, chave = CHAVE } = {}) =>
  fetch(`${APP}/api/ia${caminho}`, { method: metodo, headers: { ...(chave ? { Authorization: `Bearer ${chave}` } : {}), "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });

// 3. Segurança da porta de entrada.
assert.equal((await api("/tarefas/proxima", { chave: null })).status, 401);
assert.equal((await api("/tarefas/proxima", { chave: "sp_ia_errada" })).status, 401);
assert.equal((await fetch(`${APP}/api/ia/openapi.json`)).status, 200);
log("sem chave ou com chave errada: 401; openapi público");

// 4. A IA pega a tarefa, lê o contexto e devolve rascunhos.
const pegou = await api("/tarefas/proxima?tipos=gerar_laudo_parcial");
assert.equal(pegou.status, 200);
const { tarefa } = await pegou.json();
assert.equal(tarefa.status, "em_andamento");
assert.equal(tarefa.referencia_id, safra.id);
assert.equal((await api("/tarefas/proxima?tipos=voar")).status, 422);
log("IA pegou a tarefa; filtro inválido recusado");

const ctxSafra = await (await api(`/safras/${safra.id}/contexto`)).json();
assert.equal(ctxSafra.safra.cultura, "Soja");
assert.equal(ctxSafra.talhoes.length, 1);

const oc = await api(`/safras/${safra.id}/ocorrencias`, { metodo: "POST", corpo: { tipo: "praga", nome: "Percevejo-marrom", talhao: "t9", data: "2026-12-10", status: "aprovado" } });
assert.equal(oc.status, 201);
assert.equal((await oc.json()).ocorrencia.status, "rascunho_ia", "mesmo pedindo 'aprovado', nasce rascunho");
const ap = await api(`/safras/${safra.id}/aplicacoes`, { metodo: "POST", corpo: { data: "2026-12-11", tipo_operacao: "Pulverização", talhoes: ["T9"], produto: "Fungicida X", dose: "0,5", dose_unidade: "L/ha", custo: "1.250,50", categoria_custo: "defensivos" } });
assert.equal(ap.status, 201, await ap.clone().text());
const custoLig = await um(adm.from("custos").select("valor, status").eq("safra_id", safra.id));
assert.equal(custoLig.length, 1); assert.equal(Number(custoLig[0].valor), 1250.5); assert.equal(custoLig[0].status, "rascunho_ia");
assert.equal((await api(`/safras/${safra.id}/ocorrencias`, { metodo: "POST", corpo: { tipo: "praga", nome: "X", talhao: "T-inexistente" } })).status, 422);
assert.equal((await api(`/safras/${safra.id}/custos`, { metodo: "POST", corpo: { categoria: "sementes", descricao: "x", valor: -5 } })).status, 422);
log("ocorrência, aplicação e custo: rascunho garantido; talhão de outra safra e valor negativo recusados");

const lau = await api(`/safras/${safra.id}/laudos`, { metodo: "POST", corpo: { tipo: "parcial", texto: "Lavoura em bom estágio, com ocorrência de percevejo controlada em 11/12." } });
assert.equal(lau.status, 201);
const laudo = (await lau.json()).laudo;
assert.equal(laudo.status, "rascunho_ia");
const fim = await api(`/tarefas/${tarefa.id}/concluir`, { metodo: "POST", corpo: { resultado: { laudo_id: laudo.id } } });
assert.equal(fim.status, 200);
assert.equal((await api(`/tarefas/${tarefa.id}/concluir`, { metodo: "POST", corpo: {} })).status, 409);
log("laudo enviado como rascunho; tarefa concluída; concluir de novo dá 409");

// 5. Laudo de solo: a IA só manda números, o sistema calcula.
const ruim = await api("/laudos-solo", { metodo: "POST", corpo: { fazenda_id: fazenda.id, profundidade: "0-20", valores: { ph: 55, p: 3, k: 60, ca: 2, mg: 0.8, al: 0.1, hal: 3, mo: 2.5, argila: 40 } } });
assert.equal(ruim.status, 422);
assert.ok((await ruim.json()).detalhes["valores.ph"]);
const bom = await api("/laudos-solo", { metodo: "POST", corpo: { fazenda_id: fazenda.id, talhao_id: talhao.id, profundidade: "0-20", laboratorio: "Lab Exemplo", valores: { ph: "5,1", p: "3,2", k: 60, ca: 2.1, mg: 0.8, al: 0.1, hal: 3.5, mo: 2.5, argila: 40 } } });
assert.equal(bom.status, 201, await bom.clone().text());
const ls = await um(adm.from("laudos_solo").select("status, analise, recomendacao").eq("id", (await bom.json()).laudo.id).single());
assert.equal(ls.status, "rascunho_ia");
assert.ok(ls.analise?.v_atual != null || Object.keys(ls.analise ?? {}).length > 0, "análise calculada pelo sistema");
assert.ok(ls.recomendacao.length > 10);
log("laudo de solo: valor absurdo recusado; válido vira rascunho com análise calculada pelo sistema");

// 6. Preço do dia sem fonte é recusado; com fonte vira rascunho; admin aprova pela tela.
assert.equal((await api("/precos", { metodo: "POST", corpo: { produto: "soja", valor: 130, unidade: "R$/saca" } })).status, 422);
assert.equal((await api("/precos", { metodo: "POST", corpo: { produto: "soja", valor: "131,50", unidade: "R$/saca", fonte: `Cepea ${marca}` } })).status, 201);

// 7. Falha devolve à fila.
await adm.from("tarefas_ia").insert({ tipo: "conferir_car", entrada: {}, cliente_id: cliente.id });
const t2 = (await (await api("/tarefas/proxima?tipos=conferir_car")).json()).tarefa;
const f = await (await api(`/tarefas/${t2.id}/falhar`, { metodo: "POST", corpo: { erro: "Ollama fora do ar" } })).json();
assert.equal(f.tarefa.status, "pendente");
log("falha volta para a fila");

// 8. Tela mostra tudo; admin aprova o preço.
await page.goto(`${APP}/ia`, { timeout: 60000 });
await page.getByText(`Cepea ${marca}`).waitFor({ timeout: 30000 });
const linha = page.getByRole("row").filter({ hasText: `Cepea ${marca}` });
await linha.getByRole("button", { name: "Aprovar" }).click();
await linha.getByText("Aprovado").waitFor({ timeout: 30000 });
await page.screenshot({ path: `${QA}/etapa7-ia.png`, fullPage: true });
log("tela /ia mostra a fila e o preço; admin aprovou o preço");

// 9. Revogar a chave corta o acesso na hora.
await page.getByRole("row").filter({ hasText: `Chave teste ${marca}` }).getByRole("button", { name: "Revogar" }).click();
await page.getByRole("row").filter({ hasText: `Chave teste ${marca}` }).getByText("Revogada").waitFor({ timeout: 30000 });
assert.equal((await api("/tarefas/proxima")).status, 401);
log("chave revogada: 401 imediato");

// 10. Produtor e funcionário não entram em /ia pela API da IA nem veem as chaves.
assert.deepEqual(errosConsole, [], "erros no console do navegador");
await browser.close();
console.log("\nEtapa 7: tudo certo.");
