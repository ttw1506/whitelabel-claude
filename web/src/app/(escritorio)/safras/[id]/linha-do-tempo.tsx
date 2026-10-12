"use client";
import { useRef, useState } from "react";
import { MapPin, X, Check } from "lucide-react";
import { BotaoAcao } from "@/components/botao-acao";
import { BotaoExcluir } from "@/components/excluir";
import { aprovarLancamento, excluirFoto } from "./acoes";

export type FotoVista = {
  id: string; url: string | null; urlOriginal: string | null; estadio: string; quando: string; talhao: string | null;
  autor: string | null; anotacao: string | null; gps: string | null; status: string;
};
export type Grupo = { estadio: string; situacao: string; fotos: FotoVista[] };

const NOME_STATUS: Record<string, string> = { rascunho_ia: "Rascunho da IA", em_revisao: "Em revisão" };

export function LinhaDoTempo({ grupos, safraId, eAdmin }: { grupos: Grupo[]; safraId: string; eAdmin: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aberta, setAberta] = useState<FotoVista | null>(null);
  const abrir = (f: FotoVista) => { setAberta(f); dialogo.current?.showModal(); };
  const total = grupos.reduce((s, g) => s + g.fotos.length, 0);

  return (
    <>
      <div className="linha-tempo" role="list" aria-label={`Linha do tempo: ${total} ${total === 1 ? "foto" : "fotos"}`}>
        {grupos.map((g) => (
          <section key={g.estadio} role="listitem" className="estadio" data-situacao={g.situacao} data-vazio={g.fotos.length ? undefined : ""} aria-label={`Estádio ${g.estadio}`}>
            <h3>{g.estadio}{g.situacao === "atual" && <span className="sr-only"> (atual)</span>}</h3>
            {g.fotos.length === 0 ? <p className="sem-foto">—</p> : (
              <ul>
                {g.fotos.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="miniatura" onClick={() => abrir(f)} aria-label={`Abrir foto de ${f.quando}${f.talhao ? `, ${f.talhao}` : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto já comprimida no envio e servida por link temporário */}
                      {f.url ? <img src={f.url} alt="" width={160} height={120} loading="lazy" /> : <span className="sem-imagem">Sem prévia</span>}
                    </button>
                    <span className="legenda">{f.quando.slice(0, 5)}{f.talhao ? ` · ${f.talhao}` : ""}</span>
                    {NOME_STATUS[f.status] && <span className="selo laranja">{NOME_STATUS[f.status]}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <dialog ref={dialogo} className="foto-dialogo" onClose={() => setAberta(null)} aria-label="Foto">
        {aberta && (
          <div className="foto-aberta">
            <button type="button" className="btn discreto pequeno fechar" onClick={() => dialogo.current?.close()} aria-label="Fechar"><X size={20} aria-hidden /></button>
            {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
            {aberta.url && <img src={aberta.url} alt={aberta.anotacao ?? `Foto do estádio ${aberta.estadio}`} />}
            <div className="foto-info">
              <h3>Estádio {aberta.estadio}</h3>
              <dl className="dados">
                <div><dt>Data e hora</dt><dd>{aberta.quando}</dd></div>
                <div><dt>Talhão</dt><dd>{aberta.talhao ?? "Vários / geral"}</dd></div>
                <div><dt>Autor</dt><dd>{aberta.autor ?? "—"}</dd></div>
                <div><dt>GPS</dt><dd>{aberta.gps ? <a href={`https://www.google.com/maps?q=${aberta.gps.replace(/\s/g, "")}`} target="_blank" rel="noopener noreferrer"><MapPin size={14} aria-hidden /> {aberta.gps}</a> : "Não gravado"}</dd></div>
              </dl>
              {aberta.anotacao && <p style={{ margin: "12px 0 0" }}>{aberta.anotacao}</p>}
              <div className="acoes" style={{ marginTop: 16 }}>
                {aberta.urlOriginal && <a className="btn pequeno" href={aberta.urlOriginal} target="_blank" rel="noopener noreferrer">Abrir original</a>}
                {eAdmin && aberta.status !== "aprovado" && aberta.status !== "enviado_ao_cliente" && (
                  <BotaoAcao acao={async () => { const r = await aprovarLancamento("fotos", aberta.id, safraId); if (!r) dialogo.current?.close(); return r; }}
                    rotulo="Aprovar foto" rotuloPendente="Aprovando…" icone={<Check size={16} aria-hidden />} />
                )}
                {eAdmin && <BotaoExcluir acao={async () => { const r = await excluirFoto(aberta.id, safraId); if (!r) dialogo.current?.close(); return r; }} confirmacao="Excluir esta foto?" />}
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
