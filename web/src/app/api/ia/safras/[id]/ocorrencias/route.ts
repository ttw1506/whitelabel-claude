import { NextResponse } from "next/server";
import { validarOcorrencia } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";
import { resolverTalhoes } from "@/lib/ia/talhoes";

export const POST = rotaIA<{ id: string }>(async (req, { supabase }, { id }) => {
  const v = validarOcorrencia(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  let talhao_id: string | null = null;
  if (v.valor.talhao) {
    const { achados, faltando } = await resolverTalhoes(supabase, id, [v.valor.talhao]);
    if (faltando.length) return erro(422, "Talhão não pertence a esta safra.", { talhao: `Não achei "${faltando[0]}" nesta safra.` });
    talhao_id = achados[0].id;
  }
  const resto = { ...v.valor } as Omit<typeof v.valor, "talhao"> & { talhao?: string };
  delete resto.talhao;
  const { data, error } = await supabase.from("ocorrencias").insert({ ...resto, safra_id: id, talhao_id }).select("id, status").single();
  if (error) return erroBanco(error);
  return NextResponse.json({ ocorrencia: data }, { status: 201 });
});
