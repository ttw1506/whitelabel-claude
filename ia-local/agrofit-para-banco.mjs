// Carrega a cópia local do Agrofit no Postgres do Soloplan, pela tabela agrofit_produtos.
// Uso: node ia-local/agrofit-para-banco.mjs <csv> [url-do-postgres]
//
// Usa COPY, que é a forma rápida de entrar com centenas de milhares de linhas.
// A tabela é recriada do zero a cada carga: é uma cópia derivada do CSV, não dado do cliente.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { COLUNAS, normalizar, lerLinhaCsv, extrairGrupoQuimico } from "./agrofit.mjs";

const csv = process.argv[2];
const URL_BANCO = process.argv[3] || process.env.DATABASE_URL
  || "postgres://postgres:postgres@127.0.0.1:54322/postgres";
const URL_ORIGEM = "https://dados.gov.br/dados/conjuntos-dados/sistema-de-agrotoxicos-fitossanitarios-agrofit";
if (!csv) { console.error("Informe o caminho do CSV do Agrofit."); process.exit(1); }

const limpo = (x) => (x ?? "").replace(/\\/g, "\\\\").replace(/\t/g, " ").replace(/\r?\n/g, " ");
/** Coluna que aceita vazio: no formato COPY, vazio é string vazia e \N é nulo. */
const campoTexto = (x) => limpo(x);
/** Coluna opcional: vazio vira nulo. */
const campo = (x) => (limpo(x) === "" ? "\\N" : limpo(x));

const db = new pg.Client({ connectionString: URL_BANCO });
await db.connect();
console.log("banco :", URL_BANCO.replace(/:[^:@/]*@/, ":***@"));
console.log("lendo :", csv);

const { rows: existe } = await db.query(
  "select 1 from information_schema.tables where table_schema='public' and table_name='agrofit_produtos'");
if (!existe.length) {
  console.error("A tabela agrofit_produtos não existe. Aplique as migrações antes.");
  process.exit(1);
}

await db.query("truncate table public.agrofit_produtos restart identity");

let linhas = 0, ignoradas = 0, cabecalho = null;
const t0 = Date.now();

async function* gerarLinhas() {
  const leitor = createInterface({ input: createReadStream(csv, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const linha of leitor) {
    if (!linha.trim()) continue;
    if (!cabecalho) {
      cabecalho = lerLinhaCsv(linha.replace(/^﻿/, ""));
      const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
      if (faltando.length) throw new Error(`O CSV mudou de formato. Faltam: ${faltando.join(", ")}.`);
      continue;
    }
    const campos = lerLinhaCsv(linha);
    const v = (nome) => campos[cabecalho.indexOf(nome)] ?? "";
    const cultura = v("CULTURA"), alvoComum = v("PRAGA_NOME_COMUM"), alvoCien = v("PRAGA_NOME_CIENTIFICO");
    if (!v("NR_REGISTRO") || !v("MARCA_COMERCIAL") || !cultura) { ignoradas++; continue; }
    linhas++;
    // As colunas not null usam campoTexto; as opcionais, campo (vazio vira nulo).
    yield [
      campoTexto(v("NR_REGISTRO")), campoTexto(v("MARCA_COMERCIAL")),
      campo(v("FORMULACAO")), campo(v("INGREDIENTE_ATIVO")),
      campo(v("TITULAR_DE_REGISTRO")), campo(v("CLASSE")), campo(v("MODO_DE_ACAO")),
      campo(extrairGrupoQuimico(v("INGREDIENTE_ATIVO"))),
      campoTexto(cultura), campoTexto(normalizar(cultura)),
      campo(alvoComum), campo(alvoCien),
      campoTexto(`${normalizar(alvoComum)} ${normalizar(alvoCien)}`.trim()),
      campo(v("CLASSE_TOXICOLOGICA")), campo(v("CLASSE_AMBIENTAL")), campo(v("ORGANICOS")),
    ].join("\t") + "\n";
  }
}

const destino = db.query(copyFrom(`copy public.agrofit_produtos
  (registro, marca, formulacao, ingrediente_ativo, titular, classe, modo_de_acao, grupo_quimico,
   cultura, cultura_norm, alvo_comum, alvo_cientifico, alvo_norm,
   classe_toxicologica, classe_ambiental, organicos) from stdin`));
await pipeline(Readable.from(gerarLinhas()), destino);

// Procedência: vai junto de toda resposta que citar produto.
await db.query("delete from public.agrofit_origem");
const marcos = [
  ["fonte", "Agrofit - produtos formulados (dados abertos do MAPA)"],
  ["url", URL_ORIGEM],
  ["licenca", "Creative Commons Attribution"],
  ["baixado_em", new Date().toISOString().slice(0, 10)],
  ["linhas", String(linhas)],
  ["sem_bula_e_intervalo_seguranca", "sim"],
  ["grupo_quimico", "extraído do ingrediente ativo; NÃO é o código oficial HRAC/IRAC/FRAC"],
  ["so_registros_ativos", "sim; produto cancelado simplesmente não aparece"],
];
for (const [chave, valor] of marcos) {
  await db.query("insert into public.agrofit_origem (chave, valor) values ($1, $2)", [chave, valor]);
}
await db.query("analyze public.agrofit_produtos");

const { rows: [conta] } = await db.query("select count(*)::int n from public.agrofit_produtos");
console.log(`\ngravadas : ${conta.n.toLocaleString("pt-BR")}`);
console.log(`ignoradas: ${ignoradas.toLocaleString("pt-BR")}`);
console.log(`tempo    : ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const { rows: prova } = await db.query(
  "select registro, marca, classe, grupo_quimico from app.agrofit_consultar($1,$2,$3)",
  ["Soja", "ferrugem asiatica", 5]);
console.log("\n--- prova: soja x ferrugem-asiática ---");
for (const p of prova) console.log(`  ${p.registro}  ${p.marca}  [${p.classe}]  ${p.grupo_quimico}`);

const { rows: [c] } = await db.query(
  "select app.agrofit_conferir($1,$2,$3) ok", [prova[0]?.marca ?? "", prova[0]?.registro ?? "", "Soja"]);
console.log(`\nconferir produto real  : ${c.ok}`);
const { rows: [f] } = await db.query(
  "select app.agrofit_conferir($1,$2,$3) ok", ["Produto Inventado", "0000", "Soja"]);
console.log(`conferir produto falso : ${f.ok}`);

await db.end();
