import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { formatarHa, formatarNumero } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha, Vazio } from "@/components/ui";
import { BotaoExcluir } from "@/components/excluir";
import { excluirFazenda } from "../../acoes";
import { Talhoes } from "./talhoes";

const ha = (n: unknown) => formatarHa(n == null ? null : Number(n));

export default async function Fazenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, eAdmin } = await sessaoEquipe();
  const { data: laudosSolo } = await supabase.from("laudos_solo").select("id, data_coleta, profundidade, status, analise, talhoes(nome)").eq("fazenda_id", id).order("data_coleta", { ascending: false, nullsFirst: false });
  const { data: f } = await supabase.from("fazendas")
    .select("*, clientes(nome), talhoes(id, nome, area_ha), safras(id, ano_agricola, cultura, cultivar, area_ha, status, estadio_atual)")
    .eq("id", id).order("nome", { referencedTable: "talhoes" }).order("ano_agricola", { referencedTable: "safras", ascending: false }).maybeSingle();
  if (!f) notFound();
  const cliente = f.clientes as unknown as { nome: string };
  const safras = (f.safras ?? []) as { id: string; ano_agricola: string; cultura: string; cultivar: string | null; area_ha: number | null; status: string; estadio_atual: string | null }[];
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: cliente.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome }]} />
      <Cabeca titulo={f.nome} sub={[f.municipio && `${f.municipio}${f.uf ? `/${f.uf}` : ""}`, f.area_total_ha != null && `${ha(f.area_total_ha)} no total`].filter(Boolean).join(" · ")}>
        <Link className="btn" href={`/fazendas/${id}/editar`}><Pencil size={16} aria-hidden />Editar</Link>
        {eAdmin && <BotaoExcluir acao={excluirFazenda.bind(null, id, f.cliente_id)} confirmacao="Excluir a fazenda com talhões, safras e lançamentos?" />}
      </Cabeca>

      <section className="bloco" aria-labelledby="titulo-safras">
        <div className="bloco-cab">
          <h2 id="titulo-safras">Safras</h2>
          <Link className="btn principal" href={`/safras/nova?fazenda=${id}`}><Plus size={18} aria-hidden />Nova safra</Link>
        </div>
        {safras.length === 0 ? (
          <Vazio titulo="Nenhuma safra cadastrada">{(f.talhoes ?? []).length ? "Crie a primeira safra desta fazenda." : "Cadastre os talhões primeiro; depois crie a safra."}</Vazio>
        ) : (
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Safra</th><th>Cultivar</th><th>Estádio</th><th>Situação</th><th className="num">Área</th></tr></thead>
              <tbody>
                {safras.map((s) => (
                  <tr key={s.id}>
                    <td><Link className="linha" href={`/safras/${s.id}`}>{s.cultura} {s.ano_agricola}</Link></td>
                    <td>{s.cultivar ?? "—"}</td>
                    <td>{s.estadio_atual ?? "—"}</td>
                    <td>{s.status === "colhida" ? <span className="selo">Colhida</span> : <span className="selo verde">Em andamento</span>}</td>
                    <td className="num">{ha(s.area_ha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Talhoes fazendaId={id} talhoes={(f.talhoes ?? []) as { id: string; nome: string; area_ha: number }[]} areaFazenda={f.area_total_ha == null ? null : Number(f.area_total_ha)} eAdmin={eAdmin} />

      <section className="bloco" aria-labelledby="titulo-solo">
        <div className="bloco-cab">
          <h2 id="titulo-solo">Laudos de solo</h2>
          <Link className="btn" href={`/laudos-solo/novo?fazenda=${id}`}><Plus size={18} aria-hidden />Novo laudo de solo</Link>
        </div>
        {!laudosSolo?.length ? <Vazio titulo="Nenhum laudo de solo">Lance os resultados do laboratório para calcular calagem, gessagem e interpretar P e K.</Vazio> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Coleta</th><th>Talhão</th><th>Camada</th><th className="num">V%</th><th className="num">Calagem</th><th>Situação</th></tr></thead>
            <tbody>{laudosSolo.map((l) => {
              const a = l.analise as { v: number; calagemTHa: number } | null;
              return (
                <tr key={l.id}>
                  <td><Link className="linha" href={`/laudos-solo/${l.id}`}>{l.data_coleta ? new Date(`${l.data_coleta}T12:00:00Z`).toLocaleDateString("pt-BR") : "Sem data"}</Link></td>
                  <td>{(l.talhoes as unknown as { nome: string } | null)?.nome ?? "Fazenda toda"}</td>
                  <td>{l.profundidade} cm</td>
                  <td className="num">{a ? `${formatarNumero(a.v, 1)}%` : "—"}</td>
                  <td className="num">{a ? (a.calagemTHa > 0 ? `${formatarNumero(a.calagemTHa, 2)} t/ha` : "—") : "—"}</td>
                  <td>{l.status === "enviado_ao_cliente" ? <span className="selo verde">Enviado</span> : <span className="selo laranja">{l.status === "rascunho_ia" ? "Rascunho da IA" : l.status === "aprovado" ? "Aprovado" : "Em revisão"}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" aria-labelledby="titulo-imovel">
        <div className="bloco-cab"><h2 id="titulo-imovel">Imóvel e CAR</h2></div>
        <dl className="dados">
          <div><dt>Número do CAR</dt><dd>{f.car_numero ?? "—"}</dd></div>
          <div><dt>Área total</dt><dd>{ha(f.area_total_ha)}</dd></div>
          <div><dt>Área consolidada</dt><dd>{ha(f.area_consolidada_ha)}</dd></div>
          <div><dt>Reserva legal</dt><dd>{ha(f.reserva_legal_ha)}</dd></div>
          <div><dt>APP</dt><dd>{ha(f.app_ha)}</dd></div>
          <div><dt>Código IBGE</dt><dd>{f.codigo_ibge ?? "—"}</dd></div>
          <div><dt>Coordenadas da sede</dt><dd>{f.latitude != null && f.longitude != null ? `${formatarNumero(Number(f.latitude), 6)}, ${formatarNumero(Number(f.longitude), 6)}` : "—"}</dd></div>
        </dl>
        <p className="muted" style={{ margin: "16px 0 0", fontSize: 14 }}>A conferência automática do CAR chega na etapa 6.</p>
      </section>
    </>
  );
}
