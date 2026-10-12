import { describe, expect, it } from "vitest";
import { criarLimitador } from "../src/limite";

describe("limitador de requisições", () => {
  it("deixa passar até o máximo e barra o excesso, avisando quando liberar", () => {
    let t = 0;
    const l = criarLimitador({ max: 3, janelaMs: 60_000 }, () => t);
    expect([1, 2, 3].map(() => l.tentar("a").ok)).toEqual([true, true, true]);
    const r = l.tentar("a");
    expect(r.ok).toBe(false);
    expect(r.esperarSegundos).toBe(60);
  });
  it("cada chave tem a sua conta, e a janela renova", () => {
    let t = 0;
    const l = criarLimitador({ max: 1, janelaMs: 1000 }, () => t);
    expect(l.tentar("a").ok).toBe(true);
    expect(l.tentar("b").ok).toBe(true);
    expect(l.tentar("a").ok).toBe(false);
    t = 1001;
    expect(l.tentar("a").ok).toBe(true);
  });
  it("não cresce sem fim: esquece chaves antigas", () => {
    let t = 0;
    const l = criarLimitador({ max: 1, janelaMs: 1000, maxChaves: 5 }, () => t);
    for (let i = 0; i < 20; i++) { l.tentar(`k${i}`); t += 10; }
    t = 5000;
    l.tentar("novo");
    expect(l.tamanho()).toBeLessThanOrEqual(5);
  });
});
