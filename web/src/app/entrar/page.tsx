import type { Metadata } from "next";
import { FormEntrar } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function Entrar() {
  return (
    <main className="entrar">
      <div className="bloco">
        <div>
          <span className="marca">Solo<span>plan</span> Campo</span>
          <p className="muted" style={{ margin: "8px 0 0" }}>Acompanhamento de lavouras, custos e laudos.</p>
        </div>
        <FormEntrar />
      </div>
    </main>
  );
}
