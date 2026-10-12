import { notFound, redirect } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormLaudoSolo, type LaudoSoloForm } from "../../form";

export const metadata = { title: "Editar laudo de solo" };

export default async function EditarLaudoSolo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, eAdmin } = await sessaoEquipe();
  const { data: l } = await supabase.from("laudos_solo").select("*, fazendas(id, nome, cliente_id, clientes(nome), talhoes(id, nome))").eq("id", id).maybeSingle();
  if (!l) notFound();
  if (!eAdmin && (l.status === "aprovado" || l.status === "enviado_ao_cliente")) redirect(`/laudos-solo/${id}`);
  const f = l.fazendas as unknown as { id: string; nome: string; cliente_id: string; clientes: { nome: string }; talhoes: { id: string; nome: string }[] };
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: f.clientes.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: "Laudo de solo", href: `/laudos-solo/${id}` }, { nome: "Editar" }]} />
      <Cabeca titulo="Editar laudo de solo" />
      <FormLaudoSolo fazendaId={f.id} clienteId={f.cliente_id} talhoes={f.talhoes} laudo={l as unknown as LaudoSoloForm} />
    </>
  );
}
