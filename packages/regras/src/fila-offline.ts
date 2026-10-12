// Fila de envio da visita de campo: o aparelho guarda tudo e manda quando houver sinal, sem perder nem duplicar.
// O id nasce no aparelho e vira o id do registro no banco; reenviar o mesmo item não cria um segundo.

export type TipoItem = "ocorrencia" | "foto";
export type ItemFila = {
  id: string; tipo: TipoItem; safra_id: string; payload: Record<string, unknown>;
  criado_em: string; tentativas: number; proxima_tentativa_em: string; erro?: string; bloqueado?: boolean;
  /** Item que precisa subir antes deste (a foto depende da ocorrência). */
  depende_de?: string;
};
export type FalhaEnvio = { status: number; mensagem: string };

const ESPERA_BASE_S = 30, ESPERA_MAXIMA_S = 3600;

export function novoItem(tipo: TipoItem, safra_id: string, payload: Record<string, unknown>, agora = new Date(), id: string = crypto.randomUUID()): ItemFila {
  return { id, tipo, safra_id, payload, criado_em: agora.toISOString(), tentativas: 0, proxima_tentativa_em: agora.toISOString() };
}

/** Sem internet (0) e erro do servidor (5xx) tentam de novo; recusa do banco (4xx) não adianta repetir. */
export const erroDefinitivo = (status: number) => status >= 400 && status < 500 && status !== 408 && status !== 429;

export function prontos(fila: ItemFila[], agora = new Date()): ItemFila[] {
  const ids = new Set(fila.map((i) => i.id));
  return fila
    .filter((i) => !i.bloqueado && new Date(i.proxima_tentativa_em) <= agora && !(i.depende_de && ids.has(i.depende_de)))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

export function aposFalha(item: ItemFila, agora: Date, falha: FalhaEnvio): ItemFila {
  const espera = Math.min(ESPERA_BASE_S * 2 ** item.tentativas, ESPERA_MAXIMA_S);
  return {
    ...item, tentativas: item.tentativas + 1, erro: falha.mensagem,
    bloqueado: erroDefinitivo(falha.status) || undefined,
    proxima_tentativa_em: new Date(agora.getTime() + espera * 1000).toISOString(),
  };
}

export const aposSucesso = (fila: ItemFila[], id: string) => fila.filter((i) => i.id !== id);

export function resumoFila(fila: ItemFila[]) {
  const bloqueados = fila.filter((i) => i.bloqueado).length;
  return { total: fila.length, pendentes: fila.length - bloqueados, bloqueados };
}

export type ResultadoEnvio = { ok: true } | ({ ok: false } & FalhaEnvio);

/** Manda o que está pronto, um de cada vez (a ordem importa). Sem internet na primeira falha: para e espera. */
export async function sincronizarFila(fila: ItemFila[], enviar: (i: ItemFila) => Promise<ResultadoEnvio>, agora = () => new Date()): Promise<ItemFila[]> {
  let atual = fila;
  for (let proximo = prontos(atual, agora())[0]; proximo; proximo = prontos(atual, agora())[0]) {
    const r = await enviar(proximo).catch((e): ResultadoEnvio => ({ ok: false, status: 0, mensagem: String(e?.message ?? e) }));
    if (r.ok) { atual = aposSucesso(atual, proximo.id); continue; }
    atual = atual.map((i) => (i.id === proximo.id ? aposFalha(i, agora(), r) : i));
    if (r.status === 0) break;
  }
  return atual;
}
