-- Soloplan Campo · etapa 3: custo das aplicações e armazenamento das fotos.

-- O custo de uma aplicação vira um lançamento em custos (uma única fonte para os totais).
alter table public.aplicacoes add column categoria_custo public.categoria_custo not null default 'defensivos';
alter table public.custos drop constraint custos_aplicacao_id_fkey;
alter table public.custos add constraint custos_aplicacao_id_fkey foreign key (aplicacao_id) references public.aplicacoes (id) on delete cascade;
create unique index custos_um_por_aplicacao on public.custos (aplicacao_id) where aplicacao_id is not null;

create function app.custo_da_aplicacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  texto_descricao text := concat_ws(' · ', new.tipo_operacao, nullif(new.produto, ''));
begin
  if new.custo is null or new.custo = 0 then
    delete from public.custos where aplicacao_id = new.id;
    return null;
  end if;
  if exists (select 1 from public.custos where aplicacao_id = new.id) then
    update public.custos
       set categoria = new.categoria_custo, descricao = texto_descricao, valor = new.custo, data = new.data,
           status = case when status is distinct from new.status then new.status else status end
     where aplicacao_id = new.id;
  else
    insert into public.custos (safra_id, aplicacao_id, categoria, descricao, valor, data, status)
    values (new.safra_id, new.id, new.categoria_custo, texto_descricao, new.custo, new.data, new.status);
  end if;
  return null;
end $$;

create trigger custo_da_aplicacao after insert or update on public.aplicacoes
  for each row execute function app.custo_da_aplicacao();

-- Custo que nasce de uma aplicação só muda pela aplicação.
create function app.proteger_custo_de_aplicacao() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and old.aplicacao_id is not null then
    raise exception 'Este custo vem de uma aplicação. Altere a aplicação.' using errcode = '22023';
  end if;
  return coalesce(new, old);
end $$;
create trigger proteger_custo_de_aplicacao before update or delete on public.custos
  for each row execute function app.proteger_custo_de_aplicacao();

-- Armazenamento (Supabase Storage). Só roda onde o schema storage existe.
do $mig$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage não instalado: buckets e regras de arquivos não criados';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  on conflict (id) do nothing;

  -- A equipe e a IA leem tudo; o cliente só abre a foto (ou a original) de um registro que ele pode ver.
  execute $p$create policy fotos_ler on storage.objects for select to authenticated using (
    bucket_id = 'fotos' and (app.le_tudo() or exists (
      select 1 from public.fotos f where f.arquivo_path = storage.objects.name or f.original_path = storage.objects.name)))$p$;
  execute $p$create policy fotos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and app.e_equipe())$p$;
  execute $p$create policy fotos_substituir on storage.objects for update to authenticated using (bucket_id = 'fotos' and app.e_equipe())$p$;
  execute $p$create policy fotos_apagar on storage.objects for delete to authenticated using (bucket_id = 'fotos' and app.e_admin())$p$;
end
$mig$;
