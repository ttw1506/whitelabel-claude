import { describe, it, expect } from "vitest";
import { validarCpfCnpj } from "../src/documentos";

describe("validarCpfCnpj", () => {
  it("CPF válido, com ou sem pontuação", () => {
    expect(validarCpfCnpj("529.982.247-25")).toEqual({ tipo: "cpf", valido: true, digitos: "52998224725", formatado: "529.982.247-25" });
    expect(validarCpfCnpj("52998224725").valido).toBe(true);
  });
  it("CNPJ válido", () => {
    expect(validarCpfCnpj("11.222.333/0001-81")).toEqual({ tipo: "cnpj", valido: true, digitos: "11222333000181", formatado: "11.222.333/0001-81" });
  });
  it("dígito verificador errado ou repetido é inválido", () => {
    expect(validarCpfCnpj("529.982.247-24").valido).toBe(false);
    expect(validarCpfCnpj("111.111.111-11").valido).toBe(false);
    expect(validarCpfCnpj("11.222.333/0001-80").valido).toBe(false);
  });
  it("tamanho errado é inválido", () => {
    expect(validarCpfCnpj("123").valido).toBe(false);
    expect(validarCpfCnpj("").valido).toBe(false);
  });
});

describe("CNPJ alfanumérico (desde julho de 2026)", () => {
  it("exemplo oficial da Receita Federal", () => {
    expect(validarCpfCnpj("12.ABC.345/01DE-35")).toEqual({ tipo: "cnpj", valido: true, digitos: "12ABC34501DE35", formatado: "12.ABC.345/01DE-35" });
    expect(validarCpfCnpj("12abc34501de35").valido).toBe(true);
    expect(validarCpfCnpj("12.ABC.345/01DE-36").valido).toBe(false);
  });
});
