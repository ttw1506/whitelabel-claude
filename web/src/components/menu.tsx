"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";

const ITENS = [
  { href: "/painel", nome: "Painel", Icone: LayoutDashboard },
  { href: "/clientes", nome: "Clientes e fazendas", Icone: Users },
];

// Fazendas e safras ficam dentro de Clientes.
const ativo = (atual: string, href: string) =>
  atual === href || atual.startsWith(href + "/") || (href === "/clientes" && /^\/(fazendas|safras)\b/.test(atual));

export function Menu({ variante }: { variante: "lateral" | "abas" }) {
  const atual = usePathname();
  return (
    <nav className={variante === "lateral" ? "menu" : "abas-celular"} aria-label="Principal">
      {ITENS.map(({ href, nome, Icone }) => (
        <Link key={href} href={href} aria-current={ativo(atual, href) ? "page" : undefined}>
          {variante === "lateral" && <Icone size={18} aria-hidden />}
          {nome}
        </Link>
      ))}
    </nav>
  );
}
