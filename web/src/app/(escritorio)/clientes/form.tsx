"use client";
import { useActionState } from "react";
import Link from "next/link";
import { UFS } from "@soloplan/regras";
import { salvarCliente } from "../acoes";
import { Aviso, Campo, Selecao } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";

type Cliente = { id: string; nome: string; cpf_cnpj: string | null; telefone: string | null; email: string | null; cidade: string | null; uf: string | null };

export function FormCliente({ cliente }: { cliente?: Cliente }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarCliente.bind(null, cliente?.id ?? null), {});
  return (
    <form action={acao} className="formulario bloco" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <div className="campos">
        <Campo nome="nome" rotulo="Nome do produtor ou empresa" estado={estado} padrao={cliente?.nome} obrigatorio largo autocomplete="name" />
        <Campo nome="cpf_cnpj" rotulo="CPF ou CNPJ" estado={estado} padrao={cliente?.cpf_cnpj} dica="Com ou sem pontuação." />
        <Campo nome="telefone" rotulo="Telefone / WhatsApp" estado={estado} padrao={cliente?.telefone} modo="tel" tipo="tel" autocomplete="tel" />
        <Campo nome="email" rotulo="E-mail" estado={estado} padrao={cliente?.email} tipo="email" modo="email" autocomplete="email" />
        <Campo nome="cidade" rotulo="Cidade" estado={estado} padrao={cliente?.cidade ?? "Quirinópolis"} />
        <Selecao nome="uf" rotulo="UF" estado={estado} padrao={cliente?.uf ?? "GO"} opcoes={UFS.map((u) => ({ valor: u, nome: u }))} vazio="—" />
      </div>
      <div className="rodape-form">
        <button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Salvando…" : cliente ? "Salvar alterações" : "Cadastrar cliente"}</button>
        <Link className="btn discreto" href={cliente ? `/clientes/${cliente.id}` : "/clientes"}>Cancelar</Link>
      </div>
    </form>
  );
}
