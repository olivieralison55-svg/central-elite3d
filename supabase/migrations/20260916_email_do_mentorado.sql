-- E-mail do mentorado — a peça que faltava para o sync parar de ler o título
--
-- O sync já identifica o MENTOR pelo e-mail do convidado no evento e acerta
-- sempre. O MENTORADO era identificado por palavras do nome no título, e é
-- isso que obriga quem agenda a escrever o evento num formato específico.
-- Com e-mail aqui, o casamento do mentorado passa a ser exato e o nome no
-- título vira irrelevante.
--
-- A ETAPA continua vindo do título (Diagnóstico / Plano de Ação / Checkup N):
-- nem o Calendar nem o Meet sabem que aquela reunião é o Checkup 5.

begin;

alter table mentorados add column if not exists email text;

comment on column mentorados.email is
  'E-mail que o mentorado usa no convite do Google Agenda. É por ele que o sync '
  'casa o evento com a ficha — o nome no título do evento deixa de importar. '
  'Nulo é normal: o sync cai no casamento por nome enquanto o campo não estiver '
  'preenchido.';

-- Dois mentorados com o mesmo e-mail dariam empate no sync e o evento seria
-- descartado calado — o mesmo motivo pelo qual empate por nome já descarta.
-- Índice em lower() porque e-mail não diferencia caixa.
create unique index if not exists mentorados_email_unico
  on mentorados (lower(email)) where email is not null;

-- A view que o mentor lê. `email` entra NO FIM da lista de propósito:
-- create or replace view só aceita coluna nova no final.
-- Isto passa o e-mail a ser visível a todo mentor, como qualquer campo daqui.
create or replace view mentorados_basic as
  select id,
         nome,
         data_fechamento,
         ciclo,
         link_drive,
         link_mapa_mental,
         link_whatsapp,
         cancelado,
         created_at,
         situacao,
         pausado_em,
         retorno_previsto,
         email
    from mentorados;

commit;
