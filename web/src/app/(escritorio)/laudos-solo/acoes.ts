"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analisarSolo, lerDecimal, sugestaoRecomendacao, dataValida, type ValoresSolo } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { erroBanco, texto, valoresDe, type EstadoForm } from "@/lib/formulario";
import { CAMPOS_SOLO } from "@/lib/campos-solo";
import { pdfLaudoSolo } from "@/lib/laudo-solo";

export async function salvarLaudoSolo(id: string | null, fazendaId: string, envioId: string | null, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Record<string, string> = {};
  const valores: Partial<ValoresSolo> = {};
  for (const c of CAMPOS_SOLO) {
    const t = texto(d, c.chave);
    if (!t) { if (c.obrigatorio) erros[c.chave] = "Obrigatório."; continue; }
    const n = lerDecimal(t);
    if (n == null) erros[c.chave] = "Número inválido.";
    else valores[c.chave] = n;
  }
  const profundidade = texto(d, "profundidade") === "20-40" ? "20-40" : "0-20";
  const prnt = lerDecimal(texto(d, "prnt"));
  const v2 = lerDecimal(texto(d, "v2"));
  if (prnt == null || prnt <= 0 || prnt > 100) erros.prnt = "PRNT entre 1 e 100%.";
  if (v2 == null || v2 <= 0 || v2 > 100) erros.v2 = "V% entre 1 e 100%.";
  const data_coleta = texto(d, "data_coleta") || null;
  if (data_coleta && !dataValida(data_coleta)) erros.data_coleta = "Data inválida.";
  if (valores.ph != null && valores.ph > 14) erros.ph = "pH entre 0 e 14.";
  if (valores.argila != null && valores.argila > 100) erros.argila = "Argila entre 0 e 100%.";
  if (!["0-20", "20-40"].includes(texto(d, "profundidade"))) erros.profundidade = "Profundidade inválida.";
  if (Object.keys(erros).length) return { erro: "Confira os campos destacados.", campos: erros, valores: valoresDe(d) };

  // O cálculo é sempre refeito no servidor; o que o navegador mostrou é só prévia.
  const analise = analisarSolo(valores as ValoresSolo, { profundidade, prnt: prnt!, v2: v2! });
  const linha = {
    fazenda_id: fazendaId, talhao_id: texto(d, "talhao_id") || null, data_coleta, profundidade, laboratorio: texto(d, "laboratorio") || null,
    arquivo_path: texto(d, "arquivo_path") || null, valores, analise, prnt, v2, envio_id: envioId,
    recomendacao: texto(d, "recomendacao") || sugestaoRecomendacao(analise),
  };
  const r = id
    ? await supabase.from("laudos_solo").update(linha).eq("id", id).select("id").single()
    : await supabase.from("laudos_solo").insert(linha).select("id").single();
  if (r.error) return { erro: erroBanco(r.error), valores: valoresDe(d) };
  if (envioId) await supabase.from("envios_cliente").update({ status: "em_andamento" }).eq("id", envioId).eq("status", "aberto");
  revalidatePath(`/fazendas/${fazendaId}`);
  redirect(`/laudos-solo/${r.data.id}`);
}

/** Dados para o PDF, lidos com as permissões de quem pede. */
export async function dadosPdf(id: string, aprovador?: { nome: string; em: string }) {
  const { supabase } = await sessaoEquipe();
  const { data: l } = await supabase.from("laudos_solo")
    .select("*, fazendas(nome, clientes(nome)), talhoes(nome)").eq("id", id).maybeSingle();
  if (!l) return null;
  const f = l.fazendas as unknown as { nome: string; clientes: { nome: string } };
  let aprovadoPor = aprovador?.nome ?? null;
  if (!aprovador && l.aprovado_por) {
    const { data: p } = await supabase.from("perfis").select("nome").eq("usuario_id", l.aprovado_por).maybeSingle();
    aprovadoPor = p?.nome ?? null;
  }
  return {
    laudo: l,
    dados: {
      cliente: f.clientes.nome, fazenda: f.nome, talhao: (l.talhoes as { nome: string } | null)?.nome ?? null, profundidade: l.profundidade,
      dataColeta: l.data_coleta, laboratorio: l.laboratorio, valores: l.valores as ValoresSolo, prnt: Number(l.prnt ?? 80), v2: Number(l.v2 ?? 50),
      recomendacao: l.recomendacao ?? "", aprovadoPor, aprovadoEm: aprovador?.em ?? l.aprovado_em, previa: l.status !== "enviado_ao_cliente" && !aprovador,
    },
  };
}

export async function aprovarEnviarLaudoSolo(id: string) {
  const { supabase, eAdmin, perfil } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores aprovam e enviam laudos." };
  const x = await dadosPdf(id, { nome: perfil.nome, em: new Date().toISOString() });
  if (!x) return { erro: "Laudo não encontrado." };
  if (x.laudo.status === "enviado_ao_cliente") return { erro: "Este laudo já foi enviado. Edite o conteúdo para preparar uma nova versão." };
  let bytes: Uint8Array;
  try { bytes = await pdfLaudoSolo(x.dados); } catch (e) { return { erro: e instanceof Error ? e.message : "Não foi possível gerar o PDF." }; }
  const caminho = `clientes/${x.laudo.cliente_id}/laudos-solo/${id}/${crypto.randomUUID()}.pdf`;
  const up = await supabase.storage.from("documentos").upload(caminho, new Blob([bytes as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf" });
  if (up.error) return { erro: "Não foi possível guardar o PDF. Tente de novo." };
  const { error } = await supabase.from("laudos_solo").update({ pdf_path: caminho, status: "enviado_ao_cliente" }).eq("id", id);
  if (error) return { erro: erroBanco(error) };
  if (x.laudo.envio_id) {
    const { user } = await sessaoEquipe();
    await supabase.from("envios_cliente").update({ status: "concluido", atendido_por: user.id, atendido_em: new Date().toISOString() }).eq("id", x.laudo.envio_id);
  }
  revalidatePath(`/laudos-solo/${id}`);
}
