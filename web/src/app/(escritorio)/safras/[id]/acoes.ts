"use server";
import { revalidatePath } from "next/cache";
import { lerDecimal, CATEGORIAS_CUSTO, dataValida } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { erroBanco, texto, valoresDe, type EstadoForm } from "@/lib/formulario";
import { pdfLaudoSafra } from "@/lib/laudo-solo";

type Erros = Record<string, string>;
const TIPOS_OCORRENCIA = ["praga", "doenca", "planta_daninha", "deficiencia"];
const LANCAMENTOS = ["fotos", "ocorrencias", "aplicacoes", "custos"] as const;
type Lancamento = (typeof LANCAMENTOS)[number];

function numero(d: FormData, k: string, erros: Erros, { obrigatorio = false, positivo = false } = {}) {
  const t = texto(d, k);
  if (!t) { if (obrigatorio) erros[k] = "Preencha este campo."; return null; }
  const n = lerDecimal(t);
  if (n == null) { erros[k] = "Use só números, com vírgula para decimais."; return null; }
  if (positivo && n <= 0) { erros[k] = "Precisa ser maior que zero."; return null; }
  return n;
}
const falhou = (d: FormData, campos: Erros): EstadoForm => ({ erro: "Confira os campos destacados.", campos, valores: valoresDe(d) });
const atualizar = (safraId: string) => revalidatePath(`/safras/${safraId}`);

/* ---------- Fotos ---------- */

export type FotoEnviada = { arquivo_path: string; original_path: string | null; tirada_em: string | null; latitude: number | null; longitude: number | null };

export async function registrarFotos(safraId: string, dados: { talhao_id: string | null; estadio: string; anotacao: string; fotos: FotoEnviada[] }) {
  const { supabase } = await sessaoEquipe();
  if (!dados.estadio.trim()) return { erro: "Escolha o estádio." };
  if (!dados.fotos.length) return { erro: "Nenhuma foto enviada." };
  const { data: safra } = await supabase.from("safras").select("cliente_id").eq("id", safraId).maybeSingle();
  if (!safra) return { erro: "Safra não encontrada." };
  const prefixo = `clientes/${safra.cliente_id}/safras/${safraId}/`;
  const caminhoValido = (c: string) => c.startsWith(prefixo) && !c.split("/").some((parte) => parte === "." || parte === ".." || !parte);
  if (dados.fotos.some((f) => !caminhoValido(f.arquivo_path) || (f.original_path != null && !caminhoValido(f.original_path)))) return { erro: "Caminho de arquivo inválido." };
  const linhas = dados.fotos.map((f) => ({
    safra_id: safraId, talhao_id: dados.talhao_id || null, estadio: dados.estadio.trim(), anotacao: dados.anotacao.trim() || null,
    arquivo_path: f.arquivo_path, original_path: f.original_path, tirada_em: f.tirada_em ?? new Date().toISOString(),
    latitude: f.latitude, longitude: f.longitude,
  }));
  const { error } = await supabase.from("fotos").insert(linhas);
  if (error) return { erro: erroBanco(error) };
  atualizar(safraId);
  return { ok: `${linhas.length} ${linhas.length === 1 ? "foto registrada" : "fotos registradas"}.` };
}

export async function excluirFoto(id: string, safraId: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores excluem." };
  const { data: foto } = await supabase.from("fotos").select("arquivo_path, original_path").eq("id", id).single();
  const { error, count } = await supabase.from("fotos").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: error ? erroBanco(error) : "Você não tem permissão para fazer isso." };
  if (foto) await supabase.storage.from("fotos").remove([foto.arquivo_path, foto.original_path].filter(Boolean) as string[]);
  atualizar(safraId);
}

/* ---------- Ocorrências ---------- */

export async function salvarOcorrencia(safraId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const tipo = texto(d, "tipo");
  if (!TIPOS_OCORRENCIA.includes(tipo)) erros.tipo = "Escolha o tipo.";
  const nome = texto(d, "nome");
  if (!nome) erros.nome = "Informe o que foi encontrado (ex.: percevejo-marrom).";
  const data = texto(d, "data");
  if (!dataValida(data)) erros.data = "Informe a data.";
  if (Object.keys(erros).length) return falhou(d, erros);
  const { error } = await supabase.from("ocorrencias").insert({
    safra_id: safraId, talhao_id: texto(d, "talhao_id") || null, estadio: texto(d, "estadio") || null, data, tipo, nome,
    severidade: texto(d, "severidade") || null, acao_tomada: texto(d, "acao_tomada") || null,
  });
  if (error) return { erro: erroBanco(error), valores: valoresDe(d) };
  atualizar(safraId);
  return { ok: `Ocorrência "${nome}" registrada.` };
}

/* ---------- Aplicações ---------- */

export async function salvarAplicacao(safraId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const data = texto(d, "data");
  if (!dataValida(data)) erros.data = "Informe a data.";
  const tipo_operacao = texto(d, "tipo_operacao");
  if (!tipo_operacao) erros.tipo_operacao = "Escolha a operação.";
  const talhoes = [...new Set(d.getAll("talhoes").map(String))];
  if (!talhoes.length) erros.talhoes = "Marque os talhões aplicados.";
  const categoria_custo = texto(d, "categoria_custo");
  if (!CATEGORIAS_CUSTO.some((c) => c.valor === categoria_custo)) erros.categoria_custo = "Escolha a categoria.";
  const linha = {
    safra_id: safraId, data, tipo_operacao, categoria_custo,
    produto: texto(d, "produto") || null, ingrediente_ativo: texto(d, "ingrediente_ativo") || null,
    dose: numero(d, "dose", erros), dose_unidade: texto(d, "dose_unidade") || null,
    area_ha: numero(d, "area_ha", erros, { positivo: true }), custo: numero(d, "custo", erros),
  };
  if (linha.dose != null && !linha.dose_unidade) erros.dose_unidade = "Informe a unidade da dose.";
  if (Object.keys(erros).length) return falhou(d, erros);
  const r = await supabase.rpc("salvar_aplicacao_com_talhoes", { p_safra_id: safraId, p_dados: linha, p_talhoes: talhoes });
  if (r.error) return { erro: erroBanco(r.error), valores: valoresDe(d) };
  atualizar(safraId);
  return { ok: `Aplicação de ${new Date(`${data}T12:00`).toLocaleDateString("pt-BR")} registrada.` };
}

/* ---------- Custos ---------- */

export async function salvarCusto(safraId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const categoria = texto(d, "categoria");
  if (!CATEGORIAS_CUSTO.some((c) => c.valor === categoria)) erros.categoria = "Escolha a categoria.";
  const descricao = texto(d, "descricao");
  if (!descricao) erros.descricao = "Descreva o gasto (ex.: semente, frete).";
  const valor = numero(d, "valor", erros, { obrigatorio: true, positivo: true });
  const data = texto(d, "data");
  if (!dataValida(data)) erros.data = "Informe a data.";
  if (Object.keys(erros).length) return falhou(d, erros);
  const { error } = await supabase.from("custos").insert({ safra_id: safraId, categoria, descricao, valor, data });
  if (error) return { erro: erroBanco(error), valores: valoresDe(d) };
  atualizar(safraId);
  return { ok: `Custo "${descricao}" lançado.` };
}

/* ---------- Aprovar e excluir lançamentos ---------- */

export async function aprovarLancamento(tabela: Lancamento, id: string, safraId: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin || !LANCAMENTOS.includes(tabela)) return { erro: "Só administradores aprovam." };
  const { error } = await supabase.from(tabela).update({ status: "aprovado" }).eq("id", id);
  if (error) return { erro: erroBanco(error) };
  atualizar(safraId);
}

export async function excluirLancamento(tabela: Exclude<Lancamento, "fotos">, id: string, safraId: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin || !LANCAMENTOS.includes(tabela)) return { erro: "Só administradores excluem." };
  const { error, count } = await supabase.from(tabela).delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: error ? erroBanco(error) : "Você não tem permissão para fazer isso." };
  atualizar(safraId);
}

/* ---------- Laudos da safra ---------- */

export async function salvarLaudoSafra(safraId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const tipo = texto(d, "tipo") === "final" ? "final" : "parcial";
  const textoLaudo = texto(d, "texto");
  if (textoLaudo.length < 20) return falhou(d, { texto: "Escreva o laudo (pelo menos algumas linhas)." });
  const { error } = await supabase.from("laudos_safra").insert({ safra_id: safraId, tipo, conteudo: { texto: textoLaudo }, status: "em_revisao" });
  if (error) return { erro: erroBanco(error), valores: valoresDe(d) };
  atualizar(safraId);
  return { ok: "Laudo salvo para revisão do administrador." };
}

export async function aprovarEnviarLaudo(id: string, safraId: string) {
  const { supabase, eAdmin, perfil } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores aprovam e enviam laudos." };
  const { data: l } = await supabase.from("laudos_safra").select("tipo, conteudo, cliente_id, status, safras(cultura, ano_agricola, fazendas(nome, clientes(nome)))").eq("id", id).single();
  if (!l) return { erro: "Laudo não encontrado." };
  if (l.status === "enviado_ao_cliente") return { erro: "Este laudo já foi enviado." };
  const s = l.safras as unknown as { cultura: string; ano_agricola: string; fazendas: { nome: string; clientes: { nome: string } } };
  const bytes = await pdfLaudoSafra({ cliente: s.fazendas.clientes.nome, fazenda: s.fazendas.nome, safra: `${s.cultura} ${s.ano_agricola}`, tipo: l.tipo,
    texto: (l.conteudo as { texto?: string })?.texto ?? "", aprovadoPor: perfil.nome, aprovadoEm: new Date().toISOString() });
  const caminho = `clientes/${l.cliente_id}/laudos-safra/${id}/${crypto.randomUUID()}.pdf`;
  const up = await supabase.storage.from("documentos").upload(caminho, new Blob([bytes as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf" });
  if (up.error) return { erro: "Não foi possível guardar o PDF. Tente de novo." };
  const { error } = await supabase.from("laudos_safra").update({ status: "enviado_ao_cliente", pdf_path: caminho }).eq("id", id);
  if (error) return { erro: erroBanco(error) };
  atualizar(safraId);
}
