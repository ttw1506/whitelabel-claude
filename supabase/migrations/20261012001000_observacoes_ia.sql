-- Soloplan Campo · IA do escritório: observações escritas pela IA sobre uma foto ou sobre o CAR de uma fazenda.
-- Sempre rascunho até um administrador aprovar; o cliente só vê o que foi aprovado e é dele.

create table public.observacoes_ia (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('foto', 'car')),
  foto_id uuid references public.fotos (id) on delete cascade,
  fazenda_id uuid references public.fazendas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  texto text not null check (length(trim(texto)) >= 20),
  incertezas jsonb not null default '[]',
  status public.status_aprovacao not null default 'em_revisao',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  check ((tipo = 'foto' and foto_id is not null and fazenda_id is null) or (tipo = 'car' and fazenda_id is not null and foto_id is null))
);
create index on public.observacoes_ia (cliente_id, status);
create index on public.observacoes_ia (foto_id);
create index on public.observacoes_ia (fazenda_id);

-- O cliente vem da foto (via safra) ou da fazenda, e o vínculo não muda depois de criado.
create function app.herdar_cliente_observacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dono uuid;
begin
  if tg_op = 'UPDATE' and (new.foto_id is distinct from old.foto_id or new.fazenda_id is distinct from old.fazenda_id or new.tipo is distinct from old.tipo) then
    raise exception 'O vínculo da observação não pode ser alterado depois de criado.' using errcode = '22023';
  end if;
  if new.tipo = 'foto' then select cliente_id into dono from public.fotos where id = new.foto_id;
  else select cliente_id into dono from public.fazendas where id = new.fazenda_id;
  end if;
  if dono is null then raise exception 'Registro pai não encontrado.' using errcode = '23503'; end if;
  new.cliente_id := dono;
  return new;
end $$;

create trigger herdar_cliente before insert or update on public.observacoes_ia for each row execute function app.herdar_cliente_observacao();
create trigger controlar_aprovacao before insert or update on public.observacoes_ia for each row execute function app.controlar_aprovacao('lancamento');
create trigger carimbar_criacao before insert on public.observacoes_ia for each row execute function app.carimbar_criacao();
create trigger auditar after insert or update or delete on public.observacoes_ia for each row execute function app.auditar();

grant select, insert, update, delete on public.observacoes_ia to authenticated;
alter table public.observacoes_ia enable row level security;
create policy ler on public.observacoes_ia for select to authenticated
  using (app.le_tudo() or (cliente_id = app.cliente_atual() and status in ('aprovado', 'enviado_ao_cliente')));
create policy criar on public.observacoes_ia for insert to authenticated with check (app.e_equipe() or app.e_ia());
create policy editar on public.observacoes_ia for update to authenticated
  using (app.e_equipe() or (app.e_ia() and status = 'rascunho_ia')) with check (app.e_equipe() or app.e_ia());
create policy apagar on public.observacoes_ia for delete to authenticated using (app.e_admin());
create trigger tocar before update on public.observacoes_ia for each row execute function app.tocar();
