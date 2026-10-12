import { NextResponse } from "next/server";
import { erro, rotaIA } from "@/lib/ia/http";

// Tudo que a IA precisa para escrever um laudo da safra: dados já registrados (inclusive rascunhos), sem cálculo dela.
export const GET = rotaIA<{ id: string }>(async (_req, { supabase }, { id }) => {
  const { data: safra } = await supabase.from("safras")
    .select("id, ano_agricola, cultura, cultivar, data_plantio, status, fazendas(nome, municipio, clientes(nome))").eq("id", id).maybeSingle();
  if (!safra) return erro(404, "Safra não encontrada.");
  const [talhoes, ocorrencias, aplicacoes, custos, fotos] = await Promise.all([
    supabase.from("safra_talhoes").select("talhoes(id, nome, area_ha)").eq("safra_id", id),
    supabase.from("ocorrencias").select("tipo, nome, data, estadio, severidade, acao_tomada, status").eq("safra_id", id).order("data"),
    supabase.from("aplicacoes").select("data, tipo_operacao, produto, ingrediente_ativo, dose, dose_unidade, area_ha, custo, status").eq("safra_id", id).order("data"),
    supabase.from("custos").select("categoria, descricao, valor, data, status").eq("safra_id", id).order("data"),
    supabase.from("fotos").select("id, estadio, data, status").eq("safra_id", id).order("data"),
  ]);
  return NextResponse.json({
    safra, talhoes: (talhoes.data ?? []).map((t) => t.talhoes),
    ocorrencias: ocorrencias.data ?? [], aplicacoes: aplicacoes.data ?? [], custos: custos.data ?? [], fotos: fotos.data ?? [],
  });
});
