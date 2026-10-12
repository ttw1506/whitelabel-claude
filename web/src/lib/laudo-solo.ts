// Montagem do laudo de solo: valores → análise → PDF.
import { analisarSolo, formatarNumero, formatarSemZeros, NOME_CLASSE, AVISO_RECOMENDACAO, type ValoresSolo, type Profundidade } from "@soloplan/regras";
import { Documento } from "./pdf";
import { CAMPOS_SOLO } from "./campos-solo";
export { CAMPOS_SOLO };

export type DadosLaudoSolo = {
  cliente: string; fazenda: string; talhao: string | null; profundidade: Profundidade; dataColeta: string | null; laboratorio: string | null;
  valores: ValoresSolo; prnt: number; v2: number; recomendacao: string; aprovadoPor: string | null; aprovadoEm: string | null; previa: boolean;
};

const n = (v: number | null | undefined, casas?: number) => (v == null ? "—" : casas == null ? formatarSemZeros(v) : formatarNumero(v, casas));
const dataBr = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export async function pdfLaudoSolo(d: DadosLaudoSolo): Promise<Uint8Array> {
  const a = analisarSolo(d.valores, { profundidade: d.profundidade, prnt: d.prnt, v2: d.v2 });
  const doc = await Documento.criar("Laudo de análise de solo", `${d.cliente} · ${d.fazenda}${d.talhao ? ` · ${d.talhao}` : ""}`, d.previa ? "PRÉVIA - NÃO ENVIADO" : undefined);
  doc.tabela(["Profundidade", "Data da coleta", "Laboratório"], [[`${d.profundidade} cm`, dataBr(d.dataColeta), d.laboratorio ?? "—"]], [1, 1, 2]);

  doc.titulo("Resultados do laboratório");
  const linhas = CAMPOS_SOLO.filter((c) => c.obrigatorio || d.valores[c.chave] != null).map((c) => [c.nome, n(d.valores[c.chave] as number | null), c.unidade]);
  doc.tabela(["Determinação", "Valor", "Unidade"], linhas, [2, 1, 1.4], [false, true, false]);

  doc.titulo("Análise calculada");
  doc.tabela(["Indicador", "Valor"], [
    ["K", `${n(a.kCmolc, 3)} cmolc/dm³`],
    ["Soma de bases (SB)", `${n(a.sb, 2)} cmolc/dm³`],
    ["CTC a pH 7 (T)", `${n(a.ctc, 2)} cmolc/dm³`],
    ["Saturação por bases (V%)", `${n(a.v, 1)}%`],
    ["Saturação por alumínio (m%)", `${n(a.m, 1)}%`],
    ["Fósforo", `${NOME_CLASSE[a.p.classe]} (argila ${a.p.faixaArgila})`],
    ["Potássio", `${NOME_CLASSE[a.k.classe]} (${a.k.faixaCtc})`],
    ["Calagem", a.calagemTHa > 0 ? `${n(a.calagemTHa, 2)} t/ha (PRNT ${n(d.prnt)}%, V% meta ${n(d.v2)}%)` : "Não necessária"],
    ["Gessagem", a.gessagem.aplica ? `${n(a.gessagem.kgHa!, 0)} kg/ha` : "Não indicada"],
  ], [2, 2.4], [false, false]);

  doc.titulo("Recomendação");
  doc.texto(d.recomendacao || "—", { tamanho: 10 });
  doc.espaco(8);
  doc.texto(AVISO_RECOMENDACAO, { tamanho: 9, cor: undefined, negrito: true });
  doc.regua();
  doc.texto(d.aprovadoPor ? `Aprovado por ${d.aprovadoPor} em ${dataBr(d.aprovadoEm)}.` : "Aguardando aprovação do agrônomo responsável.", { tamanho: 9 });
  return doc.salvar();
}

export async function pdfLaudoSafra(d: { cliente: string; fazenda: string; safra: string; tipo: string; texto: string; aprovadoPor: string | null; aprovadoEm: string | null }) {
  const doc = await Documento.criar(`Laudo ${d.tipo} de safra`, `${d.cliente} · ${d.fazenda} · ${d.safra}`);
  doc.titulo("Parecer técnico");
  doc.texto(d.texto, { tamanho: 10 });
  doc.regua();
  doc.texto(d.aprovadoPor ? `Aprovado por ${d.aprovadoPor} em ${dataBr(d.aprovadoEm)}.` : "", { tamanho: 9 });
  return doc.salvar();
}
