"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { TIPOS_TAREFA_IA } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gerarChave } from "@/lib/ia/chave";
import { erroBanco, texto, valoresDe, type EstadoForm } from "@/lib/formulario";

async function soAdmin() {
  const s = await sessaoEquipe();
  if (!s.eAdmin) throw new Error("Só administradores mexem nas chaves da IA.");
  return s;
}

export type EstadoChave = EstadoForm & { chave?: string };

export async function criarChave(_: EstadoChave, d: FormData): Promise<EstadoChave> {
  const { supabase } = await soAdmin();
  const nome = texto(d, "nome");
  if (!nome) return { erro: "Dê um nome para a chave (ex.: PC do escritório).", campos: { nome: "Obrigatório." }, valores: valoresDe(d) };
  const { chave, hash, prefixo } = gerarChave();
  const { error } = await supabase.from("chaves_ia").insert({ nome, hash, prefixo });
  if (error) return { erro: erroBanco(error), valores: valoresDe(d) };
  revalidatePath("/ia");
  return { ok: "Chave criada. Copie agora: ela não aparece de novo.", chave };
}

export async function revogarChave(id: string): Promise<{ erro?: string }> {
  const { supabase } = await soAdmin();
  const { error } = await supabase.from("chaves_ia").update({ revogada_em: new Date().toISOString() }).eq("id", id).is("revogada_em", null);
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/ia");
  return {};
}

/** Cria o usuário "IA do escritório" (sem senha utilizável: ele só entra pela API, com a chave). */
export async function criarUsuarioIA(): Promise<{ erro?: string }> {
  const { supabase } = await soAdmin();
  const admin = supabaseAdmin();
  const email = "ia@soloplan.local";
  const { data, error } = await admin.auth.admin.createUser({ email, password: randomBytes(32).toString("base64url"), email_confirm: true, user_metadata: { nome: "IA do escritório" } });
  if (error) return { erro: /already|registered|exists/i.test(error.message) ? "O usuário da IA já existe." : "Não foi possível criar o usuário da IA." };
  const r = await supabase.from("perfis").update({ papel: "ia", nome: "IA do escritório", ativo: true }).eq("usuario_id", data.user.id);
  if (r.error) return { erro: erroBanco(r.error) };
  revalidatePath("/ia");
  return {};
}

export async function pedirTarefa(_: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const tipo = texto(d, "tipo");
  const cliente_id = texto(d, "cliente_id") || null;
  const referencia_id = texto(d, "referencia_id") || null;
  const observacao = texto(d, "observacao");
  if (!(TIPOS_TAREFA_IA as readonly string[]).includes(tipo)) return { erro: "Escolha o tipo de tarefa.", campos: { tipo: "Obrigatório." }, valores: valoresDe(d) };
  if (referencia_id && !/^[0-9a-f-]{36}$/i.test(referencia_id)) return { erro: "O id informado não parece válido.", campos: { referencia_id: "Id inválido." }, valores: valoresDe(d) };
  const { error } = await supabase.from("tarefas_ia").insert({ tipo, cliente_id, referencia_id, entrada: observacao ? { observacao } : {} });
  if (error) return { erro: erroBanco(error), valores: valoresDe(d) };
  revalidatePath("/ia");
  return { ok: "Tarefa colocada na fila." };
}

export async function cancelarTarefa(id: string): Promise<{ erro?: string }> {
  const { supabase } = await sessaoEquipe();
  const { error } = await supabase.from("tarefas_ia").update({ status: "cancelada", concluida_em: new Date().toISOString() }).eq("id", id).in("status", ["pendente", "falhou"]);
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/ia");
  return {};
}

export async function decidirPreco(id: string, aprovar: boolean): Promise<{ erro?: string }> {
  const { supabase } = await sessaoEquipe();
  const { error } = aprovar
    ? await supabase.from("precos_dia").update({ status: "aprovado" }).eq("id", id)
    : await supabase.from("precos_dia").delete().eq("id", id);
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/ia");
  return {};
}

export async function decidirObservacao(id: string, aprovar: boolean): Promise<{ erro?: string }> {
  const { supabase } = await sessaoEquipe();
  const { error } = aprovar
    ? await supabase.from("observacoes_ia").update({ status: "aprovado" }).eq("id", id)
    : await supabase.from("observacoes_ia").delete().eq("id", id);
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/ia");
  return {};
}
