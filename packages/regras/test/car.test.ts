import { describe, expect, it } from "vitest";
import { conferirCar, validarNumeroCar } from "../src/car";

const HEX = "A1B2C3D4E5F60718293A4B5C6D7E8F90";
const base = { numero: `GO-5218508-${HEX}`, codigo_ibge: "5218508", uf: "GO", area_total_ha: 1000, area_consolidada_ha: 700, app_ha: 50, reserva_legal_ha: 200, soma_talhoes_ha: 650 };
const codigos = (r: ReturnType<typeof conferirCar>) => r.alertas.map((a) => a.codigo);

describe("validarNumeroCar", () => {
  it("aceita o formato do SICAR, com ou sem pontos e minúsculas", () => {
    expect(validarNumeroCar(`GO-5218508-${HEX}`).ok).toBe(true);
    expect(validarNumeroCar(` go-5218508-${HEX.toLowerCase()} `).ok).toBe(true);
    expect(validarNumeroCar(`GO-5218508-A1B2.C3D4.E5F6.0718.293A.4B5C.6D7E.8F90`).ok).toBe(true);
  });
  it("recusa formato errado", () => {
    for (const x of ["", "GO-5218508", `G-5218508-${HEX}`, `GO-521850-${HEX}`, `GO-5218508-${HEX.slice(1)}`, `GO-5218508-${HEX.replace("A", "Z")}`]) expect(validarNumeroCar(x).ok, x).toBe(false);
  });
  it("devolve o número normalizado", () => {
    const r = validarNumeroCar(` go-5218508-${HEX.toLowerCase()} `);
    expect(r.ok && r.valor).toBe(`GO-5218508-${HEX}`);
  });
});

describe("conferirCar", () => {
  it("imóvel certo não gera alerta", () => {
    const r = conferirCar(base);
    expect(r.alertas).toEqual([]);
    expect(r.situacao).toBe("ok");
    expect(r.reserva_legal_pct).toBe(20);
  });
  it("reserva legal abaixo de 20% da área total", () => {
    const r = conferirCar({ ...base, reserva_legal_ha: 150 });
    expect(codigos(r)).toContain("reserva_legal_baixa");
    expect(r.situacao).toBe("atencao");
  });
  it("soma dos talhões maior que a área consolidada", () => {
    expect(codigos(conferirCar({ ...base, soma_talhoes_ha: 701 }))).toContain("talhoes_acima_consolidada");
    expect(codigos(conferirCar({ ...base, soma_talhoes_ha: 700.004 }))).not.toContain("talhoes_acima_consolidada");
  });
  it("APP + reserva + consolidada maior que a área total", () => {
    expect(codigos(conferirCar({ ...base, area_consolidada_ha: 800 }))).toContain("soma_acima_total");
  });
  it("número do CAR de outro município ou estado", () => {
    expect(codigos(conferirCar({ ...base, codigo_ibge: "5201108" }))).toContain("municipio_diferente");
    expect(codigos(conferirCar({ ...base, uf: "MG" }))).toContain("municipio_diferente");
  });
  it("número inválido é erro", () => {
    const r = conferirCar({ ...base, numero: "123" });
    expect(codigos(r)).toContain("numero_invalido");
    expect(r.situacao).toBe("erro");
  });
  it("sem número ou sem áreas: pendente, sem inventar conta", () => {
    const r = conferirCar({ ...base, numero: null, area_total_ha: null, reserva_legal_ha: null });
    expect(r.situacao).toBe("pendente");
    expect(codigos(r)).toEqual(expect.arrayContaining(["sem_numero", "sem_area_total"]));
    expect(codigos(r)).not.toContain("reserva_legal_baixa");
  });
  it("aceita números como texto vindo do banco", () => {
    expect(conferirCar({ ...base, area_total_ha: "1000.00" as unknown as number }).alertas).toEqual([]);
  });
});
