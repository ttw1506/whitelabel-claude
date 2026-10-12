import { notFound } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormCliente } from "../../form";

export const metadata = { title: "Editar cliente" };

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await sessaoEquipe();
  const { data: cliente } = await supabase.from("clientes").select("id, nome, cpf_cnpj, telefone, email, cidade, uf").eq("id", id).maybeSingle();
  if (!cliente) notFound();
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: cliente.nome, href: `/clientes/${id}` }, { nome: "Editar" }]} />
      <Cabeca titulo={`Editar ${cliente.nome}`} />
      <FormCliente cliente={cliente} />
    </>
  );
}
