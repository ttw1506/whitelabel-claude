import { describe, it, expect } from "vitest";
import { lerDecimal, formatarNumero, formatarHa, formatarReais } from "../src/numeros";

describe("lerDecimal", () => {
  it("aceita vírgula decimal e ponto de milhar", () => {
    expect(lerDecimal("1.234,56")).toBe(1234.56);
    expect(lerDecimal("3,5")).toBe(3.5);
    expect(lerDecimal(" 80 ")).toBe(80);
    expect(lerDecimal("0,7")).toBe(0.7);
  });
  it("aceita ponto decimal quando não há vírgula e não parece milhar", () => {
    expect(lerDecimal("3.5")).toBe(3.5);
    expect(lerDecimal("1.250")).toBe(1250);
  });
  it("rejeita texto, vazio e formatos ambíguos", () => {
    expect(lerDecimal("")).toBeNull();
    expect(lerDecimal("abc")).toBeNull();
    expect(lerDecimal("1,2,3")).toBeNull();
    expect(lerDecimal("12a")).toBeNull();
  });
  it("aceita negativo só quando permitido", () => {
    expect(lerDecimal("-2,5")).toBeNull();
    expect(lerDecimal("-2,5", { negativo: true })).toBe(-2.5);
  });
});

describe("formatação brasileira", () => {
  it("números, hectares e reais", () => {
    expect(formatarNumero(1234.5, 2)).toBe("1.234,50");
    expect(formatarHa(80)).toBe("80,00 ha");
    expect(formatarReais(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
  it("valor ausente vira traço", () => {
    expect(formatarHa(null)).toBe("—");
  });
});
