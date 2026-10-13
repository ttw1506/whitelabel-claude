// Etapa 3: tela da safra (fotos por estádio, ocorrências, aplicações, custos, laudos), no navegador.
// Precisa do site e do Supabase local rodando. Uso: node tests/e2e/etapa3.mjs [pasta-das-capturas]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const SUPABASE = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const QA = process.argv[2] || "qa";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
// fileURLToPath e não .pathname: no Windows o pathname vem como "/C:/..." e vira "C:\C:\...".
const FOTOS = fileURLToPath(new URL("./fotos/", import.meta.url));
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(SUPABASE, chaves.SERVICE_ROLE_KEY, opcoes);
const marca = randomUUID().slice(0, 6);
const log = (...a) => console.log("✓", ...a);
const erros = [];

// Dados de partida (fictícios): cliente, fazenda, dois talhões e uma safra de soja em V3.
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };
const cliente = await um(servico.from("clientes").insert({ nome: `Produtor Exemplo ${marca}` }).select("id").single());
const fazenda = await um(servico.from("fazendas").insert({ cliente_id: cliente.id, nome: "Fazenda Santa Luzia (exemplo)", area_total_ha: 500 }).select("id").single());
const t1 = await um(servico.from("talhoes").insert({ fazenda_id: fazenda.id, nome: "T1", area_ha: 180 }).select("id").single());
const t2 = await um(servico.from("talhoes").insert({ fazenda_id: fazenda.id, nome: "T2", area_ha: 120 }).select("id").single());
const safra = await um(servico.from("safras").insert({ fazenda_id: fazenda.id, ano_agricola: "2026/27", cultura: "Soja", cultivar: "Cultivar exemplo", area_ha: 300, estadio_atual: "V3", data_plantio: "2026-10-15" }).select("id").single());
await um(servico.from("safra_talhoes").insert([{ safra_id: safra.id, talhao_id: t1.id }, { safra_id: safra.id, talhao_id: t2.id }]));
const URL_SAFRA = `${APP}/safras/${safra.id}`;

// A IA do escritório deixa um custo em rascunho.
const emailIa = `ia.${marca}@teste.local`;
const ia = await um(servico.auth.admin.createUser({ email: emailIa, password: "teste-123456", email_confirm: true, user_metadata: { nome: "IA" } }));
await um(servico.from("perfis").update({ papel: "ia" }).eq("usuario_id", ia.user.id));
const clienteIa = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
await um(clienteIa.auth.signInWithPassword({ email: emailIa, password: "teste-123456" }));
await um(clienteIa.from("custos").insert({ safra_id: safra.id, categoria: "outros", descricao: "Frete sugerido pela IA", valor: 500 }));

const navegador = await chromium.launch({ executablePath: CHROME });
async function pagina(largura = 1440, altura = 900, tema = "light") {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(`pageerror ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text()) && erros.push(`console ${m.text()}`));
  return p;
}
async function entrar(p, email) {
  await p.goto(`${APP}/entrar`);
  await p.fill("#email", email);
  await p.fill("#senha", "teste-123456");
  await Promise.all([p.waitForURL((u) => !/^\/(entrar)?$/.test(u.pathname), { waitUntil: "commit" }), p.click("button[type=submit]")]);
}
const total = (p) => p.locator("#custos tr.total td").nth(1).textContent();

try {
  const p = await pagina();
  await entrar(p, "luciano@soloplan.local");
  await p.goto(URL_SAFRA);
  await p.locator(".estadio[data-situacao='atual'] h3", { hasText: "V3" }).waitFor();
  log("linha do tempo abre com V3 como estádio atual");

  // Fotos: uma com data e GPS na própria foto; outra sem.
  await p.click("button[aria-expanded]:has-text('Enviar fotos')");
  await p.click("form[aria-label='Enviar fotos'] button[type=submit]");
  await p.getByText("Escolha pelo menos uma foto.").waitFor();
  await p.setInputFiles("#campo-arquivos", `${FOTOS}v3-com-gps.jpg`);
  await p.selectOption("#campo-talhao-foto", { label: "T1" });
  await p.fill("#campo-anotacao", "Estande uniforme, sem falhas.");
  await p.click("form[aria-label='Enviar fotos'] button[type=submit]");
  await p.getByText("1 foto registrada.").waitFor({ timeout: 60000 });
  await p.setInputFiles("#campo-arquivos", `${FOTOS}r1-sem-exif.jpg`);
  await p.selectOption("#campo-estadio-foto", "R1");
  await p.click("form[aria-label='Enviar fotos'] button[type=submit]");
  await p.getByText("1 foto registrada.").waitFor({ timeout: 60000 });
  await p.reload();
  const v3 = p.locator(".estadio", { has: p.locator("h3", { hasText: /^V3/ }) });
  await v3.locator("img").waitFor();
  assert.match(await v3.locator(".legenda").textContent(), /^10\/11 · T1$/);
  await p.locator(".estadio", { has: p.locator("h3", { hasText: /^R1/ }) }).locator("img").waitFor();
  log("duas fotos enviadas; cada uma na coluna do seu estádio");

  // A foto leve tem no máximo 1920 px e é menor que o original guardado.
  const { data: fotos } = await servico.from("fotos").select("arquivo_path, original_path, tirada_em, latitude, longitude, autor_id").eq("safra_id", safra.id).eq("estadio", "V3");
  const leve = await um(servico.storage.from("fotos").download(fotos[0].arquivo_path));
  const original = await um(servico.storage.from("fotos").download(fotos[0].original_path));
  assert.ok(leve.size < original.size, `leve ${leve.size} < original ${original.size}`);
  const buf = Buffer.from(await leve.arrayBuffer());
  let i = 2; let dims;
  while (i < buf.length) { const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc2) { dims = [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; break; } i += 2 + len; }
  assert.deepEqual(dims, [1920, 1280]);
  assert.equal(new Date(fotos[0].tirada_em).toISOString(), "2026-11-10T12:30:00.000Z");
  assert.deepEqual([Number(fotos[0].latitude), Number(fotos[0].longitude)], [-18.4478, -50.4512]);
  assert.ok(fotos[0].autor_id);
  log(`foto comprimida para 1920×1280 (${Math.round(leve.size / 1024)} KB; original ${Math.round(original.size / 1024)} KB); data e GPS lidos da foto`);

  await v3.locator("button.miniatura").click();
  const dlg = p.locator("dialog.foto-dialogo");
  await dlg.getByText("10/11/2026, 09:30").waitFor();
  await dlg.getByText("-18.447800, -50.451200").waitFor();
  await dlg.getByText("Estande uniforme, sem falhas.").waitFor();
  await dlg.getByText("Luciano Batata").waitFor();
  assert.equal(await dlg.getByRole("link", { name: "Abrir original" }).count(), 1);
  await p.screenshot({ path: `${QA}/safra-foto-aberta-1440.png`, caret: "initial" });
  await p.keyboard.press("Escape");
  await dlg.waitFor({ state: "hidden" });
  log("foto aberta mostra data, GPS, talhão, autor e anotação; Esc fecha");

  // Ocorrência
  await p.click("button[aria-expanded]:has-text('Registrar ocorrência')");
  const fo = p.locator("form[aria-label='Registrar ocorrência']");
  await fo.locator("button[type=submit]").click();
  await fo.getByText("Escolha o tipo.").waitFor();
  await fo.locator("#ocorr-tipo").selectOption("praga");
  await fo.locator("#ocorr-nome").fill("Percevejo-marrom");
  await fo.locator("#ocorr-severidade").fill("2 percevejos por metro de pano");
  await fo.locator("#ocorr-talhao_id").selectOption({ label: "T2" });
  await fo.locator("button[type=submit]").click();
  await p.locator("#ocorrencias td", { hasText: "Percevejo-marrom" }).waitFor();
  log("ocorrência: tipo obrigatório; registrada com talhão e severidade");

  // Aplicação com custo → entra nos custos.
  await p.click("button[aria-expanded]:has-text('Lançar aplicação')");
  const fa = p.locator("form[aria-label='Lançar aplicação']");
  await fa.locator("#aplic-tipo_operacao").selectOption("Pulverização");
  await fa.locator("#aplic-produto").fill("Fungicida exemplo");
  await fa.locator("#aplic-dose").fill("0,5");
  await fa.locator("button[type=submit]").click();
  await fa.getByText("Informe a unidade da dose.").waitFor();
  await fa.locator("#aplic-dose_unidade").selectOption("L/ha");
  await fa.locator("#aplic-custo").fill("1.250,00");
  await fa.locator("button[type=submit]").click();
  await p.locator("#aplicacoes td", { hasText: "Pulverização" }).waitFor();
  assert.match(await p.locator("#aplicacoes tbody tr").first().textContent(), /0,5 L\/ha.*T1, T2.*300,00 ha.*R\$\s1\.250,00/);
  await p.locator("#custos td", { hasText: "da aplicação" }).waitFor();
  assert.match(await total(p), /R\$\s1\.250,00/);
  log("aplicação: dose pede unidade; custo da aplicação entra nos custos (R$ 1.250,00)");

  // Custo manual; total e R$/ha.
  await p.click("button[aria-expanded]:has-text('Lançar custo')");
  const fc = p.locator("form[aria-label='Lançar custo']");
  await fc.locator("#custo-categoria").selectOption("sementes");
  await fc.locator("#custo-descricao").fill("Sementes tratadas");
  await fc.locator("#custo-valor").fill("abc");
  await fc.locator("button[type=submit]").click();
  await fc.getByText("Use só números, com vírgula para decimais.").waitFor();
  await fc.locator("#custo-valor").fill("3.000");
  await fc.locator("button[type=submit]").click();
  await p.locator("#custos td", { hasText: "Sementes tratadas" }).waitFor();
  await p.waitForFunction(() => /4\.250,00/.test(document.querySelector("#custos tr.total")?.textContent ?? ""));
  assert.match(await p.locator("#custos tr.total").textContent(), /R\$\s4\.250,00.*R\$\s14,17/);
  log("custo manual: valor validado; total R$ 4.250,00 e R$ 14,17/ha");

  // Rascunho da IA fica de fora do total até o admin aprovar.
  await p.locator("#custos td", { hasText: "Frete sugerido pela IA" }).waitFor();
  await p.getByText("1 lançamento aguarda aprovação").waitFor();
  const f = await pagina();
  await entrar(f, "funcionario@soloplan.local");
  await f.goto(URL_SAFRA);
  const linhaIaFunc = f.locator("#custos tr", { hasText: "Frete sugerido pela IA" });
  await linhaIaFunc.getByText("Rascunho da IA").waitFor();
  assert.equal(await linhaIaFunc.getByRole("button", { name: "Aprovar" }).count(), 0, "funcionário não aprova");
  await p.locator("#custos tr", { hasText: "Frete sugerido pela IA" }).getByRole("button", { name: "Aprovar" }).click();
  await p.waitForFunction(() => /4\.750,00/.test(document.querySelector("#custos tr.total")?.textContent ?? ""));
  log("rascunho da IA: fora do total, funcionário não aprova, admin aprova e entra no total (R$ 4.750,00)");

  // Laudo: funcionário escreve, admin aprova e envia.
  await f.click("button[aria-expanded]:has-text('Escrever laudo')");
  await f.fill("form[aria-label='Escrever laudo'] #laudo-texto", "Lavoura em V3 com estande uniforme. Monitorar percevejo no T2 nas próximas visitas.");
  await f.click("form[aria-label='Escrever laudo'] button[type=submit]");
  await f.getByText("Laudo salvo para revisão do administrador.").waitFor();
  await f.reload();
  await f.locator("#laudos").getByText("Aguardando aprovação de um administrador.").waitFor();
  assert.equal(await f.getByRole("button", { name: "Aprovar e enviar ao cliente" }).count(), 0);
  await p.reload();
  await p.getByRole("button", { name: "Aprovar e enviar ao cliente" }).click();
  await p.locator("#laudos .selo", { hasText: "Enviado ao cliente" }).waitFor();
  const { data: laudo } = await servico.from("laudos_safra").select("status, aprovado_por, enviado_em").eq("safra_id", safra.id).single();
  assert.equal(laudo.status, "enviado_ao_cliente");
  assert.ok(laudo.aprovado_por && laudo.enviado_em);
  log("laudo: funcionário escreve, só o admin vê 'Aprovar e enviar ao cliente'; enviado com carimbo");

  // Capturas
  for (const [w, h] of [[375, 812], [768, 1024], [1440, 900]]) {
    const q = await pagina(w, h);
    await entrar(q, "luciano@soloplan.local");
    await q.goto(URL_SAFRA);
    await q.locator(".estadio img").first().waitFor();
    await q.waitForLoadState("networkidle");
    await q.screenshot({ path: `${QA}/safra-completa-${w}.png`, fullPage: true, caret: "initial" });
    const sw = await q.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= w, `safra em ${w}px vaza para o lado (${sw}px)`);
    await q.context().close();
  }
  const escuro = await pagina(1440, 900, "dark");
  await entrar(escuro, "luciano@soloplan.local");
  await escuro.goto(URL_SAFRA);
  await escuro.locator(".estadio img").first().waitFor();
  await escuro.screenshot({ path: `${QA}/safra-escuro-1440.png`, fullPage: true, caret: "initial" });
  log("telas em 375, 768 e 1440 sem vazar; tema escuro capturado");
} catch (falha) {
  // Foto de cada página aberta no momento da falha, para diagnóstico.
  for (const [i, pg] of navegador.contexts().flatMap((c) => c.pages()).entries()) await pg.screenshot({ path: `${QA}/falha-${i}.png`, fullPage: true }).catch(() => {});
  throw falha;
} finally {
  await navegador.close();
}
if (erros.length) { console.error("Erros no navegador:\n" + [...new Set(erros)].join("\n")); process.exit(1); }
console.log("Tudo certo.");
