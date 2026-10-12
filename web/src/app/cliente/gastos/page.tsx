import Link from "next/link";
import { CATEGORIAS_CUSTO, formatarHa, formatarNumero, formatarReais, resumoGastos, type SafraGasto } from "@soloplan/regras";
import { sessaoCliente } from "@/lib/sessao";
import { Cabeca, Vazio } from "@/components/ui";

export const metadata = { title: "Meus gastos" };

type Busca = { safra?: string; fazenda?: string; categoria?: string };

export default async function MeusGastos({ searchParams }: { searchParams: Promise<Busca> }) {
  const { supabase } = await sessaoCliente();
  const filtro = await searchParams;
  const [s, c] = await Promise.all([
    supabase.from("safras").select("id, fazenda_id, ano_agricola, cultura, cultivar, area_ha, fazendas(nome)"),
    supabase.from("custos").select("safra_id, categoria, valor"),
  ]);
  const safras: SafraGasto[] = (s.data ?? []).map((x) => ({
    id: x.id, fazenda_id: x.fazenda_id, fazenda: (x.fazendas as unknown as { nome: string }).nome,
    ano_agricola: x.ano_agricola, cultura: x.cultura, area_ha: x.area_ha == null ? null : Number(x.area_ha),
  }));
  const fazendas = [...new Map(safras.map((x) => [x.fazenda_id, x.fazenda])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const r = resumoGastos(safras, c.data ?? [], filtro);
  const filtrado = !!(filtro.safra || filtro.fazenda || filtro.categoria);
  const nomeSafra = (x: SafraGasto) => `${x.cultura} ${x.ano_agricola} · ${x.fazenda}`;

  return (
    <>
      <Cabeca titulo="Meus gastos" sub="Tudo o que foi investido nas suas lavouras, lançado e conferido pela Soloplan." />
      <section className="grade" aria-label="Resumo">
        <div className="numero"><span>{filtrado ? "Total no filtro" : "Total investido"}</span><strong>{formatarReais(r.total)}</strong></div>
        <div className="numero"><span>Custo por hectare</span><strong>{r.porHa == null ? "—" : formatarReais(r.porHa)}</strong></div>
        <div className="numero"><span>Safras</span><strong>{formatarNumero(r.safras.length, 0)}</strong></div>
        <div className="numero"><span>Área somada</span><strong>{formatarHa(r.areaTotal)}</strong></div>
      </section>

      <section className="bloco">
        {/* A chave recria o formulário quando o filtro muda (ex.: Limpar), para as listas mostrarem o filtro atual. */}
        <form key={JSON.stringify(filtro)} className="campos" style={{ alignItems: "end" }} aria-label="Filtrar gastos">
          <div className="campo">
            <label htmlFor="f-safra">Safra</label>
            <select id="f-safra" name="safra" defaultValue={filtro.safra ?? ""}>
              <option value="">Todas</option>
              {[...safras].sort((a, b) => b.ano_agricola.localeCompare(a.ano_agricola)).map((x) => <option key={x.id} value={x.id}>{nomeSafra(x)}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-fazenda">Fazenda</label>
            <select id="f-fazenda" name="fazenda" defaultValue={filtro.fazenda ?? ""}>
              <option value="">Todas</option>
              {fazendas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-categoria">Categoria</label>
            <select id="f-categoria" name="categoria" defaultValue={filtro.categoria ?? ""}>
              <option value="">Todas</option>
              {CATEGORIAS_CUSTO.map((x) => <option key={x.valor} value={x.valor}>{x.nome}</option>)}
            </select>
          </div>
          <div className="rodape-form">
            <button className="btn principal" type="submit">Filtrar</button>
            {filtrado && <Link className="btn discreto" href="/cliente/gastos">Limpar</Link>}
          </div>
        </form>
      </section>

      <section className="bloco" aria-labelledby="t-por-safra">
        <div className="bloco-cab"><h2 id="t-por-safra">Safra por safra</h2></div>
        {!r.safras.length ? <Vazio titulo="Nenhuma safra encontrada">{filtrado ? "Tente outro filtro." : "Assim que a Soloplan cadastrar suas safras, elas aparecem aqui."}</Vazio> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Safra</th><th className="num so-largo">Área</th><th className="num">Total</th><th className="num">R$/ha</th></tr></thead>
            <tbody>
              {r.safras.map((x) => (
                <tr key={x.id}>
                  <td><Link className="linha" href={`/cliente/safras/${x.id}`}>{x.cultura} {x.ano_agricola}</Link><div className="muted" style={{ fontSize: 14 }}>{x.fazenda}</div></td>
                  <td className="num so-largo">{formatarHa(x.area_ha)}</td>
                  <td className="num">{formatarReais(x.total)}</td>
                  <td className="num">{x.porHa == null ? "—" : formatarReais(x.porHa)}</td>
                </tr>
              ))}
              <tr className="total"><td>Total</td><td className="num so-largo">{formatarHa(r.areaTotal)}</td><td className="num">{formatarReais(r.total)}</td><td className="num">{r.porHa == null ? "—" : formatarReais(r.porHa)}</td></tr>
            </tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" aria-labelledby="t-por-categoria">
        <div className="bloco-cab"><h2 id="t-por-categoria">Por categoria</h2></div>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">R$/ha</th><th className="num so-largo">Participação</th></tr></thead>
          <tbody>
            {r.categorias.filter((x) => !filtro.categoria || x.categoria === filtro.categoria).map((x) => (
              <tr key={x.categoria}><td>{x.nome}</td><td className="num">{formatarReais(x.valor)}</td><td className="num">{x.porHa == null ? "—" : formatarReais(x.porHa)}</td><td className="num so-largo">{formatarNumero(x.participacao * 100, 1)}%</td></tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
