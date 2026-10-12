import { redirect } from "next/navigation";
import { sessao } from "@/lib/sessao";
import { sair } from "../entrar/acoes";

export const metadata = { title: "Minha área" };

// A visão do cliente (gastos, safras, laudos) é a etapa 4.
export default async function AreaCliente() {
  const { supabase, perfil } = await sessao();
  if (perfil?.papel !== "cliente" || !perfil.cliente_id) redirect("/");
  const { data: cliente } = await supabase.from("clientes").select("nome").single();
  return (
    <main className="entrar">
      <div className="bloco">
        <h1>Olá, {cliente?.nome ?? perfil.nome}</h1>
        <p>Em breve você verá aqui os gastos, as safras e os laudos das suas fazendas.</p>
        <form action={sair}><button className="btn" type="submit">Sair</button></form>
      </div>
    </main>
  );
}
