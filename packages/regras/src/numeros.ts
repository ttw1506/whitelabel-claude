// Números no formato brasileiro: vírgula decimal, ponto de milhar.

const COM_VIRGULA = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/;
const PONTO_DECIMAL = /^-?\d+\.\d+$/;
const PONTO_MILHAR = /^-?\d{1,3}(\.\d{3})+$/;

/** Lê um número digitado ("1.234,56", "3,5", "3.5"). Devolve null se não for um número claro. */
export function lerDecimal(texto: string, opcoes: { negativo?: boolean } = {}): number | null {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  let n: number;
  if (PONTO_MILHAR.test(t)) n = Number(t.replace(/\./g, ""));
  else if (COM_VIRGULA.test(t)) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (PONTO_DECIMAL.test(t)) n = Number(t);
  else return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0 && !opcoes.negativo) return null;
  return n;
}

const fmt = new Map<number, Intl.NumberFormat>();
export function formatarNumero(n: number | null | undefined, casas = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (!fmt.has(casas)) fmt.set(casas, new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  return fmt.get(casas)!.format(n);
}

export const formatarHa = (n: number | null | undefined) => (n == null ? "—" : `${formatarNumero(n, 2)} ha`);

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarReais = (n: number | null | undefined) => (n == null ? "—" : reais.format(n));

const semZeros = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
/** Número com só as casas decimais necessárias (ex.: doses 0,5 e 1,25). */
export const formatarSemZeros = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : semZeros.format(n));
