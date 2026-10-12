// PDFs dos laudos (gerados no servidor). Fonte padrão Helvetica: só caracteres Latin-1.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const VERDE = rgb(0.114, 0.416, 0.224);
const TINTA = rgb(0.094, 0.149, 0.11);
const CINZA = rgb(0.31, 0.37, 0.33);
const LINHA = rgb(0.85, 0.87, 0.83);
const A4: [number, number] = [595.28, 841.89];
const MARGEM = 48;

/** Troca o que a fonte padrão não desenha. */
export const latin1 = (t: string) =>
  t.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/₂/g, "2").replace(/[^\x00-\xFF–—•]/g, "?");

export class Documento {
  private constructor(public pdf: PDFDocument, private normal: PDFFont, private negrito: PDFFont) {}
  pagina!: PDFPage;
  y = 0;

  static async criar(titulo: string, subtitulo: string, marcaDagua?: string) {
    const pdf = await PDFDocument.create();
    pdf.setTitle(latin1(titulo));
    pdf.setAuthor("Soloplan");
    pdf.setCreator("Soloplan Campo");
    const d = new Documento(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold));
    d.novaPagina(marcaDagua);
    d.texto("Soloplan", { tamanho: 20, negrito: true, cor: VERDE });
    d.texto("Consultoria agrícola · Quirinópolis-GO", { tamanho: 9, cor: CINZA });
    d.espaco(14);
    d.texto(titulo, { tamanho: 16, negrito: true });
    d.texto(subtitulo, { tamanho: 10, cor: CINZA });
    d.regua();
    return d;
  }

  private marca?: string;
  novaPagina(marcaDagua = this.marca) {
    this.marca = marcaDagua;
    this.pagina = this.pdf.addPage(A4);
    this.y = A4[1] - MARGEM;
    if (marcaDagua) {
      this.pagina.drawText(latin1(marcaDagua), { x: 110, y: 380, size: 46, font: this.negrito, color: rgb(0.85, 0.3, 0.1), opacity: 0.15, rotate: degrees(35) });
    }
  }

  private garantir(altura: number) { if (this.y - altura < MARGEM + 20) this.novaPagina(); }
  espaco(n: number) { this.y -= n; }

  texto(t: string, { tamanho = 10, negrito = false, cor = TINTA, x = MARGEM, largura = A4[0] - 2 * MARGEM } = {}) {
    const fonte = negrito ? this.negrito : this.normal;
    for (const paragrafo of latin1(t).split("\n")) {
      const palavras = paragrafo.split(" ");
      let linha = "";
      const escrever = (l: string) => { this.garantir(tamanho * 1.4); this.pagina.drawText(l, { x, y: this.y - tamanho, size: tamanho, font: fonte, color: cor }); this.y -= tamanho * 1.4; };
      for (const p of palavras) {
        const tentativa = linha ? `${linha} ${p}` : p;
        if (fonte.widthOfTextAtSize(tentativa, tamanho) > largura && linha) { escrever(linha); linha = p; } else linha = tentativa;
      }
      escrever(linha);
    }
  }

  titulo(t: string) { this.espaco(10); this.garantir(40); this.texto(t, { tamanho: 12, negrito: true, cor: VERDE }); this.espaco(2); }

  regua() { this.espaco(6); this.pagina.drawLine({ start: { x: MARGEM, y: this.y }, end: { x: A4[0] - MARGEM, y: this.y }, thickness: 0.8, color: LINHA }); this.espaco(8); }

  /** Tabela simples; colunas com largura relativa; números alinhados à direita. */
  tabela(cabecalho: string[], linhas: string[][], pesos: number[], direita: boolean[] = []) {
    const total = pesos.reduce((a, b) => a + b, 0);
    const larguras = pesos.map((p) => (p / total) * (A4[0] - 2 * MARGEM));
    const desenhar = (celulas: string[], negrito: boolean) => {
      this.garantir(18);
      let x = MARGEM;
      const fonte = negrito ? this.negrito : this.normal;
      celulas.forEach((c, i) => {
        const t = latin1(c);
        const w = fonte.widthOfTextAtSize(t, 9);
        this.pagina.drawText(t, { x: direita[i] ? x + larguras[i] - w - 4 : x + 4, y: this.y - 12, size: 9, font: fonte, color: negrito ? CINZA : TINTA });
        x += larguras[i];
      });
      this.y -= 17;
      this.pagina.drawLine({ start: { x: MARGEM, y: this.y + 2 }, end: { x: A4[0] - MARGEM, y: this.y + 2 }, thickness: 0.5, color: LINHA });
    };
    desenhar(cabecalho, true);
    linhas.forEach((l) => desenhar(l, false));
  }

  async salvar() {
    const paginas = this.pdf.getPages();
    paginas.forEach((p, i) => p.drawText(`Página ${i + 1} de ${paginas.length}`, { x: A4[0] - MARGEM - 70, y: 24, size: 8, font: this.normal, color: CINZA }));
    return this.pdf.save();
  }
}
