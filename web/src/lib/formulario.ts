import type { PostgrestError } from "@supabase/supabase-js";

export type EstadoForm = { erro?: string; ok?: string; campos?: Record<string, string>; valores?: Record<string, string> };

export const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
export const valoresDe = (d: FormData) => Object.fromEntries([...d.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

/** Mensagem clara para o erro do banco. */
export function erroBanco(e: PostgrestError, duplicado = "Já existe um registro com esses dados."): string {
  if (e.code === "23505") return duplicado;
  if (e.code === "42501" || /row-level security/.test(e.message)) return "Você não tem permissão para fazer isso.";
  if (e.code === "23514" || e.code === "22023" || e.code === "23503") return e.message;
  return "Não foi possível salvar. Tente de novo; se continuar, avise o administrador.";
}
