import Link from "next/link";
import { sessaoCliente } from "@/lib/sessao";
import { BotaoTema } from "@/components/tema";
import { sair } from "../entrar/acoes";
import { MenuCliente } from "./menu";

export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  const { supabase, perfil } = await sessaoCliente();
  const { data: cliente } = await supabase.from("clientes").select("nome").single();
  return (
    <div className="app">
      <aside className="lateral">
        <Link href="/cliente/gastos" className="marca">Solo<span>plan</span></Link>
        <MenuCliente variante="lateral" />
        <div className="usuario">
          <div><strong>{cliente?.nome ?? perfil.nome}</strong><span className="muted">Produtor</span></div>
          <BotaoTema />
          <form action={sair}><button className="btn discreto pequeno" type="submit">Sair</button></form>
        </div>
      </aside>
      <div>
        <header className="topo-celular">
          <Link href="/cliente/gastos" className="marca" style={{ padding: 0, fontSize: 22 }}>Solo<span>plan</span></Link>
          <div className="acoes"><BotaoTema /><form action={sair}><button className="btn discreto pequeno" type="submit">Sair</button></form></div>
        </header>
        <MenuCliente variante="abas" />
        <main className="conteudo">{children}</main>
      </div>
    </div>
  );
}
