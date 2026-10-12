"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { lerDecimal, validarCpfCnpj, anoAgricolaValido, UFS, dataValida, validarNumeroCar } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { erroBanco, texto, valoresDe, type EstadoForm } from "@/lib/formulario";

type Erros = Record<string, string>;

function decimal(d: FormData, k: string, erros: Erros, { obrigatorio = false, positivo = false, negativo = false } = {}) {
  const t = texto(d, k);
  if (!t) { if (obrigatorio) erros[k] = "Preencha este campo."; return null; }
  const n = lerDecimal(t, { negativo });
  if (n == null) { erros[k] = "Use só números, com vírgula para decimais. Ex.: 120,5"; return null; }
  if (positivo && n <= 0) { erros[k] = "Precisa ser maior que zero."; return null; }
  return n;
}

const falhou = (d: FormData, campos: Erros, erro = "Confira os campos destacados."): EstadoForm => ({ erro, campos, valores: valoresDe(d) });

/* ---------- Clientes ---------- */

export async function salvarCliente(id: string | null, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const nome = texto(d, "nome");
  if (!nome) erros.nome = "Informe o nome do produtor ou da empresa.";
  let cpf_cnpj: string | null = texto(d, "cpf_cnpj") || null;
  if (cpf_cnpj) {
    const doc = validarCpfCnpj(cpf_cnpj);
    if (!doc.valido) erros.cpf_cnpj = "CPF ou CNPJ inválido. Confira os números.";
    else cpf_cnpj = doc.formatado;
  }
  const email = texto(d, "email") || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.email = "E-mail inválido.";
  const uf = texto(d, "uf").toUpperCase() || null;
  if (uf && !UFS.includes(uf)) erros.uf = "UF inválida.";
  if (Object.keys(erros).length) return falhou(d, erros);

  const linha = { nome, cpf_cnpj, email, uf, telefone: texto(d, "telefone") || null, cidade: texto(d, "cidade") || null };
  const r = id
    ? await supabase.from("clientes").update(linha).eq("id", id).select("id").single()
    : await supabase.from("clientes").insert(linha).select("id").single();
  if (r.error) return { erro: erroBanco(r.error, "Já existe um cliente com este CPF/CNPJ."), valores: valoresDe(d) };
  revalidatePath("/clientes");
  redirect(`/clientes/${r.data.id}`);
}

export async function excluirCliente(id: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores excluem." };
  const { error, count } = await supabase.from("clientes").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: error ? erroBanco(error) : "Você não tem permissão para fazer isso." };
  revalidatePath("/clientes");
  redirect("/clientes");
}

/* ---------- Fazendas ---------- */

// Número válido é guardado padronizado (maiúsculas, sem pontos); inválido fica como digitado e a conferência avisa.
const carNormalizado = (t: string) => { if (!t) return null; const v = validarNumeroCar(t); return v.ok ? v.valor : t; };

export async function salvarFazenda(id: string | null, clienteId: string | null, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const nome = texto(d, "nome");
  if (!nome) erros.nome = "Informe o nome da fazenda.";
  const codigo_ibge = texto(d, "codigo_ibge") || null;
  if (codigo_ibge && !/^\d{7}$/.test(codigo_ibge)) erros.codigo_ibge = "O código IBGE tem 7 números. Quirinópolis: 5218508.";
  const uf = texto(d, "uf").toUpperCase() || null;
  if (uf && !UFS.includes(uf)) erros.uf = "UF inválida.";
  const linha = {
    nome, municipio: texto(d, "municipio") || null, uf, codigo_ibge, car_numero: carNormalizado(texto(d, "car_numero")),
    area_total_ha: decimal(d, "area_total_ha", erros), app_ha: decimal(d, "app_ha", erros),
    reserva_legal_ha: decimal(d, "reserva_legal_ha", erros), area_consolidada_ha: decimal(d, "area_consolidada_ha", erros),
    latitude: decimal(d, "latitude", erros, { negativo: true }), longitude: decimal(d, "longitude", erros, { negativo: true }),
  };
  if (linha.latitude != null && Math.abs(linha.latitude) > 90) erros.latitude = "Latitude entre -90 e 90.";
  if (linha.longitude != null && Math.abs(linha.longitude) > 180) erros.longitude = "Longitude entre -180 e 180.";
  if (Object.keys(erros).length) return falhou(d, erros);

  const r = id
    ? await supabase.from("fazendas").update(linha).eq("id", id).select("id").single()
    : await supabase.from("fazendas").insert({ ...linha, cliente_id: clienteId }).select("id").single();
  if (r.error) return { erro: erroBanco(r.error), valores: valoresDe(d) };
  revalidatePath(`/fazendas/${r.data.id}`);
  redirect(`/fazendas/${r.data.id}`);
}

export async function excluirFazenda(id: string, clienteId: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores excluem." };
  const { error, count } = await supabase.from("fazendas").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: error ? erroBanco(error) : "Você não tem permissão para fazer isso." };
  redirect(`/clientes/${clienteId}`);
}

/* ---------- Talhões ---------- */

export async function salvarTalhao(fazendaId: string, talhaoId: string | null, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const nome = texto(d, "nome");
  if (!nome) erros.nome = "Informe o nome ou número do talhão.";
  const area_ha = decimal(d, "area_ha", erros, { obrigatorio: true, positivo: true });
  if (Object.keys(erros).length) return falhou(d, erros);
  const r = talhaoId
    ? await supabase.from("talhoes").update({ nome, area_ha }).eq("id", talhaoId).select("id").single()
    : await supabase.from("talhoes").insert({ fazenda_id: fazendaId, nome, area_ha }).select("id").single();
  if (r.error) return { erro: erroBanco(r.error, `Já existe um talhão chamado "${nome}" nesta fazenda.`), valores: valoresDe(d) };
  revalidatePath(`/fazendas/${fazendaId}`);
  return { ok: talhaoId ? "Talhão atualizado." : `Talhão ${nome} cadastrado.` };
}

export async function excluirTalhao(id: string, fazendaId: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores excluem." };
  const { error, count } = await supabase.from("talhoes").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: error ? erroBanco(error) : "Você não tem permissão para fazer isso." };
  revalidatePath(`/fazendas/${fazendaId}`);
}

/* ---------- Safras ---------- */

export async function salvarSafra(id: string | null, fazendaId: string, _: EstadoForm, d: FormData): Promise<EstadoForm> {
  const { supabase } = await sessaoEquipe();
  const erros: Erros = {};
  const ano_agricola = texto(d, "ano_agricola");
  if (!anoAgricolaValido(ano_agricola)) erros.ano_agricola = "Use o formato 2025/26.";
  const cultura = texto(d, "cultura");
  if (!cultura) erros.cultura = "Escolha a cultura.";
  const talhoes = [...new Set(d.getAll("talhoes").map(String))];
  if (!talhoes.length) erros.talhoes = "Marque pelo menos um talhão.";
  const data_plantio = texto(d, "data_plantio") || null;
  if (data_plantio && !dataValida(data_plantio)) erros.data_plantio = "Data inválida.";
  const status = texto(d, "status") === "colhida" ? "colhida" : "em_andamento";
  const linha = {
    ano_agricola, cultura, cultivar: texto(d, "cultivar") || null, data_plantio, status,
    area_ha: decimal(d, "area_ha", erros, { positivo: true }),
    estadio_atual: texto(d, "estadio_atual") || null,
    produtividade_sc_ha: decimal(d, "produtividade_sc_ha", erros),
  };
  if (Object.keys(erros).length) return falhou(d, erros);

  const r = await supabase.rpc("salvar_safra_com_talhoes", { p_id: id, p_fazenda_id: fazendaId, p_dados: linha, p_talhoes: talhoes });
  if (r.error) return { erro: erroBanco(r.error), valores: valoresDe(d) };
  const safraId = r.data;

  revalidatePath(`/fazendas/${fazendaId}`);
  redirect(`/safras/${safraId}`);
}

export async function excluirSafra(id: string, fazendaId: string) {
  const { supabase, eAdmin } = await sessaoEquipe();
  if (!eAdmin) return { erro: "Só administradores excluem." };
  const { error, count } = await supabase.from("safras").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: error ? erroBanco(error) : "Você não tem permissão para fazer isso." };
  redirect(`/fazendas/${fazendaId}`);
}

/* ---------- Pedidos dos produtores ---------- */

export async function concluirPedido(id: string) {
  const { supabase, user } = await sessaoEquipe();
  const { error } = await supabase.from("envios_cliente").update({ status: "concluido", atendido_por: user.id, atendido_em: new Date().toISOString() }).eq("id", id);
  if (error) return { erro: erroBanco(error) };
  revalidatePath("/painel");
}
