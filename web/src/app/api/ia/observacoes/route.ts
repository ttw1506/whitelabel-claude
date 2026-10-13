import { NextResponse } from "next/server";
import { validarObservacao } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

// Observação da IA sobre uma foto ou sobre o CAR. Nasce rascunho_ia; só um administrador aprova.
export const POST = rotaIA(async (req, { supabase }) => {
  const v = validarObservacao(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  const { data, error } = await supabase.from("observacoes_ia").insert(v.valor).select("id, status").single();
  if (error) return erroBanco(error);
  return NextResponse.json({ observacao: data }, { status: 201 });
});
