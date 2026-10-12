"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function BotaoTema() {
  const [escuro, setEscuro] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setEscuro(t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  function trocar() {
    const novo = !escuro;
    setEscuro(novo);
    const valor = novo ? "dark" : "light";
    document.documentElement.dataset.theme = valor;
    document.cookie = `tema=${valor}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button type="button" className="btn discreto pequeno" onClick={trocar} aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}>
      {escuro ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
      <span>{escuro ? "Tema claro" : "Tema escuro"}</span>
    </button>
  );
}
