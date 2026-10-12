// Chave de API da IA: aparece uma única vez; no banco fica só o hash.
import { createHash, randomBytes } from "node:crypto";

export const PREFIXO_CHAVE = "sp_ia_";

export function gerarChave() {
  const chave = PREFIXO_CHAVE + randomBytes(32).toString("base64url");
  return { chave, hash: hashChave(chave), prefixo: chave.slice(0, PREFIXO_CHAVE.length + 4) };
}

export const hashChave = (chave: string) => createHash("sha256").update(chave).digest("hex");

export function chaveDoCabecalho(cabecalho: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(cabecalho ?? "");
  return m && m[1].startsWith(PREFIXO_CHAVE) ? m[1] : null;
}
