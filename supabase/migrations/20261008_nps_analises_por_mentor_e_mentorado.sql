-- Analista de NPS: leitura por mentor e por mentorado
--
-- A primeira versão de `nps_analises` só tinha resumo e alertas soltos. A aba
-- "Análise IA" mostra uma leitura por mentor e outra por mentorado, que o
-- `nps-analista` passa a devolver nestas colunas. Linhas antigas ficam com
-- listas vazias: a tela mostra "sem leitura nesta rodada".

alter table nps_analises
  add column if not exists mentores   jsonb not null default '[]' check (jsonb_typeof(mentores) = 'array'),
  add column if not exists mentorados jsonb not null default '[]' check (jsonb_typeof(mentorados) = 'array');
