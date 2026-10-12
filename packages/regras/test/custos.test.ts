import { describe, it, expect } from "vitest";
import { resumoCustos, CATEGORIAS_CUSTO } from "../src/custos";

const c = (categoria: string, valor: number) => ({ categoria, valor });

describe("resumoCustos", () => {
  it("soma por categoria na ordem padrão, com total e R$/ha", () => {
    const r = resumoCustos([c("defensivos", 1000), c("sementes", 2500.5), c("defensivos", 499.5), c("outros", 100)], 100);
    expect(r.total).toBe(4100);
    expect(r.porHa).toBe(41);
    expect(r.categorias.map((x) => [x.categoria, x.valor, x.porHa])).toEqual([
      ["sementes", 2500.5, 25.01],
      ["fertilizantes_corretivos", 0, 0],
      ["defensivos", 1499.5, 15],
      ["operacoes_maquinas", 0, 0],
      ["outros", 100, 1],
    ]);
  });
  it("participação de cada categoria no total", () => {
    const r = resumoCustos([c("sementes", 750), c("defensivos", 250)], 10);
    expect(r.categorias.find((x) => x.categoria === "sementes")!.participacao).toBe(0.75);
  });
  it("sem área não calcula R$/ha", () => {
    const r = resumoCustos([c("sementes", 100)], null);
    expect(r.porHa).toBeNull();
    expect(r.categorias[0].porHa).toBeNull();
  });
  it("sem lançamentos: tudo zero, participação zero", () => {
    const r = resumoCustos([], 50);
    expect(r.total).toBe(0);
    expect(r.categorias.every((x) => x.valor === 0 && x.participacao === 0)).toBe(true);
  });
  it("centavos sem erro de ponto flutuante", () => {
    expect(resumoCustos([c("outros", 0.1), c("outros", 0.2)], 1).total).toBe(0.3);
  });
  it("tem nome em português para cada categoria", () => {
    expect(CATEGORIAS_CUSTO.map((x) => x.nome)).toEqual(["Sementes", "Fertilizantes e corretivos", "Defensivos", "Operações e máquinas", "Outros"]);
  });
});
