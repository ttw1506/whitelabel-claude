-- Soloplan Campo · etapa 1: cadastros, lançamentos, laudos e pedidos do cliente.
-- Toda tabela com dado de cliente tem cliente_id, herdado do registro pai por gatilho.
-- Isso deixa a regra de isolamento simples (cliente_id = cliente do usuário) e impossível de forjar.

create table public.fazendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  municipio text,
  uf char(2),
  codigo_ibge char(7),
  car_numero text,
  area_total_ha numeric(12, 2) check (area_total_ha >= 0),
  app_ha numeric(12, 2) check (app_ha >= 0),
  reserva_legal_ha numeric(12, 2) check (reserva_legal_ha >= 0),
  area_consolidada_ha numeric(12, 2) check (area_consolidada_ha >= 0),
  car_arquivo_path text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.talhoes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  area_ha numeric(12, 2) not null check (area_ha > 0),
  poligono jsonb,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  unique (fazenda_id, nome)
);

create table public.safras (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  ano_agricola text not null check (ano_agricola ~ '^[0-9]{4}/[0-9]{2}$'),
  cultura text not null check (length(trim(cultura)) > 0),
  cultivar text,
  data_plantio date,
  area_ha numeric(12, 2) check (area_ha > 0),
  estadio_atual text,
  status public.status_safra not null default 'em_andamento',
  produtividade_sc_ha numeric(8, 2) check (produtividade_sc_ha >= 0),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.safra_talhoes (
  safra_id uuid not null references public.safras (id) on delete cascade,
  talhao_id uuid not null references public.talhoes (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  primary key (safra_id, talhao_id)
);

create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  safra_id uuid not null references public.safras (id) on delete cascade,
  talhao_id uuid references public.talhoes (id) on delete set null,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  estadio text,
  data date not null default current_date,
  tipo public.tipo_ocorrencia not null,
  nome text not null,
  severidade text,
  acao_tomada text,
  status public.status_aprovacao not null default 'aprovado',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  safra_id uuid not null references public.safras (id) on delete cascade,
  talhao_id uuid references public.talhoes (id) on delete set null,
  ocorrencia_id uuid references public.ocorrencias (id) on delete set null,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  estadio text not null,
  tirada_em timestamptz not null default now(),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  autor_id uuid default auth.uid(),
  anotacao text,
  arquivo_path text not null,
  original_path text,
  status public.status_aprovacao not null default 'aprovado',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.aplicacoes (
  id uuid primary key default gen_random_uuid(),
  safra_id uuid not null references public.safras (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  data date not null,
  tipo_operacao text not null,
  produto text,
  ingrediente_ativo text,
  dose numeric(12, 4) check (dose >= 0),
  dose_unidade text,
  area_ha numeric(12, 2) check (area_ha > 0),
  custo numeric(14, 2) check (custo >= 0),
  status public.status_aprovacao not null default 'aprovado',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.aplicacao_talhoes (
  aplicacao_id uuid not null references public.aplicacoes (id) on delete cascade,
  talhao_id uuid not null references public.talhoes (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  primary key (aplicacao_id, talhao_id)
);

create table public.custos (
  id uuid primary key default gen_random_uuid(),
  safra_id uuid not null references public.safras (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  aplicacao_id uuid references public.aplicacoes (id) on delete set null,
  categoria public.categoria_custo not null,
  descricao text not null,
  valor numeric(14, 2) not null check (valor >= 0),
  data date not null default current_date,
  status public.status_aprovacao not null default 'aprovado',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

-- Pedidos que o cliente faz: laudo parcial e envio de laudo de solo.
create table public.envios_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo public.tipo_envio not null,
  fazenda_id uuid references public.fazendas (id) on delete cascade,
  safra_id uuid references public.safras (id) on delete cascade,
  arquivo_path text,
  mensagem text,
  status public.status_envio not null default 'aberto',
  atendido_por uuid,
  atendido_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  constraint envio_completo check (
    (tipo = 'pedido_laudo_parcial' and safra_id is not null)
    or (tipo = 'laudo_solo' and fazenda_id is not null and arquivo_path is not null)
  )
);

create table public.laudos_solo (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas (id) on delete cascade,
  talhao_id uuid references public.talhoes (id) on delete set null,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  envio_id uuid references public.envios_cliente (id) on delete set null,
  data_coleta date,
  profundidade public.profundidade_solo not null,
  laboratorio text,
  arquivo_path text,
  valores jsonb not null default '{}',
  analise jsonb,
  recomendacao text,
  status public.status_aprovacao not null default 'em_revisao',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.laudos_safra (
  id uuid primary key default gen_random_uuid(),
  safra_id uuid not null references public.safras (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo public.tipo_laudo_safra not null,
  conteudo jsonb not null default '{}',
  pdf_path text,
  status public.status_aprovacao not null default 'em_revisao',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

-- Índices de acesso por cliente e por safra.
create index on public.fazendas (cliente_id);
create index on public.talhoes (fazenda_id);
create index on public.talhoes (cliente_id);
create index on public.safras (fazenda_id);
create index on public.safras (cliente_id);
create index on public.safra_talhoes (cliente_id);
create index on public.ocorrencias (safra_id);
create index on public.ocorrencias (cliente_id);
create index on public.fotos (safra_id);
create index on public.fotos (cliente_id);
create index on public.aplicacoes (safra_id);
create index on public.aplicacoes (cliente_id);
create index on public.aplicacao_talhoes (cliente_id);
create index on public.custos (safra_id);
create index on public.custos (cliente_id);
create index on public.envios_cliente (cliente_id, status);
create index on public.laudos_solo (fazenda_id);
create index on public.laudos_solo (cliente_id, status);
create index on public.laudos_safra (safra_id);
create index on public.laudos_safra (cliente_id, status);

-- Herda cliente_id do registro pai. TG_ARGV: tabela pai, coluna com o id do pai.
-- O vínculo com o pai não muda depois de criado, para os filhos nunca ficarem com o cliente errado.
create function app.herdar_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pai_id uuid := (to_jsonb(new) ->> tg_argv[1])::uuid;
  dono uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) ->> tg_argv[1]) is distinct from (to_jsonb(new) ->> tg_argv[1]) then
    raise exception 'O vínculo com % não pode ser alterado depois de criado.', tg_argv[0] using errcode = '22023';
  end if;
  execute format('select cliente_id from public.%I where id = $1', tg_argv[0]) into dono using pai_id;
  if dono is null then
    raise exception 'Registro pai não encontrado em %.', tg_argv[0] using errcode = '23503';
  end if;
  new := jsonb_populate_record(new, jsonb_build_object('cliente_id', dono));
  return new;
end $$;

-- Fazenda não troca de cliente (os filhos herdam o cliente dela).
create function app.fixar_cliente_fazenda() returns trigger language plpgsql as $$
begin
  if new.cliente_id is distinct from old.cliente_id then
    raise exception 'A fazenda não pode mudar de cliente.' using errcode = '22023';
  end if;
  return new;
end $$;

-- Talhão citado precisa ser da mesma fazenda da safra.
create function app.conferir_talhao_da_fazenda() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fazenda_da_safra uuid;
  fazenda_do_talhao uuid;
begin
  if new.talhao_id is null then return new; end if;
  select s.fazenda_id into fazenda_da_safra
    from public.safras s
    where s.id = coalesce((to_jsonb(new) ->> 'safra_id')::uuid,
                          (select a.safra_id from public.aplicacoes a where a.id = (to_jsonb(new) ->> 'aplicacao_id')::uuid));
  select t.fazenda_id into fazenda_do_talhao from public.talhoes t where t.id = new.talhao_id;
  if fazenda_da_safra is distinct from fazenda_do_talhao then
    raise exception 'O talhão não pertence à fazenda desta safra.' using errcode = '23514';
  end if;
  return new;
end $$;

-- Pedido do cliente herda o cliente da safra ou da fazenda; safra e fazenda precisam bater.
create function app.herdar_cliente_envio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c_safra uuid;
  c_fazenda uuid;
begin
  select cliente_id into c_safra from public.safras where id = new.safra_id;
  select cliente_id into c_fazenda from public.fazendas where id = new.fazenda_id;
  if new.safra_id is not null and c_safra is null or new.fazenda_id is not null and c_fazenda is null then
    raise exception 'Safra ou fazenda não encontrada.' using errcode = '23503';
  end if;
  if c_safra is not null and c_fazenda is not null and c_safra <> c_fazenda then
    raise exception 'A safra não é desta fazenda.' using errcode = '23514';
  end if;
  new.cliente_id := coalesce(c_safra, c_fazenda);
  return new;
end $$;

create trigger fixar_cliente before update on public.fazendas for each row execute function app.fixar_cliente_fazenda();
create trigger herdar_cliente before insert or update on public.talhoes for each row execute function app.herdar_cliente('fazendas', 'fazenda_id');
create trigger herdar_cliente before insert or update on public.safras for each row execute function app.herdar_cliente('fazendas', 'fazenda_id');
create trigger herdar_cliente before insert or update on public.safra_talhoes for each row execute function app.herdar_cliente('safras', 'safra_id');
create trigger herdar_cliente before insert or update on public.ocorrencias for each row execute function app.herdar_cliente('safras', 'safra_id');
create trigger herdar_cliente before insert or update on public.fotos for each row execute function app.herdar_cliente('safras', 'safra_id');
create trigger herdar_cliente before insert or update on public.aplicacoes for each row execute function app.herdar_cliente('safras', 'safra_id');
create trigger herdar_cliente before insert or update on public.aplicacao_talhoes for each row execute function app.herdar_cliente('aplicacoes', 'aplicacao_id');
create trigger herdar_cliente before insert or update on public.custos for each row execute function app.herdar_cliente('safras', 'safra_id');
create trigger herdar_cliente before insert or update on public.laudos_solo for each row execute function app.herdar_cliente('fazendas', 'fazenda_id');
create trigger herdar_cliente before insert or update on public.laudos_safra for each row execute function app.herdar_cliente('safras', 'safra_id');
create trigger herdar_cliente before insert or update on public.envios_cliente for each row execute function app.herdar_cliente_envio();

create trigger talhao_da_fazenda before insert or update on public.safra_talhoes for each row execute function app.conferir_talhao_da_fazenda();
create trigger talhao_da_fazenda before insert or update on public.ocorrencias for each row execute function app.conferir_talhao_da_fazenda();
create trigger talhao_da_fazenda before insert or update on public.fotos for each row execute function app.conferir_talhao_da_fazenda();
create trigger talhao_da_fazenda before insert or update on public.aplicacao_talhoes for each row execute function app.conferir_talhao_da_fazenda();

create function app.conferir_talhao_laudo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.talhao_id is not null and not exists (
    select 1 from public.talhoes where id = new.talhao_id and fazenda_id = new.fazenda_id
  ) then
    raise exception 'O talhão não pertence a esta fazenda.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger talhao_da_fazenda before insert or update on public.laudos_solo for each row execute function app.conferir_talhao_laudo();

do $$
declare t text;
begin
  foreach t in array array['fazendas', 'talhoes', 'safras', 'ocorrencias', 'fotos', 'aplicacoes', 'custos', 'laudos_solo', 'laudos_safra'] loop
    execute format('create trigger tocar before update on public.%I for each row execute function app.tocar()', t);
  end loop;
end $$;
