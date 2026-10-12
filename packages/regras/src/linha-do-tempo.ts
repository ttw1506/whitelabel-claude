// Linha do tempo da safra: fotos agrupadas por estádio fenológico.
import { estadiosDa } from "./safra";

export type Situacao = "passado" | "atual" | "futuro" | "fora_da_lista";

export function agruparPorEstadio<F extends { estadio: string; tirada_em: string }>(cultura: string, fotos: F[], estadioAtual: string | null) {
  const lista = estadiosDa(cultura);
  const porData = (a: F, b: F) => a.tirada_em.localeCompare(b.tirada_em);
  const grupos = new Map<string, F[]>();
  for (const f of [...fotos].sort(porData)) grupos.set(f.estadio, [...(grupos.get(f.estadio) ?? []), f]);

  if (!lista) {
    return [...grupos.entries()].map(([estadio, fs]) => ({ estadio, fotos: fs, situacao: (estadio === estadioAtual ? "atual" : "fora_da_lista") as Situacao }));
  }
  const atual = estadioAtual ? lista.indexOf(estadioAtual) : -1;
  const padrao = lista.map((estadio, i) => ({
    estadio,
    fotos: grupos.get(estadio) ?? [],
    situacao: (atual < 0 ? "futuro" : i < atual ? "passado" : i === atual ? "atual" : "futuro") as Situacao,
  }));
  const extras = [...grupos.entries()].filter(([e]) => !lista.includes(e)).map(([estadio, fs]) => ({ estadio, fotos: fs, situacao: "fora_da_lista" as Situacao }));
  return [...padrao, ...extras];
}
