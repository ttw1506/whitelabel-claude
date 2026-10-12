-- Soloplan Campo · etapa 5: laudo de solo e depósito de documentos.

alter table public.laudos_solo
  add column pdf_path text,
  add column prnt numeric(5, 2) check (prnt > 0 and prnt <= 100),
  add column v2 numeric(5, 2) check (v2 > 0 and v2 <= 100);

-- Documentos (laudos em PDF, arquivos de laboratório, CAR). Caminho: clientes/<cliente_id>/...
--   equipe e IA leem tudo; só a equipe grava; só admin apaga;
--   o produtor envia e lê o que está em clientes/<o dele>/envios/, e lê os PDFs de laudos que já recebeu.
do $mig$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage não instalado: depósito de documentos não criado';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documentos', 'documentos', false, 20971520,
          array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
                'application/zip', 'application/vnd.google-earth.kml+xml', 'application/octet-stream'])
  on conflict (id) do nothing;

  execute $p$create policy documentos_ler on storage.objects for select to authenticated using (
    bucket_id = 'documentos' and (
      app.le_tudo()
      or (app.cliente_atual() is not null and storage.objects.name like 'clientes/' || app.cliente_atual() || '/envios/%')
      or exists (select 1 from public.laudos_solo l where l.pdf_path = storage.objects.name)
      or exists (select 1 from public.laudos_safra l where l.pdf_path = storage.objects.name)))$p$;
  execute $p$create policy documentos_enviar on storage.objects for insert to authenticated with check (
    bucket_id = 'documentos' and (
      app.e_equipe()
      or (app.cliente_atual() is not null and storage.objects.name like 'clientes/' || app.cliente_atual() || '/envios/%')))$p$;
  execute $p$create policy documentos_substituir on storage.objects for update to authenticated using (bucket_id = 'documentos' and app.e_equipe())$p$;
  execute $p$create policy documentos_apagar on storage.objects for delete to authenticated using (bucket_id = 'documentos' and app.e_admin())$p$;
end
$mig$;
