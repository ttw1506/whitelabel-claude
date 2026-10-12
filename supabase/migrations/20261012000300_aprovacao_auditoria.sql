-- Soloplan Campo · etapa 1: fluxo de aprovação e auditoria.
--
-- Regra central: nada gerado pela IA chega ao cliente sem aprovação de um admin.
--   * Tudo que a IA cria nasce como rascunho_ia, mesmo que ela peça outro status.
--   * A IA só edita registros que ainda são rascunho_ia, e não muda o status.
--   * Passar para aprovado ou enviado_ao_cliente exige admin, em qualquer tabela.
--     Exceção: lançamento (foto, ocorrência, aplicação, custo) que a própria equipe
--     cria já pode nascer aprovado.
--   * Laudo aprovado só é alterado por admin.
--   * Quem aprovou, quando aprovou e quando enviou são carimbados pelo banco.

create function app.controlar_aprovacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  eh_laudo boolean := tg_argv[0] = 'laudo';
  publicado constant public.status_aprovacao[] := array['aprovado', 'enviado_ao_cliente']::public.status_aprovacao[];
begin
  if tg_op = 'INSERT' then
    new.aprovado_por := null;
    new.aprovado_em := null;
    new.enviado_em := null;
    if app.e_ia() then
      new.status := 'rascunho_ia';
      return new;
    end if;
    if new.status = any (publicado) then
      if eh_laudo and not app.e_admin() then
        raise exception 'Somente um administrador pode aprovar laudos.' using errcode = '42501';
      end if;
      new.aprovado_por := auth.uid();
      new.aprovado_em := now();
      if new.status = 'enviado_ao_cliente' then new.enviado_em := now(); end if;
    end if;
    return new;
  end if;

  -- UPDATE: carimbos nunca vêm do usuário.
  new.aprovado_por := old.aprovado_por;
  new.aprovado_em := old.aprovado_em;
  new.enviado_em := old.enviado_em;

  if app.e_ia() then
    if old.status <> 'rascunho_ia' or new.status <> 'rascunho_ia' then
      raise exception 'A IA só pode editar rascunhos e não pode mudar o status.' using errcode = '42501';
    end if;
    return new;
  end if;

  if eh_laudo and old.status = any (publicado) and not app.e_admin() then
    raise exception 'Laudo aprovado só pode ser alterado por um administrador.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'rascunho_ia' then
      raise exception 'Somente a IA cria rascunhos.' using errcode = '42501';
    end if;
    if new.status = any (publicado) and not app.e_admin() then
      raise exception 'Somente um administrador pode aprovar e enviar ao cliente.' using errcode = '42501';
    end if;
    if new.status = any (publicado) and not (old.status = any (publicado)) then
      new.aprovado_por := auth.uid();
      new.aprovado_em := now();
    end if;
    if new.status = 'enviado_ao_cliente' then
      new.enviado_em := now();
    end if;
    if not (new.status = any (publicado)) then
      new.aprovado_por := null;
      new.aprovado_em := null;
      new.enviado_em := null;
    end if;
  end if;
  return new;
end $$;

create trigger controlar_aprovacao before insert or update on public.ocorrencias for each row execute function app.controlar_aprovacao('lancamento');
create trigger controlar_aprovacao before insert or update on public.fotos for each row execute function app.controlar_aprovacao('lancamento');
create trigger controlar_aprovacao before insert or update on public.aplicacoes for each row execute function app.controlar_aprovacao('lancamento');
create trigger controlar_aprovacao before insert or update on public.custos for each row execute function app.controlar_aprovacao('lancamento');
create trigger controlar_aprovacao before insert or update on public.laudos_solo for each row execute function app.controlar_aprovacao('laudo');
create trigger controlar_aprovacao before insert or update on public.laudos_safra for each row execute function app.controlar_aprovacao('laudo');

-- Criador e autor também não são forjáveis.
create function app.carimbar_criacao() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new := jsonb_populate_record(new, jsonb_build_object('criado_por', auth.uid()));
    if to_jsonb(new) ? 'atualizado_por' then
      new := jsonb_populate_record(new, jsonb_build_object('atualizado_por', auth.uid()));
    end if;
  end if;
  return new;
end $$;

-- Auditoria: quem criou, editou, aprovou e apagou, com o antes e o depois.
create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id uuid,
  papel public.papel,
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index on public.auditoria (tabela, registro_id);
create index on public.auditoria (usuario_id, em desc);

create function app.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  linha jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.auditoria (tabela, registro_id, acao, usuario_id, papel, antes, depois)
  values (
    tg_table_name,
    coalesce(linha ->> 'id', linha ->> 'usuario_id', concat_ws(':', linha ->> 'safra_id', linha ->> 'aplicacao_id', linha ->> 'talhao_id')),
    tg_op,
    auth.uid(),
    app.papel_atual(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes', 'perfis', 'fazendas', 'talhoes', 'safras', 'safra_talhoes', 'ocorrencias', 'fotos',
                           'aplicacoes', 'aplicacao_talhoes', 'custos', 'envios_cliente', 'laudos_solo', 'laudos_safra'] loop
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function app.auditar()', t);
  end loop;
  foreach t in array array['clientes', 'fazendas', 'talhoes', 'safras', 'ocorrencias', 'fotos', 'aplicacoes', 'custos',
                           'envios_cliente', 'laudos_solo', 'laudos_safra'] loop
    execute format('create trigger carimbar_criacao before insert on public.%I for each row execute function app.carimbar_criacao()', t);
  end loop;
end $$;
