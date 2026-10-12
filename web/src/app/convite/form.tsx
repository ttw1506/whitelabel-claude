"use client";
import { useActionState } from "react";
import type { EstadoForm } from "@/lib/formulario";
import { criarSenha } from "./acoes";

export function FormSenha({ token }: { token: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarSenha.bind(null, token), {});
  return (
    <form action={acao} className="formulario" noValidate>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo"><label htmlFor="senha">Nova senha</label><input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required /><span className="dica">Pelo menos 8 caracteres.</span></div>
      <div className="campo"><label htmlFor="confirmar">Repita a senha</label><input id="confirmar" name="confirmar" type="password" autoComplete="new-password" required /></div>
      <button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Criar senha e entrar"}</button>
    </form>
  );
}
