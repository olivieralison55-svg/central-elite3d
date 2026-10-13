-- Presença nas lives do Circle (plantões de dúvida e sessões de implementação).
--
-- Uma automação do Circle ("Attended live event" -> "Send webhook") chama a
-- edge function circle-presenca quando a live termina, uma vez por membro que
-- esteve nela. Só presença real conta: inscrição (RSVP) não passa por aqui.
--
-- `circle_presencas` guarda cada chamada crua, processada ou não: o formato do
-- webhook do Circle não é documentado, então o payload original fica para
-- reprocessar e para diagnosticar quem não casou com uma ficha.
create table if not exists circle_presencas (
  id uuid primary key default gen_random_uuid(),
  recebido_em timestamptz not null default now(),
  payload jsonb not null,
  circle_event_id bigint,
  email text,
  mentorado_id uuid references mentorados(id) on delete set null,
  sessao_id uuid references sessoes(id) on delete set null,
  erro text
);
create index if not exists circle_presencas_recebido_em on circle_presencas (recebido_em desc);
alter table circle_presencas enable row level security;
drop policy if exists circle_presencas_select on circle_presencas;
create policy circle_presencas_select on circle_presencas
  for select to authenticated using (get_my_role() in ('admin', 'diretoria'));
revoke all on circle_presencas from anon, authenticated;
grant select on circle_presencas to authenticated;

-- A presença vira uma linha de `sessoes` (o encontro em grupo é o conjunto das
-- linhas com mesma etapa, data, hora e mentor). O id do evento do Circle torna o
-- webhook idempotente: o mesmo membro no mesmo evento não vira duas presenças.
alter table sessoes add column if not exists circle_event_id bigint;
-- Índice inteiro, não parcial: o upsert do PostgREST (on_conflict) só casa com
-- índice sem WHERE. Linhas sem evento do Circle têm NULL, e NULLs não colidem.
drop index if exists sessoes_circle_presenca;
create unique index if not exists sessoes_circle_presenca on sessoes (mentorado_id, circle_event_id);
