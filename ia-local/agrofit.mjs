// Base local do Agrofit (dados abertos do MAPA), para a parte D da seção 4:
// produtos registrados para AQUELA cultura e AQUELE alvo.
//
// O que a base de origem tem e o que NÃO tem (conferido em 13/10/2026):
//   tem  : nº de registro, marca comercial, formulação, ingrediente ativo, titular,
//          classe, cultura, alvo (nome comum e científico), classes toxicológica e ambiental.
//   tem, mas escondido: o GRUPO QUÍMICO vem dentro do ingrediente ativo, entre parênteses
//          antes da concentração — "2,4-D-dimetilamina (ácido ariloxialcanóico) (806 g/L)".
//          Extraímos para a coluna grupo_quimico: 98,5% das linhas, 171 grupos distintos.
//          Serve para rotacionar família química (triazol x estrobilurina, por exemplo),
//          mas NÃO é o código oficial HRAC/IRAC/FRAC: a conversão grupo -> código precisa
//          de uma tabela à parte, aprovada pelo agrônomo.
//   NÃO tem: bula e intervalo de segurança.
//          MODO_DE_ACAO é texto livre ("sistêmico e seletivo") e vem vazia em 45% das
//          linhas: não use para decidir rotação.
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

/**
 * Tira o grupo químico do ingrediente ativo.
 * "glifosato (glicina substituída) (480 g/L)"      -> "glicina substituída"
 * "etefom (etileno (precursor de)) (720 g/L)"      -> "etileno (precursor de)"
 * Pega o último parêntese equilibrado ANTES do parêntese da concentração.
 * Devolve "" quando não houver, em vez de chutar.
 */
export function extrairGrupoQuimico(ingrediente) {
  const t = (ingrediente ?? "").trim();
  if (!t) return "";
  // Posições dos parênteses de primeiro nível.
  const blocos = [];
  let nivel = 0, inicio = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") { if (nivel === 0) inicio = i; nivel++; }
    else if (t[i] === ")") { nivel--; if (nivel === 0 && inicio >= 0) { blocos.push([inicio, i]); inicio = -1; } }
  }
  if (blocos.length < 2) return "";
  const conteudo = ([a, b]) => t.slice(a + 1, b).trim();
  const ehConcentracao = (s) => /^[\d.,]+\s*(?:g|mg|kg|ml|l|ui|%|u)\b/i.test(s) || /^[\d.,]+\s*[a-z]+\s*\/\s*[a-z]+$/i.test(s);
  for (let i = blocos.length - 1; i >= 1; i--) {
    if (ehConcentracao(conteudo(blocos[i]))) {
      const g = conteudo(blocos[i - 1]);
      return ehConcentracao(g) ? "" : g;
    }
  }
  return "";
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
  titular text, classe text, modo_de_acao text, grupo_quimico text,
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
create index if not exists idx_grupo on produtos (cultura_norm, grupo_quimico);
`;

/**
 * Lê o CSV do Agrofit e grava a base local.
 * @returns {{linhas:number, gravadas:number, ignoradas:number}}
 */
export async function importar(csvCaminho, bancoCaminho, { origemUrl = "", baixadoEm = "" } = {}) {
  const db = new DatabaseSync(bancoCaminho);
  db.exec("pragma journal_mode = wal");
  // A base é uma cópia derivada do CSV: recria do zero, para que uma mudança de
  // colunas aqui não esbarre num banco antigo criado com o formato anterior.
  db.exec("drop table if exists produtos");
  db.exec(ESQUEMA);

  const inserir = db.prepare(`insert into produtos
    (registro, marca, formulacao, ingrediente_ativo, titular, classe, modo_de_acao, grupo_quimico,
     cultura, cultura_norm, alvo_comum, alvo_cientifico, alvo_norm,
     classe_toxicologica, classe_ambiental, organicos)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

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
        extrairGrupoQuimico(v("INGREDIENTE_ATIVO")),
        cultura, normalizar(cultura), alvoComum, alvoCien,
        `${normalizar(alvoComum)} ${normalizar(alvoCien)}`.trim(),
        v("CLASSE_TOXICOLOGICA"), v("CLASSE_AMBIENTAL"), v("ORGANICOS"));
      gravadas++;
    }
    db.exec("commit");
  } catch (e) { db.exec("rollback"); db.close(); throw e; }

  db.exec(INDICES);
  // Limpa antes de regravar: chave de uma versão anterior não pode sobrar contradizendo a nova.
  db.exec("delete from origem");
  const marcar = db.prepare("insert or replace into origem (chave, valor) values (?, ?)");
  marcar.run("fonte", "Agrofit - produtos formulados (dados abertos do MAPA)");
  marcar.run("url", origemUrl);
  marcar.run("baixado_em", baixadoEm || new Date().toISOString().slice(0, 10));
  marcar.run("linhas", String(gravadas));
  marcar.run("sem_bula_e_intervalo_seguranca", "sim");
  marcar.run("grupo_quimico", "extraído do ingrediente ativo; NÃO é o código oficial HRAC/IRAC/FRAC");
  marcar.run("so_registros_ativos", "sim; produto cancelado simplesmente não aparece");
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
    let sql = `select registro, marca, ingrediente_ativo, classe, formulacao, titular, grupo_quimico,
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

  /**
   * Agrupa os produtos de uma cultura e alvo por família química, para apoiar rotação.
   * Famílias diferentes = modos de ação provavelmente diferentes, mas isso é um APOIO:
   * não é o código oficial HRAC/IRAC/FRAC e não substitui o parecer do agrônomo.
   */
  function rotacao({ cultura, alvo = "", limitePorGrupo = 5 } = {}) {
    const { produtos, procedencia: p, aviso } = consultar({ cultura, alvo, limite: 200 });
    const grupos = new Map();
    let semGrupo = 0;
    for (const prod of produtos) {
      const g = (prod.grupo_quimico || "").trim();
      if (!g) { semGrupo++; continue; }
      if (!grupos.has(g)) grupos.set(g, []);
      const lista = grupos.get(g);
      if (lista.length < limitePorGrupo) lista.push(prod);
    }
    return {
      grupos: [...grupos.entries()]
        .map(([grupo_quimico, exemplos]) => ({ grupo_quimico, exemplos }))
        .sort((a, b) => a.grupo_quimico.localeCompare(b.grupo_quimico, "pt-BR")),
      sem_grupo: semGrupo,
      procedencia: p,
      aviso,
      ressalva: "Famílias químicas, não o código oficial HRAC/IRAC/FRAC. Apoio à decisão; "
        + "a rotação é definida pelo agrônomo responsável.",
    };
  }

  const culturas = () =>
    db.prepare("select distinct cultura from produtos order by cultura").all().map((r) => r.cultura);

  return { consultar, rotacao, existeProduto, culturas, procedencia, fechar: () => db.close() };
}
