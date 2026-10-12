import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormCliente } from "../form";

export const metadata = { title: "Novo cliente" };

export default async function NovoCliente() {
  await sessaoEquipe();
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: "Novo cliente" }]} />
      <Cabeca titulo="Novo cliente" />
      <FormCliente />
    </>
  );
}
