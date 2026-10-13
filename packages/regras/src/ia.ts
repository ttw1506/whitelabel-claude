// O que a IA do escritório pode mandar para o sistema. A IA pode errar ou inventar: tudo é conferido aqui antes de gravar.
import { lerDecimal } from "./numeros";
import { CATEGORIAS_CUSTO } from "./custos";

export const TIPOS_TAREFA_IA = ["extrair_laudo_solo", "analisar_foto", "gerar_laudo_parcial", "gerar_laudo_final", "conferir_car"] as const;
export type TipoTarefaIA = (typeof TIPOS_TAREFA_IA)[number];

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: Record<string, string> };
type Erros = Record<string, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const texto = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const fim = <T>(erros: Erros, valor: T): Resultado<T> => (Object.keys(erros).length ? { ok: false, erros } : { ok: true, valor });
const corpoInvalido = (): Resultado<never> => ({ ok: false, erros: { corpo: "Envie um objeto JSON." } });

/** Número que pode vir como número ou como texto brasileiro ("4,8"). */
function numero(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") return lerDecimal(x);
  return null;
}
function dataOpcional(x: unknown, campo: string, erros: Erros): string | undefined {
  if (x == null || x === "") return undefined;
  const t = texto(x);
  if (!DATA.test(t) || Number.isNaN(Date.parse(t))) { erros[campo] = "Use a data no formato AAAA-MM-DD."; return undefined; }
  return t;
}

export function validarTiposFiltro(bruto: string | null | undefined): Resultado<TipoTarefaIA[]> {
  if (!bruto) return { ok: true, valor: [...TIPOS_TAREFA_IA] };
  const lista = bruto.split(",").map((t) => t.trim()).filter(Boolean);
  const ruins = lista.filter((t) => !(TIPOS_TAREFA_IA as readonly string[]).includes(t));
  return ruins.length ? { ok: false, erros: { tipos: `Tipo desconhecido: ${ruins.join(", ")}.` } } : { ok: true, valor: lista as TipoTarefaIA[] };
}

export function validarLaudoSafra(b: unknown): Resultado<{ tipo: "parcial" | "final"; texto: string }> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const tipo = texto(b.tipo);
  if (tipo !== "parcial" && tipo !== "final") erros.tipo = 'Use "parcial" ou "final".';
  const t = texto(b.texto);
  if (t.length < 20) erros.texto = "O laudo precisa ter pelo menos 20 caracteres.";
  if (t.length > 20000) erros.texto = "O laudo passa de 20.000 caracteres.";
  return fim(erros, { tipo: tipo as "parcial" | "final", texto: t });
}

const TIPOS_OCORRENCIA = ["praga", "doenca", "planta_daninha", "deficiencia"];
export type OcorrenciaIA = { tipo: string; nome: string; data?: string; estadio?: string; severidade?: string; acao_tomada?: string; talhao?: string };
export function validarOcorrencia(b: unknown): Resultado<OcorrenciaIA> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const tipo = texto(b.tipo);
  if (!TIPOS_OCORRENCIA.includes(tipo)) erros.tipo = `Use um destes: ${TIPOS_OCORRENCIA.join(", ")}.`;
  const nome = texto(b.nome);
  if (!nome || nome.length > 200) erros.nome = "Informe o que foi encontrado (até 200 caracteres).";
  const data = dataOpcional(b.data, "data", erros);
  const v: OcorrenciaIA = { tipo, nome };
  if (data) v.data = data;
  for (const k of ["estadio", "severidade", "acao_tomada", "talhao"] as const) { const t = texto(b[k]); if (t) v[k] = t.slice(0, 500); }
  return fim(erros, v);
}

const CATEGORIAS = CATEGORIAS_CUSTO.map((c) => c.valor) as string[];
export type AplicacaoIA = { data: string; tipo_operacao: string; talhoes: string[]; produto?: string; ingrediente_ativo?: string; dose?: number; dose_unidade?: string; area_ha?: number; custo?: number; categoria_custo?: string };
export function validarAplicacao(b: unknown): Resultado<AplicacaoIA> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const data = dataOpcional(b.data, "data", erros);
  if (!data && !erros.data) erros.data = "Informe a data (AAAA-MM-DD).";
  const tipo_operacao = texto(b.tipo_operacao);
  if (!tipo_operacao) erros.tipo_operacao = "Informe a operação (ex.: Pulverização).";
  const talhoes = Array.isArray(b.talhoes) ? b.talhoes.map(texto).filter(Boolean) : [];
  if (!talhoes.length) erros.talhoes = "Informe ao menos um talhão (nome ou id).";
  const v: AplicacaoIA = { data: data ?? "", tipo_operacao, talhoes };
  for (const k of ["produto", "ingrediente_ativo"] as const) { const t = texto(b[k]); if (t) v[k] = t.slice(0, 300); }
  for (const [k, positivo] of [["dose", false], ["area_ha", true], ["custo", false]] as const) {
    if (b[k] == null || b[k] === "") continue;
    const n = numero(b[k]);
    if (n == null || n < 0 || (positivo && n === 0)) erros[k] = positivo ? "Use um número maior que zero." : "Use um número igual ou maior que zero.";
    else v[k] = n;
  }
  const un = texto(b.dose_unidade);
  if (un) v.dose_unidade = un.slice(0, 40);
  if (v.dose != null && !v.dose_unidade) erros.dose_unidade = "Informe a unidade da dose (ex.: L/ha).";
  const cat = texto(b.categoria_custo);
  if (cat) { if (!CATEGORIAS.includes(cat)) erros.categoria_custo = `Use um destes: ${CATEGORIAS.join(", ")}.`; else v.categoria_custo = cat; }
  return fim(erros, v);
}

export type CustoIA = { categoria: string; descricao: string; valor: number; data?: string };
export function validarCusto(b: unknown): Resultado<CustoIA> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const categoria = texto(b.categoria);
  if (!CATEGORIAS.includes(categoria)) erros.categoria = `Use um destes: ${CATEGORIAS.join(", ")}.`;
  const descricao = texto(b.descricao);
  if (!descricao) erros.descricao = "Descreva o gasto.";
  const valor = numero(b.valor);
  if (valor == null || valor <= 0) erros.valor = "Use um valor em reais maior que zero.";
  const data = dataOpcional(b.data, "data", erros);
  const v: CustoIA = { categoria, descricao: descricao.slice(0, 300), valor: valor ?? 0 };
  if (data) v.data = data;
  return fim(erros, v);
}

/** Faixas plausíveis para o que um laboratório de solo pode medir. Fora disso é erro de leitura, não dado. */
export const FAIXAS_SOLO: Record<string, [number, number]> = {
  ph: [2, 10], p: [0, 1000], k: [0, 2000], ca: [0, 50], mg: [0, 30], al: [0, 20], hal: [0, 40], mo: [0, 20], argila: [0, 100],
  s: [0, 500], b: [0, 20], cu: [0, 100], fe: [0, 2000], mn: [0, 1000], zn: [0, 200],
};
const OBRIGATORIOS_SOLO = ["ph", "p", "k", "ca", "mg", "al", "hal", "mo", "argila"];
export type LaudoSoloIA = { fazenda_id: string; talhao_id?: string; profundidade: "0-20" | "20-40"; data_coleta?: string; laboratorio?: string; envio_id?: string; prnt: number; v2: number; valores: Record<string, number> };
export function validarLaudoSolo(b: unknown): Resultado<LaudoSoloIA> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const fazenda_id = texto(b.fazenda_id);
  if (!UUID.test(fazenda_id)) erros.fazenda_id = "Informe o id da fazenda.";
  const profundidade = texto(b.profundidade);
  if (profundidade !== "0-20" && profundidade !== "20-40") erros.profundidade = 'Use "0-20" ou "20-40".';
  const v: LaudoSoloIA = { fazenda_id, profundidade: profundidade as "0-20" | "20-40", prnt: 80, v2: 50, valores: {} };
  for (const k of ["talhao_id", "envio_id"] as const) {
    const t = texto(b[k]);
    if (t) { if (UUID.test(t)) v[k] = t; else erros[k] = "Id inválido."; }
  }
  v.data_coleta = dataOpcional(b.data_coleta, "data_coleta", erros);
  if (v.data_coleta === undefined) delete v.data_coleta;
  const lab = texto(b.laboratorio);
  if (lab) v.laboratorio = lab.slice(0, 200);
  for (const [k, padrao] of [["prnt", 80], ["v2", 50]] as const) {
    if (b[k] == null || b[k] === "") continue;
    const n = numero(b[k]);
    if (n == null || n <= 0 || n > 100) erros[k] = "Use um número entre 1 e 100."; else v[k] = n;
  }
  const bruto = ehObjeto(b.valores) ? b.valores : {};
  if (!ehObjeto(b.valores)) erros.valores = "Envie os valores do laboratório.";
  for (const [k, [min, max]] of Object.entries(FAIXAS_SOLO)) {
    const x = bruto[k];
    if (x == null || x === "") { if (OBRIGATORIOS_SOLO.includes(k)) erros[`valores.${k}`] = "Obrigatório."; continue; }
    const n = numero(x);
    if (n == null) erros[`valores.${k}`] = "Não é um número.";
    else if (n < min || n > max) erros[`valores.${k}`] = `Valor fora do plausível (${min} a ${max}). Confira a leitura.`;
    else v.valores[k] = n;
  }
  return fim(erros, v);
}

export const PRODUTOS_PRECO = ["soja", "milho", "boi"] as const;
export type PrecoIA = { produto: (typeof PRODUTOS_PRECO)[number]; valor: number; unidade: string; fonte: string; data?: string };
export function validarPreco(b: unknown): Resultado<PrecoIA> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const produto = texto(b.produto);
  if (!(PRODUTOS_PRECO as readonly string[]).includes(produto)) erros.produto = `Use um destes: ${PRODUTOS_PRECO.join(", ")}.`;
  const valor = numero(b.valor);
  if (valor == null || valor <= 0) erros.valor = "Use um valor maior que zero.";
  const unidade = texto(b.unidade);
  if (!unidade) erros.unidade = "Informe a unidade (ex.: R$/saca).";
  const fonte = texto(b.fonte);
  if (!fonte) erros.fonte = "Informe a fonte do preço. Preço sem fonte não é aceito.";
  const data = dataOpcional(b.data, "data", erros);
  const v: PrecoIA = { produto: produto as PrecoIA["produto"], valor: valor ?? 0, unidade, fonte: fonte.slice(0, 300) };
  if (data) v.data = data;
  return fim(erros, v);
}

export type ProdutoCitadoIA = { marca: string; registro: string };
export type DoseCitadaIA = { valor: number; unidade: string; origem: string };
export type ObservacaoIA = {
  tipo: "foto" | "car"; foto_id?: string; fazenda_id?: string; texto: string; incertezas: string[];
  produtos?: ProdutoCitadoIA[]; doses?: DoseCitadaIA[];
};

/**
 * Como conferir o que a IA citou. Sem isto, produto e dose são recusados:
 * na dúvida o sistema fecha, não abre.
 */
export type ConferenciaIA = {
  /** Diz se o produto está na base local (Agrofit) e registrado para aquela cultura e alvo. */
  conferirProduto?: (produto: ProdutoCitadoIA) => boolean;
  /** Chaves de cálculos feitos pelo sistema que a IA pode citar como origem de uma dose. */
  origensDeDosePermitidas?: readonly string[];
};

// A IA só descreve; quem prescreve é o agrônomo. Estas duas expressões são a segunda
// trava (a primeira é o pedido ao modelo).
const DOSE = /\b\d+(?:[.,]\d+)?\s*(?:l|ml|kg|g|litros?|gramas?|quilos?)\s*\/\s*(?:ha|hectare)s?\b/i;
// Prescrever continua proibido mesmo com produto conferido: receituário não é gerado pela IA.
const RECOMENDA = /\b(?:recomendo|sugiro|indico)\s+(?:aplicar|usar|pulverizar)\b/i;

function validarProdutos(b: Record<string, unknown>, erros: Erros, conferencia: ConferenciaIA): ProdutoCitadoIA[] {
  if (b.produtos == null) return [];
  if (!Array.isArray(b.produtos) || b.produtos.length > 20) {
    erros.produtos = "Envie até 20 produtos, em uma lista.";
    return [];
  }
  const fora: string[] = [];
  const lista: ProdutoCitadoIA[] = [];
  for (const bruto of b.produtos) {
    if (!ehObjeto(bruto)) { erros.produtos = "Cada produto precisa de marca e registro."; continue; }
    const p = { marca: texto(bruto.marca).slice(0, 300), registro: texto(bruto.registro).slice(0, 40) };
    if (!p.marca || !p.registro) { erros.produtos = "Cada produto precisa de marca e registro."; continue; }
    if (!conferencia.conferirProduto) { fora.push(p.marca); continue; }
    if (!conferencia.conferirProduto(p)) { fora.push(p.marca); continue; }
    lista.push(p);
  }
  if (fora.length) {
    erros.produtos = conferencia.conferirProduto
      ? `Produto fora da base local, ou não registrado para esta cultura e alvo: ${fora.join(", ")}.`
      : "A base local de produtos não está disponível; sem ela nenhum produto é aceito.";
  }
  return lista;
}

function validarDoses(b: Record<string, unknown>, erros: Erros, conferencia: ConferenciaIA): DoseCitadaIA[] {
  if (b.doses == null) return [];
  if (!Array.isArray(b.doses) || b.doses.length > 20) { erros.doses = "Envie até 20 doses, em uma lista."; return []; }
  const permitidas = new Set(conferencia.origensDeDosePermitidas ?? []);
  const lista: DoseCitadaIA[] = [];
  for (const bruto of b.doses) {
    if (!ehObjeto(bruto)) { erros.doses = "Cada dose precisa de valor, unidade e origem."; continue; }
    const valor = numero(bruto.valor);
    const unidade = texto(bruto.unidade).slice(0, 40);
    const origem = texto(bruto.origem).slice(0, 200);
    if (valor == null || valor <= 0 || !unidade) { erros.doses = "Cada dose precisa de valor maior que zero e unidade."; continue; }
    if (!origem) { erros.doses = "Dose sem origem não é aceita: ligue ao cálculo do sistema ou ao campo da bula."; continue; }
    if (!permitidas.has(origem)) {
      erros.doses = `Dose com origem não reconhecida: ${origem}. Só valem cálculos do sistema ou campos de bula.`;
      continue;
    }
    lista.push({ valor, unidade, origem });
  }
  return lista;
}

export function validarObservacao(b: unknown, conferencia: ConferenciaIA = {}): Resultado<ObservacaoIA> {
  if (!ehObjeto(b)) return corpoInvalido();
  const erros: Erros = {};
  const tipo = texto(b.tipo);
  if (tipo !== "foto" && tipo !== "car") erros.tipo = 'Use "foto" ou "car".';
  const idFoto = texto(b.foto_id), idFazenda = texto(b.fazenda_id);
  if (tipo === "foto" && !UUID.test(idFoto)) erros.foto_id = "Informe o id da foto.";
  if (tipo === "car" && !UUID.test(idFazenda)) erros.fazenda_id = "Informe o id da fazenda.";

  const produtos = validarProdutos(b, erros, conferencia);
  const doses = validarDoses(b, erros, conferencia);

  const t = texto(b.texto);
  if (t.length < 20) erros.texto = "A observação precisa ter pelo menos 20 caracteres.";
  else if (t.length > 4000) erros.texto = "A observação passa de 4.000 caracteres.";
  else if (RECOMENDA.test(t)) erros.texto = "Retire a recomendação de aplicar: prescrever é do agrônomo responsável.";
  else if (DOSE.test(t) && !doses.length) {
    // Número de dose escrito solto no texto, sem vir de um cálculo: recusado.
    erros.texto = "Há dose no texto sem origem declarada. Toda dose precisa vir de um cálculo do sistema ou de um campo de bula.";
  }

  let incertezas: string[] = [];
  if (b.incertezas != null) {
    if (!Array.isArray(b.incertezas) || b.incertezas.length > 10) erros.incertezas = "Envie até 10 incertezas, em uma lista de textos.";
    else incertezas = b.incertezas.map((x) => texto(x).slice(0, 300)).filter(Boolean);
  }
  const v: ObservacaoIA = { tipo: tipo as ObservacaoIA["tipo"], texto: t, incertezas };
  if (tipo === "foto") v.foto_id = idFoto; else v.fazenda_id = idFazenda;
  if (produtos.length) v.produtos = produtos;
  if (doses.length) v.doses = doses;
  return fim(erros, v);
}
