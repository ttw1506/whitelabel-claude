import { notFound } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { Cabeca, Trilha } from "@/components/ui";
import { FormLaudoSolo } from "../form";

export const metadata = { title: "Novo laudo de solo" };

export default async function NovoLaudoSolo({ searchParams }: { searchParams: Promise<{ fazenda?: string; envio?: string }> }) {
  const { supabase } = await sessaoEquipe();
  const busca = await searchParams;
  let fazendaId = busca.fazenda ?? "";
  let envio: { id: string; arquivo_path: string | null; urlArquivo: string | null } | undefined;
  if (busca.envio) {
    const { data: e } = await supabase.from("envios_cliente").select("id, fazenda_id, arquivo_path").eq("id", busca.envio).eq("tipo", "laudo_solo").maybeSingle();
    if (!e) notFound();
    fazendaId = e.fazenda_id!;
    const url = e.arquivo_path ? (await supabase.storage.from("documentos").createSignedUrl(e.arquivo_path, 3600)).data?.signedUrl ?? null : null;
    envio = { id: e.id, arquivo_path: e.arquivo_path, urlArquivo: url };
  }
  const { data: f } = await supabase.from("fazendas").select("id, nome, cliente_id, clientes(nome), talhoes(id, nome)").eq("id", fazendaId).order("nome", { referencedTable: "talhoes" }).maybeSingle();
  if (!f) notFound();
  const cliente = (f.clientes as unknown as { nome: string }).nome;
  return (
    <>
      <Trilha itens={[{ nome: "Clientes", href: "/clientes" }, { nome: cliente, href: `/clientes/${f.cliente_id}` }, { nome: f.nome, href: `/fazendas/${f.id}` }, { nome: "Novo laudo de solo" }]} />
      <Cabeca titulo="Novo laudo de solo" sub={envio ? "Análise do laudo enviado pelo produtor." : `${cliente} · ${f.nome}`} />
      <FormLaudoSolo fazendaId={f.id} clienteId={f.cliente_id} talhoes={f.talhoes ?? []} envio={envio} />
    </>
  );
}
