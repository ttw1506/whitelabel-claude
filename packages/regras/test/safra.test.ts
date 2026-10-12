import { describe, it, expect } from "vitest";
import { anoAgricolaValido, sugerirAnoAgricola, estadiosDa, conferirAreaTalhoes } from "../src/safra";

describe("ano agrícola", () => {
  it("formato AAAA/AA com anos seguidos", () => {
    expect(anoAgricolaValido("2025/26")).toBe(true);
    expect(anoAgricolaValido("2099/00")).toBe(true);
    expect(anoAgricolaValido("2025/27")).toBe(false);
    expect(anoAgricolaValido("25/26")).toBe(false);
  });
  it("sugere pelo calendário do Cerrado: a partir de julho começa a safra nova", () => {
    expect(sugerirAnoAgricola(new Date(2026, 9, 12))).toBe("2026/27");
    expect(sugerirAnoAgricola(new Date(2026, 2, 1))).toBe("2025/26");
  });
});

describe("estádios", () => {
  it("soja e milho têm a lista padrão; outras culturas ficam livres", () => {
    expect(estadiosDa("Soja")).toEqual(["VE", "VC", "V1", "V2", "V3", "V4", "V5", "V6", "Vn", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
    expect(estadiosDa("milho")).toEqual(["VE", "V2", "V4", "V6", "V8", "V10", "VT", "R1", "R2", "R3", "R4", "R5", "R6"]);
    expect(estadiosDa("Sorgo")).toBeNull();
  });
});

describe("conferirAreaTalhoes", () => {
  it("alerta quando a soma dos talhões passa da área da fazenda", () => {
    expect(conferirAreaTalhoes(500, [200, 250])).toEqual({ soma: 450, excede: false });
    expect(conferirAreaTalhoes(500, [300, 250.5])).toEqual({ soma: 550.5, excede: true });
    expect(conferirAreaTalhoes(null, [10])).toEqual({ soma: 10, excede: false });
  });
});
