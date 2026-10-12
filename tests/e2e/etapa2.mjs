// Etapa 2: passeio completo pelo cadastro, como um usuário, no navegador de verdade.
// Uso: node tests/e2e/etapa2.mjs [pasta-das-capturas]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const URL = process.env.APP_URL || "http://127.0.0.1:3000";
const QA = process.argv[2] || "qa";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const sufixo = Date.now().toString().slice(-5);
const log = (...a) => console.log("✓", ...a);
// CPF válido novo a cada execução (o banco não aceita CPF repetido).
function cpfAleatorio() {
  const b = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const t of [9, 10]) { const s = b.reduce((a, d, i) => a + d * (t + 1 - i), 0); const r = (s * 10) % 11; b.push(r === 10 ? 0 : r); }
  return b.join("");
}
const CPF = cpfAleatorio();
const CPF_FMT = CPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const CPF_ERRADO = CPF.slice(0, 10) + ((Number(CPF[10]) + 1) % 10);
const erros = [];

const navegador = await chromium.launch({ executablePath: CHROME });
async function pagina(largura = 1440, altura = 900, tema = "light") {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, locale: "pt-BR" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(`pageerror ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource.*fonts/.test(m.text()) && erros.push(`console ${m.text()}`));
  return p;
}
async function entrar(p, email) {
  await p.goto(`${URL}/entrar`);
  await p.fill("#email", email);
  await p.fill("#senha", "teste-123456");
  await Promise.all([p.waitForURL((u) => !/^\/(entrar)?$/.test(u.pathname), { waitUntil: "commit", timeout: 60000 }), p.click("button[type=submit]")]);
}
const largura = async (p) => p.evaluate(() => document.documentElement.scrollWidth);

try {
  // 1. Sem login vai para Entrar; senha errada mostra erro.
  let p = await pagina();
  await p.goto(`${URL}/clientes`);
  assert.match(p.url(), /\/entrar$/);
  await p.fill("#email", "luciano@soloplan.local");
  await p.fill("#senha", "errada");
  await p.click("button[type=submit]");
  await p.getByText("E-mail ou senha incorretos.").waitFor();
  await p.screenshot({ caret: "initial", path: `${QA}/entrar-erro-1440.png` });
  log("sem login → Entrar; senha errada → mensagem clara");

  // 2. Admin entra e cadastra cliente com validações.
  await entrar(p, "luciano@soloplan.local");
  assert.match(p.url(), /\/painel$/);
  await p.click("text=Clientes e fazendas");
  await p.click("text=Novo cliente");
  await p.click("button:has-text('Cadastrar cliente')");
  await p.getByText("Informe o nome do produtor ou da empresa.").waitFor();
  await p.fill("#campo-nome", `Produtor Exemplo ${sufixo}`);
  await p.fill("#campo-cpf_cnpj", CPF_ERRADO);
  await p.click("button:has-text('Cadastrar cliente')");
  await p.getByText("CPF ou CNPJ inválido. Confira os números.").waitFor();
  assert.equal(await p.inputValue("#campo-nome"), `Produtor Exemplo ${sufixo}`, "mantém o que foi digitado");
  await p.screenshot({ caret: "initial", path: `${QA}/cliente-erro-1440.png` });
  await p.fill("#campo-cpf_cnpj", CPF);
  await Promise.all([p.waitForURL(/\/clientes\/[0-9a-f-]{36}$/), p.click("button:has-text('Cadastrar cliente')")]);
  await p.getByText(CPF_FMT).first().waitFor();
  const urlCliente = p.url();
  log("cliente: nome obrigatório, CPF validado e formatado");

  // 3. Fazenda com número brasileiro.
  await p.click("text=Nova fazenda");
  await p.fill("#campo-nome", "Fazenda Boa Vista (exemplo)");
  await p.fill("#campo-area_total_ha", "abc");
  await p.click("button:has-text('Cadastrar fazenda')");
  await p.getByText("Use só números, com vírgula para decimais. Ex.: 120,5").waitFor();
  await p.fill("#campo-area_total_ha", "1.250,5");
  await p.fill("#campo-reserva_legal_ha", "260");
  await Promise.all([p.waitForURL(/\/fazendas\/[0-9a-f-]{36}$/), p.click("button:has-text('Cadastrar fazenda')")]);
  await p.getByText("1.250,50 ha no total").waitFor();
  const urlFazenda = p.url();
  log("fazenda: área com vírgula aceita, texto recusado");

  // 4. Talhões: soma acima da área alerta; edição corrige.
  await p.fill("#campo-nome", "T1");
  await p.fill("#campo-area_ha", "300");
  await p.click("button:has-text('Adicionar talhão')");
  await p.getByText("Talhão T1 cadastrado.").waitFor();
  await p.fill("form[aria-label='Novo talhão'] #campo-nome", "T2");
  await p.fill("form[aria-label='Novo talhão'] #campo-area_ha", "1.000,5");
  await p.click("button:has-text('Adicionar talhão')");
  await p.getByText(/passa da área total do imóvel/).waitFor();
  await p.fill("form[aria-label='Novo talhão'] #campo-nome", "T1");
  await p.fill("form[aria-label='Novo talhão'] #campo-area_ha", "5");
  await p.click("button:has-text('Adicionar talhão')");
  await p.getByText('Já existe um talhão chamado "T1" nesta fazenda.').waitFor();
  await p.click("button[aria-label='Editar talhão T2']");
  await p.fill("form[aria-label='Editar talhão T2'] #campo-area_ha", "900");
  await p.click("form[aria-label='Editar talhão T2'] button:has-text('Salvar')");
  await p.getByText("1.200,00 ha", { exact: false }).first().waitFor();
  assert.equal(await p.getByText(/passa da área total do imóvel/).count(), 0);
  log("talhões: alerta de área, nome repetido recusado, edição corrige");

  // 5. Safra: precisa de talhão; régua de estádios.
  await p.click("text=Nova safra");
  await p.click("button:has-text('Criar safra')");
  await p.getByText("Marque pelo menos um talhão.").waitFor();
  await p.check("label:has-text('T1') input");
  await p.check("label:has-text('T2') input");
  await p.fill("#campo-cultivar", "Cultivar exemplo");
  await p.selectOption("#campo-estadio_atual", "V4");
  await Promise.all([p.waitForURL(/\/safras\/[0-9a-f-]{36}$/), p.click("button:has-text('Criar safra')")]);
  await p.getByText("1.200,00 ha", { exact: false }).first().waitFor();
  assert.match(await p.locator(".estadio[data-situacao='atual'] h3").textContent(), /^V4/);
  const urlSafra = p.url();
  await p.click("text=Editar");
  await p.uncheck("label:has-text('T2') input");
  await p.fill("#campo-area_ha", "");
  await Promise.all([p.waitForURL(/\/safras\/[0-9a-f-]{36}$/), p.click("button:has-text('Salvar alterações')")]);
  await p.getByText("300,00 ha", { exact: false }).first().waitFor();
  log("safra: exige talhão, área = soma dos talhões, estádio V4 marcado como atual na linha do tempo, desmarcar talhão funciona");

  // 6. Painel mostra a safra; capturas em três larguras e tema escuro.
  for (const [w, h] of [[375, 812], [768, 1024], [1440, 900]]) {
    const q = await pagina(w, h);
    await entrar(q, "luciano@soloplan.local");
    for (const [nome, url] of [["painel", `${URL}/painel`], ["cliente", urlCliente], ["fazenda", urlFazenda], ["safra", urlSafra], ["nova-safra", `${URL}/safras/nova?fazenda=${urlFazenda.split("/").pop()}`]]) {
      await q.goto(url);
      await q.waitForLoadState("networkidle");
      await q.screenshot({ caret: "initial", path: `${QA}/${nome}-${w}.png`, fullPage: true });
      const sw = await largura(q);
      assert.ok(sw <= w, `${nome} em ${w}px vaza para o lado (${sw}px)`);
    }
    await q.context().close();
  }
  const escuro = await pagina(1440, 900, "dark");
  await entrar(escuro, "luciano@soloplan.local");
  await escuro.goto(urlFazenda);
  await escuro.screenshot({ caret: "initial", path: `${QA}/fazenda-escuro-1440.png`, fullPage: true });
  await escuro.context().close();
  log("telas em 375, 768 e 1440 sem vazar; tema escuro capturado");

  // 7. Funcionário: cadastra, mas não vê Excluir.
  const f = await pagina();
  await entrar(f, "funcionario@soloplan.local");
  await f.goto(urlFazenda);
  assert.equal(await f.getByRole("button", { name: /Excluir/ }).count(), 0);
  await f.goto(urlCliente);
  assert.equal(await f.getByRole("button", { name: /Excluir/ }).count(), 0);
  await p.goto(urlFazenda);
  assert.ok((await p.getByRole("button", { name: /Excluir/ }).count()) > 0, "admin vê Excluir");
  log("funcionário não vê Excluir; admin vê");

  // 8. Admin exclui um talhão (dois cliques).
  await p.goto(urlFazenda);
  const linhaT2 = p.locator("tr", { hasText: "T2" });
  await linhaT2.getByRole("button", { name: "Excluir" }).click();
  await p.getByRole("button", { name: "Sim, excluir" }).click();
  await p.locator("tr", { hasText: "T2" }).waitFor({ state: "detached" });
  log("exclusão com confirmação");

  // 9. Usuário sem vínculo cai na tela de liberação; não acessa o escritório.
  const c = await pagina(375, 812);
  await entrar(c, "produtor@exemplo.local");
  assert.match(c.url(), /\/aguardando$/);
  await c.goto(`${URL}/clientes`);
  assert.match(c.url(), /\/aguardando$/);
  await c.screenshot({ caret: "initial", path: `${QA}/aguardando-375.png` });
  log("conta sem vínculo → tela de liberação, sem acesso ao escritório");
} finally {
  await navegador.close();
}
if (erros.length) { console.error("Erros no navegador:\n" + erros.join("\n")); process.exit(1); }
console.log("Tudo certo.");
