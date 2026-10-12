"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { CULTURAS, estadiosDa, formatarHa, formatarNumero, sugerirAnoAgricola } from "@soloplan/regras";
import { salvarSafra } from "../acoes";
import { Aviso, Campo, Selecao } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";

export type Safra = {
  id: string; fazenda_id: string; ano_agricola: string; cultura: string; cultivar: string | null; data_plantio: string | null;
  area_ha: number | null; estadio_atual: string | null; status: string; produtividade_sc_ha: number | null; talhoes: string[];
};
type Talhao = { id: string; nome: string; area_ha: number };

const br = (n: number | null | undefined) => (n == null ? "" : formatarNumero(Number(n)).replace(/\./g, ""));

export function FormSafra({ safra, fazendaId, talhoes }: { safra?: Safra; fazendaId: string; talhoes: Talhao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarSafra.bind(null, safra?.id ?? null, fazendaId), {});
  const [cultura, setCultura] = useState(estado.valores?.cultura ?? safra?.cultura ?? "Soja");
  const marcadosIniciais = new Set(safra?.talhoes ?? []);
  const [marcados, setMarcados] = useState(marcadosIniciais);
  const estadios = estadiosDa(cultura);
  const areaMarcada = talhoes.filter((t) => marcados.has(t.id)).reduce((s, t) => s + Number(t.area_ha), 0);
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form action={acao} className="formulario bloco" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <div className="campos">
        <Campo nome="ano_agricola" rotulo="Ano agrícola" estado={estado} padrao={safra?.ano_agricola ?? sugerirAnoAgricola()} obrigatorio dica="Ex.: 2025/26" />
        <div className="campo">
          <label htmlFor="campo-cultura">Cultura <span aria-hidden>*</span></label>
          <select id="campo-cultura" name="cultura" value={cultura} onChange={(e) => setCultura(e.target.value)} aria-invalid={estado.campos?.cultura ? true : undefined}>
            {[...new Set([...CULTURAS, cultura])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {estado.campos?.cultura && <span className="erro">{estado.campos.cultura}</span>}
        </div>
        <Campo nome="cultivar" rotulo="Cultivar" estado={estado} padrao={safra?.cultivar} />
        <Campo nome="data_plantio" rotulo="Data de plantio" estado={estado} padrao={safra?.data_plantio} tipo="date" />
      </div>

      <fieldset aria-describedby={estado.campos?.talhoes ? "erro-talhoes" : undefined}>
        <legend>Talhões desta safra *</legend>
        {talhoes.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Esta fazenda ainda não tem talhões. <Link href={`/fazendas/${fazendaId}`}>Cadastre os talhões</Link> primeiro.</p>
        ) : (
          <div className="marcas">
            {talhoes.map((t) => (
              <label key={t.id}>
                <input type="checkbox" name="talhoes" value={t.id} checked={marcados.has(t.id)} onChange={() => alternar(t.id)} />
                {t.nome} <span className="muted tabular">({formatarHa(Number(t.area_ha))})</span>
              </label>
            ))}
          </div>
        )}
        {estado.campos?.talhoes && <p className="erro" id="erro-talhoes" style={{ color: "var(--danger)", fontWeight: 600, fontSize: 13, margin: "8px 0 0" }}>{estado.campos.talhoes}</p>}
      </fieldset>

      <div className="campos">
        <Campo nome="area_ha" rotulo="Área plantada" estado={estado} padrao={br(safra?.area_ha)} unidade="ha" modo="decimal"
          dica={`Em branco = soma dos talhões marcados (${formatarHa(areaMarcada)}).`} />
        {estadios ? (
          <Selecao nome="estadio_atual" rotulo="Estádio atual" estado={estado} padrao={safra?.estadio_atual} opcoes={estadios.map((e) => ({ valor: e, nome: e }))} vazio="Ainda não emergiu" />
        ) : (
          <Campo nome="estadio_atual" rotulo="Estádio atual" estado={estado} padrao={safra?.estadio_atual} />
        )}
        <Selecao nome="status" rotulo="Situação" estado={estado} padrao={safra?.status ?? "em_andamento"} opcoes={[{ valor: "em_andamento", nome: "Em andamento" }, { valor: "colhida", nome: "Colhida" }]} />
        <Campo nome="produtividade_sc_ha" rotulo="Produtividade final" estado={estado} padrao={br(safra?.produtividade_sc_ha)} unidade="sc/ha" modo="decimal" dica="Preencha depois da colheita." />
      </div>

      <div className="rodape-form">
        <button className="btn principal" type="submit" disabled={enviando || talhoes.length === 0}>{enviando ? "Salvando…" : safra ? "Salvar alterações" : "Criar safra"}</button>
        <Link className="btn discreto" href={safra ? `/safras/${safra.id}` : `/fazendas/${fazendaId}`}>Cancelar</Link>
      </div>
    </form>
  );
}
