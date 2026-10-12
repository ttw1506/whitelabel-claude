import { NextResponse } from "next/server";
import { criarLimitador } from "@soloplan/regras";
import { registrarErro } from "@/lib/log";
import { autenticarIA, type SessaoIA } from "./sessao";

// Por IP, antes de mexer no banco: chute de chave e laço infinito não geram custo nem derrubam o serviço.
const porIp = criarLimitador({ max: 120, janelaMs: 60_000 });
const falhasPorIp = criarLimitador({ max: 10, janelaMs: 60_000 });
const ipDe = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconhecido";

export const erro = (status: number, mensagem: string, detalhes?: Record<string, string>) =>
  NextResponse.json({ erro: mensagem, ...(detalhes ? { detalhes } : {}) }, { status });

type Contexto<P> = { params: Promise<P> };

/** Envolve uma rota da IA: exige a chave, trata JSON inválido e erros do banco com mensagem em português. */
export function rotaIA<P = Record<string, never>>(fn: (req: Request, ia: SessaoIA, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Contexto<P>) => {
    const ip = ipDe(req);
    const lim = porIp.tentar(ip);
    if (!lim.ok) return Response.json({ erro: "Muitas requisições. Aguarde um pouco." }, { status: 429, headers: { "Retry-After": String(lim.esperarSegundos) } });
    let ia: SessaoIA | null;
    try { ia = await autenticarIA(req); } catch (e) { registrarErro("ia.autenticar", e); return erro(503, "Serviço da IA indisponível no momento."); }
    if (!ia) {
      const f = falhasPorIp.tentar(ip);
      if (!f.ok) return Response.json({ erro: "Muitas tentativas com chave inválida. Aguarde." }, { status: 429, headers: { "Retry-After": String(f.esperarSegundos) } });
      return erro(401, "Chave de API ausente, inválida ou revogada.");
    }
    try { return await fn(req, ia, await ctx.params); }
    catch (e) {
      if (e instanceof SyntaxError) return erro(400, "O corpo da requisição não é um JSON válido.");
      registrarErro("ia.rota", e, { url: new URL(req.url).pathname });
      return erro(500, "Erro inesperado. Tente de novo.");
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
