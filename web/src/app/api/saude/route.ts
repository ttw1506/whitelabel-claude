import { NextResponse } from "next/server";

// Para o monitor da hospedagem saber se o site e o banco estão de pé. Não mostra nada sensível.
export const dynamic = "force-dynamic";
export async function GET() {
  let banco = false;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(3000), headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
    banco = r.ok;
  } catch { /* banco fora do ar */ }
  return NextResponse.json({ site: true, banco }, { status: banco ? 200 : 503 });
}
