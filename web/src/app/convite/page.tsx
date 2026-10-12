import { FormSenha } from "./form";

export const metadata = { title: "Criar senha" };

export default async function Convite({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const token = (await searchParams).token_hash ?? "";
  return (
    <main className="entrar">
      <div className="bloco">
        <div>
          <span className="marca">Solo<span>plan</span> Campo</span>
          <p className="muted" style={{ margin: "8px 0 0" }}>Bem-vindo. Crie a sua senha para acessar.</p>
        </div>
        {token ? <FormSenha token={token} /> : <p className="aviso erro">Link de convite incompleto. Peça um novo link à Soloplan.</p>}
      </div>
    </main>
  );
}
