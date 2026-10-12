import { NextResponse } from "next/server";
import { validarCusto } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

export const POST = rotaIA<{ id: string }>(async (req, { supabase }, { id }) => {
  const v = validarCusto(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  const { data, error } = await supabase.from("custos").insert({ ...v.valor, safra_id: id }).select("id, status").single();
  if (error) return erroBanco(error);
  return NextResponse.json({ custo: data }, { status: 201 });
});
