import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EstadoForm } from "@/lib/formulario";

export function Trilha({ itens }: { itens: { nome: string; href?: string }[] }) {
  return (
    <nav aria-label="Você está em" className="trilha">
      {itens.map((it, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span aria-hidden>›</span>}
          {it.href && i < itens.length - 1 ? <Link href={it.href}>{it.nome}</Link> : <span aria-current="page">{it.nome}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Cabeca({ titulo, sub, children }: { titulo: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="cabeca">
      <div><h1>{titulo}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="acoes">{children}</div>}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "erro" | "atencao" | "ok"; children: React.ReactNode }) {
  return (
    <p className={`aviso ${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      {tipo === "ok" ? <CheckCircle2 size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

type CampoProps = {
  nome: string; rotulo: string; estado: EstadoForm; padrao?: string | number | null; dica?: string;
  tipo?: string; unidade?: string; largo?: boolean; obrigatorio?: boolean; modo?: "decimal" | "numeric" | "email" | "tel" | "text";
  autocomplete?: string; maximo?: number; prefixo?: string;
};

export function Campo({ nome, rotulo, estado, padrao, dica, tipo = "text", unidade, largo, obrigatorio, modo, autocomplete, maximo, prefixo = "campo" }: CampoProps) {
  const erro = estado.campos?.[nome];
  const valor = estado.valores?.[nome] ?? (padrao == null ? "" : String(padrao));
  const id = `${prefixo}-${nome}`;
  const input = (
    <input id={id} name={nome} type={tipo} defaultValue={valor} inputMode={modo} autoComplete={autocomplete ?? "off"} maxLength={maximo}
      required={obrigatorio} aria-invalid={erro ? true : undefined} aria-describedby={erro || dica ? `${id}-info` : undefined} />
  );
  return (
    <div className={`campo${largo ? " largo" : ""}`}>
      <label htmlFor={id}>{rotulo}{obrigatorio && <span aria-hidden> *</span>}</label>
      {unidade ? <div className="unidade">{input}<span>{unidade}</span></div> : input}
      {erro ? <span className="erro" id={`${id}-info`}>{erro}</span> : dica ? <span className="dica" id={`${id}-info`}>{dica}</span> : null}
    </div>
  );
}

export function Selecao({ nome, rotulo, estado, padrao, opcoes, vazio, obrigatorio, prefixo = "campo" }: {
  nome: string; rotulo: string; estado: EstadoForm; padrao?: string | null; opcoes: { valor: string; nome: string }[]; vazio?: string; obrigatorio?: boolean; prefixo?: string;
}) {
  const erro = estado.campos?.[nome];
  const id = `${prefixo}-${nome}`;
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}{obrigatorio && <span aria-hidden> *</span>}</label>
      {/* A chave recria a lista quando o servidor devolve o que foi digitado: depois de um envio o React limpa o formulário
          e a lista voltaria para a primeira opção. */}
      <select key={estado.valores?.[nome] ?? padrao ?? ""} id={id} name={nome} defaultValue={estado.valores?.[nome] ?? padrao ?? ""} aria-invalid={erro ? true : undefined}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
      </select>
      {erro && <span className="erro">{erro}</span>}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return <div className="vazio"><strong>{titulo}</strong>{children}</div>;
}
