-- Excluir anexo da nota (AD-010, emenda de 15/10/2026): quem envia (admin, mentor) também apaga.
-- A diretoria só lê, como nas notas.

drop policy if exists notas_anexos_delete on storage.objects;
create policy notas_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'notas-anexos' and public.get_my_role() in ('admin', 'mentor'));
