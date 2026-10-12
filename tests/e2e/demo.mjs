// Monta a parte da demonstração que precisa do sistema (laudos e PDFs) e tira fotos das telas.
// Pré-requisito: node dev/seed-demo.mjs. Uso: node tests/e2e/demo.mjs ids.json pasta-de-saida
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const ids = JSON.parse(readFileSync(process.argv[2], "utf8"));
const SAIDA = process.argv[3];
const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const navegador = await chromium.launch({ executablePath: CHROME });

async function pagina(w, h, tema = "light") {
  const ctx = await navegador.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  return ctx.newPage();
}
async function entrar(p, email) {
  await p.goto(`${APP}/entrar`);
  await p.fill("#email", email); await p.fill("#senha", "teste-123456");
  await Promise.all([p.waitForURL((u) => !/^\/(entrar)?$/.test(u.pathname), { waitUntil: "commit", timeout: 60000 }), p.click("button[type=submit]")]);
}
async function foto(p, nome, url, { completa = true } = {}) {
  if (url) await p.goto(APP + url);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SAIDA}/${nome}.png`, fullPage: completa, caret: "initial" });
  console.log("foto", nome);
}

const a = await pagina(1440, 900);
await entrar(a, "luciano@soloplan.local");

// Laudo de solo 0–20 cm: lançado e aprovado pela tela.
async function lancarSolo(profundidade, valores, aprovar) {
  await a.goto(`${APP}/laudos-solo/novo?fazenda=${ids.fBoaVista}`);
  await a.selectOption("#solo-talhao_id", { label: "T1" });
  await a.selectOption("#solo-profundidade", profundidade);
  await a.fill("#solo-data_coleta", "2026-09-02");
  await a.fill("#solo-laboratorio", "Laboratório exemplo");
  for (const [k, v] of Object.entries(valores)) await a.fill(`#solo-${k}`, v);
  await Promise.all([a.waitForURL(/\/laudos-solo\/[0-9a-f-]{36}$/), a.click("button:has-text('Salvar para revisão')")]);
  const url = new URL(a.url()).pathname;
  if (aprovar) { await a.getByRole("button", { name: "Aprovar e enviar ao cliente" }).click(); await a.locator(".selo", { hasText: "Enviado ao cliente" }).waitFor({ timeout: 30000 }); }
  return url;
}
const urlSolo = await lancarSolo("0-20", { ph: "4,8", p: "3", k: "60", ca: "1,2", mg: "0,4", al: "0,5", hal: "5", mo: "2,5", argila: "45" }, true);
await lancarSolo("20-40", { ph: "4,5", p: "1", k: "20", ca: "0,3", mg: "0,2", al: "0,8", hal: "4", mo: "1,2", argila: "45" }, false);

// Laudo parcial da safra atual: escrito e aprovado pela tela.
await a.goto(`${APP}/safras/${ids.sAtual}`);
await a.click("button[aria-expanded]:has-text('Escrever laudo')");
await a.fill("#laudo-texto", "Laudo parcial (exemplo): a lavoura está em V3, com emergência uniforme e estande dentro do esperado. Foi observada leve falha de plantio na cabeceira do T3 e baixa pressão de lagarta-falsa-medideira, abaixo do nível de controle. Recomenda-se novo monitoramento em cinco dias e atenção à adubação de cobertura no início do V4.");
await a.click("form[aria-label='Escrever laudo'] button[type=submit]");
await a.getByText("Laudo salvo para revisão").waitFor();
await a.reload();
await a.locator("#laudos li", { hasText: "Laudo parcial" }).getByRole("button", { name: "Aprovar e enviar ao cliente" }).click();
await a.locator("#laudos .selo", { hasText: "Enviado ao cliente" }).waitFor({ timeout: 30000 });

// Fotos: escritório.
await foto(a, "01-painel-escritorio", "/painel");
await foto(a, "02-clientes", "/clientes");
await foto(a, "03-cliente", `/clientes/${ids.c1}`);
await foto(a, "04-fazenda", `/fazendas/${ids.fBoaVista}`);
await foto(a, "05-safra-2026-27-linha-do-tempo", `/safras/${ids.sAtual}`);
await foto(a, "06-safra-2025-26-colhida", `/safras/${ids.sAnterior}`);
await foto(a, "07-laudo-de-solo", urlSolo);
await foto(a, "08-usuarios", "/usuarios");

// Foto aberta.
await a.goto(`${APP}/safras/${ids.sAtual}`);
await a.locator(".estadio", { has: a.locator("h3", { hasText: /^V3/ }) }).locator("button.miniatura").first().click();
await a.locator("dialog.foto-dialogo img").waitFor();
await a.waitForTimeout(500);
await a.screenshot({ path: `${SAIDA}/09-foto-aberta.png`, caret: "initial" });
console.log("foto 09-foto-aberta");

// Fotos: produtor, no computador e no celular.
const p1 = await pagina(1440, 900);
await entrar(p1, "produtor1@exemplo.local");
await foto(p1, "10-produtor-meus-gastos", "/cliente/gastos");
await foto(p1, "11-produtor-safra", `/cliente/safras/${ids.sAtual}`);
await foto(p1, "12-produtor-laudos", "/cliente/laudos");
const cel = await pagina(375, 812);
await entrar(cel, "produtor1@exemplo.local");
await foto(cel, "13-celular-meus-gastos", "/cliente/gastos");
await foto(cel, "14-celular-safra", `/cliente/safras/${ids.sAtual}`);
const celA = await pagina(375, 812);
await entrar(celA, "luciano@soloplan.local");
await foto(celA, "15-celular-painel-escritorio", "/painel");
const escuro = await pagina(1440, 900, "dark");
await entrar(escuro, "luciano@soloplan.local");
await foto(escuro, "16-tema-escuro-safra", `/safras/${ids.sAtual}`);
await navegador.close();
console.log("pronto");
