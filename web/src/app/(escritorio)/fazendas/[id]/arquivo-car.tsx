"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { anexarArquivoCar } from "./acoes";

export function ArquivoCar({ fazendaId, clienteId }: { fazendaId: string; clienteId: string }) {
  const [msg, setMsg] = useState<string>();
  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg("Enviando…");
    const ext = (f.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `clientes/${clienteId}/car/${fazendaId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabaseNavegador().storage.from("documentos").upload(caminho, f, { contentType: f.type || "application/octet-stream" });
    if (up.error) return setMsg("Não foi possível enviar o arquivo. Tente de novo.");
    const r = await anexarArquivoCar(fazendaId, caminho);
    setMsg(r.erro ?? "Arquivo guardado.");
  }
  return (
    <div className="campo">
      <label htmlFor="car-arquivo">Recibo do CAR ou shapefile (PDF, imagem ou ZIP, até 20 MB)</label>
      <input id="car-arquivo" type="file" accept=".pdf,.zip,.kml,image/*" onChange={enviar} />
      {msg && <span role="status" className="muted" style={{ fontSize: 14 }}>{msg}</span>}
    </div>
  );
}
