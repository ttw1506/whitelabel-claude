// Base local do Agrofit (dados abertos do MAPA), para a parte D da seção 4:
// produtos registrados para AQUELA cultura e AQUELE alvo.
//
// O que a base de origem tem e o que NÃO tem (conferido em 13/10/2026):
//   tem  : nº de registro, marca comercial, formulação, ingrediente ativo, titular,
//          classe, cultura, alvo (nome comum e científico), classes toxicológica e ambiental.
//   NÃO tem: bula, intervalo de segurança, e o grupo de resistência (HRAC/IRAC/FRAC).
//          A coluna MODO_DE_ACAO é texto livre ("sistêmico e seletivo") e vem vazia em
//          45% das linhas, então NÃO serve para rotação de mecanismo de ação.
//   SITUACAO vem "TRUE" em todas as linhas: a base só traz registros ativos. Produto
//          cancelado não aparece — a ausência é a única pista.
import { DatabaseSync } from "node:sqlite";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export const COLUNAS = ["NR_REGISTRO", "MARCA_COMERCIAL", "FORMULACAO", "INGREDIENTE_ATIVO",
  "TITULAR_DE_REGISTRO", "CLASSE", "MODO_DE_ACAO", "CULTURA", "PRAGA_NOME_CIENTIFICO",
  "PRAGA_NOME_COMUM", "EMPRESA_PAIS_TIPO", "CLASSE_TOXICOLOGICA", "CLASSE_AMBIENTAL",
  "ORGANICOS", "SITUACAO"];

/** Tira acentos e baixa a caixa, para a busca não depender de como foi digitado. */
export function normalizar(texto) {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Divide uma linha de CSV com ponto e vírgula, respeitando aspas. */
export function lerLinhaCsv(linha) {
  const campos = [];
  let atual = "", dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentro) {
      if (c === '"') { if (linha[i + 1] === '"') { atual += '"'; i++; } else dentro = false; }
      else atual += c;
    } else if (c === '"') dentro = true;
    else if (c === ";") { campos.push(atual); atual = ""; }
    else atual += c;
  }
  campos.push(atual);
  return campos.map((x) => x.trim());
}

const ESQUEMA = `
create table if not exists produtos (
  registro text not null, marca text not null, formulacao text, ingrediente_ativo text,
  titular text, classe text, modo_de_acao text,
  cultura text not null, cultura_norm text not null,
  alvo_comum text, alvo_cientifico text, alvo_norm text not null,
  classe_toxicologica text, classe_ambiental text, organicos text
);
create table if not exists origem (chave text primary key, valor text not null);
`;
const INDICES = `
create index if not exists idx_cultura on produtos (cultura_norm);
create index if not exists idx_cultura_alvo on produtos (cultura_norm, alvo_norm);
create index if not exists idx_marca on produtos (marca);
`;

/**
 * Lê o CSV do Agrofit e grava a base local.
 * @returns {{linhas:number, gravadas:number, ignoradas:number}}
 */
export async function importar(csvCaminho, bancoCaminho, { origemUrl = "", baixadoEm = "" } = {}) {
  const db = new DatabaseSync(bancoCaminho);
  db.exec("pragma journal_mode = wal");
  db.exec(ESQUEMA);
  db.exec("delete from produtos");

  const inserir = db.prepare(`insert into produtos
    (registro, marca, formulacao, ingrediente_ativo, titular, classe, modo_de_acao,
     cultura, cultura_norm, alvo_comum, alvo_cientifico, alvo_norm,
     classe_toxicologica, classe_ambiental, organicos)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  let linhas = 0, gravadas = 0, ignoradas = 0, cabecalho = null;
  const leitor = createInterface({ input: createReadStream(csvCaminho, { encoding: "utf8" }), crlfDelay: Infinity });

  db.exec("begin");
  try {
    for await (const linha of leitor) {
      if (!linha.trim()) continue;
      if (!cabecalho) {
        cabecalho = lerLinhaCsv(linha.replace(/^﻿/, ""));
        const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
        if (faltando.length) throw new Error(`O CSV mudou de formato. Faltam colunas: ${faltando.join(", ")}.`);
        continue;
      }
      linhas++;
      const campos = lerLinhaCsv(linha);
      const v = (nome) => campos[cabecalho.indexOf(nome)] ?? "";
      const cultura = v("CULTURA"), alvoComum = v("PRAGA_NOME_COMUM"), alvoCien = v("PRAGA_NOME_CIENTIFICO");
      if (!v("NR_REGISTRO") || !v("MARCA_COMERCIAL") || !cultura) { ignoradas++; continue; }
      inserir.run(v("NR_REGISTRO"), v("MARCA_COMERCIAL"), v("FORMULACAO"), v("INGREDIENTE_ATIVO"),
        v("TITULAR_DE_REGISTRO"), v("CLASSE"), v("MODO_DE_ACAO"),
        cultura, normalizar(cultura), alvoComum, alvoCien,
        `${normalizar(alvoComum)} ${normalizar(alvoCien)}`.trim(),
        v("CLASSE_TOXICOLOGICA"), v("CLASSE_AMBIENTAL"), v("ORGANICOS"));
      gravadas++;
    }
    db.exec("commit");
  } catch (e) { db.exec("rollback"); db.close(); throw e; }

  db.exec(INDICES);
  const marcar = db.prepare("insert or replace into origem (chave, valor) values (?, ?)");
  marcar.run("fonte", "Agrofit - produtos formulados (dados abertos do MAPA)");
  marcar.run("url", origemUrl);
  marcar.run("baixado_em", baixadoEm || new Date().toISOString().slice(0, 10));
  marcar.run("linhas", String(gravadas));
  marcar.run("sem_bula_e_intervalo_seguranca", "sim");
  marcar.run("sem_grupo_resistencia", "sim");
  db.close();
  return { linhas, gravadas, ignoradas };
}

export function abrir(bancoCaminho) {
  const db = new DatabaseSync(bancoCaminho, { readOnly: true });

  /** Data e procedência da cópia local, para citar junto com a resposta (seção 4-D). */
  const procedencia = () =>
    Object.fromEntries(db.prepare("select chave, valor from origem").all().map((r) => [r.chave, r.valor]));

  /**
   * Produtos registrados para a cultura e, quando informado, para o alvo.
   * Sem cultura não devolve nada: a parte D exige cultura E alvo.
   */
  function consultar({ cultura, alvo = "", limite = 30 } = {}) {
    const c = normalizar(cultura);
    if (!c) return { produtos: [], procedencia: procedencia(), aviso: "Informe a cultura." };
    const termos = normalizar(alvo).split(/\s+/).filter((t) => t.length > 2);
    let sql = `select registro, marca, ingrediente_ativo, classe, formulacao, titular,
                      cultura, alvo_comum, alvo_cientifico, classe_toxicologica, classe_ambiental
               from produtos where cultura_norm = ?`;
    const params = [c];
    for (const t of termos) { sql += " and alvo_norm like ?"; params.push(`%${t}%`); }
    sql += " order by marca limit ?";
    params.push(Math.min(Math.max(1, limite), 200));
    const produtos = db.prepare(sql).all(...params);
    const r = { produtos, procedencia: procedencia() };
    if (alvo && !termos.length) r.aviso = "O alvo informado é curto demais para filtrar; mostrando a cultura inteira.";
    if (!alvo) r.aviso = "Sem alvo informado: estes produtos são da cultura, não do alvo.";
    return r;
  }

  /** Confere se um produto citado existe na base para aquela cultura (trava da seção 5). */
  function existeProduto({ marca, cultura }) {
    const m = (marca ?? "").trim();
    if (!m) return false;
    const sql = cultura
      ? "select 1 from produtos where marca = ? collate nocase and cultura_norm = ? limit 1"
      : "select 1 from produtos where marca = ? collate nocase limit 1";
    return !!db.prepare(sql).get(...(cultura ? [m, normalizar(cultura)] : [m]));
  }

  const culturas = () =>
    db.prepare("select distinct cultura from produtos order by cultura").all().map((r) => r.cultura);

  return { consultar, existeProduto, culturas, procedencia, fechar: () => db.close() };
}
