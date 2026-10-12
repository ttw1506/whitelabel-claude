"use client";
import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { Aviso, Campo, Selecao } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";
import { convidar, salvarPerfil, type EstadoConvite } from "./acoes";

type Cliente = { id: string; nome: string };
const PAPEIS = [{ valor: "cliente", nome: "Produtor (cliente)" }, { valor: "funcionario", nome: "Funcionário" }, { valor: "admin", nome: "Administrador" }];

export function FormConvite({ clientes }: { clientes: Cliente[] }) {
  const [estado, acao, enviando] = useActionState<EstadoConvite, FormData>(convidar, {});
  const [papel, setPapel] = useState(estado.valores?.papel ?? "cliente");
  const [copiado, setCopiado] = useState(false);
  return (
    <form action={acao} className="formulario" aria-label="Convidar usuário" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && estado.link && (
        <div className="aviso ok" style={{ display: "grid", gap: 8 }}>
          <span>{estado.ok}</span>
          <input readOnly value={estado.link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 14 }} />
          <button type="button" className="btn pequeno" style={{ justifySelf: "start" }}
            onClick={() => navigator.clipboard.writeText(estado.link!).then(() => setCopiado(true), () => setCopiado(false))}>
            <Copy size={16} aria-hidden />{copiado ? "Copiado" : "Copiar link"}
          </button>
        </div>
      )}
      <div className="campos">
        <Campo prefixo="conv" nome="nome" rotulo="Nome" estado={estado} obrigatorio />
        <Campo prefixo="conv" nome="email" rotulo="E-mail" estado={estado} tipo="email" modo="email" obrigatorio />
        <div className="campo">
          <label htmlFor="conv-papel">Papel</label>
          <select id="conv-papel" name="papel" value={papel} onChange={(e) => setPapel(e.target.value)}>
            {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.nome}</option>)}
          </select>
        </div>
        {papel === "cliente" && <Selecao prefixo="conv" nome="cliente_id" rotulo="Produtor" estado={estado} opcoes={clientes.map((c) => ({ valor: c.id, nome: c.nome }))} vazio="Escolha" obrigatorio />}
      </div>
      <div className="rodape-form"><button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar convite"}</button></div>
    </form>
  );
}

export function FormPerfil({ usuarioId, papel, clienteId, ativo, clientes, voce }: { usuarioId: string; papel: string; clienteId: string | null; ativo: boolean; clientes: Cliente[]; voce: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarPerfil.bind(null, usuarioId), {});
  const [p, setP] = useState(papel);
  return (
    <form action={acao} className="linha-perfil" aria-label="Acesso">
      <select name="papel" value={p} onChange={(e) => setP(e.target.value)} aria-label="Papel" disabled={voce}>
        {PAPEIS.map((x) => <option key={x.valor} value={x.valor}>{x.nome}</option>)}
        {papel === "ia" && <option value="ia">IA do escritório</option>}
      </select>
      {p === "cliente" && (
        <select name="cliente_id" defaultValue={clienteId ?? ""} aria-label="Produtor">
          <option value="">Escolha o produtor</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}
      <label className="marcas" style={{ display: "flex" }}><input type="checkbox" name="ativo" defaultChecked={ativo} disabled={voce} /> Ativo</label>
      {voce ? <span className="muted" style={{ fontSize: 14 }}>Você</span> : <button className="btn pequeno" type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</button>}
      {estado.erro && <span role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>{estado.erro}</span>}
      {estado.ok && <span role="status" style={{ color: "var(--green)", fontSize: 13, fontWeight: 600 }}>{estado.ok}</span>}
    </form>
  );
}
