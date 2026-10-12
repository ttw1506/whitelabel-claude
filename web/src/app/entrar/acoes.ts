"use server";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export type EstadoEntrar = { erro?: string; email?: string };

export async function entrar(_: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  const email = String(dados.get("email") ?? "").trim();
  const senha = String(dados.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe o e-mail e a senha.", email };
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    return { erro: error.status === 400 ? "E-mail ou senha incorretos." : "Não foi possível entrar agora. Tente de novo em instantes.", email };
  }
  redirect("/");
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
