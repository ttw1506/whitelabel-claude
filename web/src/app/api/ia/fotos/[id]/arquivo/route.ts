import { NextResponse } from "next/server";
import { erro, rotaIA } from "@/lib/ia/http";

// Link temporário (10 min) da foto, só para a IA analisar. A foto continua privada: o link vale poucos minutos.
export const GET = rotaIA<{ id: string }>(async (_req, { supabase }, { id }) => {
  const { data: foto } = await supabase.from("fotos").select("id, estadio, arquivo_path, safra_id, safras(cultura)").eq("id", id).maybeSingle();
  if (!foto) return erro(404, "Foto não encontrada.");
  const { data: url, error } = await supabase.storage.from("fotos").createSignedUrl(foto.arquivo_path, 600);
  if (error || !url) return erro(500, "Não foi possível gerar o link da foto.");
  const cultura = (foto.safras as unknown as { cultura: string } | null)?.cultura ?? null;
  return NextResponse.json({ url: url.signedUrl, estadio: foto.estadio, cultura });
});
