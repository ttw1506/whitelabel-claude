"use client";
import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { Aviso, Campo, Selecao } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";
import { NOME_TIPO } from "@/lib/ia/nomes";
import { criarChave, pedirTarefa, type EstadoChave } from "./acoes";

export function FormChave() {
  const [estado, acao, enviando] = useActionState<EstadoChave, FormData>(criarChave, {});
  const [copiado, setCopiado] = useState(false);
  return (
    <form action={acao} className="formulario" aria-label="Criar chave da IA" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && estado.chave && (
        <div className="aviso ok" style={{ display: "grid", gap: 8 }}>
          <span>{estado.ok}</span>
          <input readOnly value={estado.chave} aria-label="Chave de API" onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 14 }} />
          <button type="button" className="btn pequeno" style={{ justifySelf: "start" }}
            onClick={() => navigator.clipboard.writeText(estado.chave!).then(() => setCopiado(true), () => setCopiado(false))}>
            <Copy size={16} aria-hidden />{copiado ? "Copiado" : "Copiar chave"}
          </button>
        </div>
      )}
      <div className="campos"><Campo prefixo="chave" nome="nome" rotulo="Nome da chave" estado={estado} dica="Ex.: PC do escritório" obrigatorio /></div>
      <div className="rodape-form"><button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar chave"}</button></div>
    </form>
  );
}

export function FormTarefa({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(pedirTarefa, {});
  return (
    <form action={acao} className="formulario" aria-label="Pedir tarefa à IA" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div className="campos">
        <Selecao prefixo="tar" nome="tipo" rotulo="O que a IA deve fazer" estado={estado} vazio="Escolha" obrigatorio
          opcoes={Object.entries(NOME_TIPO).map(([valor, nome]) => ({ valor, nome }))} />
        <Selecao prefixo="tar" nome="cliente_id" rotulo="Produtor (opcional)" estado={estado} vazio="Nenhum" opcoes={clientes.map((c) => ({ valor: c.id, nome: c.nome }))} />
        <Campo prefixo="tar" nome="referencia_id" rotulo="Id do registro (opcional)" estado={estado} dica="Safra, laudo ou foto a que a tarefa se refere" />
        <Campo prefixo="tar" nome="observacao" rotulo="Observação (opcional)" estado={estado} largo maximo={500} />
      </div>
      <div className="rodape-form"><button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Colocar na fila"}</button></div>
    </form>
  );
}
