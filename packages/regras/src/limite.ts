// Limite de requisições por chave (janela fixa). shortcut: a contagem fica na memória de cada servidor;
// em produção com vários servidores, trocar por um contador compartilhado (Redis/Upstash).
export function criarLimitador(opcoes: { max: number; janelaMs: number; maxChaves?: number }, agora: () => number = Date.now) {
  const { max, janelaMs, maxChaves = 10_000 } = opcoes;
  const contas = new Map<string, { inicio: number; n: number }>();
  return {
    tentar(chave: string): { ok: boolean; esperarSegundos: number } {
      const t = agora();
      if (contas.size >= maxChaves) for (const [k, c] of contas) if (t - c.inicio >= janelaMs) contas.delete(k);
      if (contas.size >= maxChaves) contas.delete(contas.keys().next().value!);
      let c = contas.get(chave);
      if (!c || t - c.inicio >= janelaMs) { c = { inicio: t, n: 0 }; contas.set(chave, c); }
      c.n++;
      return { ok: c.n <= max, esperarSegundos: Math.ceil((c.inicio + janelaMs - t) / 1000) };
    },
    tamanho: () => contas.size,
  };
}
