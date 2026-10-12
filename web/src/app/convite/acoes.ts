"use server";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "@/lib/formulario";

export async function criarSenha(token: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const senha = String(d.get("senha") ?? "");
  const confirmar = String(d.get("confirmar") ?? "");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== confirmar) return { erro: "As duas senhas não são iguais." };
  const supabase = await supabaseServidor();
  const v = await supabase.auth.verifyOtp({ type: "invite", token_hash: token });
  if (v.error) return { erro: "Este link de convite expirou ou já foi usado. Peça um novo à Soloplan." };
  const u = await supabase.auth.updateUser({ password: senha });
  if (u.error) return { erro: "Não foi possível salvar a senha. Tente de novo." };
  redirect("/");
}
