import { expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Documento, latin1 } from "../../../web/src/lib/pdf";
it("remove controles e adapta texto para a fonte dos PDFs", async () => {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  expect(() => fonte.widthOfTextAtSize(latin1("A\tB\r\u0000 ≥ ₂ 🙂").replace(/\n/g, " "), 10)).not.toThrow();
});
it("gera várias páginas com tabelas e textos muito longos", async () => {
  const doc = await Documento.criar("Teste", "Fazenda", "PRÉVIA");
  doc.tabela(["Nome", "Valor"], Array.from({ length: 60 }, () => ["Laboratório ".repeat(30), "123,00"]), [2, 1]);
  doc.texto("A".repeat(10000));
  const resultado = await PDFDocument.load(await doc.salvar());
  expect(resultado.getPageCount()).toBeGreaterThan(3);
});
