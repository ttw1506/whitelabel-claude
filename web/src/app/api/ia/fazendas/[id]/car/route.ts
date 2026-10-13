import { NextResponse } from "next/server";
import { conferirCar } from "@soloplan/regras";
import { erro, rotaIA } from "@/lib/ia/http";

// A conferência do CAR é feita pelo sistema. A IA só recebe o resultado para explicar em português simples.
export const GET = rotaIA<{ id: string }>(async (_req, { supabase }, { id }) => {
  const { data: f } = await supabase.from("fazendas")
    .select("nome, uf, codigo_ibge, car_numero, area_total_ha, area_consolidada_ha, app_ha, reserva_legal_ha, talhoes(area_ha)").eq("id", id).maybeSingle();
  if (!f) return erro(404, "Fazenda não encontrada.");
  const soma = (f.talhoes as { area_ha: number | null }[] | null)?.reduce((t, x) => t + Number(x.area_ha ?? 0), 0) || null;
  const resultado = conferirCar({
    numero: f.car_numero, uf: f.uf, codigo_ibge: f.codigo_ibge, area_total_ha: f.area_total_ha, area_consolidada_ha: f.area_consolidada_ha,
    app_ha: f.app_ha, reserva_legal_ha: f.reserva_legal_ha, soma_talhoes_ha: soma,
  });
  return NextResponse.json({ fazenda: f.nome, soma_talhoes_ha: soma, resultado });
});
