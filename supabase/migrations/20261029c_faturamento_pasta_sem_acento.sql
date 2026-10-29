-- O Storage recusa chave com acento: o relatório do André em `André/2026-09/...` dava "Invalid key".
-- A tela agora grava na pasta sem acento (`pastaDoMentor` em src/lib/data/escritas.ts) e a política
-- do mentor compara com o mesmo nome limpo. Nome sem acento não muda: as pastas já gravadas valem.

begin;

create or replace function public.pasta_do_mentor(nome text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
    translate(nome,
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
      'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY'),
    '[^A-Za-z0-9_-]+', '-', 'g');
$$;

drop policy if exists faturamento_relatorios_select on storage.objects;
create policy faturamento_relatorios_select on storage.objects
  for select to authenticated
  using (bucket_id = 'faturamento-relatorios' and (
    public.get_my_role() in ('admin', 'diretoria')
    or (public.get_my_role() = 'mentor' and (storage.foldername(name))[1] = public.pasta_do_mentor(public.meu_mentor_nome()))
  ));

drop policy if exists faturamento_relatorios_insert on storage.objects;
create policy faturamento_relatorios_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'faturamento-relatorios' and (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'mentor' and (storage.foldername(name))[1] = public.pasta_do_mentor(public.meu_mentor_nome()))
  ));

commit;
