import { NextResponse } from "next/server";
import { validarPreco } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

export const POST = rotaIA(async (req, { supabase }) => {
  const v = validarPreco(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  const { data, error } = await supabase.from("precos_dia").insert(v.valor).select("id, status").single();
  if (error) return erroBanco(error);
  return NextResponse.json({ preco: data }, { status: 201 });
});
