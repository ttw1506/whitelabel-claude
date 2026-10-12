import { NextResponse } from "next/server";
import { openapi } from "@/lib/ia/openapi";

// Pública de propósito: só descreve a API, não tem dado nenhum. As chamadas é que exigem a chave.
export function GET(req: Request) {
  const u = new URL(req.url);
  return NextResponse.json(openapi(process.env.PUBLIC_APP_URL || `${u.protocol}//${u.host}`));
}
