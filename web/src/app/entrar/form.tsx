"use client";
import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "./acoes";

export function FormEntrar() {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(entrar, {});
  return (
    <form action={acao} className="formulario" noValidate>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={estado.email} required />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
