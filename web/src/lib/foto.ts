// Preparação da foto no navegador: lê data e GPS da própria foto (EXIF) e gera uma cópia leve.
import exifr from "exifr";

export type Preparada = { leve: Blob; original: File; tiradaEm: string | null; latitude: number | null; longitude: number | null; comprimida: boolean };

const LADO_MAXIMO = 1920;

export async function prepararFoto(arquivo: File): Promise<Preparada> {
  let tiradaEm: string | null = null, latitude: number | null = null, longitude: number | null = null;
  try {
    const exif = await exifr.parse(arquivo, ["DateTimeOriginal", "CreateDate"]);
    const data = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (data instanceof Date && !Number.isNaN(data.getTime())) tiradaEm = data.toISOString();
  } catch { /* foto sem data no EXIF */ }
  try {
    const gps = await exifr.gps(arquivo);
    if (Number.isFinite(gps?.latitude) && Number.isFinite(gps?.longitude)) { latitude = gps.latitude; longitude = gps.longitude; }
  } catch { /* foto sem GPS */ }

  try {
    const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const largura = Math.round(imagem.width * escala), altura = Math.round(imagem.height * escala);
    const tela = new OffscreenCanvas(largura, altura);
    tela.getContext("2d")!.drawImage(imagem, 0, 0, largura, altura);
    imagem.close();
    const leve = await tela.convertToBlob({ type: "image/jpeg", quality: 0.82 });
    return { leve, original: arquivo, tiradaEm, latitude, longitude, comprimida: true };
  } catch {
    // Formato que o navegador não abre (ex.: HEIC fora do Safari): envia só o original.
    return { leve: arquivo, original: arquivo, tiradaEm, latitude, longitude, comprimida: false };
  }
}
