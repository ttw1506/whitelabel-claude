// Safra: ano agrícola, estádios fenológicos por cultura e conferência de área.

export function anoAgricolaValido(ano: string): boolean {
  const m = /^(\d{4})\/(\d{2})$/.exec(String(ano ?? "").trim());
  return !!m && (Number(m[1]) + 1) % 100 === Number(m[2]);
}

/** No Cerrado a safra de verão começa no segundo semestre: de julho em diante já é o ano agrícola novo. */
export function sugerirAnoAgricola(hoje = new Date()): string {
  const inicio = hoje.getMonth() >= 6 ? hoje.getFullYear() : hoje.getFullYear() - 1;
  return `${inicio}/${String((inicio + 1) % 100).padStart(2, "0")}`;
}

export const ESTADIOS: Record<string, string[]> = {
  soja: ["VE", "VC", "V1", "V2", "V3", "V4", "V5", "V6", "Vn", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"],
  milho: ["VE", "V2", "V4", "V6", "V8", "V10", "VT", "R1", "R2", "R3", "R4", "R5", "R6"],
};

export const CULTURAS = ["Soja", "Milho", "Sorgo", "Feijão", "Algodão", "Cana-de-açúcar", "Outra"];

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Lista padrão de estádios da cultura, ou null quando o estádio é texto livre. */
export function estadiosDa(cultura: string): string[] | null {
  return ESTADIOS[normalizar(cultura ?? "")] ?? null;
}

export function conferirAreaTalhoes(areaFazenda: number | null, areasTalhoes: number[]) {
  const soma = Math.round(areasTalhoes.reduce((a, b) => a + b, 0) * 100) / 100;
  return { soma, excede: areaFazenda != null && soma > areaFazenda };
}
