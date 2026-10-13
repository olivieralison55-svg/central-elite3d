-- Bloco de notas por mentorado (aba "Notas" da ficha)
--
-- Uma linha por mentorado. `conteudo` é o HTML do editor, já sanitizado no
-- cliente por allowlist (DOMPurify) ao salvar e de novo ao abrir. Quem salva
-- por último vence: não há merge entre duas pessoas editando ao mesmo tempo.
-- Decisão em docs/decisions/004.

begin;

create table if not exists mentorado_notas (
  mentorado_id   uuid primary key references mentorados(id) on delete cascade,
  conteudo       text not null default '' check (length(conteudo) <= 500000),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null default auth.uid()
);

alter table mentorado_notas enable row level security;

-- Os três papéis leem; só quem escreve sessão (admin e mentor) grava.
drop policy if exists mentorado_notas_select on mentorado_notas;
create policy mentorado_notas_select on mentorado_notas
  for select to authenticated using (get_my_role() in ('admin', 'diretoria', 'mentor'));

drop policy if exists mentorado_notas_insert on mentorado_notas;
create policy mentorado_notas_insert on mentorado_notas
  for insert to authenticated with check (get_my_role() in ('admin', 'mentor'));

drop policy if exists mentorado_notas_update on mentorado_notas;
create policy mentorado_notas_update on mentorado_notas
  for update to authenticated
  using (get_my_role() in ('admin', 'mentor')) with check (get_my_role() in ('admin', 'mentor'));

revoke all on mentorado_notas from anon, authenticated;
grant select, insert, update on mentorado_notas to authenticated;

commit;
