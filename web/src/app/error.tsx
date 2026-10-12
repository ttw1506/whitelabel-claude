"use client";
import { useEffect } from "react";

// Erro inesperado em uma tela: mensagem clara, sem detalhes internos, e o registro vai para o log do servidor.
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(JSON.stringify({ nivel: "erro", onde: "tela", mensagem: error.message, digest: error.digest })); }, [error]);
  return (
    <main style={{ padding: 24, maxWidth: 520, margin: "10vh auto" }}>
      <h1>Algo deu errado</h1>
      <p>Não foi possível carregar esta tela. Seus dados estão salvos. Tente de novo; se continuar, avise o administrador{error.digest ? ` (código ${error.digest})` : ""}.</p>
      <button className="btn principal" onClick={reset}>Tentar de novo</button>
    </main>
  );
}
