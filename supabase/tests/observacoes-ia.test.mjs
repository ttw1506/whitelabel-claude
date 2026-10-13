// Observações da IA (foto e CAR): rascunho obrigatório, cliente herdado, só admin aprova, cliente só vê o aprovado e o seu.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBanco } from "./_banco.mjs";

let b, admin, func, ia, uA, uB;
const ids = {};
const negado = (p) => assert.rejects(p, (e) => /row-level security|Somente|IA só|não pode|permission denied|check constraint|Registro pai/.test(e.message));
const TEXTO = "Folhas com manchas amareladas nas bordas, mais fortes na parte baixa da planta.";

before(async () => {
  b = await criarBanco();
  admin = await b.usuario("Admin", "admin");
  func = await b.usuario("Func", "funcionario");
  ia = await b.usuario("IA", "ia");
  await b.como(admin, async (q) => {
    ids.cA = (await q("insert into clientes (nome, cpf_cnpj) values ('A', '1') returning id")).rows[0].id;
    ids.cB = (await q("insert into clientes (nome, cpf_cnpj) values ('B', '2') returning id")).rows[0].id;
    ids.fA = (await q("insert into fazendas (cliente_id, nome) values ($1, 'FA') returning id", [ids.cA])).rows[0].id;
    ids.fB = (await q("insert into fazendas (cliente_id, nome) values ($1, 'FB') returning id", [ids.cB])).rows[0].id;
    ids.sA = (await q("insert into safras (fazenda_id, ano_agricola, cultura) values ($1, '2025/26', 'Soja') returning id", [ids.fA])).rows[0].id;
    ids.foto = (await q("insert into fotos (safra_id, estadio, arquivo_path) values ($1, 'V3', 'a/x.jpg') returning id", [ids.sA])).rows[0].id;
  });
  uA = await b.usuario("Produtor A", "cliente", ids.cA);
  uB = await b.usuario("Produtor B", "cliente", ids.cB);
});
after(async () => b && b.encerrar());

const criar = (q, status = "aprovado") => q("insert into observacoes_ia (tipo, foto_id, texto, status) values ('foto', $1, $2, $3) returning id, status, cliente_id", [ids.foto, TEXTO, status]);

test("IA cria sempre rascunho (mesmo pedindo aprovado) e o cliente vem da foto", async () => {
  const r = await b.como(ia, (q) => criar(q));
  ids.obs = r.rows[0].id;
  assert.equal(r.rows[0].status, "rascunho_ia");
  assert.equal(r.rows[0].cliente_id, ids.cA);
});

test("IA não aprova, não muda o status e não edita o que já foi aprovado; funcionário não aprova", async () => {
  await negado(b.como(ia, (q) => q("update observacoes_ia set status = 'aprovado' where id = $1", [ids.obs])));
  await negado(b.como(func, (q) => q("update observacoes_ia set status = 'aprovado' where id = $1", [ids.obs])));
  const ok = await b.como(admin, (q) => q("update observacoes_ia set status = 'aprovado' where id = $1 returning aprovado_por", [ids.obs]));
  assert.ok(ok.rows[0].aprovado_por);
  const edit = await b.como(ia, (q) => q("update observacoes_ia set texto = $2 where id = $1 returning id", [ids.obs, TEXTO + " Mudado."]));
  assert.equal(edit.rowCount, 0, "IA não enxerga nem edita registro aprovado como rascunho");
});

test("cliente só vê o aprovado e o dele", async () => {
  const rascunho = (await b.como(ia, (q) => criar(q))).rows[0].id;
  await b.como(uA, async (q) => {
    const r = await q("select id from observacoes_ia");
    assert.deepEqual(r.rows.map((x) => x.id), [ids.obs], "vê a aprovada e não o rascunho");
    assert.ok(!r.rows.some((x) => x.id === rascunho));
  });
  await b.como(uB, async (q) => assert.equal((await q("select count(*) from observacoes_ia")).rows[0].count, "0"));
});

test("observação de CAR liga à fazenda; vínculo errado ou trocado é recusado", async () => {
  const r = await b.como(ia, (q) => q("insert into observacoes_ia (tipo, fazenda_id, texto) values ('car', $1, $2) returning cliente_id, status", [ids.fA, TEXTO]));
  assert.equal(r.rows[0].cliente_id, ids.cA);
  assert.equal(r.rows[0].status, "rascunho_ia");
  await negado(b.como(ia, (q) => q("insert into observacoes_ia (tipo, foto_id, fazenda_id, texto) values ('car', $1, $2, $3)", [ids.foto, ids.fA, TEXTO])));
  await negado(b.como(ia, (q) => q("insert into observacoes_ia (tipo, texto) values ('foto', $1)", [TEXTO])));
  const novo = (await b.como(ia, (q) => criar(q))).rows[0].id;
  await negado(b.como(ia, (q) => q("update observacoes_ia set foto_id = null, fazenda_id = $2, tipo = 'car' where id = $1", [novo, ids.fB])));
});

test("produtor não cria observação; só admin apaga", async () => {
  await negado(b.como(uA, (q) => criar(q)));
  const x = (await b.como(ia, (q) => criar(q))).rows[0].id;
  const f = await b.como(func, (q) => q("delete from observacoes_ia where id = $1", [x]));
  assert.equal(f.rowCount, 0);
  const a = await b.como(admin, (q) => q("delete from observacoes_ia where id = $1", [x]));
  assert.equal(a.rowCount, 1);
});
