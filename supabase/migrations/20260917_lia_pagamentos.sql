-- Integração com a Lia — espelho das cobranças e origem das parcelas
--
-- A Lia é o gestor de pagamentos. Nada aqui escreve NA Lia: a aplicação só
-- reflete o que ela informa por webhook.
--
-- Decisão de projeto: para quem tem cobrança na Lia, **ela passa a ser a fonte
-- das parcelas**. O preenchimento manual sai de cena para essas pessoas. Quem
-- não tem cobrança lá continua exatamente como está — não há de onde tirar
-- dado para substituir.
--
-- Por isso o backup logo abaixo. Hoje há 217 linhas em `parcelas`, 202
-- marcadas como pagas, e só 24 com vencimento: é registro feito à mão ao longo
-- de meses e não pode sumir sem cópia.

begin;

/* ---------- 0. Rede de segurança ---------- */
-- Cópia integral de `parcelas` antes de a Lia começar a substituir.
-- RLS ligado e SEM policy: ninguém alcança pelo cliente, só service_role.
create table if not exists parcelas_backup_20260917 as
  select *, now() as copiado_em from parcelas;

alter table parcelas_backup_20260917 enable row level security;

comment on table parcelas_backup_20260917 is
  'Foto de `parcelas` em 17/09/2026, antes de a Lia virar fonte das parcelas. '
  'Descartável assim que a substituição estiver conferida.';

/* ---------- 1. Vínculo do mentorado com a Lia ---------- */

alter table mentorados add column if not exists lia_order_id   text;
alter table mentorados add column if not exists lia_billing_id text;

comment on column mentorados.lia_order_id is
  'ID do pedido na Lia (painel > Pedidos). Chave principal do vínculo. Quando '
  'nula, o webhook casa pelo e-mail e grava o id aqui, para as próximas '
  'cobranças irem pelo caminho rápido.';

-- Um pedido da Lia pertence a um único mentorado.
create unique index if not exists mentorados_lia_order_unico
  on mentorados (lia_order_id) where lia_order_id is not null;

/* O casamento por e-mail é por IGUALDADE, não ilike — "_" e "%" num endereço
   viram curinga e casariam com a pessoa errada. Para a igualdade valer, os dois
   lados precisam estar em minúsculas. O front já normaliza; o trigger cobre
   quem editar direto pelo painel do Supabase. */
create or replace function lia_normalizar_email()
returns trigger as $$
begin
  new.email := nullif(lower(trim(new.email)), '');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mentorados_email_lower on mentorados;
create trigger trg_mentorados_email_lower
  before insert or update of email on mentorados
  for each row execute function lia_normalizar_email();

update mentorados set email = lower(trim(email)) where email is not null;

/* ---------- 2. Espelho das faturas ---------- */

create table if not exists lia_cobrancas (
  id                uuid primary key default gen_random_uuid(),

  lia_bill_id       text not null unique,
  lia_order_id      text,
  lia_billing_id    text,

  -- Nulo enquanto não se sabe de quem é: a cobrança fica órfã e é adotada
  -- quando o mentorado ganhar o e-mail ou o order_id.
  mentorado_id      uuid references mentorados(id) on delete set null,

  bill_type         text,             -- down_payment (entrada) | installment (parcela)
  status            text not null,    -- pending | paid | canceled | overdue (texto livre)
  numero_parcela    integer,

  amount_cents      integer not null default 0,
  paid_amount_cents integer not null default 0,
  payment_method    text,             -- pix | boleto | credit_card
  due_date          date,
  paid_at           timestamptz,
  checkout_url      text,
  contact_email     text,

  -- updated_at que veio da Lia: é o que permite descartar webhook atrasado.
  lia_updated_at    timestamptz,
  payload           jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_lia_cobrancas_mentorado on lia_cobrancas (mentorado_id);
create index if not exists idx_lia_cobrancas_order     on lia_cobrancas (lia_order_id);
create index if not exists idx_lia_cobrancas_email     on lia_cobrancas (lower(contact_email));

drop trigger if exists trg_lia_cobrancas_updated on lia_cobrancas;
create trigger trg_lia_cobrancas_updated
  before update on lia_cobrancas
  for each row execute function set_updated_at();

/* Mesmo recorte de `parcelas`: dinheiro é assunto de admin e diretoria.
   Mentor não vê — e aqui isso importa mais que em `parcelas`, porque o
   `payload` guarda o webhook cru, com contato e documento do cliente. */
alter table lia_cobrancas enable row level security;

drop policy if exists lia_cobrancas_admin_all on lia_cobrancas;
create policy lia_cobrancas_admin_all on lia_cobrancas
  for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

drop policy if exists lia_cobrancas_diretoria_select on lia_cobrancas;
create policy lia_cobrancas_diretoria_select on lia_cobrancas
  for select using (get_my_role() = 'diretoria');

/* ---------- 3. Log de webhooks ---------- */
-- Serve a três coisas: idempotência (a Lia reenvia), auditoria de assinatura
-- inválida, e diagnóstico de cobrança que chegou sem dono.

create table if not exists lia_eventos (
  id                 uuid primary key default gen_random_uuid(),
  lia_delivery_id    text unique,   -- "id" do envelope: processa uma única vez
  entity             text,          -- order | billing | bill
  event              text,          -- paid | pending | canceled | overdue | ...
  assinatura_valida  boolean not null default false,
  status             text not null, -- processado | sem_vinculo | ignorado | duplicado | erro
  detalhe            text,
  mentorado_id       uuid references mentorados(id) on delete set null,
  payload            jsonb,
  recebido_em        timestamptz not null default now()
);

create index if not exists idx_lia_eventos_recebido on lia_eventos (recebido_em desc);
create index if not exists idx_lia_eventos_status   on lia_eventos (status);

-- Só admin. Diretoria não precisa de log cru para decidir nada.
alter table lia_eventos enable row level security;

drop policy if exists lia_eventos_admin_all on lia_eventos;
create policy lia_eventos_admin_all on lia_eventos
  for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

/* ---------- 4. Parcelas passam a ter dono ---------- */

alter table parcelas add column if not exists lia_bill_id text;

create unique index if not exists parcelas_lia_bill_unico
  on parcelas (lia_bill_id) where lia_bill_id is not null;

comment on column parcelas.lia_bill_id is
  'Preenchido = a linha veio da Lia e é ela quem manda; a tela não deixa editar '
  'à mão. Nulo = linha registrada por uma pessoa. É por este campo que o sync '
  'sabe o que pode substituir.';

/* O CHECK antigo travava em 12 porque a trilha tinha 12 parcelas por desenho.
   A Lia parcela no que o cliente contratar — 8, 10, 18 — e um plano fora dessa
   faixa faria o webhook falhar em silêncio, deixando a ficha desatualizada sem
   nenhum aviso. O piso continua: parcela 0 ou negativa não existe. */
alter table parcelas drop constraint if exists parcelas_numero_check;
alter table parcelas add constraint parcelas_numero_check check (numero >= 1 and numero <= 60);

commit;
