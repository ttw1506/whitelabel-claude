import Link from "next/link";
import { formatarHa, formatarNumero } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/botao-acao";
import { dataHoraBr } from "@/lib/datas";
import { concluirPedido } from "../acoes";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const { supabase, perfil } = await sessaoEquipe();
  const semana = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [clientes, fazendas, safras, pedidos, laudos, rascunhos, fotosNovas] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase.from("fazendas").select("id", { count: "exact", head: true }),
    supabase.from("safras").select("id, ano_agricola, cultura, cultivar, area_ha, estadio_atual, fazendas(nome, clientes(nome))").eq("status", "em_andamento").order("ano_agricola", { ascending: false }),
    supabase.from("envios_cliente").select("id, tipo, mensagem, criado_em, safra_id, clientes(nome), safras(cultura, ano_agricola)").neq("status", "concluido").order("criado_em"),
    supabase.from("laudos_safra").select("id, tipo, status, safra_id, safras(cultura, ano_agricola, fazendas(nome, clientes(nome)))").in("status", ["rascunho_ia", "em_revisao", "aprovado"]).order("criado_em"),
    Promise.all(["ocorrencias", "aplicacoes", "custos", "fotos"].map((t) => supabase.from(t).select("safra_id, safras(cultura, ano_agricola, fazendas(nome, clientes(nome)))").in("status", ["rascunho_ia", "em_revisao"]))),
    supabase.from("fotos").select("safra_id, safras(cultura, ano_agricola, fazendas(nome))").gte("criado_em", semana),
  ]);
  const rascunhosPorSafra = new Map<string, { n: number; cliente: string; safra: string }>();
  for (const r of rascunhos) for (const x of r.data ?? []) {
    const s = x.safras as unknown as { cultura: string; ano_agricola: string; fazendas: { nome: string; clientes: { nome: string } } };
    const atual = rascunhosPorSafra.get(x.safra_id) ?? { n: 0, cliente: s.fazendas.clientes.nome, safra: `${s.cultura} ${s.ano_agricola} · ${s.fazendas.nome}` };
    rascunhosPorSafra.set(x.safra_id, { ...atual, n: atual.n + 1 });
  }
  const fotosPorSafra = new Map<string, { n: number; nome: string }>();
  for (const f of fotosNovas.data ?? []) {
    const s = f.safras as unknown as { cultura: string; ano_agricola: string; fazendas: { nome: string } };
    const atual = fotosPorSafra.get(f.safra_id) ?? { n: 0, nome: `${s.cultura} ${s.ano_agricola} · ${s.fazendas.nome}` };
    fotosPorSafra.set(f.safra_id, { ...atual, n: atual.n + 1 });
  }
  const totalPendencias = (pedidos.data?.length ?? 0) + (laudos.data?.length ?? 0) + rascunhosPorSafra.size;
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
      <section className="bloco" aria-labelledby="t-pendencias">
        <div className="bloco-cab"><h2 id="t-pendencias">Pendências</h2><span className={totalPendencias ? "selo laranja" : "selo verde"}>{totalPendencias ? `${totalPendencias} para resolver` : "Nada pendente"}</span></div>
        {!pedidos.data?.length && !laudos.data?.length && !rascunhosPorSafra.size ? <Vazio titulo="Tudo em dia">Pedidos dos produtores, laudos para revisar e rascunhos da IA aparecem aqui.</Vazio> : (
          <ul className="pendencias">
            {(pedidos.data ?? []).map((p) => {
              const c = p.clientes as unknown as { nome: string };
              const s = p.safras as unknown as { cultura: string; ano_agricola: string } | null;
              return (
                <li key={p.id}>
                  <span className="selo laranja">{p.tipo === "pedido_laudo_parcial" ? "Pedido de laudo parcial" : "Laudo de solo enviado"}</span>
                  <div><strong>{c.nome}</strong>{s && <> · <Link href={`/safras/${p.safra_id}`}>{s.cultura} {s.ano_agricola}</Link></>}<span className="muted"> · {dataHoraBr(p.criado_em)}</span>{p.mensagem && <p className="muted" style={{ margin: "4px 0 0" }}>“{p.mensagem}”</p>}</div>
                  <BotaoAcao acao={concluirPedido.bind(null, p.id)} rotulo="Marcar como atendido" rotuloPendente="Salvando…" />
                </li>
              );
            })}
            {(laudos.data ?? []).map((l) => {
              const s = l.safras as unknown as { cultura: string; ano_agricola: string; fazendas: { nome: string; clientes: { nome: string } } };
              return (
                <li key={l.id}>
                  <span className="selo laranja">{l.status === "rascunho_ia" ? "Laudo da IA para revisar" : l.status === "aprovado" ? "Laudo aprovado, falta enviar" : "Laudo em revisão"}</span>
                  <div><strong>{s.fazendas.clientes.nome}</strong> · <Link href={`/safras/${l.safra_id}#laudos`}>Laudo {l.tipo} · {s.cultura} {s.ano_agricola} · {s.fazendas.nome}</Link></div>
                </li>
              );
            })}
            {[...rascunhosPorSafra.entries()].map(([safraId, r]) => (
              <li key={safraId}>
                <span className="selo laranja">{r.n} {r.n === 1 ? "rascunho" : "rascunhos"} para aprovar</span>
                <div><strong>{r.cliente}</strong> · <Link href={`/safras/${safraId}`}>{r.safra}</Link></div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="bloco" aria-labelledby="t-fotos">
        <div className="bloco-cab"><h2 id="t-fotos">Fotos novas do campo</h2><span className="muted">últimos 7 dias</span></div>
        {!fotosPorSafra.size ? <p className="muted" style={{ margin: 0 }}>Nenhuma foto nova nesta semana.</p> : (
          <ul className="pendencias">{[...fotosPorSafra.entries()].map(([id, f]) => (
            <li key={id}><span className="selo verde">{f.n} {f.n === 1 ? "foto" : "fotos"}</span><div><Link href={`/safras/${id}#linha-do-tempo`}>{f.nome}</Link></div></li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
