-- Imagens e documentos nas notas do mentorado (AD-010).
-- Bucket privado: o arquivo só abre por link assinado, pedido por quem está logado. Quem lê as
-- notas lê os anexos (admin, diretoria, mentor); quem escreve as notas envia (admin, mentor).
-- Não há update nem delete: tirar o anexo da nota não apaga o arquivo.
-- SVG fica de fora de propósito: é HTML com script, e abriria XSS pelo link assinado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notas-anexos',
  'notas-anexos',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists notas_anexos_select on storage.objects;
create policy notas_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'notas-anexos' and public.get_my_role() in ('admin', 'diretoria', 'mentor'));

drop policy if exists notas_anexos_insert on storage.objects;
create policy notas_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notas-anexos' and public.get_my_role() in ('admin', 'mentor'));
