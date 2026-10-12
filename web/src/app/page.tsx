import { redirect } from "next/navigation";
import { sessao } from "@/lib/sessao";

export default async function Inicio() {
  const { perfil } = await sessao();
  if (perfil?.ativo && (perfil.papel === "admin" || perfil.papel === "funcionario")) redirect("/painel");
  if (perfil?.ativo && perfil.papel === "cliente" && perfil.cliente_id) redirect("/cliente");
  redirect("/aguardando");
}
