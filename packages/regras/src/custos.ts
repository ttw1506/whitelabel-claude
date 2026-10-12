// Custos da safra: por categoria, total e R$/ha. Contas em centavos.

export const CATEGORIAS_CUSTO = [
  { valor: "sementes", nome: "Sementes" },
  { valor: "fertilizantes_corretivos", nome: "Fertilizantes e corretivos" },
  { valor: "defensivos", nome: "Defensivos" },
  { valor: "operacoes_maquinas", nome: "Operações e máquinas" },
  { valor: "outros", nome: "Outros" },
] as const;

export type CategoriaCusto = (typeof CATEGORIAS_CUSTO)[number]["valor"];
export const nomeCategoria = (c: string) => CATEGORIAS_CUSTO.find((x) => x.valor === c)?.nome ?? c;

const centavos = (v: number | string) => Math.round(Number(v) * 100);

export function resumoCustos(lancamentos: { categoria: string; valor: number | string }[], areaHa: number | null) {
  const porCategoria = new Map<string, number>(CATEGORIAS_CUSTO.map((c) => [c.valor, 0]));
  for (const l of lancamentos) porCategoria.set(l.categoria, (porCategoria.get(l.categoria) ?? 0) + centavos(l.valor));
  const totalC = [...porCategoria.values()].reduce((a, b) => a + b, 0);
  const area = areaHa != null && areaHa > 0 ? areaHa : null;
  const porHa = (c: number) => (area == null ? null : Math.round(c / area) / 100);
  return {
    total: totalC / 100,
    porHa: porHa(totalC),
    categorias: [...porCategoria.entries()].map(([categoria, c]) => ({
      categoria,
      nome: nomeCategoria(categoria),
      valor: c / 100,
      porHa: porHa(c),
      participacao: totalC ? c / totalC : 0,
    })),
  };
}
