import Link from "next/link";
import { sessaoEquipe } from "@/lib/sessao";
import { Menu } from "@/components/menu";
import { BotaoTema } from "@/components/tema";
import { sair } from "../entrar/acoes";

const NOME_PAPEL = { admin: "Administrador", funcionario: "Funcionário" } as const;

export default async function LayoutEscritorio({ children }: { children: React.ReactNode }) {
  const { perfil } = await sessaoEquipe();
  const papel = NOME_PAPEL[perfil.papel as keyof typeof NOME_PAPEL];
  return (
    <div className="app">
      <aside className="lateral">
        <Link href="/painel" className="marca">Solo<span>plan</span></Link>
        <Menu variante="lateral" />
        <div className="usuario">
          <div><strong>{perfil.nome}</strong><span className="muted">{papel}</span></div>
          <BotaoTema />
          <form action={sair}><button className="btn discreto pequeno" type="submit">Sair</button></form>
        </div>
      </aside>
      <div>
        <header className="topo-celular">
          <Link href="/painel" className="marca" style={{ padding: 0, fontSize: 22 }}>Solo<span>plan</span></Link>
          <div className="acoes">
            <BotaoTema />
            <form action={sair}><button className="btn discreto pequeno" type="submit">Sair</button></form>
          </div>
        </header>
        <Menu variante="abas" />
        <main className="conteudo">{children}</main>
      </div>
    </div>
  );
}
