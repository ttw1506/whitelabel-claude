import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { estadiosDa, formatarHa, formatarNumero } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { BotaoExcluir } from "@/components/excluir";
import { excluirSafra } from "../../acoes";

const data = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

export default async function Safra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, eAdmin } = await sessaoEquipe();
  const { data: s } = await supabase.from("safras")
    .select("*, safra_talhoes(talhoes(id, nome, area_ha)), fazendas(id, nome, cliente_id, clientes(nome))").eq("id", id).maybeSingle();
  if (!s) notFound();
  const f = s.fazendas as unknown as { id: string; nome: string; cliente_id: string; clientes: { nome: string } };
  const talhoes = (s.safra_talhoes ?? []).map((x: { talhoes: { id: string; nome: string; area_ha: number } }) => x.talhoes)
    .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  const estadios = estadiosDa(s.cultura);
  const atual = estadios && s.estadio_atual ? estadios.indexOf(s.estadio_atual) : -1;
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: f.clientes.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: `${s.cultura} ${s.ano_agricola}` }]} />
      <Cabeca titulo={`${s.cultura} ${s.ano_agricola}`} sub={[s.cultivar, formatarHa(s.area_ha == null ? null : Number(s.area_ha)), s.status === "colhida" ? "Colhida" : "Em andamento"].filter(Boolean).join(" · ")}>
        <Link className="btn" href={`/safras/${id}/editar`}><Pencil size={16} aria-hidden />Editar</Link>
        {eAdmin && <BotaoExcluir acao={excluirSafra.bind(null, id, f.id)} confirmacao="Excluir a safra com fotos e lançamentos?" />}
      </Cabeca>

      {estadios && (
        <section className="bloco" aria-labelledby="titulo-estadio">
          <div className="bloco-cab"><h2 id="titulo-estadio">Estádio</h2><span className="selo verde">{s.estadio_atual ?? "Antes da emergência"}</span></div>
          <ol className="regua" aria-label="Estádios da cultura">
            {estadios.map((e, i) => <li key={e} data-feito={i <= atual ? "" : undefined} aria-current={i === atual ? "step" : undefined}>{e}</li>)}
          </ol>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>As fotos de cada estádio, ocorrências, aplicações e custos entram nesta tela na etapa 3.</p>
        </section>
      )}

      <section className="bloco">
        <dl className="dados">
          <div><dt>Cultivar</dt><dd>{s.cultivar ?? "—"}</dd></div>
          <div><dt>Plantio</dt><dd>{data(s.data_plantio)}</dd></div>
          <div><dt>Área plantada</dt><dd>{formatarHa(s.area_ha == null ? null : Number(s.area_ha))}</dd></div>
          <div><dt>Produtividade final</dt><dd>{s.produtividade_sc_ha == null ? "—" : `${formatarNumero(Number(s.produtividade_sc_ha), 1)} sc/ha`}</dd></div>
        </dl>
      </section>

      <section className="bloco" aria-labelledby="titulo-talhoes">
        <div className="bloco-cab"><h2 id="titulo-talhoes">Talhões</h2></div>
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Talhão</th><th className="num">Área</th></tr></thead>
            <tbody>{talhoes.map((t: { id: string; nome: string; area_ha: number }) => <tr key={t.id}><td>{t.nome}</td><td className="num">{formatarHa(Number(t.area_ha))}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
