-- Soloplan Campo · etapa 1: tipos, perfis e funções de permissão.
create extension if not exists pgcrypto;

create schema if not exists app;

create type public.papel as enum ('admin', 'funcionario', 'cliente', 'ia');
create type public.status_aprovacao as enum ('rascunho_ia', 'em_revisao', 'aprovado', 'enviado_ao_cliente');
create type public.status_safra as enum ('em_andamento', 'colhida');
create type public.tipo_ocorrencia as enum ('praga', 'doenca', 'planta_daninha', 'deficiencia');
create type public.categoria_custo as enum ('sementes', 'fertilizantes_corretivos', 'defensivos', 'operacoes_maquinas', 'outros');
create type public.profundidade_solo as enum ('0-20', '20-40');
create type public.tipo_laudo_safra as enum ('parcial', 'final');
create type public.tipo_envio as enum ('pedido_laudo_parcial', 'laudo_solo');
create type public.status_envio as enum ('aberto', 'em_andamento', 'concluido');

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cpf_cnpj text unique,
  telefone text,
  email text,
  cidade text,
  uf char(2),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

-- Um perfil por usuário do Supabase Auth. Usuário novo nasce como cliente sem
-- cliente vinculado: não enxerga nada até um admin vincular ou promover.
create table public.perfis (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel public.papel not null default 'cliente',
  cliente_id uuid references public.clientes (id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint so_cliente_tem_cliente check (papel = 'cliente' or cliente_id is null)
);
create index on public.perfis (cliente_id);

create function app.papel_atual() returns public.papel
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where usuario_id = auth.uid() and ativo
$$;

create function app.e_admin() returns boolean
language sql stable as $$ select coalesce(app.papel_atual() = 'admin', false) $$;

-- Admin e funcionário: cadastram e editam.
create function app.e_equipe() returns boolean
language sql stable as $$ select coalesce(app.papel_atual() in ('admin', 'funcionario'), false) $$;

create function app.e_ia() returns boolean
language sql stable as $$ select coalesce(app.papel_atual() = 'ia', false) $$;

-- Quem lê os dados de todos os clientes: equipe e IA.
create function app.le_tudo() returns boolean
language sql stable as $$ select coalesce(app.papel_atual() in ('admin', 'funcionario', 'ia'), false) $$;

-- Cliente do usuário logado; null para quem não é cliente.
create function app.cliente_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select cliente_id from public.perfis where usuario_id = auth.uid() and ativo and papel = 'cliente'
$$;

grant usage on schema app to authenticated, anon;
grant execute on all functions in schema app to authenticated, anon;

-- Carimbo de alteração.
create function app.tocar() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

create trigger tocar before update on public.clientes for each row execute function app.tocar();

-- Perfil automático para cada usuário criado no Auth.
create function app.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (usuario_id, nome)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), new.email, 'Usuário'))
  on conflict (usuario_id) do nothing;
  return new;
end $$;

create trigger criar_perfil after insert on auth.users for each row execute function app.criar_perfil();
