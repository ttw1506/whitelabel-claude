import { describe, expect, it } from "vitest";
import { dataValida } from "../src/datas";

describe("datas de calendário", () => {
  it("aceita dia bissexto apenas no ano correto", () => {
    expect(dataValida("2024-02-29")).toBe(true);
    expect(dataValida("2025-02-29")).toBe(false);
  });
  it("rejeita dias normalizados, meses inválidos e entradas incompletas", () => {
    for (const d of ["2026-02-30", "2026-04-31", "2026-13-01", "0000-01-01", "2026-1-1", "", "abc"]) expect(dataValida(d)).toBe(false);
    expect(dataValida("2026-12-31")).toBe(true);
  });
});
