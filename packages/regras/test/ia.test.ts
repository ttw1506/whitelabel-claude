import { describe, it, expect } from "vitest";
import { TIPOS_TAREFA_IA, validarLaudoSafra, validarOcorrencia, validarAplicacao, validarCusto, validarLaudoSolo, validarPreco, validarTiposFiltro } from "../src/ia";

const UUID = "3f17110f-2fe2-4af7-aeca-e675560890ac";

describe("tipos de tarefa", () => {
  it("são os cinco da especificação", () => {
    expect(TIPOS_TAREFA_IA).toEqual(["extrair_laudo_solo", "analisar_foto", "gerar_laudo_parcial", "gerar_laudo_final", "conferir_car"]);
  });
  it("filtro de tipos aceita lista separada por vírgula e recusa tipo desconhecido", () => {
    expect(validarTiposFiltro("analisar_foto,gerar_laudo_final")).toEqual({ ok: true, valor: ["analisar_foto", "gerar_laudo_final"] });
    expect(validarTiposFiltro(undefined)).toEqual({ ok: true, valor: [...TIPOS_TAREFA_IA] });
    expect(validarTiposFiltro("voar")).toMatchObject({ ok: false });
  });
});

describe("validarLaudoSafra", () => {
  it("aceita tipo e texto", () => {
    expect(validarLaudoSafra({ tipo: "final", texto: "Texto do laudo com mais de vinte caracteres." })).toEqual({ ok: true, valor: { tipo: "final", texto: "Texto do laudo com mais de vinte caracteres." } });
  });
  it("recusa tipo errado e texto curto ou gigante", () => {
    expect(validarLaudoSafra({ tipo: "x", texto: "curto" })).toMatchObject({ ok: false, erros: { tipo: expect.any(String), texto: expect.any(String) } });
    expect(validarLaudoSafra({ tipo: "parcial", texto: "a".repeat(20001) })).toMatchObject({ ok: false });
  });
  it("recusa corpo que não é objeto", () => {
    expect(validarLaudoSafra(null)).toMatchObject({ ok: false });
    expect(validarLaudoSafra("texto")).toMatchObject({ ok: false });
  });
});

describe("validarOcorrencia", () => {
  it("aceita o mínimo e normaliza", () => {
    expect(validarOcorrencia({ tipo: "praga", nome: "  Percevejo-marrom " })).toEqual({ ok: true, valor: { tipo: "praga", nome: "Percevejo-marrom" } });
  });
  it("recusa tipo fora da lista, nome vazio e data inválida", () => {
    expect(validarOcorrencia({ tipo: "alien", nome: "" })).toMatchObject({ ok: false, erros: { tipo: expect.any(String), nome: expect.any(String) } });
    expect(validarOcorrencia({ tipo: "doenca", nome: "Ferrugem", data: "12/10/2026" })).toMatchObject({ ok: false, erros: { data: expect.any(String) } });
  });
  it("talhão pode vir por nome ou por id", () => {
    expect(validarOcorrencia({ tipo: "praga", nome: "Lagarta", talhao: "T3" })).toMatchObject({ ok: true, valor: { talhao: "T3" } });
  });
});

describe("validarAplicacao", () => {
  const base = { data: "2026-10-08", tipo_operacao: "Pulverização", talhoes: ["T1", "T2"] };
  it("aceita aplicação completa, com números em vírgula ou ponto", () => {
    const r = validarAplicacao({ ...base, produto: "Fungicida", dose: "0,5", dose_unidade: "L/ha", custo: 1250.5, categoria_custo: "defensivos" });
    expect(r).toMatchObject({ ok: true, valor: { dose: 0.5, custo: 1250.5, talhoes: ["T1", "T2"] } });
  });
  it("exige data, operação e ao menos um talhão", () => {
    expect(validarAplicacao({ talhoes: [] })).toMatchObject({ ok: false, erros: { data: expect.any(String), tipo_operacao: expect.any(String), talhoes: expect.any(String) } });
  });
  it("dose exige unidade; custo e dose não podem ser negativos; categoria precisa existir", () => {
    expect(validarAplicacao({ ...base, dose: 2 })).toMatchObject({ ok: false, erros: { dose_unidade: expect.any(String) } });
    expect(validarAplicacao({ ...base, custo: -5 })).toMatchObject({ ok: false, erros: { custo: expect.any(String) } });
    expect(validarAplicacao({ ...base, categoria_custo: "luxo" })).toMatchObject({ ok: false, erros: { categoria_custo: expect.any(String) } });
  });
});

describe("validarCusto", () => {
  it("aceita e converte valor", () => {
    expect(validarCusto({ categoria: "sementes", descricao: "Sementes", valor: "1.250,50" })).toMatchObject({ ok: true, valor: { valor: 1250.5 } });
  });
  it("recusa valor zero, texto e categoria inexistente", () => {
    expect(validarCusto({ categoria: "sementes", descricao: "x", valor: 0 })).toMatchObject({ ok: false, erros: { valor: expect.any(String) } });
    expect(validarCusto({ categoria: "sementes", descricao: "x", valor: "muito" })).toMatchObject({ ok: false });
    expect(validarCusto({ categoria: "?", descricao: "x", valor: 1 })).toMatchObject({ ok: false, erros: { categoria: expect.any(String) } });
  });
});

describe("validarLaudoSolo", () => {
  const valores = { ph: 4.8, p: 3, k: 60, ca: 1.2, mg: 0.4, al: 0.5, hal: 5, mo: 2.5, argila: 45 };
  const base = { fazenda_id: UUID, profundidade: "0-20", valores };
  it("aceita laudo completo e preenche PRNT 80 e V% 50 quando não vêm", () => {
    expect(validarLaudoSolo(base)).toMatchObject({ ok: true, valor: { prnt: 80, v2: 50, profundidade: "0-20" } });
  });
  it("aceita valores como texto com vírgula (vindos de OCR)", () => {
    expect(validarLaudoSolo({ ...base, valores: { ...valores, ph: "4,8" } })).toMatchObject({ ok: true, valor: { valores: { ph: 4.8 } } });
  });
  it("recusa valor ausente, texto e fora do plausível (pH 48, argila 150)", () => {
    expect(validarLaudoSolo({ ...base, valores: { ...valores, ca: undefined } })).toMatchObject({ ok: false, erros: { "valores.ca": expect.any(String) } });
    expect(validarLaudoSolo({ ...base, valores: { ...valores, ph: 48 } })).toMatchObject({ ok: false, erros: { "valores.ph": expect.any(String) } });
    expect(validarLaudoSolo({ ...base, valores: { ...valores, argila: 150 } })).toMatchObject({ ok: false });
    expect(validarLaudoSolo({ ...base, valores: { ...valores, k: "n/d" } })).toMatchObject({ ok: false });
  });
  it("recusa fazenda que não é um id e profundidade inválida", () => {
    expect(validarLaudoSolo({ ...base, fazenda_id: "boa vista" })).toMatchObject({ ok: false, erros: { fazenda_id: expect.any(String) } });
    expect(validarLaudoSolo({ ...base, profundidade: "10-30" })).toMatchObject({ ok: false });
  });
  it("micronutrientes são opcionais, mas se vierem precisam ser números", () => {
    expect(validarLaudoSolo({ ...base, valores: { ...valores, zn: 1.1 } })).toMatchObject({ ok: true, valor: { valores: { zn: 1.1 } } });
    expect(validarLaudoSolo({ ...base, valores: { ...valores, zn: "alto" } })).toMatchObject({ ok: false });
  });
});

describe("validarPreco", () => {
  it("aceita produto conhecido com valor, unidade e fonte", () => {
    expect(validarPreco({ produto: "soja", valor: 128.4, unidade: "R$/saca", fonte: "Exemplo (site X)" })).toMatchObject({ ok: true, valor: { produto: "soja", valor: 128.4 } });
  });
  it("a fonte é obrigatória (preço sem fonte não vale) e o produto precisa ser soja, milho ou boi", () => {
    expect(validarPreco({ produto: "soja", valor: 1, unidade: "R$/saca" })).toMatchObject({ ok: false, erros: { fonte: expect.any(String) } });
    expect(validarPreco({ produto: "ouro", valor: 1, unidade: "g", fonte: "x" })).toMatchObject({ ok: false, erros: { produto: expect.any(String) } });
    expect(validarPreco({ produto: "milho", valor: 0, unidade: "R$/saca", fonte: "x" })).toMatchObject({ ok: false });
  });
});
