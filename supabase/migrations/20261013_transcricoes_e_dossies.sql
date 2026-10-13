-- Transcrições das calls e dossiê de evolução por mentorado
--
-- `transcricoes`: uma linha por doc "Anotações do Gemini" da pasta de gravações
-- no Drive (lido pelo workflow n8n "[Central Elite3D] Transcrições - Drive ->
-- sync-transcricoes"). Guarda só metadados, o veredito do filtro e o resumo
-- da call; o texto da transcrição não é copiado para o banco.
--
-- `mentorado_dossies`: o documento vivo de cada mentorado, lido pelos agentes.
-- `documento` é markdown pronto para ir num prompt; `estrutura` é o mesmo
-- conteúdo em jsonb. A edge function `sync-transcricoes` reescreve a linha a
-- cada transcrição aceita. Decisão em docs/decisions/003.

begin;

create table if not exists transcricoes (
  drive_id            text primary key,
  titulo              text not null,
  drive_modificado_em timestamptz not null,
  realizada_em        timestamptz not null,
  mentorado_id        uuid references mentorados(id) on delete cascade,
  sessao_id           uuid references sessoes(id) on delete set null,
  mentor              text,
  etapa               text,
  -- pendente: listada, ainda não lida | aceita: entrou no dossiê
  -- rejeitada: texto sujo (filtro determinístico, Jev ou Claude) | grupo: plantão/weekly
  -- sem_vinculo: não casou com mentorado | erro: falha técnica, tenta de novo
  status              text not null default 'pendente'
                      check (status in ('pendente', 'aceita', 'rejeitada', 'grupo', 'sem_vinculo', 'erro')),
  motivo              text,
  jev                 jsonb,
  resumo              text,
  tentativas          smallint not null default 0,
  processado_em       timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists transcricoes_fila on transcricoes (realizada_em) where status in ('pendente', 'erro');
create index if not exists transcricoes_mentorado on transcricoes (mentorado_id, realizada_em desc);

create table if not exists mentorado_dossies (
  mentorado_id        uuid primary key references mentorados(id) on delete cascade,
  documento           text not null,
  estrutura           jsonb not null check (jsonb_typeof(estrutura) = 'object'),
  ultima_mentoria_em  timestamptz not null,
  ultima_transcricao  text not null references transcricoes(drive_id),
  transcricoes_lidas  integer not null default 1,
  modelo              text not null,
  atualizado_em       timestamptz not null default now()
);

-- Mesmo recorte da Análise IA: só admin e diretoria leem; só a service_role grava.
alter table transcricoes enable row level security;
alter table mentorado_dossies enable row level security;

drop policy if exists transcricoes_select on transcricoes;
create policy transcricoes_select on transcricoes
  for select to authenticated using (get_my_role() in ('admin', 'diretoria'));

drop policy if exists mentorado_dossies_select on mentorado_dossies;
create policy mentorado_dossies_select on mentorado_dossies
  for select to authenticated using (get_my_role() in ('admin', 'diretoria'));

revoke all on transcricoes, mentorado_dossies from anon, authenticated;
grant select on transcricoes, mentorado_dossies to authenticated;

commit;

-- Agendamento (depois do deploy), com os mesmos headers do job do Calendar:
--   select cron.schedule('sync-transcricoes-10min', '*/10 * * * *',
--     $$ <command com .../sync-transcricoes, timeout_milliseconds:=150000> $$);
