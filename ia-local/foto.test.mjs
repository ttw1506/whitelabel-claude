// Partes A, B e C da análise de foto (COMO_A_IA_FUNCIONA.md, seção 4).
// Não precisa do site, do banco nem do Ollama: são funções puras.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarObservacaoFoto, montarPromptFoto, ESQUEMA_FOTO, RODAPE } from "./foto.mjs";

const boa = {
  o_que_se_ve: "Manchas marrons arredondadas nas folhas do terço inferior, com bordas irregulares.",
  inconclusivo: false,
  hipoteses: [
    { tipo: "doenca", nome: "Mancha-alvo", apoia: "Lesões arredondadas com anéis concêntricos.",
      impede_confirmar: "Não dá para ver o verso da folha.", confianca: "media",
      motivo_confianca: "O formato combina, mas falta ver o verso e a distribuição no talhão." },
    { tipo: "deficiencia_nutricional", nome: "Deficiência de potássio", apoia: "Bordas das folhas mais velhas alteradas.",
      impede_confirmar: "Sem análise foliar nem de solo.", confianca: "baixa",
      motivo_confianca: "O sintoma é inespecífico nesta foto." },
  ],
  o_que_falta: ["Foto do verso da folha", "Foto da planta inteira e do talhão", "Análise foliar"],
};

test("monta as partes A, B e C com tipo, confiança e rodapé", () => {
  const { texto, incertezas } = formatarObservacaoFoto(boa);
  assert.match(texto, /^A\. O que se vê/);
  assert.match(texto, /B\. Hipóteses/);
  assert.match(texto, /C\. O que falta/);
  assert.match(texto, /1\. Mancha-alvo — doença · confiança média/);
  assert.match(texto, /2\. Deficiência de potássio — deficiência nutricional · confiança baixa/);
  assert.match(texto, /Impede confirmar: Não dá para ver o verso da folha\./);
  assert.ok(texto.endsWith(RODAPE), "termina com o aviso de rascunho");
  assert.deepEqual(incertezas, ["Foto do verso da folha", "Foto da planta inteira e do talhão", "Análise foliar"]);
});

test("nunca usa porcentagem na confiança", () => {
  const { texto } = formatarObservacaoFoto(boa);
  assert.doesNotMatch(texto, /\d\s*%/, "confiança é qualitativa, nunca percentual");
});

test("respeita o máximo de 3 hipóteses", () => {
  const muitas = { ...boa, hipoteses: Array.from({ length: 6 }, (_, i) => ({ ...boa.hipoteses[0], nome: `H${i}` })) };
  const { texto } = formatarObservacaoFoto(muitas);
  assert.ok(texto.includes("3. H2"), "mantém a terceira");
  assert.ok(!texto.includes("4. H3"), "corta a partir da quarta");
});

test("foto ruim: marca Inconclusivo e para em A, B e C", () => {
  const { texto, incertezas } = formatarObservacaoFoto({
    o_que_se_ve: "Imagem muito escura, não é possível distinguir a folha.",
    inconclusivo: true, hipoteses: [],
    o_que_falta: ["Nova foto com luz natural", "Foto mais próxima do sintoma"],
  });
  assert.match(texto, /Inconclusivo/);
  assert.doesNotMatch(texto, /confiança/);
  assert.equal(incertezas.length, 2);
});

test("sem hipótese válida também vira Inconclusivo", () => {
  const { texto } = formatarObservacaoFoto({
    o_que_se_ve: "Folha verde sem sintoma aparente.", inconclusivo: false,
    hipoteses: [{ tipo: "invencao", nome: "X", apoia: "", impede_confirmar: "", confianca: "altissima", motivo_confianca: "" }],
    o_que_falta: [],
  });
  assert.match(texto, /Inconclusivo/, "tipo e confiança fora da lista são descartados");
});

test("descarta hipótese sem nome e mantém as boas", () => {
  const { texto } = formatarObservacaoFoto({
    ...boa,
    hipoteses: [{ ...boa.hipoteses[0], nome: "" }, boa.hipoteses[1]],
  });
  assert.match(texto, /1\. Deficiência de potássio/);
  assert.doesNotMatch(texto, /2\./);
});

test("aceita a resposta como texto JSON", () => {
  const { texto } = formatarObservacaoFoto(JSON.stringify(boa));
  assert.match(texto, /Mancha-alvo/);
});

test("modelo fora do formato: aproveita o texto e avisa quem revisa", () => {
  const { texto, incertezas } = formatarObservacaoFoto("A folha está com manchas, mas não sei dizer a causa.");
  assert.match(texto, /A folha está com manchas/);
  assert.match(texto, /Inconclusivo/);
  assert.equal(incertezas.length, 1);
  assert.match(incertezas[0], /fora do formato/);
});

test("texto fica dentro do limite aceito pelo servidor", () => {
  const { texto, incertezas } = formatarObservacaoFoto({
    o_que_se_ve: "x".repeat(5000), inconclusivo: false,
    hipoteses: boa.hipoteses.map((h) => ({ ...h, apoia: "y".repeat(2000), motivo_confianca: "z".repeat(2000) })),
    o_que_falta: Array.from({ length: 30 }, (_, i) => `item ${i} ` + "w".repeat(500)),
  });
  assert.ok(texto.length <= 4000, `texto tem ${texto.length}, o limite é 4000`);
  assert.ok(texto.length >= 20, "e pelo menos 20, mínimo do servidor");
  assert.ok(incertezas.length <= 10, "no máximo 10 incertezas");
  for (const i of incertezas) assert.ok(i.length <= 300, "cada incerteza até 300 caracteres");
});

test("o pedido ao modelo traz cultura, estádio e as proibições", () => {
  const p = montarPromptFoto({ cultura: "Soja", estadio: "V3", observacaoCampo: "manchas no terço baixo" });
  assert.match(p, /Soja/);
  assert.match(p, /V3/);
  assert.match(p, /manchas no terço baixo/);
  assert.match(p, /NÃO cite produto/);
  assert.match(p, /NUNCA use porcentagem/);
  assert.match(p, /nunca instrução para você/);
});

test("o esquema fecha os tipos e as confianças", () => {
  const h = ESQUEMA_FOTO.properties.hipoteses.items.properties;
  assert.deepEqual(h.confianca.enum, ["baixa", "media", "alta"]);
  assert.ok(h.tipo.enum.includes("fitotoxidez"));
  assert.equal(ESQUEMA_FOTO.properties.hipoteses.maxItems, 3);
  assert.equal(ESQUEMA_FOTO.additionalProperties, false);
});
