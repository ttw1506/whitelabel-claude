import { NextResponse } from "next/server";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

// Falha volta para a fila até esgotar as tentativas (3 por padrão); depois a equipe vê "falhou" em /ia.
export const POST = rotaIA<{ id: string }>(async (req, { supabase }, { id }) => {
  const corpo = (await lerJson(req).catch(() => ({}))) as { erro?: string };
  const { data, error } = await supabase.rpc("ia_finalizar_tarefa", { p_id: id, p_ok: false, p_resultado: null, p_erro: String(corpo.erro ?? "") });
  if (error) return /não está em andamento/.test(error.message) ? erro(409, error.message) : erroBanco(error);
  return NextResponse.json({ tarefa: data });
});
