import { NextResponse } from "next/server";
import { pdfLaudoSolo } from "@/lib/laudo-solo";
import { dadosPdf } from "../../acoes";

// Equipe: PDF do laudo. Enviado = o arquivo guardado; antes disso, uma prévia marcada.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await dadosPdf(id);
  if (!x) return new NextResponse("Laudo não encontrado.", { status: 404 });
  const bytes = await pdfLaudoSolo(x.dados);
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="laudo-solo-${id.slice(0, 8)}.pdf"`, "cache-control": "no-store" } });
}
