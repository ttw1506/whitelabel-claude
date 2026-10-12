"use client";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/** Exclusão em dois cliques (o primeiro pede confirmação). Só aparece para admin. */
export function BotaoExcluir({ acao, rotulo = "Excluir", confirmacao }: { acao: () => Promise<{ erro?: string } | void>; rotulo?: string; confirmacao: string }) {
  const [armado, setArmado] = useState(false);
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();
  if (!armado) {
    return <button type="button" className="btn perigo pequeno" onClick={() => setArmado(true)}><Trash2 size={16} aria-hidden />{rotulo}</button>;
  }
  return (
    <span className="acoes" role="group" aria-label="Confirmar exclusão" style={{ alignItems: "center" }}>
      <span style={{ fontSize: 14 }}>{confirmacao}</span>
      <button type="button" className="btn perigo pequeno" disabled={pendente}
        onClick={() => iniciar(async () => { const r = await acao(); if (r && r.erro) setErro(r.erro); })}>
        {pendente ? "Excluindo…" : "Sim, excluir"}
      </button>
      <button type="button" className="btn pequeno" onClick={() => setArmado(false)}>Cancelar</button>
      {erro && <span className="erro" role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</span>}
    </span>
  );
}
