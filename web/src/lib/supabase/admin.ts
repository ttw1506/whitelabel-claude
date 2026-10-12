// Cliente com a chave de serviço: SÓ no servidor, SÓ para operações de conta (convidar, listar e-mails).
// Nunca usar para ler ou gravar dados de lavoura: isso passa pelas regras do banco com o usuário logado.
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
