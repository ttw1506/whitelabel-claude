// Laudo de solo: cálculos da seção 6 da especificação. Funções puras; as tabelas ficam em config/interpretacao-solo.json.
import tabelas from "../config/interpretacao-solo.json";

export const AVISO_RECOMENDACAO = "Sugestão técnica. A recomendação final é do agrônomo responsável.";

export type ValoresSolo = {
  ph: number; p: number; k: number; ca: number; mg: number; al: number; hal: number; mo: number; argila: number;
  s?: number | null; b?: number | null; cu?: number | null; fe?: number | null; mn?: number | null; zn?: number | null;
};
export type Profundidade = "0-20" | "20-40";
export type ClasseP = "muito_baixo" | "baixo" | "medio" | "adequado" | "alto";
export type ClasseK = "baixo" | "medio" | "adequado" | "alto";

export const NOME_CLASSE: Record<ClasseP, string> = { muito_baixo: "Muito baixo", baixo: "Baixo", medio: "Médio", adequado: "Adequado", alto: "Alto" };

const OBRIGATORIOS: [keyof ValoresSolo, string][] = [
  ["ph", "pH"], ["p", "P"], ["k", "K"], ["ca", "Ca"], ["mg", "Mg"], ["al", "Al"], ["hal", "H+Al"], ["mo", "M.O."], ["argila", "Argila"],
];

export function classificarP(p: number, argila: number) {
  const faixa = tabelas.fosforo_mehlich1.faixas.find((f) => f.argila_ate == null || argila <= f.argila_ate)!;
  const classes: ClasseP[] = ["muito_baixo", "baixo", "medio", "adequado"];
  const i = faixa.limites.findIndex((lim) => p <= lim);
  return { valor: p, classe: i < 0 ? ("alto" as ClasseP) : classes[i], faixaArgila: faixa.nome };
}

export function classificarK(kMg: number, ctc: number) {
  const t = tabelas.potassio;
  const faixa = ctc >= t.ctc_limite ? t.ctc_alta : t.ctc_baixa;
  const classes: ClasseK[] = ["baixo", "medio", "adequado"];
  const i = faixa.limites.findIndex((lim) => kMg <= lim);
  return { valor: kMg, classe: i < 0 ? ("alto" as ClasseK) : classes[i], faixaCtc: faixa.nome };
}

export function analisarSolo(valores: ValoresSolo, opcoes: { profundidade: Profundidade; prnt: number; v2?: number }) {
  for (const [chave, nome] of OBRIGATORIOS) {
    const v = valores[chave];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`Valor de ${nome} ausente ou inválido.`);
  }
  if (!(opcoes.prnt > 0 && opcoes.prnt <= 100)) throw new Error("PRNT do calcário deve estar entre 1 e 100%.");
  const v2 = opcoes.v2 ?? tabelas.v2_padrao;
  if (!(v2 > 0 && v2 <= 100)) throw new Error("V% desejada deve estar entre 1 e 100%.");

  const kCmolc = valores.k / 391;
  const sb = valores.ca + valores.mg + kCmolc;
  const ctc = sb + valores.hal;
  const v = ctc > 0 ? (sb / ctc) * 100 : 0;
  const m = sb + valores.al > 0 ? (valores.al / (sb + valores.al)) * 100 : 0;
  const calagemTHa = Math.max(0, (((v2 - v) * ctc) / 100) * (100 / opcoes.prnt));

  const g = tabelas.gessagem;
  let gessagem: { aplica: boolean; kgHa?: number; motivo: string };
  if (opcoes.profundidade !== "20-40") {
    gessagem = { aplica: false, motivo: "Gessagem é avaliada na camada de 20 a 40 cm." };
  } else {
    const motivos = [
      valores.ca < g.ca_minimo_cmolc && `Ca de ${valores.ca} cmolc/dm³, abaixo de ${g.ca_minimo_cmolc}`,
      m > g.m_maximo_pct && `m% de ${m.toFixed(1)}, acima de ${g.m_maximo_pct}%`,
    ].filter(Boolean) as string[];
    gessagem = motivos.length
      ? { aplica: true, kgHa: g.kg_por_ponto_de_argila * valores.argila, motivo: `Recomendada na camada de 20 a 40 cm: ${motivos.join("; ")}.` }
      : { aplica: false, motivo: "Camada de 20 a 40 cm sem limitação de Ca nem de alumínio: gesso não indicado." };
  }

  return {
    kCmolc, sb, ctc, v, m, v2, prnt: opcoes.prnt, calagemTHa, gessagem,
    p: classificarP(valores.p, valores.argila),
    k: classificarK(valores.k, ctc),
    aviso: AVISO_RECOMENDACAO,
  };
}

export type AnaliseSolo = ReturnType<typeof analisarSolo>;
