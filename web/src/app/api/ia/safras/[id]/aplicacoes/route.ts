import { NextResponse } from "next/server";
import { validarAplicacao } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";
import { resolverTalhoes } from "@/lib/ia/talhoes";

export const POST = rotaIA<{ id: string }>(async (req, { supabase }, { id }) => {
  const v = validarAplicacao(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  const { achados, faltando } = await resolverTalhoes(supabase, id, v.valor.talhoes);
  if (faltando.length) return erro(422, "Talhão não pertence a esta safra.", { talhoes: `Não achei: ${faltando.join(", ")}.` });
  // Custo informado vira lançamento de custo (também rascunho) pelo gatilho do banco.
  const linha = { ...v.valor } as Omit<typeof v.valor, "talhoes"> & { talhoes?: string[] };
  delete linha.talhoes;
  if (linha.area_ha == null) linha.area_ha = achados.reduce((s, t) => s + Number(t.area_ha), 0) || undefined;
  const { data, error } = await supabase.from("aplicacoes").insert({ ...linha, safra_id: id }).select("id, status").single();
  if (error) return erroBanco(error);
  const lig = await supabase.from("aplicacao_talhoes").insert(achados.map((t) => ({ aplicacao_id: data.id, talhao_id: t.id })));
  if (lig.error) return erroBanco(lig.error);
  return NextResponse.json({ aplicacao: data }, { status: 201 });
});
