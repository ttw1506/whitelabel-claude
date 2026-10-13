// Prova com o Ollama de verdade: manda uma foto, recebe as partes A, B e C.
// Uso: node ia-local/foto-ollama.mjs [caminho-da-foto.jpg]
// Sem caminho, usa uma folha sintética com manchas. Não toca no banco nem no site.
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { montarPromptFoto, formatarObservacaoFoto, ESQUEMA_FOTO } from "./foto.mjs";

const OLLAMA = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const MODELO = process.env.OLLAMA_MODELO_VISAO || "gemma4:e4b-it-qat";

/** PNG 256x256: fundo verde com manchas marrons. Só para provar o caminho. */
function folhaSintetica() {
  const L = 256, manchas = [[70, 80, 24], [150, 60, 17], [110, 170, 28], [190, 150, 15]];
  const linhas = [];
  for (let y = 0; y < L; y++) {
    const linha = Buffer.alloc(L * 3 + 1);
    for (let x = 0; x < L; x++) {
      const doente = manchas.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
      linha.set(doente ? [0x6b, 0x4a, 0x1f] : [0x3f, 0x8f, 0x3f], 1 + x * 3);
    }
    linhas.push(linha);
  }
  const bloco = (tipo, dados) => {
    const t = Buffer.from(tipo), tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const crcBuf = Buffer.alloc(4);
    let c = ~0;
    for (const b of Buffer.concat([t, dados])) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    crcBuf.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([tam, t, dados, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(L, 0); ihdr.writeUInt32BE(L, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr), bloco("IDAT", deflateSync(Buffer.concat(linhas))), bloco("IEND", Buffer.alloc(0)),
  ]);
}

const caminho = process.argv[2];
const imagem = caminho ? readFileSync(caminho) : folhaSintetica();
console.log(caminho ? `foto: ${caminho}` : "foto: folha sintética gerada aqui", `(${imagem.length} bytes)`);
console.log("modelo:", MODELO);

const prompt = montarPromptFoto({ cultura: "Soja", estadio: "V6" });
const t0 = Date.now();
const r = await fetch(`${OLLAMA}/api/generate`, {
  method: "POST",
  body: JSON.stringify({ model: MODELO, prompt, stream: false, images: [imagem.toString("base64")],
    format: ESQUEMA_FOTO, think: false }),
});
if (!r.ok) { console.error(`Ollama respondeu ${r.status}:`, (await r.text()).slice(0, 300)); process.exit(1); }
const { response } = await r.json();
const segundos = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n--- bruto do modelo (${segundos}s) ---`);
console.log(response.slice(0, 700));

const { texto, incertezas } = formatarObservacaoFoto(response);
console.log("\n--- texto que iria para observacoes_ia ---\n");
console.log(texto);
console.log("\n--- incertezas ---");
for (const i of incertezas) console.log(" -", i);
console.log(`\ntamanho do texto: ${texto.length} (limite 4000) · incertezas: ${incertezas.length} (limite 10)`);
