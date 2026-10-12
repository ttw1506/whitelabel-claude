// Programa do PC do escritório: pega tarefas da fila do Soloplan, pede o texto ao Ollama (IA local) e devolve como RASCUNHO.
// Não precisa instalar nada além do Node 20+ e do Ollama. Veja ia-local/LEIA-ME.md.
//
//   SOLOPLAN_URL=https://app.exemplo.com.br SOLOPLAN_CHAVE=sp_ia_... node ia-local/worker.mjs
//   Opções: OLLAMA_URL (padrão http://127.0.0.1:11434)  OLLAMA_MODELO (padrão llama3.1)  --uma-vez (processa a fila e sai)
const BASE = (process.env.SOLOPLAN_URL || "").replace(/\/$/, "");
const CHAVE = process.env.SOLOPLAN_CHAVE || "";
const OLLAMA = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const MODELO = process.env.OLLAMA_MODELO || "llama3.1";
const UMA_VEZ = process.argv.includes("--uma-vez");
const PAUSA_MS = Number(process.env.PAUSA_SEGUNDOS || 20) * 1000;

if (!BASE || !CHAVE) { console.error("Faltou SOLOPLAN_URL ou SOLOPLAN_CHAVE (veja ia-local/LEIA-ME.md)."); process.exit(1); }

const chamar = (caminho, opcoes = {}) => fetch(`${BASE}/api/ia${caminho}`, {
  ...opcoes, headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...(opcoes.headers || {}) },
});
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString("pt-BR"), ...a);

async function perguntar(prompt) {
  const r = await fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: MODELO, prompt, stream: false }) });
  if (!r.ok) throw new Error(`Ollama respondeu ${r.status}. Ele está ligado e o modelo "${MODELO}" instalado?`);
  const { response } = await r.json();
  if (!response || response.trim().length < 20) throw new Error("O Ollama devolveu um texto vazio ou curto demais.");
  return response.trim();
}

// A IA só escreve texto com os dados que o sistema já tem. Não inventa números nem calcula.
function promptLaudo(tipo, c) {
  const l = (xs, f) => (xs.length ? xs.map(f).join("\n") : "(nenhum registro)");
  return [
    `Você é um agrônomo consultor em Quirinópolis-GO. Escreva em português do Brasil um laudo ${tipo === "final" ? "FINAL" : "PARCIAL"} da safra, claro e direto, para o produtor rural.`,
    "Use SOMENTE os dados abaixo. Não invente números, produtos ou datas. Se faltar informação, diga que não foi registrada.",
    `Produtor: ${c.safra.fazendas?.clientes?.nome ?? "?"} · Fazenda: ${c.safra.fazendas?.nome ?? "?"} · ${c.safra.cultura} ${c.safra.ano_agricola}`,
    `Talhões: ${c.talhoes.map((t) => `${t.nome} (${t.area_ha} ha)`).join(", ") || "(nenhum)"}`,
    "Ocorrências:\n" + l(c.ocorrencias, (o) => `- ${o.data} ${o.tipo}: ${o.nome}${o.severidade ? ` (${o.severidade})` : ""}${o.acao_tomada ? ` · ação: ${o.acao_tomada}` : ""}`),
    "Aplicações:\n" + l(c.aplicacoes, (a) => `- ${a.data} ${a.tipo_operacao}${a.produto ? ` · ${a.produto}` : ""}${a.dose ? ` ${a.dose} ${a.dose_unidade ?? ""}` : ""}`),
    "Termine com: Sugestão técnica. A recomendação final é do agrônomo responsável.",
  ].join("\n\n");
}

async function processar(tarefa) {
  if (tarefa.tipo === "gerar_laudo_parcial" || tarefa.tipo === "gerar_laudo_final") {
    if (!tarefa.referencia_id) throw new Error("A tarefa não diz de qual safra é (falta o id da safra).");
    const r = await chamar(`/safras/${tarefa.referencia_id}/contexto`);
    if (!r.ok) throw new Error(`Não consegui ler a safra (${r.status}).`);
    const tipo = tarefa.tipo === "gerar_laudo_final" ? "final" : "parcial";
    const texto = await perguntar(promptLaudo(tipo, await r.json()));
    const env = await chamar(`/safras/${tarefa.referencia_id}/laudos`, { method: "POST", body: JSON.stringify({ tipo, texto }) });
    if (!env.ok) throw new Error(`O Soloplan recusou o laudo: ${await env.text()}`);
    return { laudo_id: (await env.json()).laudo.id };
  }
  throw new Error(`Este programa ainda não sabe fazer "${tarefa.tipo}". Faça pelo Open WebUI ou peça a quem mantém o sistema.`);
}

async function umaRodada() {
  let feitas = 0;
  for (;;) {
    const r = await chamar("/tarefas/proxima?tipos=gerar_laudo_parcial,gerar_laudo_final");
    if (r.status === 204) return feitas;
    if (r.status === 401) throw new Error("Chave recusada. Crie outra em Inteligência artificial no Soloplan.");
    if (!r.ok) throw new Error(`Soloplan respondeu ${r.status}.`);
    const { tarefa } = await r.json();
    log("pegou", tarefa.tipo, tarefa.id);
    try {
      const resultado = await processar(tarefa);
      await chamar(`/tarefas/${tarefa.id}/concluir`, { method: "POST", body: JSON.stringify({ resultado }) });
      log("concluída", tarefa.id);
    } catch (e) {
      log("falhou:", e.message);
      await chamar(`/tarefas/${tarefa.id}/falhar`, { method: "POST", body: JSON.stringify({ erro: e.message }) });
    }
    feitas++;
  }
}

for (;;) {
  try { const n = await umaRodada(); if (n) log(`${n} tarefa(s) processada(s).`); }
  catch (e) { log("erro:", e.message); if (UMA_VEZ) process.exit(1); }
  if (UMA_VEZ) break;
  await dormir(PAUSA_MS);
}
