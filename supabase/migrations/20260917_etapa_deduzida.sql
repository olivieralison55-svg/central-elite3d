-- Etapa deduzida pelo sync
--
-- Com o mentorado casado pelo e-mail do convidado, o evento diz QUEM com
-- precisão, mas continua sem dizer QUAL etapa quando o título é livre
-- ("teste", "Reunião", "Mentoria"). Em vez de descartar o evento, o sync passa
-- a deduzir a etapa pela trilha — a primeira das 12 que ainda não tem sessão
-- concluída nem evento do Calendar preso a ela.
--
-- Dedução acerta na maioria e erra quando a ordem é pulada ou repetida. Errar
-- em silêncio é o problema, não errar: a etapa alimenta a matriz de sessões por
-- mentor, que é o que fecha o mês deles. Por isso a linha nasce marcada.

begin;

alter table sessoes
  add column if not exists etapa_deduzida boolean not null default false;

comment on column sessoes.etapa_deduzida is
  'true = a etapa não veio do título do evento nem de uma pessoa, foi deduzida '
  'pelo sync a partir da trilha. A tela de Sessões mostra a etiqueta "etapa '
  'deduzida" enquanto for true, e salvar a sessão pelo formulário zera o campo '
  '— é o ato de alguém olhar a etapa e responder por ela.';

-- Índice parcial: a tela varre só as marcadas, e elas são minoria.
create index if not exists sessoes_etapa_deduzida
  on sessoes (mentorado_id) where etapa_deduzida;

commit;
