-- STLSeller na ficha do mentorado
--
-- Foto do que o STLSeller sabe de cada mentorado: status no formulário da
-- mentoria, status real sugerido (cruzado com a Lia), loja, pedidos e produtos
-- vendidos em marketplace. A origem é o BigQuery (`stlseller_raw`), lido pelo
-- workflow n8n "GET - SELLERS"; quem grava aqui é a edge function
-- `sync-stlseller`, com service_role. Mão única: nada daqui volta ao STLSeller.
--
-- Uma linha por e-mail do formulário, com o objeto do n8n inteiro em `dados`.
-- Sem `mentorado_id` de propósito: o front casa pelo e-mail da ficha (contra o
-- do formulário ou o da conta STLFLIX), então corrigir o e-mail na ficha
-- reflete na hora, sem esperar o próximo sync.

begin;

create table if not exists stlseller_mentorados (
  email      text primary key check (email = lower(btrim(email)) and email <> ''),
  dados      jsonb not null,
  synced_at  timestamptz not null default now()
);

-- Leitura segue o recorte de `lia_cobrancas`: tem status de pagamento e
-- faturamento, então admin e diretoria leem e mentor não vê. Nenhuma policy de
-- escrita: só a service_role do sync grava.
alter table stlseller_mentorados enable row level security;

drop policy if exists stlseller_mentorados_select on stlseller_mentorados;
create policy stlseller_mentorados_select on stlseller_mentorados
  for select to authenticated
  using (get_my_role() in ('admin', 'diretoria'));

-- Revoga tudo e devolve só a leitura. O default do Supabase concede também
-- TRUNCATE, que ignora o RLS; o PostgREST não o expõe, então é defesa em
-- profundidade -- mas não há por que a tabela carregar o privilégio.
revoke all on stlseller_mentorados from anon, authenticated;
grant select on stlseller_mentorados to authenticated;

commit;

-- Agendamento (fora da transação, depois do deploy da função). Reaproveite os
-- headers do job do Calendar para não inventar outra forma de autenticar:
--
--   select command from cron.job where jobname = 'sync-google-calendar-15min';
--
-- e agende a cada 6 h trocando só a URL para .../functions/v1/sync-stlseller:
--
--   select cron.schedule('sync-stlseller-6h', '20 */6 * * *', $$ <command com a URL nova> $$);
