"use client";
import { useActionState } from "react";
import { Expansivel } from "@/components/expansivel";
import { Aviso } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";
import { pedirLaudoParcial } from "../../acoes";

export function PedirLaudo({ safraId, emAberto }: { safraId: string; emAberto: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(pedirLaudoParcial.bind(null, safraId), {});
  if (emAberto && !estado.ok) return <span className="selo laranja">Laudo parcial pedido · aguardando a Soloplan</span>;
  return (
    <Expansivel rotulo="Pedir laudo parcial">
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : (
        <form action={acao} className="formulario" aria-label="Pedir laudo parcial">
          {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          <div className="campo">
            <label htmlFor="pedido-mensagem">Quer acrescentar alguma observação? (opcional)</label>
            <textarea id="pedido-mensagem" name="mensagem" placeholder="Ex.: notei manchas nas folhas do talhão 2" />
          </div>
          <div className="rodape-form"><button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button></div>
        </form>
      )}
    </Expansivel>
  );
}
