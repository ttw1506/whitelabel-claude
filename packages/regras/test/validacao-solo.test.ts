import { expect, it } from "vitest";
import { analisarSolo, type ValoresSolo, type Profundidade } from "../src/solo";
const valores: ValoresSolo = { ph: 5, p: 10, k: 80, ca: 2, mg: 1, al: 0.2, hal: 3, mo: 2, argila: 40 };
const opcoes = { profundidade: "0-20" as Profundidade, prnt: 80 };
it("rejeita pH e argila fora da faixa física", () => {
  expect(() => analisarSolo({ ...valores, ph: 15 }, opcoes)).toThrow(/pH/);
  expect(() => analisarSolo({ ...valores, argila: 101 }, opcoes)).toThrow(/Argila/);
});
it("rejeita micronutrientes negativos ou não finitos", () => {
  for (const v of [-1, Infinity, NaN]) expect(() => analisarSolo({ ...valores, zn: v }, opcoes)).toThrow(/zn/);
});
it("rejeita profundidade desconhecida mesmo fora do formulário", () => {
  expect(() => analisarSolo(valores, { ...opcoes, profundidade: "10-30" as Profundidade })).toThrow(/Profundidade/);
});
