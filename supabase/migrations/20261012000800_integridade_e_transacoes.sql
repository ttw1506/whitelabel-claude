-- Transações com as permissões e RLS do usuário, inclusive para funcionários.
create function public.salvar_safra_com_talhoes(p_id uuid, p_fazenda_id uuid, p_dados jsonb, p_talhoes uuid[])
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare dados public.safras; resultado uuid; area numeric;
begin
  if not app.e_equipe() then raise exception 'Você não tem permissão.' using errcode = '42501'; end if;
  if coalesce(cardinality(p_talhoes), 0) = 0 then raise exception 'Escolha pelo menos um talhão.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_talhoes) t(id) where not exists (
    select 1 from public.talhoes where id = t.id and fazenda_id = p_fazenda_id
  )) then raise exception 'O talhão não pertence a esta fazenda.' using errcode = '23514'; end if;
  dados := jsonb_populate_record(null::public.safras, p_dados);
  select sum(area_ha) into area from public.talhoes where id = any(p_talhoes);
  if p_id is null then
    insert into public.safras (fazenda_id, ano_agricola, cultura, cultivar, data_plantio, status, area_ha, estadio_atual, produtividade_sc_ha)
    values (p_fazenda_id, dados.ano_agricola, dados.cultura, dados.cultivar, dados.data_plantio,
      coalesce(dados.status, 'em_andamento'), coalesce(dados.area_ha, area), dados.estadio_atual, dados.produtividade_sc_ha)
    returning id into resultado;
  else
    perform 1 from public.safras where id = p_id and fazenda_id = p_fazenda_id for update;
    if not found then raise exception 'Safra não encontrada.' using errcode = '22023'; end if;
    update public.safras set ano_agricola = dados.ano_agricola, cultura = dados.cultura, cultivar = dados.cultivar,
      data_plantio = dados.data_plantio, status = coalesce(dados.status, 'em_andamento'), area_ha = coalesce(dados.area_ha, area),
      estadio_atual = dados.estadio_atual, produtividade_sc_ha = dados.produtividade_sc_ha
    where id = p_id returning id into resultado;
  end if;
  delete from public.safra_talhoes where safra_id = resultado and not (talhao_id = any(p_talhoes));
  insert into public.safra_talhoes (safra_id, talhao_id)
    select resultado, t from (select distinct unnest(p_talhoes) as t) escolhidos on conflict do nothing;
  return resultado;
end $$;

create function public.salvar_aplicacao_com_talhoes(p_safra_id uuid, p_dados jsonb, p_talhoes uuid[])
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare dados public.aplicacoes; resultado uuid; fazenda uuid; area numeric;
begin
  if not app.e_equipe() then raise exception 'Você não tem permissão.' using errcode = '42501'; end if;
  select fazenda_id into fazenda from public.safras where id = p_safra_id;
  if fazenda is null then raise exception 'Safra não encontrada.' using errcode = '22023'; end if;
  if coalesce(cardinality(p_talhoes), 0) = 0 then raise exception 'Escolha pelo menos um talhão.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_talhoes) t(id) where not exists (
    select 1 from public.talhoes where id = t.id and fazenda_id = fazenda
  )) then raise exception 'O talhão não pertence à fazenda desta safra.' using errcode = '23514'; end if;
  dados := jsonb_populate_record(null::public.aplicacoes, p_dados);
  select sum(area_ha) into area from public.talhoes where id = any(p_talhoes);
  insert into public.aplicacoes (safra_id, data, tipo_operacao, categoria_custo, produto, ingrediente_ativo, dose, dose_unidade, area_ha, custo)
  values (p_safra_id, dados.data, dados.tipo_operacao, coalesce(dados.categoria_custo, 'defensivos'), dados.produto,
    dados.ingrediente_ativo, dados.dose, dados.dose_unidade, coalesce(dados.area_ha, area), dados.custo)
  returning id into resultado;
  insert into public.aplicacao_talhoes (aplicacao_id, talhao_id)
    select resultado, t from (select distinct unnest(p_talhoes) as t) escolhidos;
  return resultado;
end $$;
revoke all on function public.salvar_safra_com_talhoes(uuid, uuid, jsonb, uuid[]) from public;
revoke all on function public.salvar_aplicacao_com_talhoes(uuid, jsonb, uuid[]) from public;
grant execute on function public.salvar_safra_com_talhoes(uuid, uuid, jsonb, uuid[]) to authenticated;
grant execute on function public.salvar_aplicacao_com_talhoes(uuid, jsonb, uuid[]) to authenticated;

-- Valida a fazenda em si, não apenas seu cliente proprietário.
create or replace function app.herdar_cliente_envio() returns trigger
language plpgsql security definer set search_path = public as $$
declare c_safra uuid; c_fazenda uuid; fazenda_da_safra uuid;
begin
  if tg_op = 'UPDATE' and (new.safra_id is distinct from old.safra_id or new.fazenda_id is distinct from old.fazenda_id or new.tipo is distinct from old.tipo) then
    raise exception 'O vínculo do pedido não pode ser alterado.' using errcode = '22023';
  end if;
  select cliente_id, fazenda_id into c_safra, fazenda_da_safra from public.safras where id = new.safra_id;
  select cliente_id into c_fazenda from public.fazendas where id = new.fazenda_id;
  if (new.safra_id is not null and c_safra is null) or (new.fazenda_id is not null and c_fazenda is null) then
    raise exception 'Safra ou fazenda não encontrada.' using errcode = '23503';
  end if;
  if new.safra_id is not null and new.fazenda_id is not null and fazenda_da_safra <> new.fazenda_id then
    raise exception 'A safra não é desta fazenda.' using errcode = '23514';
  end if;
  new.cliente_id := coalesce(c_safra, c_fazenda);
  if tg_op = 'INSERT' and not app.e_equipe() then
    new.atendido_por := null;
    new.atendido_em := null;
  end if;
  return new;
end $$;

create function app.conferir_vinculos_adicionais() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'fotos' then
    if new.ocorrencia_id is not null and not exists (select 1 from public.ocorrencias where id = new.ocorrencia_id and safra_id = new.safra_id) then
      raise exception 'A ocorrência não pertence a esta safra.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'laudos_solo' then
    if new.envio_id is not null and not exists (select 1 from public.envios_cliente where id = new.envio_id and tipo = 'laudo_solo' and fazenda_id = new.fazenda_id) then
      raise exception 'O envio não pertence a esta fazenda.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'custos' then
    if new.aplicacao_id is not null and not exists (select 1 from public.aplicacoes where id = new.aplicacao_id and safra_id = new.safra_id) then
      raise exception 'A aplicação não pertence a esta safra.' using errcode = '23514';
    end if;
    if new.aplicacao_id is not null and pg_trigger_depth() = 1 then
      raise exception 'Este custo vem de uma aplicação. Altere a aplicação.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger conferir_vinculos before insert or update on public.fotos for each row execute function app.conferir_vinculos_adicionais();
create trigger conferir_vinculos before insert or update on public.laudos_solo for each row execute function app.conferir_vinculos_adicionais();
create trigger conferir_vinculos before insert or update on public.custos for each row execute function app.conferir_vinculos_adicionais();

-- Ao editar conteúdo já aprovado, exige nova revisão e invalida o PDF anterior.
-- O nome do gatilho garante que ele rode antes de controlar_aprovacao.
create function app.revisar_laudo_editado() returns trigger language plpgsql as $$
begin
  if old.status in ('aprovado', 'enviado_ao_cliente') and app.e_admin() and
    (to_jsonb(new) - array['status','pdf_path','aprovado_por','aprovado_em','enviado_em','atualizado_em','atualizado_por'])
    is distinct from
    (to_jsonb(old) - array['status','pdf_path','aprovado_por','aprovado_em','enviado_em','atualizado_em','atualizado_por']) then
    new.status := 'em_revisao';
    new.pdf_path := null;
  end if;
  return new;
end $$;
create trigger aa_revisar_conteudo before update on public.laudos_solo for each row execute function app.revisar_laudo_editado();
create trigger aa_revisar_conteudo before update on public.laudos_safra for each row execute function app.revisar_laudo_editado();
