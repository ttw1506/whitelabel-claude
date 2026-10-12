import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Vazio } from "@/components/ui";

export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await sessaoEquipe();
  const q = ((await searchParams).q ?? "").trim();
  let consulta = supabase.from("clientes").select("id, nome, cpf_cnpj, cidade, uf, fazendas(count)").order("nome");
  if (q) consulta = consulta.or(`nome.ilike.%${q.replace(/[%,()]/g, " ")}%,cpf_cnpj.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  const { data: clientes } = await consulta;
  return (
    <>
      <Cabeca titulo="Clientes" sub="Produtores atendidos pela Soloplan.">
        <Link className="btn principal" href="/clientes/novo"><Plus size={18} aria-hidden />Novo cliente</Link>
      </Cabeca>
      <section className="bloco">
        <form className="bloco-cab" role="search" style={{ marginBottom: 16 }}>
          <div className="campo" style={{ flex: "1 1 260px" }}>
            <label htmlFor="busca">Buscar por nome ou CPF/CNPJ</label>
            <input id="busca" name="q" type="search" defaultValue={q} />
          </div>
          <button className="btn" type="submit" style={{ alignSelf: "end" }}><Search size={18} aria-hidden />Buscar</button>
        </form>
        {!clientes?.length ? (
          <Vazio titulo={q ? `Nenhum cliente encontrado para "${q}"` : "Nenhum cliente cadastrado"}>
            {!q && <p>Comece pelo botão <strong>Novo cliente</strong>.</p>}
          </Vazio>
        ) : (
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Nome</th><th>CPF/CNPJ</th><th>Cidade</th><th className="num">Fazendas</th></tr></thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="linha" href={`/clientes/${c.id}`}>{c.nome}</Link></td>
                    <td className="tabular">{c.cpf_cnpj ?? "—"}</td>
                    <td>{c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "—"}</td>
                    <td className="num">{(c.fazendas as unknown as { count: number }[])[0]?.count ?? 0}</td>
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
