// Registro de erros em uma linha de JSON (fácil de buscar nos logs da hospedagem).
// shortcut: sem serviço de rastreio (Sentry etc.) ainda; ligar quando houver conta. É só trocar o corpo desta função.
export function registrarErro(onde: string, erro: unknown, extra: Record<string, unknown> = {}) {
  const e = erro instanceof Error ? erro : new Error(String(erro));
  console.error(JSON.stringify({ nivel: "erro", onde, mensagem: e.message, pilha: e.stack?.split("\n").slice(0, 4), em: new Date().toISOString(), ...extra }));
}
