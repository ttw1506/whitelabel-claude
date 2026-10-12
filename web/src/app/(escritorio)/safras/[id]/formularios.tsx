"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Expansivel } from "@/components/expansivel";
import { CATEGORIAS_CUSTO, formatarHa } from "@soloplan/regras";
import { Aviso, Campo, Selecao } from "@/components/ui";
import type { EstadoForm } from "@/lib/formulario";
import { salvarOcorrencia, salvarAplicacao, salvarCusto, salvarLaudoSafra } from "./acoes";

type Talhao = { id: string; nome: string; area_ha: number };

/** Formulário que limpa e mostra a confirmação depois de salvar. */
function useForm(acao: (e: EstadoForm, d: FormData) => Promise<EstadoForm>) {
  const [estado, despachar, enviando] = useActionState<EstadoForm, FormData>(acao, {});
  const ref = useRef<HTMLFormElement>(null);
  // Objeto estável: efeitos que dependem dele só rodam quando o servidor responde.
  const exibido = useMemo<EstadoForm>(() => (estado.ok ? { ok: estado.ok } : estado), [estado]);
  useEffect(() => { if (exibido.ok) ref.current?.reset(); }, [exibido]);
  return { estado: exibido, despachar, enviando, ref };
}

function Rodape({ enviando, rotulo }: { enviando: boolean; rotulo: string }) {
  return <div className="rodape-form"><button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Salvando…" : rotulo}</button></div>;
}

const TIPOS = [{ valor: "praga", nome: "Praga" }, { valor: "doenca", nome: "Doença" }, { valor: "planta_daninha", nome: "Planta daninha" }, { valor: "deficiencia", nome: "Deficiência nutricional" }];

export function FormOcorrencia({ safraId, talhoes, estadios, estadioAtual, hoje }: { safraId: string; talhoes: Talhao[]; estadios: string[] | null; estadioAtual: string | null; hoje: string }) {
  const { estado, despachar, enviando, ref } = useForm(salvarOcorrencia.bind(null, safraId));
  return (
    <Expansivel rotulo="Registrar ocorrência">
      <form ref={ref} action={despachar} className="formulario" noValidate aria-label="Registrar ocorrência">
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        <div className="campos">
          <Selecao prefixo="ocorr" nome="tipo" rotulo="Tipo" estado={estado} opcoes={TIPOS} vazio="Escolha" obrigatorio />
          <Campo prefixo="ocorr" nome="nome" rotulo="O que foi encontrado" estado={estado} obrigatorio dica="Ex.: percevejo-marrom, ferrugem-asiática, buva" />
          <Campo prefixo="ocorr" nome="data" rotulo="Data" estado={estado} padrao={hoje} tipo="date" obrigatorio />
          {estadios ? <Selecao prefixo="ocorr" nome="estadio" rotulo="Estádio" estado={estado} padrao={estadioAtual} opcoes={estadios.map((e) => ({ valor: e, nome: e }))} vazio="—" />
            : <Campo prefixo="ocorr" nome="estadio" rotulo="Estádio" estado={estado} padrao={estadioAtual} />}
          <Selecao prefixo="ocorr" nome="talhao_id" rotulo="Talhão" estado={estado} opcoes={talhoes.map((t) => ({ valor: t.id, nome: t.nome }))} vazio="Vários / geral" />
          <Campo prefixo="ocorr" nome="severidade" rotulo="Severidade / nível medido" estado={estado} dica="Ex.: 2 percevejos/m de pano; 5% de severidade" />
          <Campo prefixo="ocorr" nome="acao_tomada" rotulo="Ação tomada" estado={estado} largo />
        </div>
        <Rodape enviando={enviando} rotulo="Registrar ocorrência" />
      </form>
    </Expansivel>
  );
}

const OPERACOES = ["Pulverização", "Adubação de base", "Adubação de cobertura", "Dessecação", "Tratamento de sementes", "Plantio", "Calagem", "Gessagem", "Colheita", "Outra"];
const UNIDADES = ["L/ha", "mL/ha", "kg/ha", "g/ha", "t/ha", "L/100 kg sem.", "mL/100 kg sem."];

export function FormAplicacao({ safraId, talhoes, hoje }: { safraId: string; talhoes: Talhao[]; hoje: string }) {
  const { estado, despachar, enviando, ref } = useForm(salvarAplicacao.bind(null, safraId));
  const [marcados, setMarcados] = useState<Set<string>>(new Set(talhoes.map((t) => t.id)));
  useEffect(() => { if (estado.ok) setMarcados(new Set(talhoes.map((t) => t.id))); }, [estado, talhoes]);
  const area = talhoes.filter((t) => marcados.has(t.id)).reduce((s, t) => s + Number(t.area_ha), 0);
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Expansivel rotulo="Lançar aplicação">
      <form ref={ref} action={despachar} className="formulario" noValidate aria-label="Lançar aplicação">
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        <div className="campos">
          <Campo prefixo="aplic" nome="data" rotulo="Data" estado={estado} padrao={hoje} tipo="date" obrigatorio />
          <Selecao prefixo="aplic" nome="tipo_operacao" rotulo="Operação" estado={estado} opcoes={OPERACOES.map((o) => ({ valor: o, nome: o }))} vazio="Escolha" obrigatorio />
          <Campo prefixo="aplic" nome="produto" rotulo="Produto comercial" estado={estado} />
          <Campo prefixo="aplic" nome="ingrediente_ativo" rotulo="Ingrediente ativo" estado={estado} />
          <Campo prefixo="aplic" nome="dose" rotulo="Dose" estado={estado} modo="decimal" />
          <Selecao prefixo="aplic" nome="dose_unidade" rotulo="Unidade da dose" estado={estado} opcoes={UNIDADES.map((u) => ({ valor: u, nome: u }))} vazio="—" />
        </div>
        <fieldset>
          <legend>Talhões aplicados *</legend>
          <div className="marcas">
            {talhoes.map((t) => (
              <label key={t.id}><input type="checkbox" name="talhoes" value={t.id} checked={marcados.has(t.id)} onChange={() => alternar(t.id)} />{t.nome}</label>
            ))}
          </div>
          {estado.campos?.talhoes && <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: 13, margin: "8px 0 0" }}>{estado.campos.talhoes}</p>}
        </fieldset>
        <div className="campos">
          <Campo prefixo="aplic" nome="area_ha" rotulo="Área aplicada" estado={estado} unidade="ha" modo="decimal" dica={`Em branco = talhões marcados (${formatarHa(area)}).`} />
          <Campo prefixo="aplic" nome="custo" rotulo="Custo total da aplicação" estado={estado} unidade="R$" modo="decimal" dica="Entra automaticamente nos custos da safra." />
          <Selecao prefixo="aplic" nome="categoria_custo" rotulo="Categoria do custo" estado={estado} padrao="defensivos" opcoes={CATEGORIAS_CUSTO.map((c) => ({ valor: c.valor, nome: c.nome }))} />
        </div>
        <Rodape enviando={enviando} rotulo="Lançar aplicação" />
      </form>
    </Expansivel>
  );
}

export function FormCusto({ safraId, hoje }: { safraId: string; hoje: string }) {
  const { estado, despachar, enviando, ref } = useForm(salvarCusto.bind(null, safraId));
  return (
    <Expansivel rotulo="Lançar custo">
      <form ref={ref} action={despachar} className="formulario" noValidate aria-label="Lançar custo">
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        <div className="campos">
          <Selecao prefixo="custo" nome="categoria" rotulo="Categoria" estado={estado} opcoes={CATEGORIAS_CUSTO.map((c) => ({ valor: c.valor, nome: c.nome }))} vazio="Escolha" obrigatorio />
          <Campo prefixo="custo" nome="descricao" rotulo="Descrição" estado={estado} obrigatorio />
          <Campo prefixo="custo" nome="valor" rotulo="Valor" estado={estado} unidade="R$" modo="decimal" obrigatorio />
          <Campo prefixo="custo" nome="data" rotulo="Data" estado={estado} padrao={hoje} tipo="date" obrigatorio />
        </div>
        <Rodape enviando={enviando} rotulo="Lançar custo" />
      </form>
    </Expansivel>
  );
}

export function FormLaudo({ safraId }: { safraId: string }) {
  const { estado, despachar, enviando, ref } = useForm(salvarLaudoSafra.bind(null, safraId));
  return (
    <Expansivel rotulo="Escrever laudo">
      <form ref={ref} action={despachar} className="formulario" noValidate aria-label="Escrever laudo">
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        <div className="campos">
          <Selecao prefixo="laudo" nome="tipo" rotulo="Tipo" estado={estado} padrao="parcial" opcoes={[{ valor: "parcial", nome: "Parcial" }, { valor: "final", nome: "Final" }]} />
          <div className="campo largo">
            <label htmlFor="laudo-texto">Texto do laudo</label>
            <textarea id="laudo-texto" name="texto" rows={8} defaultValue={estado.valores?.texto} aria-invalid={estado.campos?.texto ? true : undefined} />
            {estado.campos?.texto && <span className="erro">{estado.campos.texto}</span>}
          </div>
        </div>
        <Rodape enviando={enviando} rotulo="Salvar para revisão" />
      </form>
    </Expansivel>
  );
}
