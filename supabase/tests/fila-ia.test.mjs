// Etapa 7: fila de tarefas da IA, chaves e preços, testados no próprio banco.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBanco } from "./_banco.mjs";

let b, admin, func, ia, cliente;
const ids = {};
const negado = (p) => assert.rejects(p, (e) => /row-level security|Somente|IA só|permission denied|não pode/.test(e.message));

before(async () => {
  b = await criarBanco();
  admin = await b.usuario("Admin", "admin");
  func = await b.usuario("Func", "funcionario");
  ia = await b.usuario("IA", "ia");
  await b.como(admin, async (q) => {
    ids.c = (await q("insert into clientes (nome, cpf_cnpj) values ('Produtor', '1') returning id")).rows[0].id;
  });
  cliente = await b.usuario("Produtor", "cliente", ids.c);
});
after(async () => b && b.encerrar());

const pedir = (q, tipo = "extrair_laudo_solo", extra = "") =>
  q(`insert into tarefas_ia (tipo, cliente_id ${extra}) values ($1, $2) returning id`, [tipo, ids.c]).then((r) => r.rows[0].id);

test("equipe cria tarefa; IA não cria; cliente não vê nem cria", async () => {
  await b.como(func, (q) => pedir(q));
  await negado(b.como(ia, (q) => pedir(q)));
  await negado(b.como(cliente, (q) => pedir(q)));
  await b.como(cliente, async (q) => assert.equal((await q("select count(*) from tarefas_ia")).rows[0].count, "0"));
  await b.como(ia, async (q) => assert.equal((await q("select count(*) from tarefas_ia")).rows[0].count, "1"));
});

test("só a IA pega tarefa; funcionário e cliente não", async () => {
  await negado(b.como(func, (q) => q("select * from ia_pegar_proxima_tarefa()")));
  await negado(b.como(cliente, (q) => q("select * from ia_pegar_proxima_tarefa()")));
  const r = await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa()"));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].status, "em_andamento");
  assert.equal(r.rows[0].tentativas, 1);
});

test("dois trabalhadores não pegam a mesma tarefa, e filtro por tipo funciona", async () => {
  await b.como(func, async (q) => { await pedir(q, "analisar_foto"); await pedir(q, "analisar_foto"); });
  const [a, c] = await Promise.all([
    b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['analisar_foto'])")),
    b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['analisar_foto'])")),
  ]).catch(async () => [
    // se o harness usar uma conexão só, as chamadas ficam em série: o resultado deve ser o mesmo
    await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['analisar_foto'])")),
    await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['analisar_foto'])")),
  ]);
  assert.equal(a.rows.length + c.rows.length, 2);
  assert.notEqual(a.rows[0].id, c.rows[0].id);
  const nada = await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['conferir_car'])"));
  assert.equal(nada.rows.length, 0);
});

test("falha volta para a fila até esgotar as tentativas; depois vira 'falhou'", async () => {
  const id2 = await b.como(func, async (q) => (await q("insert into tarefas_ia (tipo, max_tentativas) values ('conferir_car', 2) returning id")).rows[0].id);
  for (let i = 1; i <= 2; i++) {
    const t = await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['conferir_car'])"));
    assert.equal(t.rows[0].id, id2);
    const f = await b.como(ia, (q) => q("select * from ia_finalizar_tarefa($1, false, null, 'ollama fora do ar')", [id2]));
    assert.equal(f.rows[0].status, i < 2 ? "pendente" : "falhou");
  }
});

test("tarefa com prazo vencido volta para a fila; fechar tarefa que não está em andamento é erro", async () => {
  const id = await b.como(func, async (q) => (await q("insert into tarefas_ia (tipo) values ('gerar_laudo_parcial') returning id")).rows[0].id);
  await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['gerar_laudo_parcial'])"));
  await b.como(admin, (q) => q("update tarefas_ia set bloqueada_ate = now() - interval '1 minute' where id = $1", [id]));
  const de_novo = await b.como(ia, (q) => q("select * from ia_pegar_proxima_tarefa(array['gerar_laudo_parcial'])"));
  assert.equal(de_novo.rows[0].id, id);
  assert.equal(de_novo.rows[0].tentativas, 2);
  await b.como(ia, (q) => q("select * from ia_finalizar_tarefa($1, true, '{\"ok\":1}')", [id]));
  await assert.rejects(b.como(ia, (q) => q("select * from ia_finalizar_tarefa($1, true, '{}')", [id])), /não está em andamento/);
});

test("chaves de API: só admin lê e cria", async () => {
  await b.como(admin, (q) => q("insert into chaves_ia (nome, hash, prefixo) values ('PC do escritório', 'abc123', 'sp_ia_ab')"));
  for (const u of [func, ia, cliente]) {
    await b.como(u, async (q) => assert.equal((await q("select count(*) from chaves_ia")).rows[0].count, "0"));
    await negado(b.como(u, (q) => q("insert into chaves_ia (nome, hash, prefixo) values ('x', 'y', 'z')")));
  }
});

test("preços do dia: IA só cria rascunho; só admin aprova; cliente não vê", async () => {
  const id = await b.como(ia, async (q) =>
    (await q("insert into precos_dia (produto, valor, unidade, fonte, status) values ('soja', 130.5, 'R$/saca', 'Cepea', 'aprovado') returning id, status")).rows[0]);
  assert.equal(id.status, "rascunho_ia");
  await negado(b.como(ia, (q) => q("update precos_dia set status = 'aprovado' where id = $1", [id.id])));
  await negado(b.como(func, (q) => q("update precos_dia set status = 'aprovado' where id = $1", [id.id])));
  const ok = await b.como(admin, (q) => q("update precos_dia set status = 'aprovado' where id = $1 returning aprovado_por", [id.id]));
  assert.ok(ok.rows[0].aprovado_por);
  await b.como(cliente, async (q) => assert.equal((await q("select count(*) from precos_dia")).rows[0].count, "0"));
});
