import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { formatarHa } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha, Vazio } from "@/components/ui";
import { BotaoExcluir } from "@/components/excluir";
import { excluirCliente } from "../../acoes";

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, eAdmin } = await sessaoEquipe();
  const { data: c } = await supabase.from("clientes")
    .select("id, nome, cpf_cnpj, telefone, email, cidade, uf, fazendas(id, nome, municipio, uf, area_total_ha, talhoes(count), safras(id, status))")
    .eq("id", id).order("nome", { referencedTable: "fazendas" }).maybeSingle();
  if (!c) notFound();
  const fazendas = c.fazendas ?? [];
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: c.nome }]} />
      <Cabeca titulo={c.nome} sub={[c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ""}`, c.cpf_cnpj].filter(Boolean).join(" · ")}>
        <Link className="btn" href={`/clientes/${id}/editar`}><Pencil size={16} aria-hidden />Editar</Link>
        {eAdmin && <BotaoExcluir acao={excluirCliente.bind(null, id)} confirmacao="Excluir o cliente e todas as fazendas, safras e lançamentos?" />}
      </Cabeca>
      <section className="bloco">
        <dl className="dados">
          <div><dt>CPF/CNPJ</dt><dd>{c.cpf_cnpj ?? "—"}</dd></div>
          <div><dt>Telefone</dt><dd>{c.telefone ?? "—"}</dd></div>
          <div><dt>E-mail</dt><dd>{c.email ?? "—"}</dd></div>
          <div><dt>Cidade</dt><dd>{c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "—"}</dd></div>
        </dl>
      </section>
      <section className="bloco">
        <div className="bloco-cab">
          <h2>Fazendas</h2>
          <Link className="btn principal" href={`/fazendas/nova?cliente=${id}`}><Plus size={18} aria-hidden />Nova fazenda</Link>
        </div>
        {fazendas.length === 0 ? (
          <Vazio titulo="Nenhuma fazenda cadastrada">Cadastre a primeira fazenda deste cliente.</Vazio>
        ) : (
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Fazenda</th><th>Município</th><th className="num">Área total</th><th className="num">Talhões</th><th className="num">Safras em andamento</th></tr></thead>
              <tbody>
                {fazendas.map((f) => (
                  <tr key={f.id}>
                    <td><Link className="linha" href={`/fazendas/${f.id}`}>{f.nome}</Link></td>
                    <td>{f.municipio ? `${f.municipio}${f.uf ? `/${f.uf}` : ""}` : "—"}</td>
                    <td className="num">{formatarHa(f.area_total_ha == null ? null : Number(f.area_total_ha))}</td>
                    <td className="num">{(f.talhoes as unknown as { count: number }[])[0]?.count ?? 0}</td>
                    <td className="num">{(f.safras ?? []).filter((s) => s.status === "em_andamento").length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
