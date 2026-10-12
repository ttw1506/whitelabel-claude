-- Soloplan Campo · etapa 7: fila de tarefas e chaves para a IA local do escritório.
--
--   chaves_ia   chaves de API da IA; só o hash é guardado (a chave aparece uma vez, ao ser criada). Só admin mexe.
--   tarefas_ia  fila: a equipe pede, a IA pega a próxima, devolve o resultado como rascunho.
--   precos_dia  cotação do dia (soja, milho, boi) trazida pela IA, sempre com fonte e sempre rascunho até um admin aprovar.

create type public.status_tarefa_ia as enum ('pendente', 'em_andamento', 'concluida', 'falhou', 'cancelada');

create table public.chaves_ia (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  hash text not null unique,
  prefixo text not null,
  criada_em timestamptz not null default now(),
  criada_por uuid default auth.uid(),
  revogada_em timestamptz,
  ultimo_uso_em timestamptz
);

create table public.tarefas_ia (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('extrair_laudo_solo', 'analisar_foto', 'gerar_laudo_parcial', 'gerar_laudo_final', 'conferir_car')),
  cliente_id uuid references public.clientes (id) on delete cascade,
  referencia_tabela text,
  referencia_id uuid,
  entrada jsonb not null default '{}',
  status public.status_tarefa_ia not null default 'pendente',
  tentativas int not null default 0,
  max_tentativas int not null default 3 check (max_tentativas between 1 and 10),
  bloqueada_ate timestamptz,
  resultado jsonb,
  erro text,
  criada_em timestamptz not null default now(),
  criada_por uuid default auth.uid(),
  iniciada_em timestamptz,
  concluida_em timestamptz
);
create index on public.tarefas_ia (status, criada_em);
create index on public.tarefas_ia (cliente_id);

create table public.precos_dia (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (produto in ('soja', 'milho', 'boi')),
  valor numeric(12, 2) not null check (valor > 0),
  unidade text not null,
  fonte text not null check (length(trim(fonte)) > 0),
  data date not null default current_date,
  status public.status_aprovacao not null default 'em_revisao',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid()
);
create index on public.precos_dia (produto, data desc);

grant select, insert, update, delete on public.chaves_ia, public.tarefas_ia, public.precos_dia to authenticated;
alter table public.chaves_ia enable row level security;
alter table public.tarefas_ia enable row level security;
alter table public.precos_dia enable row level security;

-- Chaves: só admin.
create policy chaves_admin on public.chaves_ia for all to authenticated using (app.e_admin()) with check (app.e_admin());

-- Tarefas: a equipe pede e acompanha; a IA lê e atualiza as que pegou; só admin apaga. Cliente não vê.
create policy ler on public.tarefas_ia for select to authenticated using (app.le_tudo());
create policy criar on public.tarefas_ia for insert to authenticated with check (app.e_equipe());
create policy editar on public.tarefas_ia for update to authenticated using (app.e_equipe() or app.e_ia()) with check (app.e_equipe() or app.e_ia());
create policy apagar on public.tarefas_ia for delete to authenticated using (app.e_admin());

-- Preços: equipe e IA leem; a IA só cria rascunho e só edita rascunho; aprovar é com admin.
create policy ler on public.precos_dia for select to authenticated using (app.le_tudo());
create policy criar on public.precos_dia for insert to authenticated with check (app.e_equipe() or app.e_ia());
create policy editar on public.precos_dia for update to authenticated
  using (app.e_equipe() or (app.e_ia() and status = 'rascunho_ia')) with check (app.e_equipe() or app.e_ia());
create policy apagar on public.precos_dia for delete to authenticated using (app.e_admin());

create trigger controlar_aprovacao before insert or update on public.precos_dia for each row execute function app.controlar_aprovacao('laudo');
create trigger auditar after insert or update or delete on public.tarefas_ia for each row execute function app.auditar();
create trigger auditar after insert or update or delete on public.precos_dia for each row execute function app.auditar();
create trigger auditar after insert or update or delete on public.chaves_ia for each row execute function app.auditar();

-- A IA pega a próxima tarefa. "skip locked" impede dois trabalhadores de pegarem a mesma;
-- o prazo (lease) devolve à fila a tarefa de um trabalhador que travou ou desligou.
create function public.ia_pegar_proxima_tarefa(p_tipos text[] default null, p_prazo_segundos int default 600)
returns setof public.tarefas_ia
language plpgsql security definer set search_path = public as $$
declare
  t public.tarefas_ia;
begin
  if not (app.e_ia() or app.e_admin()) then
    raise exception 'Somente a IA pega tarefas.' using errcode = '42501';
  end if;
  -- Tarefa vencida que já gastou todas as tentativas vira falha em vez de voltar para a fila.
  update public.tarefas_ia set status = 'falhou', erro = coalesce(erro, 'Prazo esgotado sem resposta.'), concluida_em = now()
   where status = 'em_andamento' and bloqueada_ate < now() and tentativas >= max_tentativas;

  select * into t from public.tarefas_ia
   where (p_tipos is null or tipo = any (p_tipos))
     and (status = 'pendente' or (status = 'em_andamento' and bloqueada_ate < now()))
   order by criada_em
   for update skip locked
   limit 1;
  if not found then return; end if;

  update public.tarefas_ia
     set status = 'em_andamento', tentativas = tentativas + 1, iniciada_em = now(),
         bloqueada_ate = now() + make_interval(secs => greatest(30, least(p_prazo_segundos, 3600)))
   where id = t.id
   returning * into t;
  return next t;
end $$;

-- A IA devolve o resultado (ou o erro). Só quem está com a tarefa em andamento pode fechar.
create function public.ia_finalizar_tarefa(p_id uuid, p_ok boolean, p_resultado jsonb default null, p_erro text default null)
returns public.tarefas_ia
language plpgsql security definer set search_path = public as $$
declare
  t public.tarefas_ia;
begin
  if not (app.e_ia() or app.e_admin()) then
    raise exception 'Somente a IA finaliza tarefas.' using errcode = '42501';
  end if;
  update public.tarefas_ia
     set status = case
           when p_ok then 'concluida'
           when tentativas >= max_tentativas then 'falhou'
           else 'pendente' end::public.status_tarefa_ia,
         resultado = case when p_ok then p_resultado end,
         erro = case when p_ok then null else left(coalesce(p_erro, 'Erro sem detalhe.'), 2000) end,
         bloqueada_ate = null,
         concluida_em = case when p_ok or tentativas >= max_tentativas then now() end
   where id = p_id and status = 'em_andamento'
   returning * into t;
  if not found then raise exception 'Tarefa não está em andamento.' using errcode = 'P0002'; end if;
  return t;
end $$;

revoke all on function public.ia_pegar_proxima_tarefa(text[], int), public.ia_finalizar_tarefa(uuid, boolean, jsonb, text) from public, anon;
grant execute on function public.ia_pegar_proxima_tarefa(text[], int), public.ia_finalizar_tarefa(uuid, boolean, jsonb, text) to authenticated;
