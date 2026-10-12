import { redirect } from "next/navigation";
import { sessaoEquipe } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Cabeca } from "@/components/ui";
import { FormConvite, FormPerfil } from "./formularios";

export const metadata = { title: "Usuários" };

export default async function Usuarios() {
  const { supabase, eAdmin, user } = await sessaoEquipe();
  if (!eAdmin) redirect("/painel");
  const [perfis, clientes, contas] = await Promise.all([
    supabase.from("perfis").select("usuario_id, nome, papel, cliente_id, ativo").order("nome"),
    supabase.from("clientes").select("id, nome").order("nome"),
    supabaseAdmin().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const conta = new Map((contas.data?.users ?? []).map((u) => [u.id, u]));
  const listaClientes = clientes.data ?? [];
  return (
    <>
      <Cabeca titulo="Usuários" sub="Quem acessa o sistema e o que cada um pode fazer." />
      <section className="bloco" aria-labelledby="t-convite">
        <div className="bloco-cab"><h2 id="t-convite">Convidar</h2></div>
        <p className="muted" style={{ marginTop: 0 }}>O convite gera um link para a pessoa criar a própria senha. Envie pelo WhatsApp ou e-mail.</p>
        <FormConvite clientes={listaClientes} />
      </section>
      <section className="bloco" aria-labelledby="t-lista">
        <div className="bloco-cab"><h2 id="t-lista">Acessos</h2></div>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Situação</th><th>Papel e acesso</th></tr></thead>
          <tbody>{(perfis.data ?? []).map((p) => {
            const c = conta.get(p.usuario_id);
            return (
              <tr key={p.usuario_id}>
                <td><strong>{p.nome}</strong></td>
                <td>{c?.email ?? "—"}</td>
                <td>{!p.ativo ? <span className="selo">Desativado</span> : c?.last_sign_in_at ? <span className="selo verde">Ativo</span> : <span className="selo laranja">Convite pendente</span>}</td>
                <td><FormPerfil usuarioId={p.usuario_id} papel={p.papel} clienteId={p.cliente_id} ativo={p.ativo} clientes={listaClientes} voce={p.usuario_id === user.id} /></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
    </>
  );
}
