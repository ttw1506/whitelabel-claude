// Dados de DEMONSTRAÇÃO (todos fictícios). Apaga os dados do banco de desenvolvimento e cria um cenário pequeno e limpo.
// Uso (com o Supabase local rodando): node dev/seed-demo.mjs [pasta-com-fotos-de-exemplo]
// Entra pelas mesmas regras do sistema: o que é lançado pela equipe, pela IA e pelo produtor segue o fluxo de aprovação.
import pg from "pg";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const PG = process.env.PG_URL || "postgres://postgres:postgres@127.0.0.1:5432/soloplan_dev";
const FOTOS = process.argv[2] || "/tmp/demofotos";
const chaves = Object.fromEntries(readFileSync(new URL("./.keys", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(SUPABASE, chaves.SERVICE_ROLE_KEY, opcoes);
const SENHA = "teste-123456";
const um = async (q) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data; };

// 1. Limpeza (só o ambiente de desenvolvimento).
const db = new pg.Client({ connectionString: PG });
await db.connect();
await db.query("truncate public.clientes, public.auditoria restart identity cascade");
for (const bucket of ["fotos", "documentos"]) {   // o armazenamento só aceita apagar pela API dele
  const { rows } = await db.query("select name from storage.objects where bucket_id = $1", [bucket]);
  for (let i = 0; i < rows.length; i += 100) await servico.storage.from(bucket).remove(rows.slice(i, i + 100).map((r) => r.name));
}
await db.query("delete from auth.users where email like '%@teste.local' or email like '%@exemplo.local'");
// O truncate em cascata também esvazia os perfis (eles apontam para clientes): recria um perfil para cada conta.
await db.query("insert into public.perfis (usuario_id, nome) select id, coalesce(nullif(raw_user_meta_data ->> 'nome', ''), email) from auth.users on conflict do nothing");
await db.end();

// 2. Contas de demonstração.
async function conta(email, nome, papel, clienteId = null) {
  const existente = (await servico.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email);
  const u = existente ?? (await um(servico.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { nome } }))).user;
  await um(servico.from("perfis").update({ nome, papel, cliente_id: clienteId, ativo: true }).eq("usuario_id", u.id));
  const c = createClient(SUPABASE, chaves.ANON_KEY, opcoes);
  await um(c.auth.signInWithPassword({ email, password: SENHA }));
  return c;
}
const admin = await conta("luciano@soloplan.local", "Luciano Batata", "admin");
await conta("mateus@soloplan.local", "Mateus Batata", "admin");
const func = await conta("funcionario@soloplan.local", "Ana Funcionária", "funcionario");
const ia = await conta("ia@soloplan.local", "IA do escritório", "ia");

// 3. Cadastros (feitos pela equipe).
const cliente = (nome, doc, cidade) => um(admin.from("clientes").insert({ nome, cpf_cnpj: doc, telefone: "(64) 90000-0000", email: null, cidade, uf: "GO" }).select("id").single());
const c1 = await cliente("Agropecuária Vale do Meia Ponte (exemplo)", "11.222.333/0001-81", "Quirinópolis");
const c2 = await cliente("Marcos Antônio Silveira (exemplo)", "529.982.247-25", "Gouvelândia");
const produtor1 = await conta("produtor1@exemplo.local", "Agropecuária Vale do Meia Ponte", "cliente", c1.id);
const produtor2 = await conta("produtor2@exemplo.local", "Marcos Silveira", "cliente", c2.id);

const fazenda = (c, nome, mun, ibge, total, cons, rl, app) => um(func.from("fazendas").insert({ cliente_id: c, nome, municipio: mun, uf: "GO", codigo_ibge: ibge, area_total_ha: total, area_consolidada_ha: cons, reserva_legal_ha: rl, app_ha: app }).select("id").single());
const fBoaVista = await fazenda(c1.id, "Fazenda Boa Vista (exemplo)", "Quirinópolis", "5218508", 1680.5, 1250.5, 336.1, 93.9);
const fSantaLuzia = await fazenda(c2.id, "Fazenda Santa Luzia (exemplo)", "Gouvelândia", "5209101", 600, 480, 120, 0);
const talhao = async (f, nome, ha) => (await um(func.from("talhoes").insert({ fazenda_id: f, nome, area_ha: ha }).select("id").single())).id;
const [t1, t2, t3, t4] = [await talhao(fBoaVista.id, "T1", 320), await talhao(fBoaVista.id, "T2", 280.5), await talhao(fBoaVista.id, "T3", 350), await talhao(fBoaVista.id, "T4", 300)];
const m1 = await talhao(fSantaLuzia.id, "Gleba 1", 260);
const m2 = await talhao(fSantaLuzia.id, "Gleba 2", 220);

async function safra(dados, talhoes) {
  const s = await um(func.from("safras").insert(dados).select("id").single());
  await um(func.from("safra_talhoes").insert(talhoes.map((talhao_id) => ({ safra_id: s.id, talhao_id }))));
  return s.id;
}
const sAnterior = await safra({ fazenda_id: fBoaVista.id, ano_agricola: "2025/26", cultura: "Soja", cultivar: "Cultivar exemplo A", data_plantio: "2025-10-12", area_ha: 1250.5, estadio_atual: "R8", status: "colhida", produtividade_sc_ha: 62.4 }, [t1, t2, t3, t4]);
const sAtual = await safra({ fazenda_id: fBoaVista.id, ano_agricola: "2026/27", cultura: "Soja", cultivar: "Cultivar exemplo B", data_plantio: "2026-09-22", area_ha: 950.5, estadio_atual: "V3" }, [t1, t2, t3]);
const sMilho = await safra({ fazenda_id: fSantaLuzia.id, ano_agricola: "2026/27", cultura: "Milho", cultivar: "Híbrido exemplo", data_plantio: "2026-10-01", area_ha: 480, estadio_atual: "V4" }, [m1, m2]);

// 4. Fotos de exemplo (enviadas pela equipe, aprovadas na hora).
async function foto(safraId, clienteId, talhaoId, estadio, arquivo, quando, nota, lat = -18.4478, lon = -50.4512) {
  const caminho = `clientes/${clienteId}/safras/${safraId}/${crypto.randomUUID()}.jpg`;
  const bytes = readFileSync(`${FOTOS}/${arquivo}.jpg`);
  const up = await func.storage.from("fotos").upload(caminho, new Blob([bytes], { type: "image/jpeg" }), { contentType: "image/jpeg" });
  if (up.error) throw new Error(up.error.message);
  await um(func.from("fotos").insert({ safra_id: safraId, talhao_id: talhaoId, estadio, arquivo_path: caminho, tirada_em: quando, anotacao: nota, latitude: lat, longitude: lon }));
}
await foto(sAnterior, c1.id, t1, "V3", "soja-v3", "2025-11-18T11:20:00-03:00", "Estande uniforme, 280 mil plantas por hectare.");
await foto(sAnterior, c1.id, t2, "R1", "soja-r1", "2026-01-06T09:40:00-03:00", "Início do florescimento. Sem pragas acima do nível de controle.");
await foto(sAnterior, c1.id, t1, "R5", "soja-r5", "2026-02-10T10:05:00-03:00", "Enchimento de grãos com boa sanidade.");
await foto(sAnterior, c1.id, t3, "R8", "soja-r8", "2026-03-12T08:30:00-03:00", "Maturação plena. Colheita liberada.");
await foto(sAtual, c1.id, t1, "VE", "soja-ve", "2026-09-30T08:15:00-03:00", "Emergência uniforme em todo o talhão.");
await foto(sAtual, c1.id, t2, "V1", "soja-v1", "2026-10-05T10:30:00-03:00", "Primeira folha trifoliolada aberta.");
await foto(sAtual, c1.id, t1, "V3", "soja-v3", "2026-10-10T09:10:00-03:00", "Terceiro trifólio. Estande dentro do esperado.");
await foto(sAtual, c1.id, t3, "V3", "soja-v3", "2026-10-11T16:45:00-03:00", "T3 com leve falha de plantio na cabeceira.");
await foto(sMilho, c2.id, m1, "V4", "milho-v4", "2026-10-09T09:00:00-03:00", "Milho com quatro folhas, boa uniformidade.", -18.6, -50.1);

// 5. Custos, aplicações e ocorrências.
const custo = (safra_id, categoria, descricao, valor, data) => um(func.from("custos").insert({ safra_id, categoria, descricao, valor, data }));
for (const [cat, desc, v] of [["sementes", "Sementes tratadas", 540000], ["fertilizantes_corretivos", "Adubação de base e cobertura", 1320000], ["defensivos", "Fungicidas, inseticidas e herbicidas", 1560000], ["operacoes_maquinas", "Plantio, pulverizações e colheita", 1080000], ["outros", "Frete e armazenagem", 300000]])
  await custo(sAnterior, cat, desc, v, "2026-03-20");
await custo(sAtual, "sementes", "Sementes tratadas", 405000, "2026-09-15");
await custo(sAtual, "fertilizantes_corretivos", "Adubação de base", 760000, "2026-09-18");
const aplic = (dados, talhoes) => um(func.from("aplicacoes").insert(dados).select("id").single()).then(async (a) => { await um(func.from("aplicacao_talhoes").insert(talhoes.map((talhao_id) => ({ aplicacao_id: a.id, talhao_id })))); return a.id; });
await aplic({ safra_id: sAtual, data: "2026-09-20", tipo_operacao: "Dessecação", produto: "Herbicida exemplo", ingrediente_ativo: "Glifosato", dose: 2, dose_unidade: "L/ha", area_ha: 950.5, custo: 52000, categoria_custo: "defensivos" }, [t1, t2, t3]);
await aplic({ safra_id: sAtual, data: "2026-10-08", tipo_operacao: "Pulverização", produto: "Inseticida exemplo", ingrediente_ativo: "Tiametoxam + lambda-cialotrina", dose: 0.2, dose_unidade: "L/ha", area_ha: 950.5, custo: 71000, categoria_custo: "defensivos" }, [t1, t2, t3]);
await um(func.from("ocorrencias").insert({ safra_id: sAtual, talhao_id: t3, estadio: "V3", data: "2026-10-11", tipo: "praga", nome: "Lagarta-falsa-medideira", severidade: "1 lagarta por metro (abaixo do nível de controle)", acao_tomada: "Monitorar novamente em 5 dias." }));

// 6. Pendências: rascunhos da IA, laudos em revisão e pedido do produtor.
await um(ia.from("custos").insert({ safra_id: sAtual, categoria: "operacoes_maquinas", descricao: "Hora-máquina de pulverização (sugerido pela IA)", valor: 18500 }));
await um(ia.from("ocorrencias").insert({ safra_id: sAtual, talhao_id: t2, estadio: "V3", tipo: "doenca", nome: "Possível mancha-alvo (sugerido pela IA, confirmar em campo)" }));
await um(func.from("laudos_safra").insert({ safra_id: sAnterior, tipo: "final", conteudo: { texto: "Safra 2025/26 encerrada com produtividade média de 62,4 sc/ha em 1.250,5 ha. O ciclo teve boa distribuição de chuvas no enchimento de grãos e sanidade dentro do esperado. Recomenda-se manter a rotação com milho safrinha e reforçar a calagem nos talhões T2 e T3.\n\n(Texto de exemplo.)" }, status: "em_revisao" }));
await um(produtor1.from("envios_cliente").insert({ tipo: "pedido_laudo_parcial", safra_id: sAtual, mensagem: "Notei folhas amareladas perto da cabeceira do T3." }));

console.log(JSON.stringify({ c1: c1.id, c2: c2.id, fBoaVista: fBoaVista.id, fSantaLuzia: fSantaLuzia.id, sAnterior, sAtual, sMilho, talhoes: { t1, t2, t3, t4 } }));
