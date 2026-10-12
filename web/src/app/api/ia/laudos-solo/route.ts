import { NextResponse } from "next/server";
import { analisarSolo, sugestaoRecomendacao, validarLaudoSolo, type ValoresSolo } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

// A IA só LÊ os números do laudo do laboratório. A análise e a recomendação são calculadas aqui, pelo sistema.
export const POST = rotaIA(async (req, { supabase }) => {
  const v = validarLaudoSolo(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  const { valores, prnt, v2, profundidade, ...resto } = v.valor;
  const analise = analisarSolo(valores as unknown as ValoresSolo, { profundidade, prnt, v2 });
  const { data, error } = await supabase.from("laudos_solo")
    .insert({ ...resto, profundidade, valores, prnt, v2, analise, recomendacao: sugestaoRecomendacao(analise) }).select("id, status").single();
  if (error) return erroBanco(error);
  if (resto.envio_id) await supabase.from("envios_cliente").update({ status: "em_andamento" }).eq("id", resto.envio_id).eq("status", "aberto");
  return NextResponse.json({ laudo: data }, { status: 201 });
});
