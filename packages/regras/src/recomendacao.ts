// Texto-sugestão de recomendação a partir da análise. O agrônomo edita antes de aprovar.
import { NOME_CLASSE, type AnaliseSolo } from "./solo";
import { formatarNumero, formatarSemZeros } from "./numeros";

const minusculo = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function sugestaoRecomendacao(a: AnaliseSolo): string {
  const linhas: string[] = [];
  linhas.push(
    a.calagemTHa > 0
      ? `Calagem: aplicar ${formatarNumero(a.calagemTHa, 2)} t/ha de calcário com PRNT ${formatarSemZeros(a.prnt)}% para elevar a saturação por bases de ${formatarNumero(a.v, 1)}% para ${formatarSemZeros(a.v2)}%.`
      : `Calagem: não necessária (saturação por bases de ${formatarNumero(a.v, 1)}%, meta de ${formatarSemZeros(a.v2)}%).`,
  );
  if (a.gessagem.aplica) linhas.push(`Gessagem: aplicar ${formatarNumero(a.gessagem.kgHa!, 0)} kg/ha de gesso agrícola. ${a.gessagem.motivo}`);
  else if (a.gessagem.motivo.includes("20 a 40 cm sem")) linhas.push(`Gessagem: ${minusculo(a.gessagem.motivo)}`);
  linhas.push(`Fósforo (Mehlich-1): ${formatarSemZeros(a.p.valor)} mg/dm³, ${minusculo(NOME_CLASSE[a.p.classe])} para argila ${a.p.faixaArgila}.`);
  linhas.push(`Potássio: ${formatarSemZeros(a.k.valor)} mg/dm³, ${minusculo(NOME_CLASSE[a.k.classe])} (${a.k.faixaCtc}).`);
  linhas.push(`Saturação por alumínio (m%): ${formatarNumero(a.m, 1)}%.`);
  return linhas.join("\n");
}
