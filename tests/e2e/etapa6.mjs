// Etapa 6: conferência do CAR na tela da fazenda + envio do recibo. Uso: node tests/e2e/etapa6.mjs [pasta-das-capturas]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL || "http://127.0.0.1:3000";
const QA = process.argv[2] || "qa";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chaves = Object.fromEntries(readFileSync(new URL("../../dev/.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const adm = createClient("http://127.0.0.1:54321", chaves.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const um = async (q) => { const r = await q; if (r.error) throw r.error; return r.data; };
const log = (...a) => console.log("✓", ...a);
await um(adm.auth.signInWithPassword({ email: "luciano@soloplan.local", password: "teste-123456" }));
const cliente = await um(adm.from("clientes").insert({ nome: `Produtor CAR ${randomUUID().slice(0, 6)}` }).select("id").single());
const HEX = "A1B2C3D4E5F60718293A4B5C6D7E8F90";
const nova = (extra) => um(adm.from("fazendas").insert({ cliente_id: cliente.id, nome: "Faz CAR", uf: "GO", codigo_ibge: "5218508", ...extra }).select("id").single());
const certa = await nova({ car_numero: `GO-5218508-${HEX}`, area_total_ha: 1000, area_consolidada_ha: 700, app_ha: 50, reserva_legal_ha: 200 });
const errada = await nova({ car_numero: "GO-5218508-XYZ", area_total_ha: 1000, area_consolidada_ha: 800, app_ha: 150, reserva_legal_ha: 100 });
await um(adm.from("talhoes").insert({ fazenda_id: errada.id, nome: "T1", area_ha: 900 }));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.goto(`${APP}/entrar`);
await page.fill("#email", "luciano@soloplan.local"); await page.fill("#senha", "teste-123456");
await page.click("button[type=submit]"); await page.waitForURL(/painel/, { timeout: 60000 });

await page.goto(`${APP}/fazendas/${certa.id}`, { timeout: 60000 });
await page.getByText(/Tudo certo com os números do CAR/).waitFor({ timeout: 30000 });
log("fazenda certa: sem alerta, reserva legal em 20%");

await page.goto(`${APP}/fazendas/${errada.id}`, { timeout: 60000 });
for (const t of [/fora do formato do SICAR/, /Reserva legal de 10%/, /somam 1\.050 ha, mais que a área total/, /talhões somam 900 ha, mais que a área consolidada/]) await page.getByText(t).first().waitFor({ timeout: 30000 });
log("fazenda errada: formato, reserva legal 10%, soma acima do total e talhões acima da consolidada");

await page.setInputFiles("#car-arquivo", { name: "recibo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 teste") });
await page.getByText("Arquivo guardado.").waitFor({ timeout: 30000 });
await page.reload();
await page.getByRole("link", { name: "Abrir arquivo do CAR enviado" }).waitFor({ timeout: 30000 });
log("recibo enviado e guardado na fazenda");
await page.screenshot({ path: `${QA}/etapa6-car.png`, fullPage: true });

// Edição normaliza o número válido (minúsculas e pontos).
await page.goto(`${APP}/fazendas/${certa.id}/editar`);
await page.fill("#fazenda-car_numero, input[name=car_numero]", `go-5218508-${HEX.toLowerCase()}`);
await page.getByRole("button", { name: /Salvar/ }).click();
await page.waitForURL(new RegExp(`/fazendas/${certa.id}$`), { timeout: 30000 });
assert.equal((await um(adm.from("fazendas").select("car_numero").eq("id", certa.id).single())).car_numero, `GO-5218508-${HEX}`);
log("número digitado em minúsculas é guardado padronizado");
assert.deepEqual(erros, []);
await browser.close();
console.log("\nEtapa 6: tudo certo.");
