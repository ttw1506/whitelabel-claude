/** Valida uma data de calendário sem aceitar normalização (ex.: 30/02). */
export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || texto.startsWith("0000-")) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}
