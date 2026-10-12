import { notFound } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormFazenda, type Fazenda } from "../../form";

export const metadata = { title: "Editar fazenda" };

export default async function EditarFazenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await sessaoEquipe();
  const { data: f } = await supabase.from("fazendas").select("*, clientes(nome)").eq("id", id).maybeSingle();
  if (!f) notFound();
  const cliente = f.clientes as unknown as { nome: string };
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: cliente.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${id}` }, { nome: "Editar" }]} />
      <Cabeca titulo={`Editar ${f.nome}`} />
      <FormFazenda fazenda={f as Fazenda} clienteId={f.cliente_id} />
    </>
  );
}
