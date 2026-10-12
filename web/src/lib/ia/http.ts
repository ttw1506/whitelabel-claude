import { NextResponse } from "next/server";
import { autenticarIA, type SessaoIA } from "./sessao";

export const erro = (status: number, mensagem: string, detalhes?: Record<string, string>) =>
  NextResponse.json({ erro: mensagem, ...(detalhes ? { detalhes } : {}) }, { status });

type Contexto<P> = { params: Promise<P> };

/** Envolve uma rota da IA: exige a chave, trata JSON inválido e erros do banco com mensagem em português. */
export function rotaIA<P = Record<string, never>>(fn: (req: Request, ia: SessaoIA, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Contexto<P>) => {
    let ia: SessaoIA | null;
    try { ia = await autenticarIA(req); } catch (e) { return erro(503, (e as Error).message); }
    if (!ia) return erro(401, "Chave de API ausente, inválida ou revogada.");
    try { return await fn(req, ia, await ctx.params); }
    catch (e) {
      const msg = (e as Error).message ?? "Erro inesperado.";
      if (e instanceof SyntaxError) return erro(400, "O corpo da requisição não é um JSON válido.");
      return erro(500, msg);
    }
  };
}

export const lerJson = async (req: Request): Promise<unknown> => req.json();

/** Traduz erro do PostgREST para HTTP. */
export function erroBanco(e: { message: string; code?: string }) {
  if (e.code === "42501" || /row-level security/.test(e.message)) return erro(403, "O banco recusou: a IA só cria e edita rascunhos.");
  if (e.code === "23503") return erro(422, "Referência inexistente (safra, talhão ou fazenda não encontrados).");
  return erro(500, e.message);
}
