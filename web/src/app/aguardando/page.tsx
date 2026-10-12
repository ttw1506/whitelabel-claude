import { sair } from "../entrar/acoes";

export const metadata = { title: "Acesso em liberação" };

export default function Aguardando() {
  return (
    <main className="entrar">
      <div className="bloco">
        <h1>Seu acesso está sendo liberado</h1>
        <p>Sua conta foi criada, mas ainda não está ligada a um produtor ou à equipe da Soloplan. Fale com o escritório para concluir a liberação.</p>
        <form action={sair}><button className="btn" type="submit">Sair</button></form>
      </div>
    </main>
  );
}
