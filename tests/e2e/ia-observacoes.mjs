// Tela /ia: o administrador revisa a observação da IA; o produtor só vê depois de aprovada. Uso: node tests/e2e/ia-observacoes.mjs [pasta]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const QA = process.argv[2] || "qa";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const o = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient("http://127.0.0.1:54321", chaves.SERVICE_ROLE_KEY, o);
const adm = createClient("http://127.0.0.1:54321", chaves.ANON_KEY, o);
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };
const marca = randomUUID().slice(0, 6);
await um(adm.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));

const cliente = await um(adm.from("clientes").insert({ nome: `Produtor Obs ${marca}` }).select("id").single());
const fazenda = await um(adm.from("fazendas").insert({ cliente_id: cliente.id, nome: `Faz Obs ${marca}` }).select("id").single());
const texto = `Observação de teste ${marca}: manchas amareladas nas bordas das folhas mais baixas.`;
// A IA grava como rascunho (o gatilho garante), do mesmo jeito que a API faz.
const email = `ia-${marca}@teste.local`;
const conta = (await servico.auth.admin.createUser({ email, password: "teste-123456", email_confirm: true, user_metadata: { nome: "IA teste" } })).data.user;
await um(servico.from("perfis").update({ papel: "ia" }).eq("usuario_id", conta.id));
const ia = createClient("http://127.0.0.1:54321", chaves.ANON_KEY, o);
await um(ia.auth.signInWithPassword({ email, password: "teste-123456" }));
const obs = await um(ia.from("observacoes_ia").insert({ tipo: "car", fazenda_id: fazenda.id, texto, incertezas: ["Sem a área do talhão"], status: "aprovado" }).select("id, status").single());
assert.equal(obs.status, "rascunho_ia");

// Produtor (do mesmo cliente) não vê o rascunho.
const em = `prod-${marca}@teste.local`;
const prod = (await servico.auth.admin.createUser({ email: em, password: "teste-123456", email_confirm: true, user_metadata: { nome: "Produtor teste" } })).data.user;
await um(servico.from("perfis").update({ papel: "cliente", cliente_id: cliente.id }).eq("usuario_id", prod.id));
const cp = createClient("http://127.0.0.1:54321", chaves.ANON_KEY, o);
await um(cp.auth.signInWithPassword({ email: em, password: "teste-123456" }));
assert.equal((await um(cp.from("observacoes_ia").select("id"))).length, 0);
console.log("✓ rascunho da IA: produtor não vê");

const browser = await chromium.launch({ executablePath: CHROME });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.goto(`${APP}/entrar`);
await page.fill("#email", "luciano@soloplan.local"); await page.fill("#senha", "teste-123456");
await page.click("button[type=submit]"); await page.waitForURL(/painel/, { timeout: 60000 });
await page.goto(`${APP}/ia`, { timeout: 60000 });
const cartao = page.locator("article", { hasText: texto });
await cartao.waitFor({ timeout: 30000 });
await cartao.getByText("Sem a área do talhão").waitFor();
await page.screenshot({ path: `${QA}/ia-observacoes.png`, fullPage: true });
await cartao.getByRole("button", { name: "Aprovar" }).click();
await page.locator("article", { hasText: texto }).waitFor({ state: "detached", timeout: 30000 });
assert.equal((await um(adm.from("observacoes_ia").select("status").eq("id", obs.id).single())).status, "aprovado");
assert.equal((await um(cp.from("observacoes_ia").select("id"))).length, 1, "produtor passa a ver");
console.log("✓ /ia: administrador aprova e a observação sai da fila; produtor passa a ver");
assert.deepEqual(erros, []);
await browser.close();
console.log("\nObservações da IA: tudo certo.");
