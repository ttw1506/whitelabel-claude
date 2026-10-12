// Etapa 4: visão do cliente (meus gastos, minhas safras, pedido de laudo), convite de usuário e pendências.
// Precisa do site e do Supabase local rodando. Uso: node tests/e2e/etapa4.mjs [pasta-das-capturas]
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
const servico = createClient(SUPABASE, chaves.SERVICE_ROLE_KEY, opcoes);
const marca = randomUUID().slice(0, 6);
const log = (...a) => console.log("✓", ...a);
const erros = [];
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };

// Um admin "de verdade" lança os dados (o banco carimba aprovação), para os rascunhos serem genuínos.
const admin = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
await um(admin.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));
const emailIa = `ia4.${marca}@teste.local`;
const iaUser = await um(servico.auth.admin.createUser({ email: emailIa, password: "teste-123456", email_confirm: true, user_metadata: { nome: "IA" } }));
await um(servico.from("perfis").update({ papel: "ia" }).eq("usuario_id", iaUser.user.id));
const ia = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
await um(ia.auth.signInWithPassword({ email: emailIa, password: "teste-123456" }));

const nomeC = `Produtor C ${marca}`;
const c = await um(admin.from("clientes").insert({ nome: nomeC }).select("id").single());
const d = await um(admin.from("clientes").insert({ nome: `Produtor D ${marca}` }).select("id").single());
const fc = await um(admin.from("fazendas").insert({ cliente_id: c.id, nome: "Fazenda Esperança (exemplo)" }).select("id").single());
const fd = await um(admin.from("fazendas").insert({ cliente_id: d.id, nome: "Fazenda do Vizinho (exemplo)" }).select("id").single());
const safra = async (fazenda, ano, area, estadio) => um(admin.from("safras").insert({ fazenda_id: fazenda, ano_agricola: ano, cultura: "Soja", area_ha: area, estadio_atual: estadio }).select("id").single());
const s1 = await safra(fc.id, "2025/26", 100, "R8");
const s2 = await safra(fc.id, "2026/27", 200, "V4");
const sd = await safra(fd.id, "2026/27", 50, "V2");
await um(admin.from("custos").insert([
  { safra_id: s1.id, categoria: "sementes", descricao: "Sementes", valor: 10000 },
  { safra_id: s1.id, categoria: "defensivos", descricao: "Fungicida", valor: 5000 },
  { safra_id: s2.id, categoria: "sementes", descricao: "Sementes", valor: 24000 },
  { safra_id: sd.id, categoria: "sementes", descricao: "Do vizinho", valor: 99999 },
]));
await um(ia.from("custos").insert({ safra_id: s2.id, categoria: "outros", descricao: "Rascunho da IA", valor: 7777 }));
await um(ia.from("ocorrencias").insert({ safra_id: s2.id, tipo: "praga", nome: "Lagarta sugerida pela IA" }));
await um(admin.from("ocorrencias").insert({ safra_id: s2.id, tipo: "doenca", nome: "Ferrugem-asiática", severidade: "Focos iniciais" }));
await um(admin.from("laudos_safra").insert({ safra_id: s2.id, tipo: "parcial", conteudo: { texto: "Laudo enviado: lavoura em V4, bom estande." }, status: "enviado_ao_cliente" }));
await um(admin.from("laudos_safra").insert({ safra_id: s2.id, tipo: "final", conteudo: { texto: "Laudo ainda em revisão, não pode aparecer." } }));

const navegador = await chromium.launch({ executablePath: CHROME });
async function pagina(largura = 1440, altura = 900) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(`pageerror ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/fonts\.(googleapis|gstatic)|404 \(Not Found\)/.test(m.text()) && erros.push(`console ${m.text()}`));
  return p;
}
async function entrar(p, email, senha = "teste-123456") {
  await p.goto(`${APP}/entrar`);
  await p.fill("#email", email);
  await p.fill("#senha", senha);
  await Promise.all([p.waitForURL((u) => !/^\/(entrar)?$/.test(u.pathname), { waitUntil: "commit", timeout: 60000 }), p.click("button[type=submit]")]);
}
const texto = (p, sel) => p.locator(sel).textContent();

try {
  // 1. Admin convida o produtor.
  const a = await pagina();
  await entrar(a, "luciano@soloplan.local");
  await a.click("text=Usuários");
  await a.waitForURL(/\/usuarios$/);
  const emailProdutor = `produtor.${marca}@teste.local`;
  await a.fill("#conv-nome", "Produtor Etapa Quatro");
  await a.fill("#conv-email", emailProdutor);
  await a.click("button:has-text('Criar convite')");
  await a.getByText("Escolha de qual produtor é este acesso.").waitFor();
  await a.selectOption("#conv-cliente_id", { label: nomeC });
  await a.click("button:has-text('Criar convite')");
  const link = await a.locator("input[aria-label='Link do convite']").inputValue({ timeout: 30000 });
  assert.match(link, /\/convite\?token_hash=/);
  await a.locator("tr", { hasText: emailProdutor }).getByText("Convite pendente").waitFor();
  log("admin cria convite: produtor obrigatório para acesso de cliente; link gerado; aparece como pendente");

  // 2. O produtor abre o link e cria a senha.
  const cli = await pagina(375, 812);
  await cli.goto(link);
  await cli.fill("#senha", "senha-forte-1");
  await cli.fill("#confirmar", "senha-diferente");
  await cli.click("button[type=submit]");
  await cli.getByText("As duas senhas não são iguais.").waitFor();
  assert.equal(await cli.inputValue("#senha"), "", "por segurança as senhas são apagadas depois do erro");
  await cli.fill("#senha", "senha-forte-1");
  await cli.fill("#confirmar", "senha-forte-1");
  await Promise.all([cli.waitForURL(/\/cliente\/gastos$/, { waitUntil: "commit", timeout: 60000 }), cli.click("button[type=submit]")]);
  await cli.getByRole("heading", { name: "Meus gastos" }).waitFor();
  log("produtor cria a senha pelo link (senhas diferentes recusadas) e entra direto em Meus gastos");

  // 3. Meus gastos: só o que é dele e aprovado.
  const numeros = await cli.locator(".grade .numero strong").allTextContents();
  assert.match(numeros[0], /R\$\s39\.000,00/, "total sem o rascunho da IA e sem o vizinho");
  assert.match(numeros[1], /R\$\s130,00/, "39.000 / 300 ha");
  assert.equal(numeros[2], "2");
  const linhas = await cli.locator("section[aria-labelledby='t-por-safra'] tbody tr").allTextContents();
  assert.match(linhas[0], /Soja 2026\/27.*R\$\s24\.000,00.*R\$\s120,00/);
  assert.match(linhas[1], /Soja 2025\/26.*R\$\s15\.000,00.*R\$\s150,00/);
  assert.equal(await cli.getByText("Do vizinho").count(), 0);
  await cli.screenshot({ path: `${QA}/cliente-gastos-375.png`, fullPage: true, caret: "initial" });
  await cli.selectOption("#f-categoria", "defensivos");
  await cli.click("button:has-text('Filtrar')");
  await cli.waitForURL(/categoria=defensivos/);
  assert.match(await texto(cli, ".grade .numero strong >> nth=0"), /R\$\s5\.000,00/);
  await cli.click("text=Limpar");
  await cli.waitForURL(/\/cliente\/gastos$/);
  assert.equal(await cli.inputValue("#f-categoria"), "", "Limpar volta as listas para Todas");
  await cli.selectOption("#f-safra", { index: 1 });
  await cli.click("button:has-text('Filtrar')");
  await cli.waitForURL(/safra=/);
  assert.match(await texto(cli, ".grade .numero strong >> nth=0"), /R\$\s24\.000,00/);
  log("meus gastos: total R$ 39.000,00 e R$ 130,00/ha só com custos aprovados dele; filtros por categoria e safra");

  // 4. Minhas safras: só o aprovado; pedir laudo parcial.
  await cli.locator("a:visible", { hasText: "Minhas safras" }).click();
  await cli.click("a.cartao:has-text('Soja 2026/27')");
  await cli.getByRole("heading", { name: "Soja 2026/27" }).waitFor();
  await cli.getByText("Ferrugem-asiática").waitFor();
  assert.equal(await cli.getByText("Lagarta sugerida pela IA").count(), 0, "ocorrência em rascunho não aparece");
  await cli.getByText("Laudo enviado: lavoura em V4, bom estande.").waitFor();
  assert.equal(await cli.getByText("Laudo ainda em revisão").count(), 0, "laudo em revisão não aparece");
  assert.equal(await cli.getByRole("button", { name: /Excluir|Aprovar/ }).count(), 0, "produtor não tem botões da equipe");
  await cli.click("button[aria-expanded]:has-text('Pedir laudo parcial')");
  await cli.fill("#pedido-mensagem", "Notei manchas no talhão de baixo.");
  await cli.click("button:has-text('Enviar pedido')");
  await cli.getByText("Pedido enviado.").waitFor();
  await cli.reload();
  await cli.getByText("Laudo parcial pedido · aguardando a Soloplan").waitFor();
  await cli.screenshot({ path: `${QA}/cliente-safra-375.png`, fullPage: true, caret: "initial" });
  log("minha safra: só ocorrência e laudo aprovados; sem botões da equipe; pedido de laudo parcial registrado");

  // 5. O produtor não alcança dados de outro cliente nem as telas do escritório.
  const r = await cli.goto(`${APP}/cliente/safras/${sd.id}`);
  assert.equal(r.status(), 404);
  await cli.goto(`${APP}/painel`);
  await cli.waitForURL(/\/cliente\/gastos$/, { waitUntil: "commit" });
  await cli.goto(`${APP}/safras/${s2.id}`);
  await cli.waitForURL(/\/cliente\/gastos$/, { waitUntil: "commit" });
  log("safra de outro produtor dá 404; telas do escritório redirecionam para a área do produtor");

  // 6. O pedido aparece nas pendências do escritório.
  await a.goto(`${APP}/painel`);
  const pend = a.locator(".pendencias li", { hasText: nomeC });
  await pend.getByText("Pedido de laudo parcial").waitFor();
  await pend.getByText("Notei manchas no talhão de baixo.").waitFor();
  await a.locator(".pendencias li", { hasText: nomeC }).filter({ hasText: "para aprovar" }).getByText("Soja 2026/27 · Fazenda Esperança (exemplo)").waitFor();
  await pend.getByRole("button", { name: "Marcar como atendido" }).click();
  await a.locator(".pendencias li", { hasText: nomeC }).filter({ hasText: "Pedido de laudo parcial" }).waitFor({ state: "detached" });
  await a.goto(`${APP}/usuarios`);
  await a.locator("tr", { hasText: emailProdutor }).locator(".selo", { hasText: "Ativo" }).waitFor();
  log("pedido aparece nas pendências do painel e sai ao marcar como atendido; produtor aparece como Ativo");

  // 7. Funcionário não gerencia usuários.
  const f = await pagina();
  await entrar(f, "funcionario@soloplan.local");
  assert.equal(await f.getByRole("link", { name: "Usuários" }).count(), 0);
  await f.goto(`${APP}/usuarios`);
  await f.waitForURL(/\/painel$/, { waitUntil: "commit" });
  log("funcionário não vê nem abre Usuários");

  // 8. Capturas e largura.
  for (const [w, h] of [[375, 812], [768, 1024], [1440, 900]]) {
    const q = await pagina(w, h);
    await entrar(q, emailProdutor, "senha-forte-1");
    for (const [nome, url] of [["cliente-gastos", "/cliente/gastos"], ["cliente-safras", "/cliente/safras"], ["cliente-safra", `/cliente/safras/${s2.id}`]]) {
      await q.goto(APP + url);
      await q.waitForLoadState("networkidle");
      await q.screenshot({ path: `${QA}/${nome}-${w}.png`, fullPage: true, caret: "initial" });
      const sw = await q.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(sw <= w, `${nome} em ${w}px vaza para o lado (${sw}px)`);
    }
    await q.context().close();
  }
  await a.goto(`${APP}/painel`);
  await a.screenshot({ path: `${QA}/painel-pendencias-1440.png`, fullPage: true, caret: "initial" });
  await a.goto(`${APP}/usuarios`);
  await a.screenshot({ path: `${QA}/usuarios-1440.png`, fullPage: true, caret: "initial" });
  log("telas do produtor em 375, 768 e 1440 sem vazar");
} catch (falha) {
  for (const [i, pg] of navegador.contexts().flatMap((x) => x.pages()).entries()) await pg.screenshot({ path: `${QA}/falha4-${i}.png`, fullPage: true }).catch(() => {});
  throw falha;
} finally {
  await navegador.close();
}
if (erros.length) { console.error("Erros no navegador:\n" + [...new Set(erros)].join("\n")); process.exit(1); }
console.log("Tudo certo.");
