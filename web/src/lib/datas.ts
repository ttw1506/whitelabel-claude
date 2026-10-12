// Datas sempre no fuso de Goiás (o servidor pode estar em outro fuso).
const FUSO = "America/Sao_Paulo";
export const dataBr = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("pt-BR", { timeZone: FUSO }) : "—");
export const dataHoraBr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: FUSO });
