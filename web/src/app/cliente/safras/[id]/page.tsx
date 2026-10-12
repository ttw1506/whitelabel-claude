import { notFound } from "next/navigation";
import { agruparPorEstadio, formatarHa, formatarReais, formatarSemZeros, resumoCustos, formatarNumero } from "@soloplan/regras";
import { sessaoCliente } from "@/lib/sessao";
import { dataBr, dataHoraBr } from "@/lib/datas";
import { Cabeca, Trilha, Vazio } from "@/components/ui";
import { LinhaDoTempo, type FotoVista } from "../../../(escritorio)/safras/[id]/linha-do-tempo";
import { PedirLaudo } from "./pedido";

const NOME_TIPO: Record<string, string> = { praga: "Praga", doenca: "Doença", planta_daninha: "Planta daninha", deficiencia: "Deficiência" };

// Tudo aqui passa pelas regras do banco: o produtor só recebe o que é dele e já foi aprovado.
export default async function SafraCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await sessaoCliente();
  const { data: s } = await supabase.from("safras").select("*, fazendas(nome), safra_talhoes(talhoes(id, nome))").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [fotos, ocorrencias, aplicacoes, custos, laudos, pedidos] = await Promise.all([
    supabase.from("fotos").select("id, estadio, tirada_em, talhao_id, anotacao, arquivo_path, original_path, latitude, longitude, status").eq("safra_id", id),
    supabase.from("ocorrencias").select("id, data, estadio, tipo, nome, severidade, acao_tomada, talhao_id").eq("safra_id", id).order("data", { ascending: false }),
    supabase.from("aplicacoes").select("id, data, tipo_operacao, produto, ingrediente_ativo, dose, dose_unidade, area_ha").eq("safra_id", id).order("data", { ascending: false }),
    supabase.from("custos").select("categoria, valor").eq("safra_id", id),
    supabase.from("laudos_safra").select("id, tipo, conteudo, enviado_em").eq("safra_id", id).order("enviado_em", { ascending: false }),
    supabase.from("envios_cliente").select("id").eq("safra_id", id).eq("tipo", "pedido_laudo_parcial").neq("status", "concluido"),
  ]);
  const fazenda = (s.fazendas as unknown as { nome: string }).nome;
  const nomeTalhao = new Map<string, string>((s.safra_talhoes ?? []).map((x: { talhoes: { id: string; nome: string } }) => [x.talhoes.id, x.talhoes.nome] as [string, string]));
  const lista = fotos.data ?? [];
  const caminhos = lista.flatMap((x) => [x.arquivo_path, x.original_path].filter(Boolean) as string[]);
  const assinadas = caminhos.length ? (await supabase.storage.from("fotos").createSignedUrls(caminhos, 3600)).data ?? [] : [];
  const url = new Map(assinadas.filter((a) => a.signedUrl).map((a) => [a.path, a.signedUrl]));
  const vistas = lista.map((x) => ({
    id: x.id, estadio: x.estadio, tirada_em: x.tirada_em, status: x.status, autor: null,
    url: url.get(x.arquivo_path) ?? null, urlOriginal: x.original_path ? url.get(x.original_path) ?? null : null,
    quando: dataHoraBr(x.tirada_em), talhao: x.talhao_id ? nomeTalhao.get(x.talhao_id) ?? null : null, anotacao: x.anotacao,
    gps: x.latitude != null && x.longitude != null ? `${Number(x.latitude).toFixed(6)}, ${Number(x.longitude).toFixed(6)}` : null,
  }));
  const grupos = agruparPorEstadio(s.cultura, vistas, s.estadio_atual).map((g) => ({ ...g, fotos: g.fotos as FotoVista[] }));
  const area = s.area_ha == null ? null : Number(s.area_ha);
  const resumo = resumoCustos(custos.data ?? [], area);

  return (
    <>
      <Trilha itens={[{ nome: "Minhas safras", href: "/cliente/safras" }, { nome: `${s.cultura} ${s.ano_agricola}` }]} />
      <Cabeca titulo={`${s.cultura} ${s.ano_agricola}`} sub={[fazenda, s.cultivar, formatarHa(area), s.status === "colhida" ? "Colhida" : "Em andamento"].filter(Boolean).join(" · ")}>
        <PedirLaudo safraId={id} emAberto={(pedidos.data ?? []).length > 0} />
      </Cabeca>

      <section className="grade" aria-label="Resumo">
        <div className="numero"><span>Estádio atual</span><strong>{s.estadio_atual ?? "—"}</strong></div>
        <div className="numero"><span>Plantio</span><strong>{dataBr(s.data_plantio)}</strong></div>
        <div className="numero"><span>Investido</span><strong>{formatarReais(resumo.total)}</strong></div>
        <div className="numero"><span>Por hectare</span><strong>{resumo.porHa == null ? "—" : formatarReais(resumo.porHa)}</strong></div>
      </section>

      <section className="bloco" aria-labelledby="t-linha">
        <div className="bloco-cab"><h2 id="t-linha">Fotos por estádio</h2></div>
        {vistas.length === 0 && <p className="muted" style={{ marginTop: 0 }}>As fotos das visitas da Soloplan aparecem aqui.</p>}
        <LinhaDoTempo grupos={grupos} safraId={id} eAdmin={false} />
      </section>

      {!!laudos.data?.length && (
        <section className="bloco" aria-labelledby="t-laudos">
          <div className="bloco-cab"><h2 id="t-laudos">Laudos</h2></div>
          <ul className="laudos">{laudos.data.map((l) => (
            <li key={l.id}>
              <h3 style={{ marginBottom: 8 }}>Laudo {l.tipo} · {dataBr(l.enviado_em)}</h3>
              <p className="texto-laudo">{(l.conteudo as { texto?: string })?.texto ?? "—"}</p>
            </li>
          ))}</ul>
        </section>
      )}

      <section className="bloco" aria-labelledby="t-ocorrencias">
        <div className="bloco-cab"><h2 id="t-ocorrencias">Ocorrências</h2></div>
        {!ocorrencias.data?.length ? <Vazio titulo="Nenhuma ocorrência registrada" /> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Data</th><th>Tipo</th><th>O que</th><th>Estádio</th><th>Talhão</th><th>Severidade</th><th>Ação tomada</th></tr></thead>
            <tbody>{ocorrencias.data.map((o) => (
              <tr key={o.id}><td className="tabular">{dataBr(o.data)}</td><td>{NOME_TIPO[o.tipo]}</td><td><strong>{o.nome}</strong></td><td>{o.estadio ?? "—"}</td>
                <td>{o.talhao_id ? nomeTalhao.get(o.talhao_id) : "Geral"}</td><td>{o.severidade ?? "—"}</td><td>{o.acao_tomada ?? "—"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" aria-labelledby="t-aplicacoes">
        <div className="bloco-cab"><h2 id="t-aplicacoes">Aplicações</h2></div>
        {!aplicacoes.data?.length ? <Vazio titulo="Nenhuma aplicação lançada" /> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Data</th><th>Operação</th><th>Produto · ingrediente ativo</th><th className="num">Dose</th><th className="num">Área</th></tr></thead>
            <tbody>{aplicacoes.data.map((a) => (
              <tr key={a.id}><td className="tabular">{dataBr(a.data)}</td><td><strong>{a.tipo_operacao}</strong></td>
                <td>{[a.produto, a.ingrediente_ativo].filter(Boolean).join(" · ") || "—"}</td>
                <td className="num">{a.dose == null ? "—" : `${formatarSemZeros(Number(a.dose))} ${a.dose_unidade ?? ""}`}</td>
                <td className="num">{formatarHa(a.area_ha == null ? null : Number(a.area_ha))}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" aria-labelledby="t-custos">
        <div className="bloco-cab"><h2 id="t-custos">Custos desta safra</h2></div>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">R$/ha</th><th className="num">Participação</th></tr></thead>
          <tbody>
            {resumo.categorias.map((c) => <tr key={c.categoria}><td>{c.nome}</td><td className="num">{formatarReais(c.valor)}</td><td className="num">{c.porHa == null ? "—" : formatarReais(c.porHa)}</td><td className="num">{formatarNumero(c.participacao * 100, 1)}%</td></tr>)}
            <tr className="total"><td>Total</td><td className="num">{formatarReais(resumo.total)}</td><td className="num">{resumo.porHa == null ? "—" : formatarReais(resumo.porHa)}</td><td className="num">100%</td></tr>
          </tbody>
        </table></div>
      </section>
    </>
  );
}
