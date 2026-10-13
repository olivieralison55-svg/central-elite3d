-- Pesquisa de Experiência e analista de NPS
--
-- `experiencia_respostas`: a Pesquisa de Experiência Mentoria Elite 3D, que é
-- ANÔNIMA (sem nome, sem mentor). A origem é a planilha do formulário, exportada
-- pelo workflow n8n "[Central Elite3D] Experiência - planilha -> sync-experiencia";
-- quem grava é a edge function `sync-experiencia`, com service_role, a cada 6 h.
-- Grade e perguntas abertas ficam em jsonb com o texto da planilha como chave:
-- pergunta nova no Forms entra sem migration, e a tela lê o que houver.
--
-- `nps_analises`: uma linha por rodada do analista (`nps-analista`, diária),
-- que só roda quando entrou resposta nova desde a última análise. `dados_ate` é
-- o maior `created_at` das respostas que ela viu — é a marca d'água da novidade.
-- Os alertas ficam só para admin e diretoria: mentor não lê (decisão de
-- 08/10/2026, ver docs/decisions/001).

begin;

create table if not exists experiencia_respostas (
  origem_id      text primary key check (origem_id like 'sheet:%'),
  respondido_em  timestamptz not null,
  nota           smallint not null check (nota between 0 and 10),
  geral          text,
  itens          jsonb not null default '{}' check (jsonb_typeof(itens) = 'object'),
  clareza        text,
  textos         jsonb not null default '{}' check (jsonb_typeof(textos) = 'object'),
  created_at     timestamptz not null default now()
);

create table if not exists nps_analises (
  id          uuid primary key default gen_random_uuid(),
  gerado_em   timestamptz not null default now(),
  modelo      text not null,
  dados_ate   timestamptz not null,
  respostas   integer not null check (respostas >= 0),
  resumo      text not null,
  alertas     jsonb not null check (jsonb_typeof(alertas) = 'array')
);
create index if not exists nps_analises_gerado_em on nps_analises (gerado_em desc);

-- Leitura no recorte do NPS: admin e diretoria. Nenhuma policy de escrita: só
-- a service_role das edge functions grava. Revoga o default (inclui TRUNCATE,
-- que ignora RLS) e devolve só o SELECT.
alter table experiencia_respostas enable row level security;
alter table nps_analises enable row level security;

drop policy if exists experiencia_respostas_select on experiencia_respostas;
create policy experiencia_respostas_select on experiencia_respostas
  for select to authenticated
  using (get_my_role() in ('admin', 'diretoria'));

drop policy if exists nps_analises_select on nps_analises;
create policy nps_analises_select on nps_analises
  for select to authenticated
  using (get_my_role() in ('admin', 'diretoria'));

revoke all on experiencia_respostas, nps_analises from anon, authenticated;
grant select on experiencia_respostas, nps_analises to authenticated;

commit;

-- Agendamento (fora da transação, depois do deploy das funções), com os mesmos
-- headers do job do Calendar:
--
--   select cron.schedule('sync-experiencia-6h', '45 */6 * * *', $$ <command com .../sync-experiencia> $$);
--   select cron.schedule('nps-analista-diario', '0 10 * * *', $$ <command com .../nps-analista, timeout_milliseconds:=150000> $$);
