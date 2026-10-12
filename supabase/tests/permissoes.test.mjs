// Etapa 1: perfis, permissões e isolamento entre clientes, testados no próprio banco.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBanco } from "./_banco.mjs";

let b, admin, func, ia, semVinculo, uA, uB;
const ids = {};

const negado = (p) => assert.rejects(p, (e) => /row-level security|Somente|IA só|não pode|permission denied|Laudo aprovado/.test(e.message));
const contar = async (q, tabela) => Number((await q(`select count(*) from ${tabela}`)).rows[0].count);

before(async () => {
  b = await criarBanco();
  admin = await b.usuario("Luciano Batata", "admin");
  func = await b.usuario("Funcionário 1", "funcionario");
  ia = await b.usuario("IA do escritório", "ia");
  semVinculo = await b.usuario("Cadastro novo", null);

  await b.como(admin, async (q) => {
    ids.cA = (await q("insert into clientes (nome, cpf_cnpj) values ('Produtor A', '111') returning id")).rows[0].id;
    ids.cB = (await q("insert into clientes (nome, cpf_cnpj) values ('Produtor B', '222') returning id")).rows[0].id;
    ids.fA = (await q("insert into fazendas (cliente_id, nome, area_total_ha) values ($1, 'Boa Vista', 500) returning id", [ids.cA])).rows[0].id;
    ids.fB = (await q("insert into fazendas (cliente_id, nome, area_total_ha) values ($1, 'Santa Fé', 300) returning id", [ids.cB])).rows[0].id;
    ids.tA = (await q("insert into talhoes (fazenda_id, nome, area_ha) values ($1, 'T1', 80) returning id", [ids.fA])).rows[0].id;
    ids.tB = (await q("insert into talhoes (fazenda_id, nome, area_ha) values ($1, 'T1', 60) returning id", [ids.fB])).rows[0].id;
    ids.sA = (await q("insert into safras (fazenda_id, ano_agricola, cultura) values ($1, '2025/26', 'Soja') returning id", [ids.fA])).rows[0].id;
    ids.sB = (await q("insert into safras (fazenda_id, ano_agricola, cultura) values ($1, '2025/26', 'Soja') returning id", [ids.fB])).rows[0].id;
    await q("insert into safra_talhoes (safra_id, talhao_id) values ($1, $2)", [ids.sA, ids.tA]);
    await q("insert into custos (safra_id, categoria, descricao, valor) values ($1, 'sementes', 'Semente A', 1000), ($2, 'sementes', 'Semente B', 2000)", [ids.sA, ids.sB]);
    await q("insert into fotos (safra_id, talhao_id, estadio, arquivo_path) values ($1, $2, 'V3', 'a/v3.jpg')", [ids.sA, ids.tA]);
    ids.laudoA = (await q("insert into laudos_safra (safra_id, tipo) values ($1, 'parcial') returning id", [ids.sA])).rows[0].id;
    await q("insert into laudos_safra (safra_id, tipo, status) values ($1, 'final', 'enviado_ao_cliente')", [ids.sB]);
  });
  uA = await b.usuario("Produtor A", "cliente", ids.cA);
  uB = await b.usuario("Produtor B", "cliente", ids.cB);
});

after(async () => b && b.encerrar());

test("cliente A só enxerga os próprios cadastros", async () => {
  await b.como(uA, async (q) => {
    assert.deepEqual((await q("select nome from clientes")).rows.map((r) => r.nome), ["Produtor A"]);
    assert.deepEqual((await q("select nome from fazendas")).rows.map((r) => r.nome), ["Boa Vista"]);
    assert.equal(await contar(q, "talhoes"), 1);
    assert.equal(await contar(q, "safras"), 1);
    assert.equal(await contar(q, "safra_talhoes"), 1);
    assert.deepEqual((await q("select descricao from custos")).rows.map((r) => r.descricao), ["Semente A"]);
    assert.equal((await q("select count(*) from fazendas where id = $1", [ids.fB])).rows[0].count, "0");
  });
});

test("cliente B não vê nada do cliente A, nem buscando pelo id", async () => {
  await b.como(uB, async (q) => {
    for (const [tabela, id] of [["clientes", ids.cA], ["fazendas", ids.fA], ["talhoes", ids.tA], ["safras", ids.sA]]) {
      assert.equal((await q(`select count(*) from ${tabela} where id = $1`, [id])).rows[0].count, "0", tabela);
    }
    assert.equal((await q("select count(*) from custos where safra_id = $1", [ids.sA])).rows[0].count, "0");
    assert.equal((await q("select count(*) from fotos where safra_id = $1", [ids.sA])).rows[0].count, "0");
  });
});

test("cliente não altera, não cria e não apaga cadastros", async () => {
  await b.como(uA, async (q) => {
    assert.equal((await q("update fazendas set nome = 'X' where id = $1", [ids.fA])).rowCount, 0);
    assert.equal((await q("delete from safras where id = $1", [ids.sA])).rowCount, 0);
  });
  await negado(b.como(uA, (q) => q("insert into fazendas (cliente_id, nome) values ($1, 'Nova')", [ids.cA])));
  await negado(b.como(uA, (q) => q("insert into custos (safra_id, categoria, descricao, valor) values ($1, 'outros', 'x', 1)", [ids.sA])));
});

test("cliente não consegue se promover nem trocar de cliente", async () => {
  await b.como(uA, async (q) => {
    assert.equal((await q("update perfis set papel = 'admin' where usuario_id = $1", [uA])).rowCount, 0);
    assert.equal((await q("update perfis set cliente_id = $2 where usuario_id = $1", [uA, ids.cB])).rowCount, 0);
    assert.equal(await contar(q, "perfis"), 1, "só vê o próprio perfil");
  });
});

test("usuário recém-criado sem vínculo e visitante anônimo não veem nada", async () => {
  await b.como(semVinculo, async (q) => {
    for (const t of ["clientes", "fazendas", "safras", "custos", "laudos_safra"]) assert.equal(await contar(q, t), 0, t);
  });
  await assert.rejects(b.como(null, (q) => q("select * from clientes")), /permission denied/);
});

test("cliente só vê laudo depois de enviado ao cliente", async () => {
  await b.como(uA, async (q) => assert.equal(await contar(q, "laudos_safra"), 0));
  await b.como(uB, async (q) => assert.deepEqual((await q("select tipo from laudos_safra")).rows.map((r) => r.tipo), ["final"]));
});

test("funcionário cadastra e edita, mas não aprova laudo, não apaga e não gerencia usuários", async () => {
  await b.como(func, async (q) => {
    const f = (await q("insert into fazendas (cliente_id, nome) values ($1, 'Retiro') returning id", [ids.cA])).rows[0].id;
    assert.equal((await q("update fazendas set municipio = 'Quirinópolis' where id = $1", [f])).rowCount, 1);
    assert.equal(await contar(q, "clientes"), 2);
    assert.equal((await q("delete from fazendas where id = $1", [f])).rowCount, 0, "não apaga");
    const t2 = (await q("insert into talhoes (fazenda_id, nome, area_ha) values ($1, 'T2', 20) returning id", [ids.fA])).rows[0].id;
    await q("insert into safra_talhoes (safra_id, talhao_id) values ($1, $2)", [ids.sA, t2]);
    assert.equal((await q("delete from safra_talhoes where safra_id = $1 and talhao_id = $2", [ids.sA, t2])).rowCount, 1, "desmarca talhão da safra");
    assert.equal((await q("update perfis set papel = 'admin' where usuario_id = $1", [func])).rowCount, 0, "não se promove");
  });
  await negado(b.como(func, (q) => q("update laudos_safra set status = 'aprovado' where id = $1", [ids.laudoA])));
  await negado(b.como(func, (q) => q("insert into laudos_safra (safra_id, tipo, status) values ($1, 'final', 'enviado_ao_cliente')", [ids.sA])));
  await negado(b.como(func, (q) => q("insert into perfis (usuario_id, nome) values (gen_random_uuid(), 'x')")));
});

test("admin aprova e envia o laudo; o banco carimba quem e quando", async () => {
  const r = await b.como(admin, (q) => q(
    "update laudos_safra set status = 'enviado_ao_cliente', aprovado_por = gen_random_uuid() where id = $1 returning aprovado_por, aprovado_em, enviado_em", [ids.laudoA]));
  assert.equal(r.rows[0].aprovado_por, admin, "carimbo não pode ser forjado");
  assert.ok(r.rows[0].aprovado_em && r.rows[0].enviado_em);
  await b.como(uA, async (q) => assert.equal(await contar(q, "laudos_safra"), 1));
  await negado(b.como(func, (q) => q("update laudos_safra set conteudo = '{\"x\":1}' where id = $1", [ids.laudoA])));
});

test("tudo que a IA cria nasce como rascunho e o cliente não vê", async () => {
  const id = await b.como(ia, async (q) => {
    assert.ok((await contar(q, "clientes")) >= 2, "IA lê os dados");
    return (await q("insert into custos (safra_id, categoria, descricao, valor, status) values ($1, 'defensivos', 'Fungicida', 500, 'aprovado') returning id, status", [ids.sA])).rows[0];
  });
  assert.equal(id.status, "rascunho_ia");
  const laudo = await b.como(ia, (q) => q("insert into laudos_safra (safra_id, tipo, status) values ($1, 'final', 'enviado_ao_cliente') returning status", [ids.sA]));
  assert.equal(laudo.rows[0].status, "rascunho_ia");
  await b.como(uA, async (q) => {
    assert.equal((await q("select count(*) from custos where id = $1", [id.id])).rows[0].count, "0");
  });
  await negado(b.como(ia, (q) => q("update custos set status = 'aprovado' where id = $1", [id.id])));
  await negado(b.como(func, (q) => q("update custos set status = 'aprovado' where id = $1", [id.id])));
  await b.como(admin, (q) => q("update custos set status = 'aprovado' where id = $1", [id.id]));
  await b.como(uA, async (q) => assert.equal((await q("select count(*) from custos where id = $1", [id.id])).rows[0].count, "1"));
});

test("IA não cadastra clientes, fazendas nem fotos, não apaga e não mexe em rascunho já revisado", async () => {
  await negado(b.como(ia, (q) => q("insert into clientes (nome) values ('x')")));
  await negado(b.como(ia, (q) => q("insert into fazendas (cliente_id, nome) values ($1, 'x')", [ids.cA])));
  await negado(b.como(ia, (q) => q("insert into fotos (safra_id, estadio, arquivo_path) values ($1, 'V1', 'x.jpg')", [ids.sA])));
  await b.como(ia, async (q) => assert.equal((await q("delete from custos where safra_id = $1", [ids.sA])).rowCount, 0));
  await b.como(ia, async (q) => assert.equal((await q("update laudos_safra set conteudo = '{}' where id = $1", [ids.laudoA])).rowCount, 0));
});

test("cliente_id é herdado do pai e não pode ser forjado", async () => {
  const t = await b.como(admin, (q) => q("insert into talhoes (fazenda_id, cliente_id, nome, area_ha) values ($1, $2, 'T9', 10) returning cliente_id", [ids.fA, ids.cB]));
  assert.equal(t.rows[0].cliente_id, ids.cA);
  await assert.rejects(b.como(admin, (q) => q("update safras set fazenda_id = $2 where id = $1", [ids.sA, ids.fB])), /não pode ser alterado/);
  await assert.rejects(b.como(admin, (q) => q("update fazendas set cliente_id = $2 where id = $1", [ids.fA, ids.cB])), /não pode mudar de cliente/);
  await assert.rejects(b.como(admin, (q) => q("insert into safra_talhoes (safra_id, talhao_id) values ($1, $2)", [ids.sA, ids.tB])), /não pertence/);
});

test("cliente pede laudo parcial e envia laudo de solo só para as próprias safras e fazendas", async () => {
  await b.como(uA, (q) => q("insert into envios_cliente (tipo, safra_id, mensagem) values ('pedido_laudo_parcial', $1, 'Quero o parcial')", [ids.sA]));
  await b.como(uA, (q) => q("insert into envios_cliente (tipo, fazenda_id, arquivo_path) values ('laudo_solo', $1, 'a/laudo.pdf')", [ids.fA]));
  await negado(b.como(uA, (q) => q("insert into envios_cliente (tipo, safra_id) values ('pedido_laudo_parcial', $1)", [ids.sB])));
  await negado(b.como(uA, (q) => q("insert into envios_cliente (tipo, safra_id, status) values ('pedido_laudo_parcial', $1, 'concluido')", [ids.sA])));
  await b.como(uB, async (q) => assert.equal(await contar(q, "envios_cliente"), 0));
  await b.como(func, async (q) => assert.equal(await contar(q, "envios_cliente"), 2));
});

test("auditoria registra quem fez o quê; só admin lê", async () => {
  await b.como(admin, async (q) => {
    const r = await q("select acao, papel from auditoria where tabela = 'laudos_safra' and registro_id = $1 order by id", [ids.laudoA]);
    assert.deepEqual(r.rows.map((x) => `${x.acao}:${x.papel}`), ["INSERT:admin", "UPDATE:admin"]);
    const f = await q("select count(*) from auditoria where tabela = 'fazendas' and papel = 'funcionario' and acao = 'INSERT'");
    assert.equal(f.rows[0].count, "1");
  });
  for (const u of [func, ia, uA]) await b.como(u, async (q) => assert.equal(await contar(q, "auditoria"), 0));
  await assert.rejects(b.como(admin, (q) => q("delete from auditoria")), /permission denied/);
});

test("custo da aplicação vira lançamento de custo e acompanha a aplicação", async () => {
  const ap = await b.como(func, (q) => q(
    "insert into aplicacoes (safra_id, data, tipo_operacao, produto, custo, categoria_custo) values ($1, '2026-11-20', 'Pulverização', 'Fungicida X', 1500, 'defensivos') returning id", [ids.sA]));
  const id = ap.rows[0].id;
  const custo = async () => (await b.como(admin, (q) => q("select categoria, descricao, valor::float, status from custos where aplicacao_id = $1", [id]))).rows;
  assert.deepEqual(await custo(), [{ categoria: "defensivos", descricao: "Pulverização · Fungicida X", valor: 1500, status: "aprovado" }]);
  await b.como(func, (q) => q("update aplicacoes set custo = 1800 where id = $1", [id]));
  assert.equal((await custo())[0].valor, 1800);
  await assert.rejects(b.como(func, (q) => q("update custos set valor = 1 where aplicacao_id = $1", [id])), /vem de uma aplicação/);
  await b.como(func, (q) => q("update aplicacoes set custo = null where id = $1", [id]));
  assert.deepEqual(await custo(), []);
});

test("aplicação criada pela IA gera custo em rascunho, invisível ao cliente até o admin aprovar", async () => {
  const ap = await b.como(ia, (q) => q(
    "insert into aplicacoes (safra_id, data, tipo_operacao, custo) values ($1, '2026-11-25', 'Adubação de cobertura', 900) returning id, status", [ids.sA]));
  assert.equal(ap.rows[0].status, "rascunho_ia");
  const id = ap.rows[0].id;
  await b.como(uA, async (q) => assert.equal((await q("select count(*) from custos where aplicacao_id = $1", [id])).rows[0].count, "0"));
  await b.como(admin, (q) => q("update aplicacoes set status = 'aprovado' where id = $1", [id]));
  await b.como(uA, async (q) => assert.equal((await q("select count(*) from custos where aplicacao_id = $1", [id])).rows[0].count, "1"));
});
