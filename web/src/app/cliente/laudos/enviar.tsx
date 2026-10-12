"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Expansivel } from "@/components/expansivel";
import { Aviso } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { registrarEnvioLaudoSolo } from "../acoes";

export function EnviarLaudoSolo({ clienteId, fazendas }: { clienteId: string; fazendas: { id: string; nome: string }[] }) {
  const roteador = useRouter();
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const arquivo = d.get("arquivo");
    const fazendaId = String(d.get("fazenda") ?? "");
    setErro(undefined); setOk(undefined);
    if (!fazendaId) return setErro("Escolha a fazenda.");
    if (!(arquivo instanceof File) || !arquivo.size) return setErro("Escolha o arquivo do laboratório (PDF ou foto).");
    if (arquivo.size > 20 * 1024 * 1024) return setErro("O arquivo passa de 20 MB.");
    setEnviando(true);
    const ext = (arquivo.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `clientes/${clienteId}/envios/${crypto.randomUUID()}.${ext}`;
    try {
      const up = await supabaseNavegador().storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream" });
      if (up.error) throw new Error("Não foi possível enviar o arquivo. Verifique a internet e tente de novo.");
      const r = await registrarEnvioLaudoSolo({ fazendaId, caminho, mensagem: String(d.get("mensagem") ?? "") });
      if (r.erro) throw new Error(r.erro);
      setOk(r.ok); form.reset(); roteador.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha no envio. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Expansivel rotulo="Enviar laudo de solo" principal icone={<Upload size={18} aria-hidden />}>
      <form onSubmit={enviar} className="formulario" aria-label="Enviar laudo de solo" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <div className="campos">
          <div className="campo">
            <label htmlFor="envio-fazenda">Fazenda</label>
            <select id="envio-fazenda" name="fazenda" defaultValue={fazendas.length === 1 ? fazendas[0].id : ""}>
              <option value="">Escolha</option>
              {fazendas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="envio-arquivo">Arquivo do laboratório</label>
            <input id="envio-arquivo" name="arquivo" type="file" accept="application/pdf,image/*" />
          </div>
          <div className="campo largo">
            <label htmlFor="envio-mensagem">Observação (opcional)</label>
            <textarea id="envio-mensagem" name="mensagem" placeholder="Ex.: amostra do talhão 3, coletada em setembro" />
          </div>
        </div>
        <div className="rodape-form"><button className="btn principal" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button></div>
      </form>
    </Expansivel>
  );
}
