import { notFound } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormSafra } from "../form";

export const metadata = { title: "Nova safra" };

export default async function NovaSafra({ searchParams }: { searchParams: Promise<{ fazenda?: string }> }) {
  const { supabase } = await sessaoEquipe();
  const fazendaId = (await searchParams).fazenda ?? "";
  const { data: f } = await supabase.from("fazendas").select("id, nome, cliente_id, clientes(nome), talhoes(id, nome, area_ha)").eq("id", fazendaId).order("nome", { referencedTable: "talhoes" }).maybeSingle();
  if (!f) notFound();
  const cliente = f.clientes as unknown as { nome: string };
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: cliente.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: "Nova safra" }]} />
      <Cabeca titulo="Nova safra" sub={`${cliente.nome} · ${f.nome}`} />
      <FormSafra fazendaId={f.id} talhoes={(f.talhoes ?? []) as { id: string; nome: string; area_ha: number }[]} />
    </>
  );
}
