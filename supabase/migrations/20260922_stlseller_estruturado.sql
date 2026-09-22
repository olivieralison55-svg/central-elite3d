-- STLSeller estruturado: colunas em vez de um jsonb
--
-- Substitui a `stlseller_mentorados(email, dados jsonb)` da migration anterior,
-- que guardava o objeto do n8n inteiro numa coluna. Agora são três tabelas:
--
--   stlseller_mentorados            uma linha por mentorado (e-mail do formulário)
--   stlseller_pedidos_marketplace   resumo de pedidos por mentorado e marketplace
--   stlseller_produtos_vendidos     produtos vendidos por mentorado, marketplace e anúncio
--
-- Quem grava é `stlseller_sincronizar(payload)`, numa transação só: o sync
-- nunca deixa um mentorado com os pedidos de uma rodada e os produtos de outra.
-- Mão única: nada daqui volta ao STLSeller.
--
-- Sem `mentorado_id` de propósito: o front casa pelo e-mail da ficha contra
-- `email` ou `email_stlflix`, então corrigir o e-mail na ficha reflete na hora.

begin;

drop table if exists stlseller_mentorados cascade;

create table stlseller_mentorados (
  email                    text primary key check (email = lower(btrim(email)) and email <> ''),
  email_stlflix            text,
  nome                     text,
  status_formulario        text,          -- ATIVO | PAUSADO | CANCELADO
  status_real              text,          -- pago | pendente | inadimplente_ou_cancelado | sem_pedido_lia
  plano_ativo              boolean,       -- plano do STLSeller
  vendas_marketplace       integer,
  loja_id                  text,
  loja_nome                text,
  loja_email               text,
  lia_status_pagamento     text,          -- finished | canceled | initiated
  lia_motivo_cancelamento  text,
  lia_tipo_checkout        text,
  lia_pedidos              integer,
  lia_pedidos_finalizados  integer,
  lia_ultimo_pedido_em     timestamptz,
  produtos_vendidos        integer not null default 0,
  faturamento_total        numeric(14,2) not null default 0,
  synced_at                timestamptz not null default now()
);
create index stlseller_mentorados_email_stlflix on stlseller_mentorados (email_stlflix);

create table stlseller_pedidos_marketplace (
  email              text not null references stlseller_mentorados (email) on delete cascade,
  marketplace        text not null,
  pedidos            integer,
  pedidos_vendidos   integer,
  pedidos_cancelados integer,
  total_bruto        numeric(14,2),
  total_liquido      numeric(14,2),   -- nulo quando o marketplace não informa (Mercado Livre)
  status             text,            -- lista dos status vistos, separada por vírgula
  primeiro_pedido_em timestamptz,
  ultimo_pedido_em   timestamptz,
  primary key (email, marketplace)
);

create table stlseller_produtos_vendidos (
  email                  text not null references stlseller_mentorados (email) on delete cascade,
  marketplace            text not null,
  anuncio_id             text not null,   -- external_id do marketplace
  titulo                 text,
  cadastrado_no_stlseller boolean,
  status                 text,
  link                   text,
  preco_atual            numeric(14,2),
  pedidos                integer,
  unidades               integer,
  faturamento            numeric(14,2),
  primeira_venda_em      timestamptz,
  ultima_venda_em        timestamptz,
  primary key (email, marketplace, anuncio_id)
);

/* Leitura segue o recorte de `lia_cobrancas`: tem status de pagamento e
   faturamento, então admin e diretoria leem e mentor não vê. Nenhuma policy de
   escrita. Revoga tudo e devolve só a leitura: o default do Supabase concede
   também TRUNCATE, que ignora o RLS (o PostgREST não o expõe; é defesa em
   profundidade). */
do $$
declare t text;
begin
  foreach t in array array['stlseller_mentorados','stlseller_pedidos_marketplace','stlseller_produtos_vendidos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (get_my_role() in (''admin'',''diretoria''))', t || '_select', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

/* Recebe o payload do workflow n8n "GET - SELLERS" e deixa as três tabelas
   iguais a ele. Quem sumiu do payload sai (e leva pedidos e produtos pelo
   cascade). Payload sem mentorados é recusado antes de apagar qualquer coisa:
   uma falha do n8n ou do BigQuery não pode esvaziar a aba de todo mundo.

   SECURITY INVOKER e execute só para service_role: quem chama é a edge
   function sync-stlseller. */
create or replace function stlseller_sincronizar(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  agora timestamptz := now();
  n_mentorados int;
  n_removidos int;
begin
  if jsonb_typeof(payload->'mentees') is distinct from 'array'
     or jsonb_array_length(payload->'mentees') = 0 then
    raise exception 'payload sem mentorados; nada foi gravado nem apagado';
  end if;

  create temp table _m on commit drop as
  select lower(btrim(m->>'email')) as email, m
  from jsonb_array_elements(payload->'mentees') m
  where coalesce(btrim(m->>'email'), '') <> '';

  insert into stlseller_mentorados as t (
    email, email_stlflix, nome, status_formulario, status_real, plano_ativo, vendas_marketplace,
    loja_id, loja_nome, loja_email,
    lia_status_pagamento, lia_motivo_cancelamento, lia_tipo_checkout,
    lia_pedidos, lia_pedidos_finalizados, lia_ultimo_pedido_em,
    produtos_vendidos, faturamento_total, synced_at)
  select distinct on (email)
    email,
    nullif(lower(btrim(m->>'email_stlflix')), ''),
    m->>'name', m->>'mentoria_status', m->>'status_real',
    (m->>'stlseller_plan_active')::boolean, (m->>'marketplace_sales_count')::int,
    m->>'seller_id', m->>'seller_name', m->>'seller_email',
    m->'lia'->>'payment_status', m->'lia'->>'cancel_reason', m->'lia'->>'checkout_type',
    (m->'lia'->>'orders')::int, (m->'lia'->>'orders_finished')::int,
    (m->'lia'->>'last_order_at')::timestamptz,
    coalesce((m->>'products_count')::int, 0), coalesce((m->>'revenue_total')::numeric, 0),
    agora
  from _m
  on conflict (email) do update set
    email_stlflix = excluded.email_stlflix, nome = excluded.nome,
    status_formulario = excluded.status_formulario, status_real = excluded.status_real,
    plano_ativo = excluded.plano_ativo, vendas_marketplace = excluded.vendas_marketplace,
    loja_id = excluded.loja_id, loja_nome = excluded.loja_nome, loja_email = excluded.loja_email,
    lia_status_pagamento = excluded.lia_status_pagamento,
    lia_motivo_cancelamento = excluded.lia_motivo_cancelamento,
    lia_tipo_checkout = excluded.lia_tipo_checkout,
    lia_pedidos = excluded.lia_pedidos, lia_pedidos_finalizados = excluded.lia_pedidos_finalizados,
    lia_ultimo_pedido_em = excluded.lia_ultimo_pedido_em,
    produtos_vendidos = excluded.produtos_vendidos, faturamento_total = excluded.faturamento_total,
    synced_at = excluded.synced_at;
  get diagnostics n_mentorados = row_count;

  delete from stlseller_mentorados where synced_at < agora;
  get diagnostics n_removidos = row_count;

  -- Filhos são a foto da rodada: apaga e regrava, em vez de casar linha a linha.
  delete from stlseller_pedidos_marketplace;
  insert into stlseller_pedidos_marketplace (
    email, marketplace, pedidos, pedidos_vendidos, pedidos_cancelados,
    total_bruto, total_liquido, status, primeiro_pedido_em, ultimo_pedido_em)
  select _m.email, o->>'marketplace', (o->>'orders')::int, (o->>'sold_orders')::int,
         (o->>'cancelled_orders')::int, (o->>'gross_total')::numeric, (o->>'net_total')::numeric,
         o->>'statuses', (o->>'first_order_at')::timestamptz, (o->>'last_order_at')::timestamptz
  from _m, jsonb_array_elements(coalesce(_m.m->'orders_summary', '[]')) o
  where o->>'marketplace' is not null;

  delete from stlseller_produtos_vendidos;
  insert into stlseller_produtos_vendidos (
    email, marketplace, anuncio_id, titulo, cadastrado_no_stlseller, status, link, preco_atual,
    pedidos, unidades, faturamento, primeira_venda_em, ultima_venda_em)
  select _m.email, p->>'marketplace', p->>'external_id', p->>'title',
         (p->>'registered_in_products')::boolean, p->>'status', p->>'permalink',
         (p->>'current_price')::numeric, (p->>'orders')::int, (p->>'units')::int,
         (p->>'revenue')::numeric, (p->>'first_sale_at')::timestamptz, (p->>'last_sale_at')::timestamptz
  from _m, jsonb_array_elements(coalesce(_m.m->'products', '[]')) p
  where p->>'marketplace' is not null and p->>'external_id' is not null;

  return jsonb_build_object(
    'mentorados', n_mentorados,
    'removidos', n_removidos,
    'pedidos', (select count(*) from stlseller_pedidos_marketplace),
    'produtos', (select count(*) from stlseller_produtos_vendidos));
end $$;

revoke all on function stlseller_sincronizar(jsonb) from public, anon, authenticated;
grant execute on function stlseller_sincronizar(jsonb) to service_role;

commit;

-- Agendamento (fora da transação, depois do deploy da função). Reaproveite os
-- headers do job do Calendar para não inventar outra forma de autenticar:
--
--   select command from cron.job where jobname = 'sync-google-calendar-15min';
--
-- e agende a cada 6 h trocando só a URL para .../functions/v1/sync-stlseller:
--
--   select cron.schedule('sync-stlseller-6h', '20 */6 * * *', $$ <command com a URL nova> $$);
