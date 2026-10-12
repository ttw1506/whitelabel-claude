"use client";
import { useState, useTransition } from "react";

/** Botão que chama uma ação do servidor e mostra o erro, se houver. */
export function BotaoAcao({ acao, rotulo, rotuloPendente, classe = "btn pequeno", icone }: {
  acao: () => Promise<{ erro?: string } | void>; rotulo: string; rotuloPendente: string; classe?: string; icone?: React.ReactNode;
}) {
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();
  return (
    <span className="acoes" style={{ alignItems: "center" }}>
      <button type="button" className={classe} disabled={pendente}
        onClick={() => iniciar(async () => { setErro(undefined); const r = await acao(); if (r && r.erro) setErro(r.erro); })}>
        {icone}{pendente ? rotuloPendente : rotulo}
      </button>
      {erro && <span role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>{erro}</span>}
    </span>
  );
}
