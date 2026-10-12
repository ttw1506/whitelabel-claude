import { describe, it, expect } from "vitest";
import { resumoGastos } from "../src/gastos";

const safras = [
  { id: "s1", fazenda_id: "f1", fazenda: "Boa Vista", ano_agricola: "2024/25", cultura: "Soja", area_ha: 100 },
  { id: "s2", fazenda_id: "f1", fazenda: "Boa Vista", ano_agricola: "2025/26", cultura: "Soja", area_ha: 120 },
  { id: "s3", fazenda_id: "f2", fazenda: "Santa Fé", ano_agricola: "2025/26", cultura: "Milho", area_ha: null },
];
const custos = [
  { safra_id: "s1", categoria: "sementes", valor: 10000 },
  { safra_id: "s1", categoria: "defensivos", valor: 5000 },
  { safra_id: "s2", categoria: "sementes", valor: 12000 },
  { safra_id: "s3", categoria: "outros", valor: 800 },
];

describe("resumoGastos", () => {
  it("total geral e uma linha por safra, da mais nova para a mais antiga", () => {
    const r = resumoGastos(safras, custos, {});
    expect(r.total).toBe(27800);
    expect(r.safras.map((s) => [s.id, s.total, s.porHa])).toEqual([["s2", 12000, 100], ["s3", 800, null], ["s1", 15000, 150]]);
    expect(r.areaTotal).toBe(220);
  });
  it("filtra por safra, por fazenda e por categoria", () => {
    expect(resumoGastos(safras, custos, { safra: "s1" }).total).toBe(15000);
    expect(resumoGastos(safras, custos, { fazenda: "f2" }).total).toBe(800);
    const r = resumoGastos(safras, custos, { categoria: "sementes" });
    expect(r.total).toBe(22000);
    expect(r.safras.find((s) => s.id === "s3")!.total).toBe(0);
  });
  it("resumo por categoria do conjunto filtrado, com R$/ha pela área das safras com área", () => {
    const r = resumoGastos(safras, custos, { fazenda: "f1" });
    const sementes = r.categorias.find((c) => c.categoria === "sementes")!;
    expect(sementes.valor).toBe(22000);
    expect(sementes.porHa).toBe(100);
  });
  it("sem safras nem custos", () => {
    const r = resumoGastos([], [], {});
    expect(r).toMatchObject({ total: 0, porHa: null, safras: [], areaTotal: 0 });
  });
  it("ignora custo de safra que não está na lista (ou filtrada fora)", () => {
    expect(resumoGastos(safras, [...custos, { safra_id: "x", categoria: "outros", valor: 999 }], {}).total).toBe(27800);
  });
});
