import { NextResponse } from "next/server";
import { validarLaudoSafra } from "@soloplan/regras";
import { erro, erroBanco, lerJson, rotaIA } from "@/lib/ia/http";

// Texto do laudo parcial ou final escrito pela IA. Nasce rascunho_ia; só um admin aprova e envia.
export const POST = rotaIA<{ id: string }>(async (req, { supabase }, { id }) => {
  const v = validarLaudoSafra(await lerJson(req));
  if (!v.ok) return erro(422, "Dados inválidos.", v.erros);
  const { data, error } = await supabase.from("laudos_safra")
    .insert({ safra_id: id, tipo: v.valor.tipo, conteudo: { texto: v.valor.texto, origem: "ia" } }).select("id, status").single();
  if (error) return erroBanco(error);
  return NextResponse.json({ laudo: data }, { status: 201 });
});
