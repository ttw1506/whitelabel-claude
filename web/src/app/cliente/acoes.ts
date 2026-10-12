"use server";
import { revalidatePath } from "next/cache";
import { sessaoCliente } from "@/lib/sessao";
import { erroBanco, texto, type EstadoForm } from "@/lib/formulario";

export async function pedirLaudoParcial(safraId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoCliente();
  const { count } = await supabase.from("envios_cliente").select("id", { count: "exact", head: true })
    .eq("safra_id", safraId).eq("tipo", "pedido_laudo_parcial").neq("status", "concluido");
  if (count) return { ok: "Você já tem um pedido em aberto para esta safra. A Soloplan vai responder em breve." };
  const { error } = await supabase.from("envios_cliente").insert({ tipo: "pedido_laudo_parcial", safra_id: safraId, mensagem: texto(d, "mensagem") || null });
  if (error) return { erro: erroBanco(error) };
  revalidatePath(`/cliente/safras/${safraId}`);
  return { ok: "Pedido enviado. A Soloplan vai preparar o laudo parcial e avisar quando estiver pronto." };
}
