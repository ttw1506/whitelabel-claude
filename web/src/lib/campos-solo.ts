// Campos do laudo de solo (sem dependências de servidor: usado também no navegador).
import type { ValoresSolo } from "@soloplan/regras";

export const CAMPOS_SOLO: { chave: keyof ValoresSolo; nome: string; unidade: string; obrigatorio: boolean }[] = [
  { chave: "ph", nome: "pH (CaCl2)", unidade: "", obrigatorio: true },
  { chave: "p", nome: "P (Mehlich-1)", unidade: "mg/dm³", obrigatorio: true },
  { chave: "k", nome: "K", unidade: "mg/dm³", obrigatorio: true },
  { chave: "ca", nome: "Ca", unidade: "cmolc/dm³", obrigatorio: true },
  { chave: "mg", nome: "Mg", unidade: "cmolc/dm³", obrigatorio: true },
  { chave: "al", nome: "Al", unidade: "cmolc/dm³", obrigatorio: true },
  { chave: "hal", nome: "H+Al", unidade: "cmolc/dm³", obrigatorio: true },
  { chave: "mo", nome: "M.O.", unidade: "%", obrigatorio: true },
  { chave: "argila", nome: "Argila", unidade: "%", obrigatorio: true },
  { chave: "s", nome: "S", unidade: "mg/dm³", obrigatorio: false },
  { chave: "b", nome: "B", unidade: "mg/dm³", obrigatorio: false },
  { chave: "cu", nome: "Cu", unidade: "mg/dm³", obrigatorio: false },
  { chave: "fe", nome: "Fe", unidade: "mg/dm³", obrigatorio: false },
  { chave: "mn", nome: "Mn", unidade: "mg/dm³", obrigatorio: false },
  { chave: "zn", nome: "Zn", unidade: "mg/dm³", obrigatorio: false },
];
