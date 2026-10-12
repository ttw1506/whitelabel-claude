// Sessão da IA: a chave de API só prova quem está chamando. Quem grava é o usuário "ia" de verdade,
// com o JWT dele, para que as regras do banco (rascunho obrigatório, sem aprovar, sem apagar) valham também aqui.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chaveDoCabecalho, hashChave } from "./chave";

type Cache = { token: string; ate: number };
let cache: Cache | null = null;
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

async function tokenDaIA(): Promise<string> {
  if (cache && cache.ate > Date.now()) return cache.token;
  const admin = supabaseAdmin();
  const { data: perfil } = await admin.from("perfis").select("usuario_id").eq("papel", "ia").eq("ativo", true).limit(1).maybeSingle();
  if (!perfil) throw new Error("Nenhum usuário com papel 'ia' ativo. Crie um em Usuários.");
  const { data: u, error: e1 } = await admin.auth.admin.getUserById(perfil.usuario_id);
  if (e1 || !u.user?.email) throw new Error("Usuário da IA sem e-mail.");
  const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (e2 || !link.properties?.hashed_token) throw new Error("Não foi possível abrir a sessão da IA.");
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opcoes);
  const { data: s, error: e3 } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (e3 || !s.session) throw new Error("Sessão da IA recusada.");
  cache = { token: s.session.access_token, ate: Date.now() + 45 * 60 * 1000 };
  return cache.token;
}

export type SessaoIA = { supabase: SupabaseClient; chaveId: string };

/** Confere a chave de API (Authorization: Bearer sp_ia_...) e devolve um cliente do banco com papel ia. */
export async function autenticarIA(request: Request): Promise<SessaoIA | null> {
  const chave = chaveDoCabecalho(request.headers.get("authorization"));
  if (!chave) return null;
  const admin = supabaseAdmin();
  const { data } = await admin.from("chaves_ia").select("id").eq("hash", hashChave(chave)).is("revogada_em", null).maybeSingle();
  if (!data) return null;
  await admin.from("chaves_ia").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", data.id);
  const token = await tokenDaIA();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    ...opcoes, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { supabase, chaveId: data.id };
}
