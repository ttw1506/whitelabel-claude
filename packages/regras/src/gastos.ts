// "Meus gastos" do cliente: total investido, safra por safra e por categoria, com filtros.
import { resumoCustos } from "./custos";

export type SafraGasto = { id: string; fazenda_id: string; fazenda: string; ano_agricola: string; cultura: string; area_ha: number | null };
export type CustoGasto = { safra_id: string; categoria: string; valor: number | string };
export type FiltroGastos = { safra?: string; fazenda?: string; categoria?: string };

export function resumoGastos(safras: SafraGasto[], custos: CustoGasto[], filtro: FiltroGastos) {
  const escolhidas = safras
    .filter((s) => (!filtro.safra || s.id === filtro.safra) && (!filtro.fazenda || s.fazenda_id === filtro.fazenda))
    .sort((a, b) => b.ano_agricola.localeCompare(a.ano_agricola) || a.fazenda.localeCompare(b.fazenda, "pt-BR") || a.cultura.localeCompare(b.cultura, "pt-BR"));
  const ids = new Set(escolhidas.map((s) => s.id));
  const validos = custos.filter((c) => ids.has(c.safra_id) && (!filtro.categoria || c.categoria === filtro.categoria));

  const porSafra = escolhidas.map((s) => {
    const r = resumoCustos(validos.filter((c) => c.safra_id === s.id), s.area_ha == null ? null : Number(s.area_ha));
    return { ...s, total: r.total, porHa: r.porHa };
  });
  const areaTotal = escolhidas.reduce((a, s) => a + (s.area_ha == null ? 0 : Number(s.area_ha)), 0);
  const geral = resumoCustos(validos, areaTotal || null);
  return { total: geral.total, porHa: geral.porHa, areaTotal, safras: porSafra, categorias: geral.categorias };
}
