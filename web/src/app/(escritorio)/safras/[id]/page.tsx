import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Pencil, Send } from "lucide-react";
import { agruparPorEstadio, estadiosDa, formatarHa, formatarNumero, formatarReais, formatarSemZeros, resumoCustos, nomeCategoria } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { dataBr, dataHoraBr, hojeIso } from "@/lib/datas";
import { Cabeca, Trilha, Vazio } from "@/components/ui";
import { BotaoExcluir } from "@/components/excluir";
import { BotaoAcao } from "@/components/botao-acao";
import { excluirSafra } from "../../acoes";
import { aprovarLancamento, excluirLancamento, aprovarEnviarLaudo } from "./acoes";
import { EnviarFotos } from "./enviar-fotos";
import { LinhaDoTempo, type FotoVista } from "./linha-do-tempo";
import { FormAplicacao, FormCusto, FormLaudo, FormOcorrencia } from "./formularios";

type Talhao = { id: string; nome: string; area_ha: number };
const NOME_TIPO: Record<string, string> = { praga: "Praga", doenca: "Doença", planta_daninha: "Planta daninha", deficiencia: "Deficiência" };
const STATUS: Record<string, { nome: string; classe: string }> = {
  rascunho_ia: { nome: "Rascunho da IA", classe: "selo laranja" }, em_revisao: { nome: "Em revisão", classe: "selo laranja" },
  aprovado: { nome: "Aprovado", classe: "selo verde" }, enviado_ao_cliente: { nome: "Enviado ao cliente", classe: "selo verde" },
};
const pendente = (s: string) => s === "rascunho_ia" || s === "em_revisao";

export default async function Safra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, eAdmin } = await sessaoEquipe();
  const { data: s } = await supabase.from("safras")
    .select("*, safra_talhoes(talhoes(id, nome, area_ha)), fazendas(id, nome, cliente_id, clientes(nome))").eq("id", id).maybeSingle();
  if (!s) notFound();

  const [fotos, ocorrencias, aplicacoes, custos, laudos, perfis] = await Promise.all([
    supabase.from("fotos").select("id, estadio, tirada_em, talhao_id, autor_id, anotacao, arquivo_path, original_path, latitude, longitude, status").eq("safra_id", id),
    supabase.from("ocorrencias").select("id, data, estadio, tipo, nome, severidade, acao_tomada, talhao_id, status").eq("safra_id", id).order("data", { ascending: false }),
    supabase.from("aplicacoes").select("id, data, tipo_operacao, produto, ingrediente_ativo, dose, dose_unidade, area_ha, custo, status, aplicacao_talhoes(talhoes(nome))").eq("safra_id", id).order("data", { ascending: false }),
    supabase.from("custos").select("id, categoria, descricao, valor, data, aplicacao_id, status").eq("safra_id", id).order("data", { ascending: false }),
    supabase.from("laudos_safra").select("id, tipo, conteudo, status, criado_em, aprovado_em, enviado_em").eq("safra_id", id).order("criado_em", { ascending: false }),
    supabase.from("perfis").select("usuario_id, nome"),
  ]);

  const f = s.fazendas as unknown as { id: string; nome: string; cliente_id: string; clientes: { nome: string } };
  const talhoes: Talhao[] = (s.safra_talhoes ?? []).map((x: { talhoes: Talhao }) => x.talhoes).sort((a: Talhao, b: Talhao) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  const nomeTalhao = new Map(talhoes.map((t) => [t.id, t.nome]));
  const nomeAutor = new Map((perfis.data ?? []).map((p) => [p.usuario_id, p.nome]));
  const area = s.area_ha == null ? null : Number(s.area_ha);
  const estadios = estadiosDa(s.cultura);
  const hoje = hojeIso();

  // Links temporários (1 hora) para as fotos privadas.
  const listaFotos = fotos.data ?? [];
  const caminhos = listaFotos.flatMap((x) => [x.arquivo_path, x.original_path].filter(Boolean) as string[]);
  const assinadas = caminhos.length ? (await supabase.storage.from("fotos").createSignedUrls(caminhos, 3600)).data ?? [] : [];
  const url = new Map(assinadas.filter((a) => a.signedUrl).map((a) => [a.path, a.signedUrl]));
  const vistas = listaFotos.map((x) => ({
    id: x.id, estadio: x.estadio, tirada_em: x.tirada_em, status: x.status,
    url: url.get(x.arquivo_path) ?? null, urlOriginal: x.original_path ? url.get(x.original_path) ?? null : null,
    quando: dataHoraBr(x.tirada_em), talhao: x.talhao_id ? nomeTalhao.get(x.talhao_id) ?? null : null,
    autor: x.autor_id ? nomeAutor.get(x.autor_id) ?? null : null, anotacao: x.anotacao,
    gps: x.latitude != null && x.longitude != null ? `${Number(x.latitude).toFixed(6)}, ${Number(x.longitude).toFixed(6)}` : null,
  }));
  const grupos = agruparPorEstadio(s.cultura, vistas, s.estadio_atual).map((g) => ({ ...g, fotos: g.fotos as FotoVista[] }));

  const listaCustos = custos.data ?? [];
  const resumo = resumoCustos(listaCustos.filter((c) => !pendente(c.status)), area);
  const custosPendentes = listaCustos.filter((c) => pendente(c.status)).length;

  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: f.clientes.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: `${s.cultura} ${s.ano_agricola}` }]} />
      <Cabeca titulo={`${s.cultura} ${s.ano_agricola}`} sub={[s.cultivar, formatarHa(area), `Plantio ${dataBr(s.data_plantio)}`, s.status === "colhida" ? "Colhida" : "Em andamento"].filter(Boolean).join(" · ")}>
        <Link className="btn" href={`/safras/${id}/editar`}><Pencil size={16} aria-hidden />Editar safra</Link>
        {eAdmin && <BotaoExcluir acao={excluirSafra.bind(null, id, f.id)} confirmacao="Excluir a safra com fotos e lançamentos?" />}
      </Cabeca>

      <nav className="secoes" aria-label="Seções da safra">
        <a href="#linha-do-tempo">Linha do tempo</a><a href="#ocorrencias">Ocorrências</a><a href="#aplicacoes">Aplicações</a><a href="#custos">Custos</a><a href="#laudos">Laudos</a>
      </nav>

      <section className="grade" aria-label="Resumo">
        <div className="numero"><span>Estádio atual</span><strong>{s.estadio_atual ?? "—"}</strong></div>
        <div className="numero"><span>Fotos</span><strong>{formatarNumero(vistas.length, 0)}</strong></div>
        <div className="numero"><span>Custo total</span><strong>{formatarReais(resumo.total)}</strong></div>
        <div className="numero"><span>Custo por hectare</span><strong>{resumo.porHa == null ? "—" : formatarReais(resumo.porHa)}</strong></div>
      </section>

      <section className="bloco" id="linha-do-tempo" aria-labelledby="t-linha">
        <div className="bloco-cab">
          <h2 id="t-linha">Linha do tempo</h2>
          <EnviarFotos safraId={id} clienteId={f.cliente_id} talhoes={talhoes} estadios={estadios} estadioAtual={s.estadio_atual} />
        </div>
        {vistas.length === 0 && <p className="muted" style={{ marginTop: 0 }}>Nenhuma foto ainda. Use <strong>Enviar fotos</strong> para registrar o estádio {s.estadio_atual ?? "atual"}.</p>}
        <LinhaDoTempo grupos={grupos} safraId={id} eAdmin={eAdmin} />
      </section>

      <section className="bloco" id="ocorrencias" aria-labelledby="t-ocorrencias">
        <div className="bloco-cab"><h2 id="t-ocorrencias">Ocorrências</h2><FormOcorrencia safraId={id} talhoes={talhoes} estadios={estadios} estadioAtual={s.estadio_atual} hoje={hoje} /></div>
        {!ocorrencias.data?.length ? <Vazio titulo="Nenhuma ocorrência registrada" /> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Data</th><th>Tipo</th><th>O que</th><th>Estádio</th><th>Talhão</th><th>Severidade</th><th>Ação tomada</th><th><span className="sr-only">Situação e ações</span></th></tr></thead>
            <tbody>{ocorrencias.data.map((o) => (
              <tr key={o.id}>
                <td className="tabular">{dataBr(o.data)}</td><td>{NOME_TIPO[o.tipo]}</td><td><strong>{o.nome}</strong></td><td>{o.estadio ?? "—"}</td>
                <td>{o.talhao_id ? nomeTalhao.get(o.talhao_id) : "Geral"}</td><td>{o.severidade ?? "—"}</td><td>{o.acao_tomada ?? "—"}</td>
                <td><Situacao status={o.status} eAdmin={eAdmin} aprovar={aprovarLancamento.bind(null, "ocorrencias", o.id, id)} excluir={excluirLancamento.bind(null, "ocorrencias", o.id, id)} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" id="aplicacoes" aria-labelledby="t-aplicacoes">
        <div className="bloco-cab"><h2 id="t-aplicacoes">Aplicações</h2><FormAplicacao safraId={id} talhoes={talhoes} hoje={hoje} /></div>
        {!aplicacoes.data?.length ? <Vazio titulo="Nenhuma aplicação lançada" /> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Data</th><th>Operação</th><th>Produto · ingrediente ativo</th><th className="num">Dose</th><th>Talhões</th><th className="num">Área</th><th className="num">Custo</th><th><span className="sr-only">Situação e ações</span></th></tr></thead>
            <tbody>{aplicacoes.data.map((a) => (
              <tr key={a.id}>
                <td className="tabular">{dataBr(a.data)}</td><td><strong>{a.tipo_operacao}</strong></td>
                <td>{[a.produto, a.ingrediente_ativo].filter(Boolean).join(" · ") || "—"}</td>
                <td className="num">{a.dose == null ? "—" : `${formatarSemZeros(Number(a.dose))} ${a.dose_unidade ?? ""}`}</td>
                <td>{(a.aplicacao_talhoes as unknown as { talhoes: { nome: string } }[]).map((x) => x.talhoes.nome).sort().join(", ")}</td>
                <td className="num">{formatarHa(a.area_ha == null ? null : Number(a.area_ha))}</td>
                <td className="num">{a.custo == null ? "—" : formatarReais(Number(a.custo))}</td>
                <td><Situacao status={a.status} eAdmin={eAdmin} aprovar={aprovarLancamento.bind(null, "aplicacoes", a.id, id)} excluir={excluirLancamento.bind(null, "aplicacoes", a.id, id)} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" id="custos" aria-labelledby="t-custos">
        <div className="bloco-cab"><h2 id="t-custos">Custos</h2><FormCusto safraId={id} hoje={hoje} /></div>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">R$/ha</th><th className="num">Participação</th></tr></thead>
          <tbody>
            {resumo.categorias.map((c) => (
              <tr key={c.categoria}><td>{c.nome}</td><td className="num">{formatarReais(c.valor)}</td><td className="num">{c.porHa == null ? "—" : formatarReais(c.porHa)}</td><td className="num">{formatarNumero(c.participacao * 100, 1)}%</td></tr>
            ))}
            <tr className="total"><td>Total</td><td className="num">{formatarReais(resumo.total)}</td><td className="num">{resumo.porHa == null ? "—" : formatarReais(resumo.porHa)}</td><td className="num">100%</td></tr>
          </tbody>
        </table></div>
        {custosPendentes > 0 && <p className="aviso atencao" style={{ marginTop: 12 }}>{custosPendentes} {custosPendentes === 1 ? "lançamento aguarda" : "lançamentos aguardam"} aprovação e ainda não {custosPendentes === 1 ? "entra" : "entram"} no total.</p>}
        <h3 style={{ margin: "24px 0 8px" }}>Lançamentos</h3>
        {!listaCustos.length ? <Vazio titulo="Nenhum custo lançado">Lance custos aqui ou pelo custo de uma aplicação.</Vazio> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th className="num">Valor</th><th><span className="sr-only">Situação e ações</span></th></tr></thead>
            <tbody>{listaCustos.map((c) => (
              <tr key={c.id}>
                <td className="tabular">{dataBr(c.data)}</td><td>{nomeCategoria(c.categoria)}</td>
                <td>{c.descricao}{c.aplicacao_id && <span className="selo" style={{ marginLeft: 8 }}>da aplicação</span>}</td>
                <td className="num">{formatarReais(Number(c.valor))}</td>
                <td>{c.aplicacao_id ? (pendente(c.status) ? <span className={STATUS[c.status].classe}>{STATUS[c.status].nome}</span> : null)
                  : <Situacao status={c.status} eAdmin={eAdmin} aprovar={aprovarLancamento.bind(null, "custos", c.id, id)} excluir={excluirLancamento.bind(null, "custos", c.id, id)} />}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" id="laudos" aria-labelledby="t-laudos">
        <div className="bloco-cab"><h2 id="t-laudos">Laudos</h2><FormLaudo safraId={id} /></div>
        {!laudos.data?.length ? <Vazio titulo="Nenhum laudo desta safra">Laudos escritos pela equipe ou gerados pela IA aparecem aqui para revisão.</Vazio> : (
          <ul className="laudos">{laudos.data.map((l) => (
            <li key={l.id}>
              <div className="bloco-cab" style={{ marginBottom: 8 }}>
                <h3>Laudo {l.tipo} · {dataBr(l.criado_em)}</h3>
                <span className={STATUS[l.status].classe}>{STATUS[l.status].nome}{l.enviado_em ? ` em ${dataBr(l.enviado_em)}` : ""}</span>
              </div>
              <p className="texto-laudo">{(l.conteudo as { texto?: string })?.texto ?? "—"}</p>
              {eAdmin && l.status !== "enviado_ao_cliente" && (
                <BotaoAcao acao={aprovarEnviarLaudo.bind(null, l.id, id)} rotulo="Aprovar e enviar ao cliente" rotuloPendente="Enviando…" classe="btn principal pequeno" icone={<Send size={16} aria-hidden />} />
              )}
              {!eAdmin && pendente(l.status) && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Aguardando aprovação de um administrador.</p>}
            </li>
          ))}</ul>
        )}
      </section>
    </>
  );
}

function Situacao({ status, eAdmin, aprovar, excluir }: { status: string; eAdmin: boolean; aprovar: () => Promise<{ erro?: string } | void>; excluir: () => Promise<{ erro?: string } | void> }) {
  return (
    <span className="acoes" style={{ justifyContent: "flex-end", alignItems: "center", flexWrap: "nowrap" }}>
      {pendente(status) && <span className={STATUS[status].classe}>{STATUS[status].nome}</span>}
      {eAdmin && pendente(status) && <BotaoAcao acao={aprovar} rotulo="Aprovar" rotuloPendente="Aprovando…" icone={<Check size={16} aria-hidden />} />}
      {eAdmin && <BotaoExcluir acao={excluir} confirmacao="Excluir?" />}
    </span>
  );
}
