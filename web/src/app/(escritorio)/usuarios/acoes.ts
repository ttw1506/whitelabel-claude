"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sessaoEquipe } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { erroBanco, texto, valoresDe, type EstadoForm } from "@/lib/formulario";

const PAPEIS = ["admin", "funcionario", "cliente"] as const;

async function soAdmin() {
  const s = await sessaoEquipe();
  if (!s.eAdmin) throw new Error("Só administradores gerenciam usuários.");
  return s;
}

export type EstadoConvite = EstadoForm & { link?: string };

export async function convidar(_: EstadoConvite, d: FormData): Promise<EstadoConvite> {
  const { supabase } = await soAdmin();
  const erros: Record<string, string> = {};
  const nome = texto(d, "nome");
  const email = texto(d, "email").toLowerCase();
  const papel = texto(d, "papel") as (typeof PAPEIS)[number];
  const cliente_id = texto(d, "cliente_id") || null;
  if (!nome) erros.nome = "Informe o nome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.email = "E-mail inválido.";
  if (!PAPEIS.includes(papel)) erros.papel = "Escolha o papel.";
  if (papel === "cliente" && !cliente_id) erros.cliente_id = "Escolha de qual produtor é este acesso.";
  if (Object.keys(erros).length) return { erro: "Confira os campos destacados.", campos: erros, valores: valoresDe(d) };

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { nome } } });
  if (error) {
    const existe = /already|registered|exists/i.test(error.message);
    return { erro: existe ? "Já existe uma conta com este e-mail. Ajuste o papel dela na lista abaixo." : "Não foi possível criar o convite. Tente de novo.", valores: valoresDe(d) };
  }
  const r = await supabase.from("perfis").update({ nome, papel, cliente_id: papel === "cliente" ? cliente_id : null }).eq("usuario_id", data.user.id);
  if (r.error) return { erro: erroBanco(r.error), valores: valoresDe(d) };
  const h = await headers();
  const origem = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  revalidatePath("/usuarios");
  return { ok: `Convite criado para ${nome}. Envie o link abaixo (vale por 24 horas).`, link: `${origem}/convite?token_hash=${data.properties.hashed_token}` };
}

export async function salvarPerfil(usuarioId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase, user } = await soAdmin();
  const papel = texto(d, "papel") as (typeof PAPEIS)[number];
  const cliente_id = texto(d, "cliente_id") || null;
  const ativo = d.get("ativo") === "on";
  if (!PAPEIS.includes(papel)) return { erro: "Papel inválido." };
  if (papel === "cliente" && !cliente_id) return { erro: "Escolha o produtor deste acesso." };
  if (usuarioId === user.id && (papel !== "admin" || !ativo)) return { erro: "Você não pode tirar o seu próprio acesso de administrador." };
  const { error } = await supabase.from("perfis").update({ papel, ativo, cliente_id: papel === "cliente" ? cliente_id : null }).eq("usuario_id", usuarioId);
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/usuarios");
  return { ok: "Salvo." };
}
