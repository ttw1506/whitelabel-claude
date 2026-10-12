import { describe, it, expect } from "vitest";
import { agruparPorEstadio } from "../src/linha-do-tempo";

const f = (id: string, estadio: string, tirada_em: string) => ({ id, estadio, tirada_em });

describe("agruparPorEstadio", () => {
  it("segue a ordem dos estádios da cultura e ordena as fotos pela data", () => {
    const g = agruparPorEstadio("Soja", [f("a", "V3", "2026-11-10T10:00"), f("b", "VE", "2026-10-20T09:00"), f("c", "V3", "2026-11-08T08:00")], "V3");
    expect(g.map((x) => x.estadio).slice(0, 6)).toEqual(["VE", "VC", "V1", "V2", "V3", "V4"]);
    expect(g.find((x) => x.estadio === "V3")!.fotos.map((x) => x.id)).toEqual(["c", "a"]);
  });
  it("marca o estádio atual e os já passados", () => {
    const g = agruparPorEstadio("Soja", [], "V2");
    expect(g.find((x) => x.estadio === "V2")!.situacao).toBe("atual");
    expect(g.find((x) => x.estadio === "VE")!.situacao).toBe("passado");
    expect(g.find((x) => x.estadio === "R1")!.situacao).toBe("futuro");
  });
  it("estádio fora da lista entra no fim, na ordem em que apareceu", () => {
    const g = agruparPorEstadio("Soja", [f("x", "Pré-plantio", "2026-09-01T10:00")], null);
    expect(g.at(-1)).toMatchObject({ estadio: "Pré-plantio", situacao: "fora_da_lista" });
  });
  it("cultura sem lista: só os estádios que têm foto, pela data da primeira foto", () => {
    const g = agruparPorEstadio("Sorgo", [f("a", "Floração", "2026-12-01T10:00"), f("b", "Emergência", "2026-10-01T10:00")], null);
    expect(g.map((x) => x.estadio)).toEqual(["Emergência", "Floração"]);
  });
});
