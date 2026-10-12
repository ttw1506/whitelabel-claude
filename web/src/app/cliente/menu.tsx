"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout, Wallet } from "lucide-react";

const ITENS = [
  { href: "/cliente/gastos", nome: "Meus gastos", Icone: Wallet },
  { href: "/cliente/safras", nome: "Minhas safras", Icone: Sprout },
];

export function MenuCliente({ variante }: { variante: "lateral" | "abas" }) {
  const atual = usePathname();
  return (
    <nav className={variante === "lateral" ? "menu" : "abas-celular"} aria-label="Principal">
      {ITENS.map(({ href, nome, Icone }) => (
        <Link key={href} href={href} aria-current={atual === href || atual.startsWith(href + "/") ? "page" : undefined}>
          {variante === "lateral" && <Icone size={18} aria-hidden />}{nome}
        </Link>
      ))}
    </nav>
  );
}
