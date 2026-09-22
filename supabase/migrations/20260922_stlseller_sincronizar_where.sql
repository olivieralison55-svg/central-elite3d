-- stlseller_sincronizar: DELETE com WHERE explícito
--
-- Chamada pela edge function (PostgREST, service_role), a função falhava com
-- "DELETE requires a WHERE clause": o Supabase carrega a extensão safeupdate
-- nas sessões do PostgREST, e ela recusa DELETE/UPDATE sem WHERE. Rodando como
-- postgres (carga manual pelo SQL) o erro não aparece — por isso passou nos
-- testes. `where true` é a forma aceita de dizer "a tabela inteira" de
-- propósito. A falha não deixou dano: a transação voltou inteira.

begin;

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
  delete from stlseller_pedidos_marketplace where true;
  insert into stlseller_pedidos_marketplace (
    email, marketplace, pedidos, pedidos_vendidos, pedidos_cancelados,
    total_bruto, total_liquido, status, primeiro_pedido_em, ultimo_pedido_em)
  select _m.email, o->>'marketplace', (o->>'orders')::int, (o->>'sold_orders')::int,
         (o->>'cancelled_orders')::int, (o->>'gross_total')::numeric, (o->>'net_total')::numeric,
         o->>'statuses', (o->>'first_order_at')::timestamptz, (o->>'last_order_at')::timestamptz
  from _m, jsonb_array_elements(coalesce(_m.m->'orders_summary', '[]')) o
  where o->>'marketplace' is not null;

  delete from stlseller_produtos_vendidos where true;
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
