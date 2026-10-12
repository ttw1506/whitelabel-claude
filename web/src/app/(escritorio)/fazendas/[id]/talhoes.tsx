"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { formatarHa, formatarNumero, conferirAreaTalhoes } from "@soloplan/regras";
import { salvarTalhao, excluirTalhao } from "../../acoes";
import { Aviso, Campo, Vazio } from "@/components/ui";
import { BotaoExcluir } from "@/components/excluir";
import type { EstadoForm } from "@/lib/formulario";

type Talhao = { id: string; nome: string; area_ha: number };

function FormTalhao({ fazendaId, talhao, aoTerminar }: { fazendaId: string; talhao?: Talhao; aoTerminar?: () => void }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarTalhao.bind(null, fazendaId, talhao?.id ?? null), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) { if (talhao) aoTerminar?.(); else form.current?.reset(); }
  }, [estado, talhao, aoTerminar]);
  return (
    <form ref={form} action={acao} className="formulario" noValidate aria-label={talhao ? `Editar talhão ${talhao.nome}` : "Novo talhão"}>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && !talhao && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div className="campos" style={{ alignItems: "end" }}>
        <Campo nome="nome" rotulo="Talhão (nome ou número)" estado={estado.ok ? {} : estado} padrao={talhao?.nome} obrigatorio />
        <Campo nome="area_ha" rotulo="Área" estado={estado.ok ? {} : estado} padrao={talhao ? formatarNumero(Number(talhao.area_ha)).replace(/\./g, "") : ""} unidade="ha" modo="decimal" obrigatorio />
        <div className="rodape-form">
          <button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Salvando…" : talhao ? "Salvar" : "Adicionar talhão"}</button>
          {talhao && <button type="button" className="btn discreto" onClick={aoTerminar}>Cancelar</button>}
        </div>
      </div>
    </form>
  );
}

export function Talhoes({ fazendaId, talhoes, areaFazenda, eAdmin }: { fazendaId: string; talhoes: Talhao[]; areaFazenda: number | null; eAdmin: boolean }) {
  const [editando, setEditando] = useState<string | null>(null);
  const { soma, excede } = conferirAreaTalhoes(areaFazenda, talhoes.map((t) => Number(t.area_ha)));
  return (
    <section className="bloco" aria-labelledby="titulo-talhoes">
      <div className="bloco-cab">
        <h2 id="titulo-talhoes">Talhões</h2>
        <span className="muted tabular">{talhoes.length} {talhoes.length === 1 ? "talhão" : "talhões"} · {formatarHa(soma)}</span>
      </div>
      {excede && <Aviso tipo="atencao">A soma dos talhões ({formatarHa(soma)}) passa da área total do imóvel ({formatarHa(areaFazenda)}). Confira as áreas.</Aviso>}
      {talhoes.length === 0 ? (
        <Vazio titulo="Nenhum talhão cadastrado">Adicione os talhões abaixo para poder montar as safras.</Vazio>
      ) : (
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Talhão</th><th className="num">Área</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {talhoes.map((t) => editando === t.id ? (
                <tr key={t.id}><td colSpan={3}><FormTalhao fazendaId={fazendaId} talhao={t} aoTerminar={() => setEditando(null)} /></td></tr>
              ) : (
                <tr key={t.id}>
                  <td><strong>{t.nome}</strong></td>
                  <td className="num">{formatarHa(Number(t.area_ha))}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="acoes" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="btn pequeno" onClick={() => setEditando(t.id)} aria-label={`Editar talhão ${t.nome}`}><Pencil size={16} aria-hidden />Editar</button>
                      {eAdmin && <BotaoExcluir acao={excluirTalhao.bind(null, t.id, fazendaId)} confirmacao={`Excluir ${t.nome}?`} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
        <FormTalhao fazendaId={fazendaId} />
      </div>
    </section>
  );
}
