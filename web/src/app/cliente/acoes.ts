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

export async function registrarEnvioLaudoSolo(dados: { fazendaId: string; caminho: string; mensagem: string }) {
  const { supabase, clienteId } = await sessaoCliente();
  if (!dados.caminho.startsWith(`clientes/${clienteId}/envios/`)) return { erro: "Arquivo inválido." };
  const { error } = await supabase.from("envios_cliente").insert({ tipo: "laudo_solo", fazenda_id: dados.fazendaId, arquivo_path: dados.caminho, mensagem: dados.mensagem.trim() || null });
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/cliente/laudos");
  return { ok: "Laudo enviado. A Soloplan vai analisar e você recebe o resultado aqui." };
}
