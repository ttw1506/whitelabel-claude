// Etapa 5: laudo de solo de ponta a ponta (envio do produtor → análise → aprovação → PDF) e PDF do laudo de safra.
// Precisa do site e do Supabase local rodando. Uso: node tests/e2e/etapa5.mjs [pasta-das-capturas]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const SUPABASE = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const QA = process.argv[2] || "qa";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
// fileURLToPath e não .pathname: no Windows o pathname vem como "/C:/..." e vira "C:\C:\...".
const PDF_LAB = fileURLToPath(new URL("./fotos/laboratorio-exemplo.pdf", import.meta.url));
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(SUPABASE, chaves.SERVICE_ROLE_KEY, opcoes);
const marca = randomUUID().slice(0, 6);
const log = (...a) => console.log("✓", ...a);
const erros = [];
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };
const textoPdf = (bytes) => { const f = `${QA}/tmp-${randomUUID()}.pdf`; writeFileSync(f, bytes); return execFileSync("pdftotext", ["-raw", f, "-"]).toString(); };

// Produtor com uma fazenda e um talhão (dados fictícios).
const admin = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
await um(admin.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));
const nomeCliente = `Produtor Solo ${marca}`;
const cliente = await um(admin.from("clientes").insert({ nome: nomeCliente }).select("id").single());
const fazenda = await um(admin.from("fazendas").insert({ cliente_id: cliente.id, nome: "Fazenda Cerrado Alto (exemplo)" }).select("id").single());
await um(admin.from("talhoes").insert({ fazenda_id: fazenda.id, nome: "T3", area_ha: 90 }));
const safra = await um(admin.from("safras").insert({ fazenda_id: fazenda.id, ano_agricola: "2026/27", cultura: "Soja" }).select("id").single());
const emailProdutor = `solo.${marca}@teste.local`;
const conta = await um(servico.auth.admin.createUser({ email: emailProdutor, password: "teste-123456", email_confirm: true, user_metadata: { nome: "Produtor Solo" } }));
await um(servico.from("perfis").update({ papel: "cliente", cliente_id: cliente.id }).eq("usuario_id", conta.user.id));

const navegador = await chromium.launch({ executablePath: CHROME });
async function pagina(largura = 1440, altura = 900) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", acceptDownloads: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(`pageerror ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text()) && erros.push(`console ${m.text()}`));
  return p;
}
async function entrar(p, email) {
  await p.goto(`${APP}/entrar`);
  await p.fill("#email", email);
  await p.fill("#senha", "teste-123456");
  await Promise.all([p.waitForURL((u) => !/^\/(entrar)?$/.test(u.pathname), { waitUntil: "commit", timeout: 60000 }), p.click("button[type=submit]")]);
}

try {
  // 1. Produtor envia o laudo do laboratório.
  const cli = await pagina(375, 812);
  await entrar(cli, emailProdutor);
  await cli.locator("a:visible", { hasText: "Laudos" }).click();
  await cli.waitForURL(/\/cliente\/laudos$/);
  await cli.click("button[aria-expanded]:has-text('Enviar laudo de solo')");
  await cli.click("form[aria-label='Enviar laudo de solo'] button[type=submit]");
  await cli.getByText("Escolha o arquivo do laboratório (PDF ou foto).").waitFor();
  await cli.setInputFiles("#envio-arquivo", PDF_LAB);
  await cli.fill("#envio-mensagem", "Amostra do talhão 3.");
  await cli.click("form[aria-label='Enviar laudo de solo'] button[type=submit]");
  await cli.getByText("Laudo enviado.").waitFor({ timeout: 30000 });
  await cli.getByText("Recebido, aguardando análise").waitFor();
  log("produtor envia o PDF do laboratório (arquivo obrigatório) e vê 'aguardando análise'");

  // 2. Escritório analisa a partir da pendência.
  const a = await pagina();
  await entrar(a, "luciano@soloplan.local");
  const pend = a.locator(".pendencias li", { hasText: nomeCliente });
  await pend.getByText("Laudo de solo enviado").waitFor();
  await pend.getByRole("link", { name: "Analisar" }).click();
  await a.waitForURL(/\/laudos-solo\/novo\?envio=/);
  await a.getByRole("link", { name: "abrir o arquivo" }).waitFor();
  await a.selectOption("#solo-talhao_id", { label: "T3" });
  await a.fill("#solo-data_coleta", "2026-09-15");
  await a.fill("#solo-laboratorio", "Laboratório exemplo");
  const valores = { ph: "4,8", p: "3", k: "60", mg: "0,4", al: "0,5", hal: "5", mo: "2,5", argila: "45" };
  for (const [k, v] of Object.entries(valores)) await a.fill(`#solo-${k}`, v);
  await a.click("button:has-text('Salvar para revisão')");
  await a.getByText("Confira os campos destacados.").waitFor();
  assert.equal(await a.inputValue("#solo-ph"), "4,8", "mantém o que foi digitado");
  await a.fill("#solo-ca", "1,2");
  await a.locator("dl", { hasText: "V%" }).getByText("26,0%").waitFor();
  await a.locator("dl", { hasText: "Calagem" }).getByText("2,03 t/ha").waitFor();
  await a.screenshot({ path: `${QA}/laudo-solo-form-1440.png`, fullPage: true, caret: "initial" });
  await Promise.all([a.waitForURL(/\/laudos-solo\/[0-9a-f-]{36}$/), a.click("button:has-text('Salvar para revisão')")]);
  const urlLaudo = a.url();
  await a.getByText("Em revisão").first().waitFor();
  await a.getByText("Calagem: aplicar 2,03 t/ha de calcário com PRNT 80% para elevar a saturação por bases de 26,0% para 50%.").waitFor();
  await a.getByText("Fósforo (Mehlich-1): 3 mg/dm³, muito baixo para argila de 36 a 60%.").waitFor();
  await a.getByText("Sugestão técnica. A recomendação final é do agrônomo responsável.").first().waitFor();
  log("escritório analisa pelo painel: Ca obrigatório; prévia V% 26,0% e calagem 2,03 t/ha; sugestão de recomendação e aviso");

  // 3. Funcionário não aprova; produtor ainda não vê.
  const f = await pagina();
  await entrar(f, "funcionario@soloplan.local");
  await f.goto(urlLaudo);
  await f.getByText("Aguardando a aprovação de um administrador").waitFor();
  assert.equal(await f.getByRole("button", { name: "Aprovar e enviar ao cliente" }).count(), 0);
  const previa = await f.request.get(`${urlLaudo}/pdf`);
  assert.equal(previa.headers()["content-type"], "application/pdf");
  const tPrevia = textoPdf(await previa.body());
  assert.match(tPrevia, /PRÉVIA/);
  assert.match(tPrevia, /Aguardando aprovação do agrônomo responsável/);
  await cli.reload();
  await cli.getByText("Nenhum laudo de solo ainda").waitFor();
  log("funcionário: sem botão de aprovar; prévia do PDF marcada 'PRÉVIA'; produtor ainda não vê o laudo");

  // 4. Admin aprova e envia; o produtor baixa o PDF.
  await a.getByRole("button", { name: "Aprovar e enviar ao cliente" }).click();
  await a.locator(".selo", { hasText: "Enviado ao cliente" }).waitFor({ timeout: 30000 });
  await a.screenshot({ path: `${QA}/laudo-solo-1440.png`, fullPage: true, caret: "initial" });
  await cli.reload();
  await cli.getByText("Analisado").waitFor();
  const baixar = cli.locator("tr", { hasText: "Fazenda Cerrado Alto" }).getByRole("link", { name: "Baixar PDF" });
  const resp = await cli.request.get(new URL(await baixar.getAttribute("href"), APP).toString());
  assert.equal(resp.status(), 200);
  const t = textoPdf(await resp.body());
  assert.match(t, /Laudo de análise de solo/);
  assert.match(t, new RegExp(nomeCliente));
  assert.match(t, /Calagem: aplicar 2,03 t\/ha/);
  assert.match(t, /Aprovado por Luciano Batata em \d{2}\/\d{2}\/\d{4}/);
  assert.doesNotMatch(t, /PRÉVIA/);
  await cli.screenshot({ path: `${QA}/cliente-laudos-375.png`, fullPage: true, caret: "initial" });
  log("admin aprova e envia: PDF guardado; produtor vê 'Analisado' e baixa o PDF com calagem e assinatura");

  // 5. Outro produtor não baixa este PDF.
  const outro = await um(admin.from("clientes").insert({ nome: `Outro ${marca}` }).select("id").single());
  const emailOutro = `outro.${marca}@teste.local`;
  const contaOutro = await um(servico.auth.admin.createUser({ email: emailOutro, password: "teste-123456", email_confirm: true, user_metadata: { nome: "Outro" } }));
  await um(servico.from("perfis").update({ papel: "cliente", cliente_id: outro.id }).eq("usuario_id", contaOutro.user.id));
  const o = await pagina();
  await entrar(o, emailOutro);
  const idLaudo = urlLaudo.split("/").pop();
  assert.equal((await o.request.get(`${APP}/cliente/laudos/pdf/solo/${idLaudo}`, { maxRedirects: 0 })).status(), 404);
  log("outro produtor recebe 404 ao tentar baixar este laudo");

  // 6. Camada 20–40: gessagem.
  await a.goto(`${APP}/laudos-solo/novo?fazenda=${fazenda.id}`);
  await a.selectOption("#solo-profundidade", "20-40");
  for (const [k, v] of Object.entries({ ph: "4,5", p: "1", k: "20", ca: "0,3", mg: "0,2", al: "0,8", hal: "4", mo: "1,2", argila: "45" })) await a.fill(`#solo-${k}`, v);
  await a.locator("dl", { hasText: "Gessagem" }).getByText("2.250 kg/ha").waitFor();
  await Promise.all([a.waitForURL(/\/laudos-solo\/[0-9a-f-]{36}$/), a.click("button:has-text('Salvar para revisão')")]);
  await a.getByText("Gessagem: aplicar 2.250 kg/ha de gesso agrícola.").waitFor();
  log("camada 20–40 com Ca baixo: gessagem de 2.250 kg/ha");

  // 7. Laudo de safra também vira PDF ao ser enviado.
  await a.goto(`${APP}/safras/${safra.id}`);
  await a.click("button[aria-expanded]:has-text('Escrever laudo')");
  await a.fill("#laudo-texto", "Parecer de exemplo: lavoura em boas condições, seguir monitoramento semanal.");
  await a.click("form[aria-label='Escrever laudo'] button[type=submit]");
  await a.getByText("Laudo salvo para revisão").waitFor();
  await a.reload();
  await a.getByRole("button", { name: "Aprovar e enviar ao cliente" }).click();
  await a.locator("#laudos .selo", { hasText: "Enviado ao cliente" }).waitFor({ timeout: 30000 });
  await cli.reload();
  const linkSafra = cli.locator("section[aria-labelledby='t-safra'] a", { hasText: "Baixar PDF" });
  const rs = await cli.request.get(new URL(await linkSafra.getAttribute("href"), APP).toString());
  assert.match(textoPdf(await rs.body()), /seguir monitoramento semanal/);
  log("laudo de safra enviado gera PDF que o produtor baixa");

  await cli.reload();
  const largura = await cli.evaluate(() => [...document.querySelectorAll(".tabela-rolagem")].every((t) => t.scrollWidth <= t.clientWidth));
  assert.ok(largura, "tabelas de laudos cabem no celular");
  // 8. Telas sem vazar.
  for (const [w, h] of [[375, 812], [1440, 900]]) {
    const q = await pagina(w, h);
    await entrar(q, "luciano@soloplan.local");
    for (const [nome, url] of [["laudo-solo-novo", `/laudos-solo/novo?fazenda=${fazenda.id}`], ["laudo-solo", new URL(urlLaudo).pathname], ["fazenda-solo", `/fazendas/${fazenda.id}`]]) {
      await q.goto(APP + url);
      await q.waitForLoadState("networkidle");
      await q.screenshot({ path: `${QA}/${nome}-${w}.png`, fullPage: true, caret: "initial" });
      const sw = await q.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(sw <= w, `${nome} em ${w}px vaza para o lado (${sw}px)`);
    }
    await q.context().close();
  }
  log("telas de laudo em 375 e 1440 sem vazar");
} catch (falha) {
  for (const [i, pg] of navegador.contexts().flatMap((x) => x.pages()).entries()) await pg.screenshot({ path: `${QA}/falha5-${i}.png`, fullPage: true }).catch(() => {});
  throw falha;
} finally {
  await navegador.close();
}
if (erros.length) { console.error("Erros no navegador:\n" + [...new Set(erros)].join("\n")); process.exit(1); }
console.log("Tudo certo.");
