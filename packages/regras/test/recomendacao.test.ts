import { describe, it, expect } from "vitest";
import { analisarSolo } from "../src/solo";
import { sugestaoRecomendacao } from "../src/recomendacao";

const v = { ph: 4.8, p: 3, k: 60, ca: 1.2, mg: 0.4, al: 0.5, hal: 5.0, mo: 2.5, argila: 45 };

describe("sugestaoRecomendacao", () => {
  it("0–20 cm: calagem com dose, PRNT e V%, e leitura de P e K em português", () => {
    const t = sugestaoRecomendacao(analisarSolo(v, { profundidade: "0-20", prnt: 80, v2: 50 }));
    expect(t).toContain("Calagem: aplicar 2,03 t/ha de calcário com PRNT 80% para elevar a saturação por bases de 26,0% para 50%.");
    expect(t).toContain("Fósforo (Mehlich-1): 3 mg/dm³, muito baixo para argila de 36 a 60%.");
    expect(t).toContain("Potássio: 60 mg/dm³, adequado (CTC ≥ 4).");
    expect(t).toContain("Saturação por alumínio (m%): 22,2%.");
  });
  it("sem necessidade de calcário", () => {
    const t = sugestaoRecomendacao(analisarSolo({ ...v, ca: 4, mg: 1.5 }, { profundidade: "0-20", prnt: 80 }));
    expect(t).toContain("Calagem: não necessária");
  });
  it("20–40 cm: gessagem quando indicada", () => {
    const t = sugestaoRecomendacao(analisarSolo({ ...v, ca: 0.3, mg: 0.2, k: 20, al: 0.8, hal: 4 }, { profundidade: "20-40", prnt: 80 }));
    expect(t).toContain("Gessagem: aplicar 2.250 kg/ha de gesso agrícola.");
  });
});
