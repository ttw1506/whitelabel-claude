import Link from "next/link";
import { formatarHa, formatarNumero } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Vazio } from "@/components/ui";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const { supabase, perfil } = await sessaoEquipe();
  const [clientes, fazendas, safras] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase.from("fazendas").select("id", { count: "exact", head: true }),
    supabase.from("safras").select("id, ano_agricola, cultura, cultivar, area_ha, estadio_atual, fazendas(nome, clientes(nome))").eq("status", "em_andamento").order("ano_agricola", { ascending: false }),
  ]);
  const emAndamento = safras.data ?? [];
  const area = emAndamento.reduce((s, x) => s + Number(x.area_ha ?? 0), 0);
  const primeiroNome = perfil.nome.split(" ")[0];
  return (
    <>
      <Cabeca titulo={`Bom trabalho, ${primeiroNome}`} sub="Resumo da carteira da Soloplan." />
      <section className="grade" aria-label="Números">
        <div className="numero"><span>Clientes</span><strong>{formatarNumero(clientes.count ?? 0, 0)}</strong></div>
        <div className="numero"><span>Fazendas</span><strong>{formatarNumero(fazendas.count ?? 0, 0)}</strong></div>
        <div className="numero"><span>Área em safra</span><strong>{formatarHa(area)}</strong></div>
        <div className="numero"><span>Safras em andamento</span><strong>{formatarNumero(emAndamento.length, 0)}</strong></div>
      </section>
      <section className="bloco">
        <div className="bloco-cab"><h2>Safras em andamento</h2></div>
        {emAndamento.length === 0 ? (
          <Vazio titulo="Nenhuma safra em andamento">Cadastre uma safra dentro da fazenda do cliente.</Vazio>
        ) : (
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Safra</th><th>Cliente · Fazenda</th><th>Estádio</th><th className="num">Área</th></tr></thead>
              <tbody>
                {emAndamento.map((s) => {
                  const f = s.fazendas as unknown as { nome: string; clientes: { nome: string } };
                  return (
                    <tr key={s.id}>
                      <td><Link className="linha" href={`/safras/${s.id}`}>{s.cultura} {s.ano_agricola}</Link>{s.cultivar && <div className="muted">{s.cultivar}</div>}</td>
                      <td>{f.clientes.nome} · {f.nome}</td>
                      <td>{s.estadio_atual ?? "—"}</td>
                      <td className="num">{formatarHa(s.area_ha == null ? null : Number(s.area_ha))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="bloco">
        <div className="bloco-cab"><h2>Pendências</h2></div>
        <p className="muted" style={{ margin: 0 }}>Laudos para revisar, pedidos de clientes e fotos novas do campo aparecem aqui a partir das próximas etapas.</p>
      </section>
    </>
  );
}
