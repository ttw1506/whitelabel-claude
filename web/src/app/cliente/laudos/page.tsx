import { FileText } from "lucide-react";
import { sessaoCliente } from "@/lib/sessao";
import { dataBr } from "@/lib/datas";
import { Cabeca, Vazio } from "@/components/ui";
import { EnviarLaudoSolo } from "./enviar";

export const metadata = { title: "Laudos" };

const SITUACAO: Record<string, string> = { aberto: "Recebido, aguardando análise", em_andamento: "Em análise", concluido: "Analisado" };

export default async function Laudos() {
  const { supabase, clienteId } = await sessaoCliente();
  const [solo, safra, envios, fazendas] = await Promise.all([
    supabase.from("laudos_solo").select("id, data_coleta, profundidade, enviado_em, pdf_path, fazendas(nome), talhoes(nome)").order("enviado_em", { ascending: false }),
    supabase.from("laudos_safra").select("id, tipo, enviado_em, pdf_path, safras(cultura, ano_agricola, fazendas(nome))").order("enviado_em", { ascending: false }),
    supabase.from("envios_cliente").select("id, criado_em, status, fazendas(nome)").eq("tipo", "laudo_solo").order("criado_em", { ascending: false }),
    supabase.from("fazendas").select("id, nome").order("nome"),
  ]);
  return (
    <>
      <Cabeca titulo="Laudos" sub="Laudos de solo e de safra liberados pela Soloplan, para baixar em PDF.">
        <EnviarLaudoSolo clienteId={clienteId} fazendas={fazendas.data ?? []} />
      </Cabeca>

      {!!envios.data?.length && (
        <section className="bloco" aria-labelledby="t-envios">
          <div className="bloco-cab"><h2 id="t-envios">Laudos que você enviou</h2></div>
          <ul className="pendencias">{envios.data.map((e) => (
            <li key={e.id}><span className={e.status === "concluido" ? "selo verde" : "selo laranja"}>{SITUACAO[e.status]}</span>
              <div>{(e.fazendas as unknown as { nome: string } | null)?.nome} · enviado em {dataBr(e.criado_em)}</div></li>
          ))}</ul>
        </section>
      )}

      <section className="bloco" aria-labelledby="t-solo">
        <div className="bloco-cab"><h2 id="t-solo">Laudos de solo</h2></div>
        {!solo.data?.length ? <Vazio titulo="Nenhum laudo de solo ainda">Envie o laudo do laboratório pelo botão acima; ele volta analisado depois da aprovação do agrônomo.</Vazio> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Fazenda · talhão</th><th>Camada</th><th>Coleta</th></tr></thead>
            <tbody>{solo.data.map((l) => (
              <tr key={l.id}>
                <td>
                  {(l.fazendas as unknown as { nome: string }).nome}{(l.talhoes as unknown as { nome: string } | null) ? ` · ${(l.talhoes as unknown as { nome: string }).nome}` : ""}
                  {l.pdf_path && <div style={{ marginTop: 8 }}><a className="btn pequeno" href={`/cliente/laudos/pdf/solo/${l.id}`}><FileText size={16} aria-hidden />Baixar PDF</a></div>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{l.profundidade} cm</td><td className="tabular">{dataBr(l.data_coleta)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bloco" aria-labelledby="t-safra">
        <div className="bloco-cab"><h2 id="t-safra">Laudos de safra</h2></div>
        {!safra.data?.length ? <Vazio titulo="Nenhum laudo de safra ainda" /> : (
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Safra</th><th>Tipo</th><th>Enviado</th></tr></thead>
            <tbody>{safra.data.map((l) => {
              const s = l.safras as unknown as { cultura: string; ano_agricola: string; fazendas: { nome: string } };
              return (
                <tr key={l.id}>
                  <td>
                    {s.cultura} {s.ano_agricola} · {s.fazendas.nome}
                    {l.pdf_path && <div style={{ marginTop: 8 }}><a className="btn pequeno" href={`/cliente/laudos/pdf/safra/${l.id}`}><FileText size={16} aria-hidden />Baixar PDF</a></div>}
                  </td>
                  <td>{l.tipo === "final" ? "Final" : "Parcial"}</td><td className="tabular">{dataBr(l.enviado_em)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
