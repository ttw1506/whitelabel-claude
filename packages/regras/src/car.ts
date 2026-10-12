// Conferência do CAR (Cadastro Ambiental Rural) de uma fazenda. Só confere números e avisa; quem decide é o agrônomo.
const FORMATO = /^([A-Z]{2})-(\d{7})-([0-9A-F]{32})$/;

export function validarNumeroCar(bruto: string): { ok: true; valor: string } | { ok: false; erro: string } {
  const t = String(bruto ?? "").trim().toUpperCase().replace(/\./g, "");
  return FORMATO.test(t) ? { ok: true, valor: t } : { ok: false, erro: "Número fora do formato do SICAR (UF-0000000-32 letras e números)." };
}

export type EntradaCar = {
  numero: string | null; uf: string | null; codigo_ibge: string | null;
  area_total_ha: number | null; area_consolidada_ha: number | null; app_ha: number | null; reserva_legal_ha: number | null;
  soma_talhoes_ha: number | null;
};
export type AlertaCar = { codigo: string; nivel: "erro" | "atencao" | "info"; texto: string };

const TOLERANCIA_HA = 0.01; // arredondamento do SICAR
const num = (x: unknown) => (x == null || x === "" ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const ha = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function conferirCar(e: EntradaCar) {
  const alertas: AlertaCar[] = [];
  const add = (codigo: string, nivel: AlertaCar["nivel"], texto: string) => alertas.push({ codigo, nivel, texto });
  const total = num(e.area_total_ha), consolidada = num(e.area_consolidada_ha), app = num(e.app_ha), rl = num(e.reserva_legal_ha), talhoes = num(e.soma_talhoes_ha);

  if (!e.numero?.trim()) add("sem_numero", "info", "Número do CAR não informado.");
  else {
    const v = validarNumeroCar(e.numero);
    if (!v.ok) add("numero_invalido", "erro", v.erro);
    else {
      const [, uf, ibge] = FORMATO.exec(v.valor)!;
      if ((e.uf && e.uf.toUpperCase() !== uf) || (e.codigo_ibge && e.codigo_ibge !== ibge))
        add("municipio_diferente", "atencao", `O número do CAR é de ${uf}-${ibge}, diferente do município cadastrado na fazenda.`);
    }
  }
  if (total == null || total <= 0) add("sem_area_total", "info", "Informe a área total do imóvel para conferir o CAR.");

  let reserva_legal_pct: number | null = null;
  if (total && total > 0) {
    if (rl == null) add("sem_reserva_legal", "info", "Reserva legal não informada.");
    else {
      reserva_legal_pct = Math.round((rl / total) * 10000) / 100;
      if (rl + TOLERANCIA_HA < total * 0.2) add("reserva_legal_baixa", "atencao", `Reserva legal de ${reserva_legal_pct.toLocaleString("pt-BR")}% da área total: o mínimo é 20%.`);
    }
    if (consolidada != null && app != null && rl != null && app + rl + consolidada > total + TOLERANCIA_HA)
      add("soma_acima_total", "erro", `APP + reserva legal + área consolidada somam ${ha(app + rl + consolidada)} ha, mais que a área total (${ha(total)} ha).`);
  }
  if (consolidada != null && talhoes != null && talhoes > consolidada + TOLERANCIA_HA)
    add("talhoes_acima_consolidada", "atencao", `Os talhões somam ${ha(talhoes)} ha, mais que a área consolidada (${ha(consolidada)} ha).`);

  const situacao = alertas.some((a) => a.nivel === "erro") ? "erro" : alertas.some((a) => a.nivel === "atencao") ? "atencao" : alertas.length ? "pendente" : "ok";
  return { situacao: situacao as "ok" | "pendente" | "atencao" | "erro", alertas, reserva_legal_pct };
}
