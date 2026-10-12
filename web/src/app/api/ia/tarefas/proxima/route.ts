import { NextResponse } from "next/server";
import { validarTiposFiltro } from "@soloplan/regras";
import { erro, erroBanco, rotaIA } from "@/lib/ia/http";

// A IA pega a próxima tarefa da fila (204 quando não há nenhuma). A tarefa fica reservada por 10 minutos.
export const GET = rotaIA(async (req, { supabase }) => {
  const url = new URL(req.url);
  const tipos = validarTiposFiltro(url.searchParams.get("tipos"));
  if (!tipos.ok) return erro(422, "Filtro inválido.", tipos.erros);
  const { data, error } = await supabase.rpc("ia_pegar_proxima_tarefa", { p_tipos: tipos.valor, p_prazo_segundos: 600 });
  if (error) return erroBanco(error);
  const tarefa = Array.isArray(data) ? data[0] : data;
  return tarefa ? NextResponse.json({ tarefa }) : new Response(null, { status: 204 });
});
