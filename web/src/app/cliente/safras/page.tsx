import Link from "next/link";
import { formatarHa } from "@soloplan/regras";
import { sessaoCliente } from "@/lib/sessao";
import { Cabeca, Vazio } from "@/components/ui";

export const metadata = { title: "Minhas safras" };

export default async function MinhasSafras() {
  const { supabase } = await sessaoCliente();
  const { data } = await supabase.from("safras")
    .select("id, ano_agricola, cultura, cultivar, area_ha, estadio_atual, status, fazendas(id, nome)")
    .order("ano_agricola", { ascending: false });
  const porFazenda = new Map<string, { nome: string; safras: NonNullable<typeof data> }>();
  for (const s of data ?? []) {
    const f = s.fazendas as unknown as { id: string; nome: string };
    if (!porFazenda.has(f.id)) porFazenda.set(f.id, { nome: f.nome, safras: [] });
    porFazenda.get(f.id)!.safras.push(s);
  }
  return (
    <>
      <Cabeca titulo="Minhas safras" sub="Acompanhamento de cada lavoura: fotos por estádio, ocorrências, aplicações e laudos." />
      {porFazenda.size === 0 && <section className="bloco"><Vazio titulo="Nenhuma safra ainda">Assim que a Soloplan cadastrar suas safras, elas aparecem aqui.</Vazio></section>}
      {[...porFazenda.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR")).map(([id, f]) => (
        <section className="bloco" key={id} aria-label={f.nome}>
          <div className="bloco-cab"><h2>{f.nome}</h2></div>
          <ul className="cartoes">
            {f.safras.map((s) => (
              <li key={s.id}>
                <Link href={`/cliente/safras/${s.id}`} className="cartao">
                  <strong>{s.cultura} {s.ano_agricola}</strong>
                  <span className="muted">{[s.cultivar, formatarHa(s.area_ha == null ? null : Number(s.area_ha))].filter(Boolean).join(" · ")}</span>
                  <span>{s.status === "colhida" ? <span className="selo">Colhida</span> : <span className="selo verde">{s.estadio_atual ? `Em ${s.estadio_atual}` : "Em andamento"}</span>}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
