// Cria (ou garante) uma conta no Supabase LOCAL, sem apagar nada.
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node dev/criar-admin.mjs email "Nome" [senha]
// Sem senha, usa a de demonstracao do projeto (teste-123456): troque na primeira entrada.
// PAPEL=admin (padrao) | funcionario | nenhum  (nenhum = conta sem vinculo, cai em /aguardando)
import { createClient } from "@supabase/supabase-js";

const [email, nome, senhaArg] = process.argv.slice(2);
const URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !nome || !CHAVE) {
  console.error("Uso: SUPABASE_SERVICE_ROLE_KEY=... node dev/criar-admin.mjs email \"Nome\" [senha]");
  process.exit(1);
}
const senha = senhaArg || "teste-123456";

const servico = createClient(URL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });
const um = async (p) => { const r = await p; if (r.error) throw r.error; return r.data; };

const lista = await um(servico.auth.admin.listUsers({ perPage: 1000 }));
let usuario = lista.users.find((u) => u.email === email);
if (usuario) {
  console.log("conta ja existia:", email);
} else {
  usuario = (await um(servico.auth.admin.createUser({
    email, password: senha, email_confirm: true, user_metadata: { nome },
  }))).user;
  console.log("conta criada:", email);
}

// O perfil pode ou nao ter sido criado por gatilho; garante e aplica o papel pedido.
const papel = process.env.PAPEL || "admin";
if (!["admin", "funcionario", "nenhum"].includes(papel)) {
  console.error('PAPEL deve ser admin, funcionario ou nenhum.');
  process.exit(1);
}
if (papel !== "nenhum") {
  await um(servico.from("perfis").upsert(
    { usuario_id: usuario.id, nome, papel, cliente_id: null, ativo: true },
    { onConflict: "usuario_id" },
  ));
}
const perfil = await um(servico.from("perfis").select("nome, papel, ativo").eq("usuario_id", usuario.id).single());
console.log("perfil:", perfil);
console.log(senhaArg ? "senha: a que voce informou" : "senha: a de demonstracao do projeto (teste-123456) - troque ao entrar");
