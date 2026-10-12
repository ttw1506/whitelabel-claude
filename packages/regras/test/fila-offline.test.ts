import { describe, expect, it } from "vitest";
import { aposFalha, aposSucesso, erroDefinitivo, novoItem, prontos, resumoFila, type ItemFila } from "../src/fila-offline";

const t0 = new Date("2026-10-12T10:00:00Z");
const mais = (s: number) => new Date(t0.getTime() + s * 1000);
const item = (id: string, extra: Partial<ItemFila> = {}): ItemFila => ({ ...novoItem("ocorrencia", "safra-1", { nome: id }, t0, id), ...extra });

describe("fila offline da visita", () => {
  it("item novo nasce pronto, com id do aparelho (reenviar não duplica)", () => {
    const i = novoItem("foto", "s", {}, t0);
    expect(i.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(i.tentativas).toBe(0);
    expect(prontos([i], t0)).toEqual([i]);
  });
  it("entrega na ordem em que foram registrados", () => {
    const a = item("a", { criado_em: mais(2).toISOString() }), b = item("b", { criado_em: mais(1).toISOString() });
    expect(prontos([a, b], mais(5)).map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("falha de rede: tenta de novo depois, com espera que dobra até 1 hora", () => {
    let i = item("a");
    const esperas: number[] = [];
    for (let n = 0; n < 9; n++) {
      i = aposFalha(i, t0, { status: 0, mensagem: "sem internet" });
      esperas.push((new Date(i.proxima_tentativa_em).getTime() - t0.getTime()) / 1000);
    }
    expect(esperas.slice(0, 4)).toEqual([30, 60, 120, 240]);
    expect(Math.max(...esperas)).toBe(3600);
    expect(prontos([i], t0)).toEqual([]);
    expect(prontos([i], mais(3600))).toHaveLength(1);
    expect(i.erro).toBe("sem internet");
  });
  it("erro definitivo (403, 422) para de tentar e pede ajuda da pessoa", () => {
    expect(erroDefinitivo(403)).toBe(true);
    expect(erroDefinitivo(422)).toBe(true);
    expect(erroDefinitivo(0)).toBe(false);
    expect(erroDefinitivo(500)).toBe(false);
    const i = aposFalha(item("a"), t0, { status: 422, mensagem: "dados inválidos" });
    expect(i.bloqueado).toBe(true);
    expect(prontos([i], mais(999999))).toEqual([]);
    expect(resumoFila([i])).toEqual({ total: 1, pendentes: 0, bloqueados: 1 });
  });
  it("foto só sobe depois da ocorrência a que pertence", () => {
    const oc = item("oc");
    const foto = item("f", { depende_de: "oc" });
    expect(prontos([foto, oc], t0).map((x) => x.id)).toEqual(["oc"]);
    expect(prontos(aposSucesso([foto, oc], "oc"), t0).map((x) => x.id)).toEqual(["f"]);
  });
  it("se a ocorrência travou de vez, a foto dela espera junto (não sobe solta)", () => {
    const oc = aposFalha(item("oc"), t0, { status: 403, mensagem: "x" });
    expect(prontos([oc, item("f", { depende_de: "oc" })], mais(99999))).toEqual([]);
  });
  it("não altera a lista original", () => {
    const l = [item("a")];
    aposSucesso(l, "a"); aposFalha(l[0], t0, { status: 0, mensagem: "" });
    expect(l).toHaveLength(1); expect(l[0].tentativas).toBe(0);
  });
});

import { sincronizarFila } from "../src/fila-offline";
describe("sincronizarFila", () => {
  const relogio = () => t0;
  it("manda tudo em ordem e esvazia a fila", async () => {
    const enviados: string[] = [];
    const fila = [item("oc"), item("f", { depende_de: "oc", criado_em: mais(1).toISOString() })];
    const resto = await sincronizarFila(fila, async (i) => { enviados.push(i.id); return { ok: true }; }, relogio);
    expect(enviados).toEqual(["oc", "f"]);
    expect(resto).toEqual([]);
  });
  it("sem internet: para no primeiro, guarda o resto e tenta depois", async () => {
    let chamadas = 0;
    const resto = await sincronizarFila([item("a"), item("b", { criado_em: mais(1).toISOString() })], async () => { chamadas++; return { ok: false, status: 0, mensagem: "sem sinal" }; }, relogio);
    expect(chamadas).toBe(1);
    expect(resto).toHaveLength(2);
    expect(resto.find((i) => i.id === "a")!.tentativas).toBe(1);
  });
  it("recusa do banco trava só aquele item; os outros seguem", async () => {
    const resto = await sincronizarFila([item("ruim"), item("bom", { criado_em: mais(1).toISOString() })], async (i) => (i.id === "ruim" ? { ok: false, status: 422, mensagem: "inválido" } : { ok: true }), relogio);
    expect(resto.map((i) => [i.id, !!i.bloqueado])).toEqual([["ruim", true]]);
  });
  it("erro inesperado do envio vira falha de rede, não derruba a fila", async () => {
    const resto = await sincronizarFila([item("a")], async () => { throw new Error("timeout"); }, relogio);
    expect(resto[0].erro).toBe("timeout");
  });
});
