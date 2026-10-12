import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Aviso } from "@/components/ui";
import { BotaoAcao } from "@/components/botao-acao";
import { dataBr, dataHoraBr } from "@/lib/datas";
import { cancelarTarefa, criarUsuarioIA, decidirPreco, revogarChave } from "./acoes";
import { NOME_TIPO } from "@/lib/ia/nomes";
import { FormChave, FormTarefa } from "./formularios";

export const metadata = { title: "Inteligência artificial" };

const SELO: Record<string, [string, string]> = {
  pendente: ["Na fila", "laranja"], em_andamento: ["Em andamento", "azul"], concluida: ["Concluída", "verde"], falhou: ["Falhou", "vermelho"], cancelada: ["Cancelada", ""],
};
const NOME_STATUS_PRECO: Record<string, string> = { rascunho_ia: "Rascunho da IA", em_revisao: "Em revisão", aprovado: "Aprovado", enviado_ao_cliente: "Enviado" };

export default async function PaginaIA() {
  const { supabase, eAdmin } = await sessaoEquipe();
  const [ia, chaves, tarefas, precos, clientes] = await Promise.all([
    supabase.from("perfis").select("usuario_id").eq("papel", "ia").eq("ativo", true).limit(1),
    eAdmin ? supabase.from("chaves_ia").select("id, nome, prefixo, criada_em, revogada_em, ultimo_uso_em").order("criada_em", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("tarefas_ia").select("id, tipo, status, tentativas, erro, criada_em, concluida_em, clientes(nome)").order("criada_em", { ascending: false }).limit(30),
    supabase.from("precos_dia").select("id, produto, valor, unidade, fonte, data, status").order("data", { ascending: false }).order("criado_em", { ascending: false }).limit(20),
    supabase.from("clientes").select("id, nome").order("nome"),
  ]);
  const temUsuarioIA = (ia.data?.length ?? 0) > 0;
  return (
    <>
      <Cabeca titulo="Inteligência artificial" sub="A IA do escritório trabalha em rascunhos. Nada chega ao produtor sem um administrador aprovar." />

      {eAdmin && (
        <section className="bloco" aria-labelledby="t-chaves">
          <div className="bloco-cab"><h2 id="t-chaves">Conexão com a IA</h2></div>
          {!temUsuarioIA ? (
            <>
              <Aviso tipo="atencao">Ainda não existe o usuário da IA. Ele só entra pela API, com a chave, e só consegue criar rascunhos.</Aviso>
              <BotaoAcao acao={criarUsuarioIA} rotulo="Criar usuário da IA" rotuloPendente="Criando…" classe="btn principal" />
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>Cole a chave na ferramenta da IA (Open WebUI ou no programa do PC do escritório). Guarde-a como senha: ela dá acesso para criar rascunhos.</p>
              <FormChave />
              <div className="tabela-rolagem"><table>
                <thead><tr><th>Nome</th><th>Começa com</th><th>Criada em</th><th>Último uso</th><th>Situação</th></tr></thead>
                <tbody>
                  {(chaves.data ?? []).map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.nome}</strong></td><td><code>{c.prefixo}…</code></td><td>{dataHoraBr(c.criada_em)}</td><td>{dataHoraBr(c.ultimo_uso_em)}</td>
                      <td>{c.revogada_em ? <span className="selo">Revogada</span> : <BotaoAcao acao={revogarChave.bind(null, c.id)} rotulo="Revogar" rotuloPendente="Revogando…" classe="btn discreto pequeno" />}</td>
                    </tr>
                  ))}
                  {!chaves.data?.length && <tr><td colSpan={5} className="muted">Nenhuma chave criada.</td></tr>}
                </tbody>
              </table></div>
              <p className="muted">Descrição da API para o Open WebUI: <code>/api/ia/openapi.json</code></p>
            </>
          )}
        </section>
      )}

      <section className="bloco" aria-labelledby="t-fila">
        <div className="bloco-cab"><h2 id="t-fila">Fila de tarefas</h2></div>
        <FormTarefa clientes={clientes.data ?? []} />
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Tarefa</th><th>Produtor</th><th>Situação</th><th>Pedida em</th><th></th></tr></thead>
          <tbody>
            {(tarefas.data ?? []).map((t) => {
              const [nome, cor] = SELO[t.status] ?? [t.status, ""];
              const cliente = (t.clientes as unknown as { nome: string } | null)?.nome;
              return (
                <tr key={t.id}>
                  <td><strong>{NOME_TIPO[t.tipo] ?? t.tipo}</strong>{t.erro && <div className="muted" style={{ fontSize: 13 }}>{t.erro}</div>}</td>
                  <td>{cliente ?? "—"}</td>
                  <td><span className={`selo ${cor}`}>{nome}</span>{t.tentativas > 1 && <span className="muted"> · {t.tentativas}ª tentativa</span>}</td>
                  <td>{dataHoraBr(t.criada_em)}</td>
                  <td>{["pendente", "falhou"].includes(t.status) && <BotaoAcao acao={cancelarTarefa.bind(null, t.id)} rotulo="Cancelar" rotuloPendente="…" classe="btn discreto pequeno" />}</td>
                </tr>
              );
            })}
            {!tarefas.data?.length && <tr><td colSpan={5} className="muted">Nenhuma tarefa ainda.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <section className="bloco" aria-labelledby="t-precos">
        <div className="bloco-cab"><h2 id="t-precos">Preços do dia trazidos pela IA</h2></div>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Produto</th><th>Valor</th><th>Fonte</th><th>Data</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {(precos.data ?? []).map((p) => (
              <tr key={p.id}>
                <td><strong>{p.produto}</strong></td>
                <td>{Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} <span className="muted">{p.unidade}</span></td>
                <td>{p.fonte}</td><td>{dataBr(p.data)}</td>
                <td><span className={`selo ${p.status === "aprovado" ? "verde" : "laranja"}`}>{NOME_STATUS_PRECO[p.status] ?? p.status}</span></td>
                <td>{eAdmin && p.status !== "aprovado" && (
                  <span className="acoes">
                    <BotaoAcao acao={decidirPreco.bind(null, p.id, true)} rotulo="Aprovar" rotuloPendente="…" classe="btn principal pequeno" />
                    <BotaoAcao acao={decidirPreco.bind(null, p.id, false)} rotulo="Descartar" rotuloPendente="…" classe="btn discreto pequeno" />
                  </span>
                )}</td>
              </tr>
            ))}
            {!precos.data?.length && <tr><td colSpan={6} className="muted">Nenhum preço ainda.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
