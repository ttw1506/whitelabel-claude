import { notFound } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormSafra, type Safra } from "../../form";

export const metadata = { title: "Editar safra" };

export default async function EditarSafra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await sessaoEquipe();
  const { data: s } = await supabase.from("safras")
    .select("*, safra_talhoes(talhao_id), fazendas(id, nome, cliente_id, clientes(nome), talhoes(id, nome, area_ha))").eq("id", id).maybeSingle();
  if (!s) notFound();
  const f = s.fazendas as unknown as { id: string; nome: string; cliente_id: string; clientes: { nome: string }; talhoes: { id: string; nome: string; area_ha: number }[] };
  const safra = { ...s, talhoes: (s.safra_talhoes ?? []).map((x: { talhao_id: string }) => x.talhao_id) } as Safra;
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: f.clientes.nome, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: `${s.cultura} ${s.ano_agricola}`, href: `/safras/${id}` }, { nome: "Editar" }]} />
      <Cabeca titulo={`Editar ${s.cultura} ${s.ano_agricola}`} />
      <FormSafra safra={safra} fazendaId={f.id} talhoes={[...f.talhoes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }))} />
    </>
  );
}
