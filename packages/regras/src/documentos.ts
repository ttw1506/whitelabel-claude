// CPF e CNPJ (inclusive o CNPJ alfanumérico, emitido desde julho de 2026).

export type Documento = { tipo: "cpf" | "cnpj" | null; valido: boolean; digitos: string; formatado: string };

const valor = (c: string) => c.charCodeAt(0) - 48; // regra da Receita: 0-9 → 0-9, A-Z → 17-42

function dvCpf(base: string): string {
  let d = "";
  for (const tam of [9, 10]) {
    const s = [...(base + d).slice(0, tam)].reduce((acc, c, i) => acc + valor(c) * (tam + 1 - i), 0);
    const r = (s * 10) % 11;
    d += String(r === 10 ? 0 : r);
  }
  return d;
}

function dvCnpj(base: string): string {
  let d = "";
  for (const pesos of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const s = [...(base + d)].reduce((acc, c, i) => acc + valor(c) * pesos[i], 0);
    const r = s % 11;
    d += String(r < 2 ? 0 : 11 - r);
  }
  return d;
}

export function validarCpfCnpj(texto: string): Documento {
  const digitos = String(texto ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (/^\d{11}$/.test(digitos)) {
    const valido = !/^(\d)\1{10}$/.test(digitos) && dvCpf(digitos.slice(0, 9)) === digitos.slice(9);
    return { tipo: "cpf", valido, digitos, formatado: digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") };
  }
  if (/^[0-9A-Z]{12}\d{2}$/.test(digitos)) {
    const valido = !/^(\d)\1{13}$/.test(digitos) && dvCnpj(digitos.slice(0, 12)) === digitos.slice(12);
    return { tipo: "cnpj", valido, digitos, formatado: digitos.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, "$1.$2.$3/$4-$5") };
  }
  return { tipo: null, valido: false, digitos, formatado: String(texto ?? "").trim() };
}
