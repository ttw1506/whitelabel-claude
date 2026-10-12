import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServidor } from "./supabase/server";

export type Papel = "admin" | "funcionario" | "cliente" | "ia";
export type Perfil = { usuario_id: string; nome: string; papel: Papel; cliente_id: string | null; ativo: boolean };

/** Usuário logado e o perfil dele. Uma consulta por requisição. */
export const sessao = cache(async () => {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: perfil } = await supabase.from("perfis").select("usuario_id, nome, papel, cliente_id, ativo").eq("usuario_id", user.id).single<Perfil>();
  return { supabase, user, perfil };
});

/** Para as telas do escritório: só admin e funcionário. */
export async function sessaoEquipe() {
  const s = await sessao();
  if (!s.perfil || !s.perfil.ativo) redirect("/aguardando");
  if (s.perfil.papel === "cliente") redirect(s.perfil.cliente_id ? "/cliente" : "/aguardando");
  if (s.perfil.papel === "ia") redirect("/aguardando");
  return { ...s, perfil: s.perfil, eAdmin: s.perfil.papel === "admin" };
}

/** Para a área do produtor: só cliente vinculado e ativo. */
export async function sessaoCliente() {
  const s = await sessao();
  if (!s.perfil?.ativo || s.perfil.papel !== "cliente" || !s.perfil.cliente_id) redirect("/");
  return { ...s, perfil: s.perfil, clienteId: s.perfil.cliente_id };
}
