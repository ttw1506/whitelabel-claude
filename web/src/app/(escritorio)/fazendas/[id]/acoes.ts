"use server";
import { revalidatePath } from "next/cache";
import { sessaoEquipe } from "@/lib/sessao";
import { erroBanco } from "@/lib/formulario";

/** Guarda o caminho do recibo/arquivo do CAR já enviado ao depósito. O prefixo é conferido: só a pasta desta fazenda. */
export async function anexarArquivoCar(fazendaId: string, caminho: string): Promise<{ erro?: string }> {
  const { supabase } = await sessaoEquipe();
  const { data: f } = await supabase.from("fazendas").select("cliente_id").eq("id", fazendaId).maybeSingle();
  if (!f) return { erro: "Fazenda não encontrada." };
  if (!caminho.startsWith(`clientes/${f.cliente_id}/car/${fazendaId}/`) || caminho.includes("..")) return { erro: "Arquivo fora da pasta do CAR desta fazenda." };
  const { error } = await supabase.from("fazendas").update({ car_arquivo_path: caminho }).eq("id", fazendaId);
  if (error) return { erro: erroBanco(error) };
  revalidatePath(`/fazendas/${fazendaId}`);
  return {};
}
