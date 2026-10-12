"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserCog, Users } from "lucide-react";

const ITENS = [
  { href: "/painel", nome: "Painel", Icone: LayoutDashboard },
  { href: "/clientes", nome: "Clientes e fazendas", Icone: Users },
];

// Fazendas e safras ficam dentro de Clientes.
const ativo = (atual: string, href: string) =>
  atual === href || atual.startsWith(href + "/") || (href === "/clientes" && /^\/(fazendas|safras)\b/.test(atual));

export function Menu({ variante, eAdmin }: { variante: "lateral" | "abas"; eAdmin: boolean }) {
  const atual = usePathname();
  const itens = eAdmin ? [...ITENS, { href: "/usuarios", nome: "Usuários", Icone: UserCog }] : ITENS;
  return (
    <nav className={variante === "lateral" ? "menu" : "abas-celular"} aria-label="Principal">
      {itens.map(({ href, nome, Icone }) => (
        <Link key={href} href={href} aria-current={ativo(atual, href) ? "page" : undefined}>
          {variante === "lateral" && <Icone size={18} aria-hidden />}
          {nome}
        </Link>
      ))}
    </nav>
  );
}
