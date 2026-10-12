"use client";
import { useState } from "react";

/** Botão no cabeçalho do bloco que abre o formulário logo abaixo, na largura toda. */
export function Expansivel({ rotulo, icone, principal, children }: { rotulo: string; icone?: React.ReactNode; principal?: boolean; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="painel-form">
      <button type="button" className={`btn${principal && !aberto ? " principal" : ""}`} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {icone}{aberto ? "Fechar" : rotulo}
      </button>
      {aberto && <div className="painel-corpo">{children}</div>}
    </div>
  );
}
