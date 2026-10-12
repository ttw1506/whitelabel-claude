import { describe, it, expect } from "vitest";
import { analisarSolo, classificarP, classificarK, AVISO_RECOMENDACAO } from "../src/solo";

// Exemplo de laudo típico de Cerrado, camada 0–20 cm.
const camada0a20 = { ph: 4.8, p: 3, k: 60, ca: 1.2, mg: 0.4, al: 0.5, hal: 5.0, mo: 2.5, argila: 45 };

describe("analisarSolo: cálculos da seção 6", () => {
  const a = analisarSolo(camada0a20, { profundidade: "0-20", prnt: 80, v2: 50 });
  it("K em cmolc, SB, CTC a pH 7, V% e m%", () => {
    expect(a.kCmolc).toBeCloseTo(0.1535, 4);
    expect(a.sb).toBeCloseTo(1.7535, 4);
    expect(a.ctc).toBeCloseTo(6.7535, 4);
    expect(a.v).toBeCloseTo(25.9638, 3);
    expect(a.m).toBeCloseTo(22.1882, 3);
  });
  it("calagem (V2 − V1) × T / 100 × (100 / PRNT)", () => {
    expect(a.calagemTHa).toBeCloseTo(2.0291, 3);
  });
  it("interpreta P pela argila e K pela CTC", () => {
    expect(a.p).toEqual({ valor: 3, classe: "muito_baixo", faixaArgila: "de 36 a 60%" });
    expect(a.k).toEqual({ valor: 60, classe: "adequado", faixaCtc: "CTC ≥ 4" });
  });
  it("na camada 0–20 não recomenda gesso", () => {
    expect(a.gessagem).toEqual({ aplica: false, motivo: "Gessagem é avaliada na camada de 20 a 40 cm." });
  });
});

describe("calagem", () => {
  it("V% já acima da meta: zero, nunca negativo", () => {
    const a = analisarSolo({ ...camada0a20, ca: 4, mg: 1.5 }, { profundidade: "0-20", prnt: 80, v2: 50 });
    expect(a.v).toBeGreaterThan(50);
    expect(a.calagemTHa).toBe(0);
  });
  it("PRNT e V2 editáveis mudam a dose", () => {
    const a = analisarSolo(camada0a20, { profundidade: "0-20", prnt: 100, v2: 60 });
    expect(a.calagemTHa).toBeCloseTo(((60 - 25.9638) * 6.7535) / 100, 3);
  });
  it("V2 padrão é 50%", () => {
    expect(analisarSolo(camada0a20, { profundidade: "0-20", prnt: 80 }).v2).toBe(50);
  });
});

describe("gessagem na camada 20–40 cm", () => {
  const sub = { ph: 4.5, p: 1, k: 20, ca: 0.3, mg: 0.2, al: 0.8, hal: 4, mo: 1.2, argila: 45 };
  it("Ca < 0,5 → 50 × argila", () => {
    const g = analisarSolo(sub, { profundidade: "20-40", prnt: 80 }).gessagem;
    expect(g).toMatchObject({ aplica: true, kgHa: 2250 });
    expect(g.motivo).toMatch(/Ca/);
  });
  it("só m% > 20 também indica gesso", () => {
    const g = analisarSolo({ ...sub, ca: 0.8, al: 0.9 }, { profundidade: "20-40", prnt: 80 }).gessagem;
    expect(g).toMatchObject({ aplica: true, kgHa: 2250 });
    expect(g.motivo).toMatch(/m%/);
  });
  it("Ca ≥ 0,5 e m% ≤ 20: não recomenda", () => {
    const g = analisarSolo({ ...sub, ca: 1.5, mg: 0.6, al: 0.1 }, { profundidade: "20-40", prnt: 80 }).gessagem;
    expect(g.aplica).toBe(false);
  });
});

describe("tabelas de interpretação", () => {
  it("P pelas faixas de argila (limites superiores)", () => {
    expect(classificarP(6, 15).classe).toBe("muito_baixo");
    expect(classificarP(6.1, 15).classe).toBe("baixo");
    expect(classificarP(25, 10).classe).toBe("adequado");
    expect(classificarP(25.5, 10).classe).toBe("alto");
    expect(classificarP(10, 20)).toMatchObject({ classe: "baixo", faixaArgila: "de 16 a 35%" });
    expect(classificarP(5, 70)).toMatchObject({ classe: "alto", faixaArgila: "acima de 60%" });
  });
  it("K pela CTC", () => {
    expect(classificarK(25, 5).classe).toBe("baixo");
    expect(classificarK(26, 5).classe).toBe("medio");
    expect(classificarK(81, 5).classe).toBe("alto");
    expect(classificarK(35, 3)).toMatchObject({ classe: "adequado", faixaCtc: "CTC < 4" });
    expect(classificarK(41, 3).classe).toBe("alto");
  });
});

describe("validação", () => {
  it("rejeita valor ausente ou negativo e PRNT fora de 1–100", () => {
    expect(() => analisarSolo({ ...camada0a20, ca: -1 }, { profundidade: "0-20", prnt: 80 })).toThrow(/Ca/);
    expect(() => analisarSolo({ ...camada0a20, hal: Number.NaN }, { profundidade: "0-20", prnt: 80 })).toThrow(/H\+Al/);
    expect(() => analisarSolo(camada0a20, { profundidade: "0-20", prnt: 0 })).toThrow(/PRNT/);
  });
  it("CTC zero não divide por zero", () => {
    const a = analisarSolo({ ...camada0a20, ca: 0, mg: 0, k: 0, al: 0, hal: 0 }, { profundidade: "0-20", prnt: 80 });
    expect(a.v).toBe(0);
    expect(a.m).toBe(0);
  });
  it("todo resultado vem com o aviso", () => {
    expect(AVISO_RECOMENDACAO).toBe("Sugestão técnica. A recomendação final é do agrônomo responsável.");
  });
});
