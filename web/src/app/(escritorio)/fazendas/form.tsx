"use client";
import { useActionState } from "react";
import Link from "next/link";
import { UFS, formatarNumero } from "@soloplan/regras";
import { salvarFazenda } from "../acoes";
import { Aviso, Campo, Selecao } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";

export type Fazenda = {
  id: string; cliente_id: string; nome: string; municipio: string | null; uf: string | null; codigo_ibge: string | null; car_numero: string | null;
  area_total_ha: number | null; app_ha: number | null; reserva_legal_ha: number | null; area_consolidada_ha: number | null;
  latitude: number | null; longitude: number | null;
};

const br = (n: number | null | undefined, casas = 2) => (n == null ? "" : formatarNumero(Number(n), casas).replace(/\./g, ""));

export function FormFazenda({ fazenda, clienteId }: { fazenda?: Fazenda; clienteId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarFazenda.bind(null, fazenda?.id ?? null, clienteId), {});
  return (
    <form action={acao} className="formulario bloco" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <div className="campos">
        <Campo nome="nome" rotulo="Nome da fazenda" estado={estado} padrao={fazenda?.nome} obrigatorio largo />
        <Campo nome="municipio" rotulo="Município" estado={estado} padrao={fazenda?.municipio ?? "Quirinópolis"} />
        <Selecao nome="uf" rotulo="UF" estado={estado} padrao={fazenda?.uf ?? "GO"} opcoes={UFS.map((u) => ({ valor: u, nome: u }))} vazio="—" />
        <Campo nome="codigo_ibge" rotulo="Código IBGE do município" estado={estado} padrao={fazenda?.codigo_ibge ?? (fazenda ? "" : "5218508")} modo="numeric" maximo={7} dica="Usado na conferência do CAR." />
      </div>
      <fieldset>
        <legend>CAR e áreas do imóvel</legend>
        <div className="campos">
          <Campo nome="car_numero" rotulo="Número do CAR" estado={estado} padrao={fazenda?.car_numero} largo dica="Formato do SICAR: GO-5218508-…" />
          <Campo nome="area_total_ha" rotulo="Área total do imóvel" estado={estado} padrao={br(fazenda?.area_total_ha)} unidade="ha" modo="decimal" />
          <Campo nome="area_consolidada_ha" rotulo="Área consolidada" estado={estado} padrao={br(fazenda?.area_consolidada_ha)} unidade="ha" modo="decimal" />
          <Campo nome="reserva_legal_ha" rotulo="Reserva legal" estado={estado} padrao={br(fazenda?.reserva_legal_ha)} unidade="ha" modo="decimal" />
          <Campo nome="app_ha" rotulo="APP" estado={estado} padrao={br(fazenda?.app_ha)} unidade="ha" modo="decimal" />
        </div>
      </fieldset>
      <fieldset>
        <legend>Localização da sede</legend>
        <div className="campos">
          <Campo nome="latitude" rotulo="Latitude" estado={estado} padrao={br(fazenda?.latitude, 6)} modo="decimal" dica="Ex.: -18,447800" />
          <Campo nome="longitude" rotulo="Longitude" estado={estado} padrao={br(fazenda?.longitude, 6)} modo="decimal" dica="Ex.: -50,451200" />
        </div>
      </fieldset>
      <div className="rodape-form">
        <button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Salvando…" : fazenda ? "Salvar alterações" : "Cadastrar fazenda"}</button>
        <Link className="btn discreto" href={fazenda ? `/fazendas/${fazenda.id}` : `/clientes/${clienteId}`}>Cancelar</Link>
      </div>
    </form>
  );
}
