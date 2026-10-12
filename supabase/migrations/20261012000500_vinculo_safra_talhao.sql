-- Desmarcar um talhão de uma safra é edição da safra, não exclusão de dado: a equipe pode.
drop policy apagar on public.safra_talhoes;
create policy apagar on public.safra_talhoes for delete to authenticated using (app.e_equipe());
