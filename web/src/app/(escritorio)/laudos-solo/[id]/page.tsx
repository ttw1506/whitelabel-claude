import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Send } from "lucide-react";
import { formatarNumero, formatarSemZeros, NOME_CLASSE, AVISO_RECOMENDACAO, type AnaliseSolo } from "@soloplan/regras";
import { sessaoEquipe } from "@/lib/sessao";
import { dataBr } from "@/lib/datas";
import { CAMPOS_SOLO } from "@/lib/campos-solo";
import { Cabeca, Trilha } from "@/components/ui";
import { BotaoAcao } from "@/components/botao-acao";
import { aprovarEnviarLaudoSolo } from "../acoes";

const STATUS: Record<string, { nome: string; classe: string }> = {
  rascunho_ia: { nome: "Rascunho da IA", classe: "selo laranja" }, em_revisao: { nome: "Em revisão", classe: "selo laranja" },
  aprovado: { nome: "Aprovado", classe: "selo verde" }, enviado_ao_cliente: { nome: "Enviado ao cliente", classe: "selo verde" },
};

export default async function LaudoSolo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, eAdmin } = await sessaoEquipe();
  const { data: l } = await supabase.from("laudos_solo").select("*, fazendas(id, nome, cliente_id, clientes(nome)), talhoes(nome)").eq("id", id).maybeSingle();
  if (!l) notFound();
  const f = l.fazendas as unknown as { id: string; nome: string; cliente_id: string; clientes: { nome: string } };
  const a = l.analise as AnaliseSolo | null;
  const valores = l.valores as Record<string, number | null>;
  const original = l.arquivo_path ? (await supabase.storage.from("documentos").createSignedUrl(l.arquivo_path, 3600)).data?.signedUrl : null;
  const travado = l.status === "aprovado" || l.status === "enviado_ao_cliente";
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: f.clientes.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: "Laudo de solo" }]} />
      <Cabeca titulo={`Laudo de solo · ${l.profundidade} cm`} sub={[(l.talhoes as { nome: string } | null)?.nome ?? "Fazenda toda", `coleta ${dataBr(l.data_coleta)}`, l.laboratorio].filter(Boolean).join(" · ")}>
        <span className={STATUS[l.status].classe}>{STATUS[l.status].nome}{l.enviado_em ? ` em ${dataBr(l.enviado_em)}` : ""}</span>
        <a className="btn" href={`/laudos-solo/${id}/pdf`} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden />{l.status === "enviado_ao_cliente" ? "PDF" : "Prévia do PDF"}</a>
        {(!travado || eAdmin) && <Link className="btn" href={`/laudos-solo/${id}/editar`}><Pencil size={16} aria-hidden />Editar</Link>}
        {eAdmin && l.status !== "enviado_ao_cliente" && <BotaoAcao acao={aprovarEnviarLaudoSolo.bind(null, id)} rotulo="Aprovar e enviar ao cliente" rotuloPendente="Gerando PDF e enviando…" classe="btn principal" icone={<Send size={16} aria-hidden />} />}
      </Cabeca>
      {!eAdmin && !travado && <p className="aviso atencao">Aguardando a aprovação de um administrador para chegar ao produtor.</p>}

      <section className="bloco">
        <div className="bloco-cab"><h2>Resultados do laboratório</h2>{original && <a className="btn pequeno" href={original} target="_blank" rel="noopener noreferrer">Arquivo original</a>}</div>
        <dl className="dados">
          {CAMPOS_SOLO.filter((c) => c.obrigatorio || valores[c.chave] != null).map((c) => (
            <div key={c.chave}><dt>{c.nome}</dt><dd>{valores[c.chave] == null ? "—" : `${formatarSemZeros(Number(valores[c.chave]))} ${c.unidade}`}</dd></div>
          ))}
        </dl>
      </section>

      {a && (
        <section className="bloco">
          <div className="bloco-cab"><h2>Análise calculada</h2></div>
          <dl className="dados">
            <div><dt>SB</dt><dd>{formatarNumero(a.sb, 2)} cmolc/dm³</dd></div>
            <div><dt>CTC a pH 7</dt><dd>{formatarNumero(a.ctc, 2)} cmolc/dm³</dd></div>
            <div><dt>V%</dt><dd>{formatarNumero(a.v, 1)}%</dd></div>
            <div><dt>m%</dt><dd>{formatarNumero(a.m, 1)}%</dd></div>
            <div><dt>Fósforo</dt><dd>{NOME_CLASSE[a.p.classe]} <span className="muted">(argila {a.p.faixaArgila})</span></dd></div>
            <div><dt>Potássio</dt><dd>{NOME_CLASSE[a.k.classe]} <span className="muted">({a.k.faixaCtc})</span></dd></div>
            <div><dt>Calagem</dt><dd>{a.calagemTHa > 0 ? `${formatarNumero(a.calagemTHa, 2)} t/ha` : "Não necessária"} <span className="muted">(PRNT {formatarSemZeros(a.prnt)}%, meta {formatarSemZeros(a.v2)}%)</span></dd></div>
            <div><dt>Gessagem</dt><dd>{a.gessagem.aplica ? `${formatarNumero(a.gessagem.kgHa!, 0)} kg/ha` : "Não indicada"}</dd></div>
          </dl>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>{a.gessagem.motivo}</p>
        </section>
      )}

      <section className="bloco">
        <div className="bloco-cab"><h2>Recomendação</h2></div>
        <p className="texto-laudo">{l.recomendacao}</p>
        <p className="aviso atencao" style={{ margin: 0 }}>{AVISO_RECOMENDACAO}</p>
      </section>
    </>
  );
}
