"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { prepararFoto } from "@/lib/foto";
import { Aviso } from "@/components/ui";
import { Expansivel } from "@/components/expansivel";
import { registrarFotos, type FotoEnviada } from "./acoes";

type Talhao = { id: string; nome: string };
const LIMITE = 25 * 1024 * 1024;

export function EnviarFotos({ safraId, clienteId, talhoes, estadios, estadioAtual }: {
  safraId: string; clienteId: string; talhoes: Talhao[]; estadios: string[] | null; estadioAtual: string | null;
}) {
  const roteador = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [progresso, setProgresso] = useState<string>();
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const arquivos = d.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
    const estadio = String(d.get("estadio") ?? "").trim();
    setErro(undefined); setOk(undefined);
    if (!arquivos.length) return setErro("Escolha pelo menos uma foto.");
    if (!estadio) return setErro("Escolha o estádio.");
    const grande = arquivos.find((f) => f.size > LIMITE);
    if (grande) return setErro(`A foto ${grande.name} passa de 25 MB.`);
    setEnviando(true);
    const supabase = supabaseNavegador();
    const enviadas: FotoEnviada[] = [];
    try {
      for (const [i, arquivo] of arquivos.entries()) {
        setProgresso(`Preparando e enviando ${i + 1} de ${arquivos.length}…`);
        const p = await prepararFoto(arquivo);
        const id = crypto.randomUUID();
        const base = `clientes/${clienteId}/safras/${safraId}`;
        const extensao = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const arquivo_path = p.comprimida ? `${base}/${id}.jpg` : `${base}/${id}.${extensao}`;
        const original_path = p.comprimida ? `${base}/originais/${id}.${extensao}` : null;
        const up = await supabase.storage.from("fotos").upload(arquivo_path, p.leve, { contentType: p.comprimida ? "image/jpeg" : arquivo.type });
        if (up.error) throw new Error(`Não foi possível enviar ${arquivo.name}. Verifique a internet e tente de novo.`);
        if (original_path) {
          const o = await supabase.storage.from("fotos").upload(original_path, p.original, { contentType: arquivo.type || "image/jpeg" });
          if (o.error) throw new Error(`Não foi possível guardar o original de ${arquivo.name}.`);
        }
        enviadas.push({ arquivo_path, original_path, tirada_em: p.tiradaEm, latitude: p.latitude, longitude: p.longitude });
      }
      setProgresso("Registrando…");
      const r = await registrarFotos(safraId, { talhao_id: String(d.get("talhao_id") || "") || null, estadio, anotacao: String(d.get("anotacao") ?? ""), fotos: enviadas });
      if (r.erro) throw new Error(r.erro);
      setOk(r.ok);
      form.current?.reset();
      roteador.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha no envio.");
    } finally {
      setEnviando(false);
      setProgresso(undefined);
    }
  }

  return (
    <Expansivel rotulo="Enviar fotos" principal icone={<Camera size={18} aria-hidden />}>
      <form ref={form} onSubmit={enviar} className="formulario" noValidate aria-label="Enviar fotos">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <div className="campos">
          <div className="campo largo">
            <label htmlFor="campo-arquivos">Fotos</label>
            <input id="campo-arquivos" name="arquivos" type="file" accept="image/*" multiple />
            <span className="dica">Data, hora e GPS são lidos da própria foto, quando a câmera grava. Enviamos uma cópia leve e guardamos o original.</span>
          </div>
          <div className="campo">
            <label htmlFor="campo-estadio-foto">Estádio *</label>
            {estadios ? (
              <select id="campo-estadio-foto" name="estadio" defaultValue={estadioAtual ?? ""}>
                <option value="">Escolha</option>
                {estadios.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            ) : <input id="campo-estadio-foto" name="estadio" defaultValue={estadioAtual ?? ""} />}
          </div>
          <div className="campo">
            <label htmlFor="campo-talhao-foto">Talhão</label>
            <select id="campo-talhao-foto" name="talhao_id" defaultValue={talhoes.length === 1 ? talhoes[0].id : ""}>
              <option value="">Vários / geral</option>
              {talhoes.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="campo largo">
            <label htmlFor="campo-anotacao">Anotação</label>
            <textarea id="campo-anotacao" name="anotacao" placeholder="O que a foto mostra: estande, vigor, sintomas…" />
          </div>
        </div>
        <div className="rodape-form">
          <button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
          {progresso && <span className="muted" role="status">{progresso}</span>}
        </div>
      </form>
    </Expansivel>
  );
}
