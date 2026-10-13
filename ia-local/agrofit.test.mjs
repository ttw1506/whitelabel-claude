// Base local do Agrofit: importação e consulta por cultura e alvo.
// Usa um CSV pequeno criado aqui; não precisa do arquivo de 374 MB nem de rede.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importar, abrir, normalizar, lerLinhaCsv, COLUNAS } from "./agrofit.mjs";

const CABECALHO = COLUNAS.join(";");
const linha = (o) => COLUNAS.map((c) => o[c] ?? "").join(";");

const CSV = [
  CABECALHO,
  linha({ NR_REGISTRO: "1215", MARCA_COMERCIAL: "2,4-D 806 RN", FORMULACAO: "SL",
    INGREDIENTE_ATIVO: "2,4-D-dimetilamina (806 g/L)", TITULAR_DE_REGISTRO: "Empresa A",
    CLASSE: "Herbicida", MODO_DE_ACAO: "sistêmico e seletivo", CULTURA: "Soja",
    PRAGA_NOME_CIENTIFICO: "Amaranthus deflexus", PRAGA_NOME_COMUM: "bredo; caruru",
    CLASSE_TOXICOLOGICA: "III", CLASSE_AMBIENTAL: "II", ORGANICOS: "Não", SITUACAO: "TRUE" }),
  linha({ NR_REGISTRO: "0999", MARCA_COMERCIAL: "Fungi Max", FORMULACAO: "SC",
    INGREDIENTE_ATIVO: "azoxistrobina (200 g/L)", TITULAR_DE_REGISTRO: "Empresa B",
    CLASSE: "Fungicida", MODO_DE_ACAO: "", CULTURA: "Soja",
    PRAGA_NOME_CIENTIFICO: "Phakopsora pachyrhizi", PRAGA_NOME_COMUM: "ferrugem-asiática",
    CLASSE_TOXICOLOGICA: "IV", CLASSE_AMBIENTAL: "III", ORGANICOS: "Não", SITUACAO: "TRUE" }),
  linha({ NR_REGISTRO: "0777", MARCA_COMERCIAL: "Milho Protege", FORMULACAO: "WG",
    INGREDIENTE_ATIVO: "atrazina (900 g/kg)", TITULAR_DE_REGISTRO: "Empresa C",
    CLASSE: "Herbicida", MODO_DE_ACAO: "sistêmico", CULTURA: "Milho",
    PRAGA_NOME_CIENTIFICO: "Brachiaria plantaginea", PRAGA_NOME_COMUM: "papuã",
    CLASSE_TOXICOLOGICA: "III", CLASSE_AMBIENTAL: "II", ORGANICOS: "Não", SITUACAO: "TRUE" }),
  // Linha quebrada de propósito: sem registro, deve ser ignorada.
  linha({ MARCA_COMERCIAL: "Sem Registro", CULTURA: "Soja", PRAGA_NOME_COMUM: "x" }),
].join("\n");

let pasta, csv, banco, base;

before(async () => {
  pasta = mkdtempSync(join(tmpdir(), "agrofit-"));
  csv = join(pasta, "teste.csv");
  banco = join(pasta, "teste.sqlite3");
  writeFileSync(csv, CSV, "utf8");
  const r = await importar(csv, banco, { origemUrl: "https://exemplo/agrofit.csv", baixadoEm: "2026-10-13" });
  assert.equal(r.gravadas, 3, "três linhas boas");
  assert.equal(r.ignoradas, 1, "a linha sem registro é ignorada");
  base = abrir(banco);
});
after(() => { base?.fechar(); rmSync(pasta, { recursive: true, force: true }); });

test("acha o produto pela cultura e pelo alvo", () => {
  const { produtos } = base.consultar({ cultura: "Soja", alvo: "ferrugem asiatica" });
  assert.equal(produtos.length, 1);
  assert.equal(produtos[0].marca, "Fungi Max");
  assert.equal(produtos[0].classe, "Fungicida");
  assert.match(produtos[0].ingrediente_ativo, /azoxistrobina/);
});

test("acento e caixa não atrapalham a busca", () => {
  const a = base.consultar({ cultura: "SOJA", alvo: "FERRUGEM-ASIÁTICA" }).produtos;
  const b = base.consultar({ cultura: "soja", alvo: "ferrugem asiatica" }).produtos;
  assert.equal(a.length, 1);
  assert.deepEqual(a.map((x) => x.marca), b.map((x) => x.marca));
});

test("não mistura cultura: alvo de milho não aparece em soja", () => {
  assert.equal(base.consultar({ cultura: "Soja", alvo: "papuã" }).produtos.length, 0);
  assert.equal(base.consultar({ cultura: "Milho", alvo: "papuã" }).produtos.length, 1);
});

test("sem cultura não devolve nada", () => {
  const r = base.consultar({ cultura: "", alvo: "ferrugem" });
  assert.equal(r.produtos.length, 0);
  assert.match(r.aviso, /Informe a cultura/);
});

test("sem alvo avisa que a lista é da cultura inteira", () => {
  const r = base.consultar({ cultura: "Soja" });
  assert.equal(r.produtos.length, 2);
  assert.match(r.aviso, /não do alvo/);
});

test("alvo desconhecido devolve vazio, não chuta", () => {
  assert.equal(base.consultar({ cultura: "Soja", alvo: "praga que nao existe" }).produtos.length, 0);
});

test("existeProduto é a trava: só aceita o que está na base para a cultura", () => {
  assert.equal(base.existeProduto({ marca: "Fungi Max", cultura: "Soja" }), true);
  assert.equal(base.existeProduto({ marca: "fungi max", cultura: "Soja" }), true, "ignora a caixa");
  assert.equal(base.existeProduto({ marca: "Fungi Max", cultura: "Milho" }), false, "registrado só para soja");
  assert.equal(base.existeProduto({ marca: "Produto Inventado", cultura: "Soja" }), false);
  assert.equal(base.existeProduto({ marca: "", cultura: "Soja" }), false);
});

test("a procedência vai junto, com data e as limitações", () => {
  const p = base.procedencia();
  assert.equal(p.baixado_em, "2026-10-13");
  assert.match(p.fonte, /MAPA/);
  assert.equal(p.sem_bula_e_intervalo_seguranca, "sim");
  assert.equal(p.sem_grupo_resistencia, "sim", "não dá para rotacionar mecanismo com esta base");
});

test("lista as culturas da base", () => {
  assert.deepEqual(base.culturas(), ["Milho", "Soja"]);
});

test("o limite é respeitado e não explode", () => {
  assert.ok(base.consultar({ cultura: "Soja", limite: 1 }).produtos.length === 1);
  assert.ok(base.consultar({ cultura: "Soja", limite: 9999 }).produtos.length === 2);
});

test("CSV com aspas e ponto e vírgula dentro do campo", () => {
  assert.deepEqual(lerLinhaCsv('a;"b;c";d'), ["a", "b;c", "d"]);
  assert.deepEqual(lerLinhaCsv('"com ""aspas""";x'), ['com "aspas"', "x"]);
});

test("normalizar tira acento e baixa a caixa", () => {
  assert.equal(normalizar("Ferrugem-Asiática"), "ferrugem-asiatica");
  assert.equal(normalizar(null), "");
});

test("recusa um CSV com formato diferente", async () => {
  const ruim = join(pasta, "ruim.csv");
  writeFileSync(ruim, "COLUNA_ESTRANHA;OUTRA\n1;2\n", "utf8");
  await assert.rejects(() => importar(ruim, join(pasta, "ruim.sqlite3")), /mudou de formato/);
});
