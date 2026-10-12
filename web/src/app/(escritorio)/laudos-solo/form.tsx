"use client";
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { analisarSolo, lerDecimal, sugestaoRecomendacao, formatarNumero, NOME_CLASSE, AVISO_RECOMENDACAO, type ValoresSolo } from "@soloplan/regras";
import { Aviso, Campo, Selecao } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { CAMPOS_SOLO } from "@/lib/campos-solo";
import type { EstadoForm } from "@/lib/formulario";
import { salvarLaudoSolo } from "./acoes";

type Talhao = { id: string; nome: string };
export type LaudoSoloForm = {
  id: string; talhao_id: string | null; data_coleta: string | null; profundidade: string; laboratorio: string | null; arquivo_path: string | null;
  valores: Record<string, number | null>; prnt: number | null; v2: number | null; recomendacao: string | null;
};
const br = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export function FormLaudoSolo({ fazendaId, clienteId, talhoes, laudo, envio }: {
  fazendaId: string; clienteId: string; talhoes: Talhao[]; laudo?: LaudoSoloForm; envio?: { id: string; arquivo_path: string | null; urlArquivo: string | null };
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarLaudoSolo.bind(null, laudo?.id ?? null, fazendaId, envio?.id ?? null), {});
  const inicial = (c: string) => estado.valores?.[c] ?? (laudo ? br(laudo.valores[c]) : "");
  const [campos, setCampos] = useState<Record<string, string>>(() => Object.fromEntries([...CAMPOS_SOLO.map((c) => [c.chave, inicial(c.chave)]), ["prnt", estado.valores?.prnt ?? br(laudo?.prnt ?? 80)], ["v2", estado.valores?.v2 ?? br(laudo?.v2 ?? 50)], ["profundidade", laudo?.profundidade ?? "0-20"]]));
  const [recomendacao, setRecomendacao] = useState(estado.valores?.recomendacao ?? laudo?.recomendacao ?? "");
  const [arquivo, setArquivo] = useState(laudo?.arquivo_path ?? envio?.arquivo_path ?? "");
  const [enviandoArquivo, setEnviandoArquivo] = useState<string>();

  const previa = useMemo(() => {
    try {
      const v = Object.fromEntries(CAMPOS_SOLO.map((c) => [c.chave, lerDecimal(campos[c.chave] ?? "")])) as unknown as ValoresSolo;
      return analisarSolo(v, { profundidade: campos.profundidade === "20-40" ? "20-40" : "0-20", prnt: lerDecimal(campos.prnt) ?? 0, v2: lerDecimal(campos.v2) ?? 0 });
    } catch (e) { return e instanceof Error ? e.message : "Preencha os valores."; }
  }, [campos]);
  const muda = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCampos((c) => ({ ...c, [k]: e.target.value }));

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEnviandoArquivo("Enviando arquivo…");
    const ext = (f.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `clientes/${clienteId}/laudos-solo/originais/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseNavegador().storage.from("documentos").upload(caminho, f, { contentType: f.type || "application/octet-stream" });
    setEnviandoArquivo(error ? "Não foi possível enviar o arquivo. Tente de novo." : undefined);
    if (!error) setArquivo(caminho);
  }

  return (
    <form action={acao} className="formulario" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <section className="bloco">
        <div className="bloco-cab"><h2>Amostra</h2></div>
        <div className="campos">
          <Selecao prefixo="solo" nome="talhao_id" rotulo="Talhão" estado={estado} padrao={laudo?.talhao_id} opcoes={talhoes.map((t) => ({ valor: t.id, nome: t.nome }))} vazio="Fazenda toda / sem talhão" />
          <div className="campo">
            <label htmlFor="solo-profundidade">Profundidade</label>
            <select id="solo-profundidade" name="profundidade" value={campos.profundidade} onChange={muda("profundidade")}>
              <option value="0-20">0 a 20 cm</option><option value="20-40">20 a 40 cm</option>
            </select>
          </div>
          <Campo prefixo="solo" nome="data_coleta" rotulo="Data da coleta" estado={estado} padrao={laudo?.data_coleta} tipo="date" />
          <Campo prefixo="solo" nome="laboratorio" rotulo="Laboratório" estado={estado} padrao={laudo?.laboratorio} />
          <div className="campo largo">
            <label htmlFor="solo-arquivo">Arquivo do laboratório (PDF ou foto)</label>
            {envio?.urlArquivo && <span className="dica">Enviado pelo produtor: <a href={envio.urlArquivo} target="_blank" rel="noopener noreferrer">abrir o arquivo</a></span>}
            <input id="solo-arquivo" type="file" accept="application/pdf,image/*" onChange={enviarArquivo} />
            <input type="hidden" name="arquivo_path" value={arquivo} />
            {enviandoArquivo ? <span className="dica" role="status">{enviandoArquivo}</span> : arquivo ? <span className="dica">Arquivo anexado.</span> : null}
          </div>
        </div>
      </section>

      <section className="bloco">
        <div className="bloco-cab"><h2>Resultados do laboratório</h2><span className="muted">A leitura automática pela IA chega na etapa 7.</span></div>
        <div className="campos campos-solo">
          {CAMPOS_SOLO.map((c) => (
            <div className="campo" key={c.chave}>
              <label htmlFor={`solo-${c.chave}`}>{c.nome}{c.obrigatorio && <span aria-hidden> *</span>}</label>
              <div className="unidade">
                <input id={`solo-${c.chave}`} name={c.chave} inputMode="decimal" autoComplete="off" value={campos[c.chave] ?? ""} onChange={muda(c.chave)} aria-invalid={estado.campos?.[c.chave] ? true : undefined} />
                {c.unidade && <span>{c.unidade}</span>}
              </div>
              {estado.campos?.[c.chave] && <span className="erro">{estado.campos[c.chave]}</span>}
            </div>
          ))}
        </div>
        <div className="campos" style={{ marginTop: 16 }}>
          <div className="campo"><label htmlFor="solo-prnt">PRNT do calcário</label><div className="unidade"><input id="solo-prnt" name="prnt" inputMode="decimal" value={campos.prnt} onChange={muda("prnt")} aria-invalid={estado.campos?.prnt ? true : undefined} /><span>%</span></div>{estado.campos?.prnt && <span className="erro">{estado.campos.prnt}</span>}</div>
          <div className="campo"><label htmlFor="solo-v2">V% desejada</label><div className="unidade"><input id="solo-v2" name="v2" inputMode="decimal" value={campos.v2} onChange={muda("v2")} aria-invalid={estado.campos?.v2 ? true : undefined} /><span>%</span></div><span className="dica">Padrão 50% para soja no Cerrado.</span>{estado.campos?.v2 && <span className="erro">{estado.campos.v2}</span>}</div>
        </div>
      </section>

      <section className="bloco" aria-live="polite">
        <div className="bloco-cab"><h2>Análise calculada</h2></div>
        {typeof previa === "string" ? <p className="muted" style={{ margin: 0 }}>{previa}</p> : (
          <dl className="dados">
            <div><dt>SB</dt><dd>{formatarNumero(previa.sb, 2)} cmolc/dm³</dd></div>
            <div><dt>CTC a pH 7</dt><dd>{formatarNumero(previa.ctc, 2)} cmolc/dm³</dd></div>
            <div><dt>V%</dt><dd>{formatarNumero(previa.v, 1)}%</dd></div>
            <div><dt>m%</dt><dd>{formatarNumero(previa.m, 1)}%</dd></div>
            <div><dt>Fósforo</dt><dd>{NOME_CLASSE[previa.p.classe]}</dd></div>
            <div><dt>Potássio</dt><dd>{NOME_CLASSE[previa.k.classe]}</dd></div>
            <div><dt>Calagem</dt><dd>{previa.calagemTHa > 0 ? `${formatarNumero(previa.calagemTHa, 2)} t/ha` : "Não necessária"}</dd></div>
            <div><dt>Gessagem</dt><dd>{previa.gessagem.aplica ? `${formatarNumero(previa.gessagem.kgHa!, 0)} kg/ha` : "Não indicada"}</dd></div>
          </dl>
        )}
      </section>

      <section className="bloco">
        <div className="bloco-cab">
          <h2>Recomendação</h2>
          <button type="button" className="btn pequeno" disabled={typeof previa === "string"} onClick={() => typeof previa !== "string" && setRecomendacao(sugestaoRecomendacao(previa))}>Usar sugestão calculada</button>
        </div>
        <div className="campo">
          <label htmlFor="solo-recomendacao" className="sr-only">Recomendação</label>
          <textarea id="solo-recomendacao" name="recomendacao" rows={8} value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} placeholder="Em branco = usa a sugestão calculada." />
          <span className="dica">{AVISO_RECOMENDACAO}</span>
        </div>
      </section>

      <div className="rodape-form">
        <button className="btn principal" type="submit" disabled={enviando || !!enviandoArquivo}>{enviando ? "Salvando…" : laudo ? "Salvar alterações" : "Salvar para revisão"}</button>
        <Link className="btn discreto" href={laudo ? `/laudos-solo/${laudo.id}` : `/fazendas/${fazendaId}`}>Cancelar</Link>
      </div>
    </form>
  );
}
