import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acha talhões da safra por nome (sem diferenciar maiúsculas) ou id. Devolve os ids e o que não foi achado. */
export async function resolverTalhoes(supabase: SupabaseClient, safraId: string, refs: string[]) {
  const { data } = await supabase.from("safra_talhoes").select("talhao_id, talhoes(id, nome, area_ha)").eq("safra_id", safraId);
  const lista = (data ?? []).map((l) => l.talhoes as unknown as { id: string; nome: string; area_ha: number });
  const achados: { id: string; area_ha: number }[] = [];
  const faltando: string[] = [];
  for (const ref of refs) {
    const t = lista.find((x) => (UUID.test(ref) ? x.id === ref : x.nome.toLowerCase() === ref.toLowerCase()));
    if (t) achados.push(t); else faltando.push(ref);
  }
  return { achados, faltando };
}
