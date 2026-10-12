import { NextResponse } from "next/server";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

export const POST = rotaIA<{ id: string }>(async (req, { supabase }, { id }) => {
  const corpo = (await lerJson(req).catch(() => ({}))) as { resultado?: unknown };
  const { data, error } = await supabase.rpc("ia_finalizar_tarefa", { p_id: id, p_ok: true, p_resultado: corpo.resultado ?? {}, p_erro: null });
  if (error) return /não está em andamento/.test(error.message) ? erro(409, error.message) : erroBanco(error);
  return NextResponse.json({ tarefa: data });
});
