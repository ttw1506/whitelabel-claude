import { NextResponse } from "next/server";
import { sessaoCliente } from "@/lib/sessao";

// Download do PDF pelo produtor. As regras do banco e do armazenamento decidem se ele pode.
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = await params;
  const { supabase } = await sessaoCliente();
  const tabela = tipo === "solo" ? "laudos_solo" : tipo === "safra" ? "laudos_safra" : null;
  if (!tabela) return new NextResponse("Não encontrado.", { status: 404 });
  const { data } = await supabase.from(tabela).select("pdf_path").eq("id", id).maybeSingle();
  if (!data?.pdf_path) return new NextResponse("Laudo não encontrado.", { status: 404 });
  const { data: url } = await supabase.storage.from("documentos").createSignedUrl(data.pdf_path, 300, { download: `laudo-${tipo}-${id.slice(0, 8)}.pdf` });
  if (!url?.signedUrl) return new NextResponse("Laudo não encontrado.", { status: 404 });
  return NextResponse.redirect(url.signedUrl);
}
