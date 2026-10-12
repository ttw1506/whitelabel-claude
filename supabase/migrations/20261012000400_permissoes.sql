-- Soloplan Campo · etapa 1: permissões no banco (row level security).
--
--   admin        lê e escreve tudo, aprova, apaga, gerencia usuários, lê a auditoria
--   funcionario  lê tudo, cadastra e edita; não aprova laudo, não apaga, não gerencia usuários
--   ia           lê tudo; só cria e edita rascunhos (ocorrência, aplicação, custo, laudos)
--   cliente      lê só os próprios dados, e só o que foi aprovado; laudos só depois de enviados;
--                cria pedidos (laudo parcial, envio de laudo de solo) para si mesmo
--   anônimo      nada

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.auditoria from authenticated;

do $$
declare t text;
begin
  foreach t in array array['clientes', 'perfis', 'fazendas', 'talhoes', 'safras', 'safra_talhoes', 'ocorrencias', 'fotos',
                           'aplicacoes', 'aplicacao_talhoes', 'custos', 'envios_cliente', 'laudos_solo', 'laudos_safra', 'auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Perfis
create policy perfis_ler on public.perfis for select to authenticated
  using (usuario_id = auth.uid() or app.e_equipe());
create policy perfis_admin_criar on public.perfis for insert to authenticated with check (app.e_admin());
create policy perfis_admin_editar on public.perfis for update to authenticated using (app.e_admin()) with check (app.e_admin());
create policy perfis_admin_apagar on public.perfis for delete to authenticated using (app.e_admin());

-- Clientes
create policy clientes_ler on public.clientes for select to authenticated
  using (app.le_tudo() or id = app.cliente_atual());
create policy clientes_criar on public.clientes for insert to authenticated with check (app.e_equipe());
create policy clientes_editar on public.clientes for update to authenticated using (app.e_equipe()) with check (app.e_equipe());
create policy clientes_apagar on public.clientes for delete to authenticated using (app.e_admin());

-- Cadastros do cliente (sem status): o cliente lê os próprios; a equipe edita.
do $$
declare t text;
begin
  foreach t in array array['fazendas', 'talhoes', 'safras', 'safra_talhoes'] loop
    execute format($p$create policy ler on public.%I for select to authenticated
      using (app.le_tudo() or cliente_id = app.cliente_atual())$p$, t);
    execute format('create policy criar on public.%I for insert to authenticated with check (app.e_equipe())', t);
    execute format('create policy editar on public.%I for update to authenticated using (app.e_equipe()) with check (app.e_equipe())', t);
    execute format('create policy apagar on public.%I for delete to authenticated using (app.e_admin())', t);
  end loop;
end $$;

-- Lançamentos: o cliente vê os próprios já aprovados. A IA cria e edita rascunhos.
do $$
declare t text;
begin
  foreach t in array array['ocorrencias', 'fotos', 'aplicacoes', 'custos'] loop
    execute format($p$create policy ler on public.%I for select to authenticated
      using (app.le_tudo() or (cliente_id = app.cliente_atual() and status in ('aprovado', 'enviado_ao_cliente')))$p$, t);
    execute format('create policy apagar on public.%I for delete to authenticated using (app.e_admin())', t);
  end loop;
  -- Foto é registro de campo: só a equipe cria.
  execute $p$create policy criar on public.fotos for insert to authenticated with check (app.e_equipe())$p$;
  execute $p$create policy editar on public.fotos for update to authenticated using (app.e_equipe()) with check (app.e_equipe())$p$;
  foreach t in array array['ocorrencias', 'aplicacoes', 'custos'] loop
    execute format('create policy criar on public.%I for insert to authenticated with check (app.e_equipe() or app.e_ia())', t);
    execute format($p$create policy editar on public.%I for update to authenticated
      using (app.e_equipe() or (app.e_ia() and status = 'rascunho_ia'))
      with check (app.e_equipe() or app.e_ia())$p$, t);
  end loop;
end $$;

-- Talhões de uma aplicação: visíveis se a aplicação for visível; a IA só liga talhões a rascunho dela.
create policy ler on public.aplicacao_talhoes for select to authenticated
  using (app.le_tudo() or exists (select 1 from public.aplicacoes a where a.id = aplicacao_id));
create policy criar on public.aplicacao_talhoes for insert to authenticated
  with check (app.e_equipe() or (app.e_ia() and exists (
    select 1 from public.aplicacoes a where a.id = aplicacao_id and a.status = 'rascunho_ia')));
create policy apagar on public.aplicacao_talhoes for delete to authenticated
  using (app.e_equipe() or (app.e_ia() and exists (
    select 1 from public.aplicacoes a where a.id = aplicacao_id and a.status = 'rascunho_ia')));

-- Laudos: o cliente só vê depois de enviado.
do $$
declare t text;
begin
  foreach t in array array['laudos_solo', 'laudos_safra'] loop
    execute format($p$create policy ler on public.%I for select to authenticated
      using (app.le_tudo() or (cliente_id = app.cliente_atual() and status = 'enviado_ao_cliente'))$p$, t);
    execute format('create policy criar on public.%I for insert to authenticated with check (app.e_equipe() or app.e_ia())', t);
    execute format($p$create policy editar on public.%I for update to authenticated
      using (app.e_equipe() or (app.e_ia() and status = 'rascunho_ia'))
      with check (app.e_equipe() or app.e_ia())$p$, t);
    execute format('create policy apagar on public.%I for delete to authenticated using (app.e_admin())', t);
  end loop;
end $$;

-- Pedidos do cliente
create policy ler on public.envios_cliente for select to authenticated
  using (app.le_tudo() or cliente_id = app.cliente_atual());
create policy criar on public.envios_cliente for insert to authenticated
  with check (app.e_equipe() or (cliente_id = app.cliente_atual() and status = 'aberto'));
create policy editar on public.envios_cliente for update to authenticated using (app.e_equipe()) with check (app.e_equipe());
create policy apagar on public.envios_cliente for delete to authenticated using (app.e_admin());

-- Auditoria: só admin lê. Ninguém escreve direto (o gatilho grava).
create policy ler on public.auditoria for select to authenticated using (app.e_admin());
