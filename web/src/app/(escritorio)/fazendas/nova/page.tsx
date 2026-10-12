import { notFound } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormFazenda } from "../form";

export const metadata = { title: "Nova fazenda" };

export default async function NovaFazenda({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { supabase } = await sessaoEquipe();
  const clienteId = (await searchParams).cliente ?? "";
  const { data: cliente } = await supabase.from("clientes").select("id, nome").eq("id", clienteId).maybeSingle();
  if (!cliente) notFound();
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: cliente.nome, href: `/clientes/${cliente.id}` }, { nome: "Nova fazenda" }]} />
      <Cabeca titulo="Nova fazenda" sub={`Cliente: ${cliente.nome}`} />
      <FormFazenda clienteId={cliente.id} />
    </>
  );
}
