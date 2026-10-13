// Importa a cópia local do Agrofit. Uso:
//   node ia-local/agrofit-importar.mjs <csv> [banco.sqlite3]
// Baixe o CSV em dados.gov.br -> "Sistema de Agrotóxicos Fitossanitários - Agrofit",
// recurso "Produto Formulado". Licença Creative Commons Attribution.
import { importar, abrir } from "./agrofit.mjs";

const csv = process.argv[2];
const banco = process.argv[3] || "D:\\SOLOPLAN\\agrofit\\agrofit.sqlite3";
if (!csv) { console.error("Informe o caminho do CSV do Agrofit."); process.exit(1); }

const URL_ORIGEM = "https://dados.gov.br/dados/conjuntos-dados/sistema-de-agrotoxicos-fitossanitarios-agrofit";

console.log("lendo  :", csv);
console.log("gravando:", banco);
const t0 = Date.now();
const r = await importar(csv, banco, { origemUrl: URL_ORIGEM });
console.log(`\nlinhas lidas : ${r.linhas.toLocaleString("pt-BR")}`);
console.log(`gravadas     : ${r.gravadas.toLocaleString("pt-BR")}`);
console.log(`ignoradas    : ${r.ignoradas.toLocaleString("pt-BR")}`);
console.log(`tempo        : ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const base = abrir(banco);
console.log(`culturas     : ${base.culturas().length}`);
console.log("\nprocedência gravada na base:");
for (const [k, v] of Object.entries(base.procedencia())) console.log(`  ${k}: ${v}`);

console.log('\n--- prova: soja x ferrugem-asiática ---');
const { produtos, aviso } = base.consultar({ cultura: "Soja", alvo: "ferrugem asiatica", limite: 5 });
if (aviso) console.log("aviso:", aviso);
for (const p of produtos) console.log(`  ${p.registro}  ${p.marca}  [${p.classe}]  ${p.ingrediente_ativo?.slice(0, 60)}`);
console.log(`  (${produtos.length} mostrados)`);
base.fechar();
