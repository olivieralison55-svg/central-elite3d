-- Validação mensal do faturamento dos mentores (processo "Comprovação e validação de faturamento").
--
-- O mentor envia, no 1º dia útil até 12h, os relatórios das lojas e o resumo do mês anterior; o
-- admin confere no 2º e 3º dias úteis, faz os Meets necessários e fecha até o 4º; o pagamento sai no
-- 5º. O fechamento grava o faturamento elegível, a faixa vigente, as sessões individuais pagas e o
-- valor — e daí em diante a linha não muda mais.
--
-- Regras de faixa (decididas com a operação em 29/10/2026):
--   promoção      3 meses validados seguidos acima da faixa vigente, com Meet; vale no mês seguinte
--   rebaixamento  1 mês abaixo do piso da faixa vigente, após apuração e comunicação; vale no seguinte
--   pagamento     valor hora vigente × sessões individuais concluídas (sessão = 1 hora); falta do
--                 mentorado não conta
-- A conta das faixas mora no front (src/lib/faturamento.ts); aqui ficam o registro e as travas.
--
-- O mentor é identificado pelo nome gravado em `sessoes.mentor` ("Luan"), não pelo login. Por isso
-- `profiles.mentor_nome`: é ele que liga o login do mentor às sessões e às linhas desta validação.

begin;

/* ---------- 0. Falta do mentorado ---------- */
-- "Não compareceu": a sessão fica no histórico, mas não é paga nem conta como etapa cumprida.
alter table sessoes drop constraint if exists sessoes_status_valido;
alter table sessoes add constraint sessoes_status_valido check (
  status is null or status = any (array[
    'Não iniciada', 'Agendada', 'Aguardando confirmação', 'Concluída', 'Bloqueada', 'Não compareceu'
  ])
);

/* ---------- 1. Login do mentor → nome nas sessões ---------- */
alter table profiles add column if not exists mentor_nome text;

comment on column profiles.mentor_nome is
  'Nome do mentor como gravado em sessoes.mentor (ex.: "Luan"). Liga o login às sessões e à '
  'validação de faturamento. Nulo para quem não é mentor ou ainda não foi ligado.';

-- Os mentores com login hoje. Leonardo Donadel fica nulo: não há sessão dele em `sessoes` ainda.
update profiles set mentor_nome = v.mentor
from (values
  ('Luan Alves Maker', 'Luan'),
  ('Diovani Mentor',   'Diovani'),
  ('Michelle Mentora', 'Michelle'),
  ('Petare Mentor',    'Petare'),
  ('Sergio Mentor',    'Sergio'),
  ('André',            'André'),
  ('Gabriella',        'Gabriella')
) as v(nome, mentor)
where profiles.nome = v.nome and profiles.role = 'mentor' and profiles.mentor_nome is null;

-- `profiles_update_own` deixa o usuário editar a própria linha: sem esta trava, um mentor poderia
-- se ligar ao nome de outro e enxergar a validação dele.
create or replace function profiles_trava_mentor_nome()
returns trigger language plpgsql as $$
begin
  if new.mentor_nome is distinct from old.mentor_nome and coalesce(public.get_my_role(), '') <> 'admin'
     and auth.uid() is not null then
    raise exception 'Só o admin liga o login a um mentor';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_trava_mentor_nome on profiles;
create trigger trg_profiles_trava_mentor_nome
  before update of mentor_nome on profiles
  for each row execute function profiles_trava_mentor_nome();

create or replace function meu_mentor_nome()
returns text language sql stable security definer set search_path to 'public' as $$
  select mentor_nome from public.profiles where id = auth.uid();
$$;

/* ---------- 2. Faixas de remuneração ---------- */
create table if not exists faixas_remuneracao (
  id         smallint primary key,
  piso       numeric(14,2) not null,       -- inclusivo
  teto       numeric(14,2),                -- inclusivo; nulo = sem teto
  valor_hora numeric(10,2) not null,
  check (teto is null or teto > piso)
);

comment on table faixas_remuneracao is
  'Faixa de faturamento mensal elegível (rota Marketplace) → valor hora da sessão individual.';

insert into faixas_remuneracao (id, piso, teto, valor_hora) values
  (1,  10000.00,  20000.00,  75),
  (2,  20000.01,  50000.00, 100),
  (3,  50000.01, 100000.00, 200),
  (4, 100000.01, 200000.00, 300),
  (5, 200000.01, 500000.00, 400),
  (6, 500000.01,      null, 500)
on conflict (id) do nothing;

alter table faixas_remuneracao enable row level security;

drop policy if exists faixas_select on faixas_remuneracao;
create policy faixas_select on faixas_remuneracao for select to authenticated
  using (get_my_role() in ('admin', 'diretoria', 'mentor'));

drop policy if exists faixas_admin_all on faixas_remuneracao;
create policy faixas_admin_all on faixas_remuneracao for all to authenticated
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

/* ---------- 3. Lojas cadastradas do mentor ---------- */
create table if not exists mentor_lojas (
  id          uuid primary key default gen_random_uuid(),
  mentor      text not null,
  marketplace text not null check (marketplace in ('Shopee', 'Mercado Livre', 'Outro')),
  nome        text not null,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table mentor_lojas enable row level security;

-- Cadastro de loja é do admin: o processo confere relatório "das lojas previamente cadastradas".
drop policy if exists mentor_lojas_admin_all on mentor_lojas;
create policy mentor_lojas_admin_all on mentor_lojas for all to authenticated
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

drop policy if exists mentor_lojas_select on mentor_lojas;
create policy mentor_lojas_select on mentor_lojas for select to authenticated
  using (get_my_role() = 'diretoria' or (get_my_role() = 'mentor' and mentor = meu_mentor_nome()));

/* ---------- 4. A validação do mês ---------- */
create table if not exists validacao_faturamento (
  id                   uuid primary key default gen_random_uuid(),
  mentor               text not null,
  competencia          date not null check (extract(day from competencia) = 1),
  estado               text not null default 'rascunho' check (estado in (
                         'rascunho', 'enviado', 'em_conferencia', 'ajuste_pedido',
                         'meet_agendado', 'validado', 'pago')),

  -- Envio do mentor
  enviado_em           timestamptz,       -- carimbado pelo banco, não pelo navegador
  alteracao_lojas      boolean,
  alteracao_lojas_obs  text,
  obs_mentor           text,

  -- Conferência do admin
  checklist            jsonb not null default '{}'::jsonb,
  motivo_ajuste        text,
  meet_motivo          text check (meet_motivo in ('cadastro_inicial', 'promocao', 'divergencia')),
  meet_em              timestamptz,
  obs_admin            text,

  -- Fechamento (congelado ao validar)
  faturamento_elegivel numeric(14,2),
  faixa_do_mes         smallint references faixas_remuneracao(id),
  faixa_vigente        smallint references faixas_remuneracao(id),
  faixa_seguinte       smallint references faixas_remuneracao(id),
  mudanca              text check (mudanca in ('promocao', 'rebaixamento')),
  comunicado_em        timestamptz,
  sessoes_ids          uuid[],
  sessoes_qtd          integer,
  valor_hora           numeric(10,2),
  valor_pagar          numeric(12,2),
  validado_por         uuid references auth.users(id),
  validado_em          timestamptz,
  pago_em              date,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (mentor, competencia)
);

comment on table validacao_faturamento is
  'Uma linha por mentor e mês de competência. Validada, só muda para "pago"; correção posterior '
  'entra como evento em validacao_eventos.';

/* As travas que o RLS não alcança (ele olha a linha, não a coluna nem a transição):
   - mentor só cria/edita em rascunho ou ajuste pedido, só move para rascunho/enviado, e não toca
     em coluna de conferência ou fechamento;
   - validada, a linha só anda para "pago";
   - envio e validação são carimbados aqui. */
create or replace function validacao_faturamento_travas()
returns trigger language plpgsql as $$
declare
  papel text := coalesce(public.get_my_role(), '');
  servico boolean := auth.uid() is null;   -- SQL Editor / service role
begin
  new.updated_at := now();

  if not servico and papel <> 'admin' then
    if tg_op = 'UPDATE' and old.estado not in ('rascunho', 'ajuste_pedido') then
      raise exception 'Este mês já está com a operação; peça ajuste ao responsável';
    end if;
    if new.estado not in ('rascunho', 'enviado') then
      raise exception 'O mentor só salva rascunho ou envia';
    end if;
    if tg_op = 'INSERT' then
      if new.checklist <> '{}'::jsonb or new.faturamento_elegivel is not null or new.faixa_vigente is not null
         or new.valor_pagar is not null or new.validado_por is not null or new.motivo_ajuste is not null then
        raise exception 'Campos de conferência são do admin';
      end if;
    elsif (new.checklist, new.motivo_ajuste, new.meet_motivo, new.meet_em, new.obs_admin,
           new.faturamento_elegivel, new.faixa_do_mes, new.faixa_vigente, new.faixa_seguinte, new.mudanca,
           new.comunicado_em, new.sessoes_ids, new.sessoes_qtd, new.valor_hora, new.valor_pagar,
           new.validado_por, new.validado_em, new.pago_em, new.mentor, new.competencia)
          is distinct from
          (old.checklist, old.motivo_ajuste, old.meet_motivo, old.meet_em, old.obs_admin,
           old.faturamento_elegivel, old.faixa_do_mes, old.faixa_vigente, old.faixa_seguinte, old.mudanca,
           old.comunicado_em, old.sessoes_ids, old.sessoes_qtd, old.valor_hora, old.valor_pagar,
           old.validado_por, old.validado_em, old.pago_em, old.mentor, old.competencia) then
      raise exception 'Campos de conferência são do admin';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.estado in ('validado', 'pago') and not servico then
    if new.estado <> 'pago'
       or (new.faturamento_elegivel, new.faixa_vigente, new.faixa_seguinte, new.sessoes_ids, new.valor_pagar)
          is distinct from
          (old.faturamento_elegivel, old.faixa_vigente, old.faixa_seguinte, old.sessoes_ids, old.valor_pagar) then
      raise exception 'Mês validado não muda; registre um ajuste posterior';
    end if;
  end if;

  if new.estado = 'enviado' and (tg_op = 'INSERT' or old.estado <> 'enviado') then
    new.enviado_em := now();
  end if;

  if new.estado = 'validado' and (tg_op = 'INSERT' or old.estado <> 'validado') then
    if new.faturamento_elegivel is null or new.faixa_vigente is null or new.sessoes_qtd is null
       or new.valor_pagar is null then
      raise exception 'Para validar, grave elegível, faixa vigente, sessões e valor';
    end if;
    new.validado_por := auth.uid();
    new.validado_em := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validacao_faturamento_travas on validacao_faturamento;
create trigger trg_validacao_faturamento_travas
  before insert or update on validacao_faturamento
  for each row execute function validacao_faturamento_travas();

alter table validacao_faturamento enable row level security;

drop policy if exists validacao_admin_all on validacao_faturamento;
create policy validacao_admin_all on validacao_faturamento for all to authenticated
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

drop policy if exists validacao_diretoria_select on validacao_faturamento;
create policy validacao_diretoria_select on validacao_faturamento for select to authenticated
  using (get_my_role() = 'diretoria');

drop policy if exists validacao_mentor_select on validacao_faturamento;
create policy validacao_mentor_select on validacao_faturamento for select to authenticated
  using (get_my_role() = 'mentor' and mentor = meu_mentor_nome());

drop policy if exists validacao_mentor_insert on validacao_faturamento;
create policy validacao_mentor_insert on validacao_faturamento for insert to authenticated
  with check (get_my_role() = 'mentor' and mentor = meu_mentor_nome());

drop policy if exists validacao_mentor_update on validacao_faturamento;
create policy validacao_mentor_update on validacao_faturamento for update to authenticated
  using (get_my_role() = 'mentor' and mentor = meu_mentor_nome())
  with check (get_my_role() = 'mentor' and mentor = meu_mentor_nome());

/* ---------- 5. Lojas do mês (o detalhe de cada relatório) ---------- */
create table if not exists validacao_lojas (
  id             uuid primary key default gen_random_uuid(),
  validacao_id   uuid not null references validacao_faturamento(id) on delete cascade,
  loja_id        uuid references mentor_lojas(id) on delete set null,
  marketplace    text not null,
  loja_nome      text not null,
  periodo_inicio date not null,
  periodo_fim    date not null,
  vendas         numeric(14,2) not null default 0,
  pedidos        integer not null default 0,
  cancelamentos  numeric(14,2) not null default 0,
  devolucoes     numeric(14,2) not null default 0,
  reembolsos     numeric(14,2) not null default 0,
  elegivel       numeric(14,2) generated always as (vendas - cancelamentos - devolucoes - reembolsos) stored,
  arquivo_path   text,
  created_at     timestamptz not null default now(),
  check (periodo_fim >= periodo_inicio)
);

create index if not exists validacao_lojas_validacao on validacao_lojas (validacao_id);

-- O mentor mexe nas lojas do próprio mês só enquanto o mês está com ele.
create or replace function validacao_editavel_pelo_mentor(vid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.validacao_faturamento v
    where v.id = vid and v.mentor = public.meu_mentor_nome() and v.estado in ('rascunho', 'ajuste_pedido')
  );
$$;

create or replace function validacao_e_minha(vid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.validacao_faturamento v where v.id = vid and v.mentor = public.meu_mentor_nome());
$$;

alter table validacao_lojas enable row level security;

drop policy if exists validacao_lojas_admin_all on validacao_lojas;
create policy validacao_lojas_admin_all on validacao_lojas for all to authenticated
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

drop policy if exists validacao_lojas_leitura on validacao_lojas;
create policy validacao_lojas_leitura on validacao_lojas for select to authenticated
  using (get_my_role() = 'diretoria' or (get_my_role() = 'mentor' and validacao_e_minha(validacao_id)));

drop policy if exists validacao_lojas_mentor_escrita on validacao_lojas;
create policy validacao_lojas_mentor_escrita on validacao_lojas for all to authenticated
  using (get_my_role() = 'mentor' and validacao_editavel_pelo_mentor(validacao_id))
  with check (get_my_role() = 'mentor' and validacao_editavel_pelo_mentor(validacao_id));

/* ---------- 6. Histórico (só cresce) ---------- */
create table if not exists validacao_eventos (
  id           uuid primary key default gen_random_uuid(),
  validacao_id uuid not null references validacao_faturamento(id) on delete cascade,
  tipo         text not null,     -- estado:<novo> | comunicacao | ajuste_posterior | nota
  detalhe      text,
  autor        uuid default auth.uid() references auth.users(id),
  criado_em    timestamptz not null default now()
);

create index if not exists validacao_eventos_validacao on validacao_eventos (validacao_id, criado_em);

-- Toda troca de estado vira evento, gravada pelo banco: o histórico não depende da tela lembrar.
create or replace function validacao_faturamento_log()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into public.validacao_eventos (validacao_id, tipo, detalhe, autor)
    values (new.id, 'estado:' || new.estado,
            case when new.estado = 'ajuste_pedido' then new.motivo_ajuste
                 when new.estado = 'meet_agendado' then new.meet_motivo end,
            auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validacao_faturamento_log on validacao_faturamento;
create trigger trg_validacao_faturamento_log
  after insert or update on validacao_faturamento
  for each row execute function validacao_faturamento_log();

alter table validacao_eventos enable row level security;

drop policy if exists validacao_eventos_admin_insert on validacao_eventos;
create policy validacao_eventos_admin_insert on validacao_eventos for insert to authenticated
  with check (get_my_role() = 'admin' and autor = auth.uid());

drop policy if exists validacao_eventos_leitura on validacao_eventos;
create policy validacao_eventos_leitura on validacao_eventos for select to authenticated
  using (get_my_role() in ('admin', 'diretoria') or (get_my_role() = 'mentor' and validacao_e_minha(validacao_id)));

/* ---------- 7. Relatórios anexados ---------- */
-- Caminho: <mentor>/<AAAA-MM>/<arquivo>. Privado, por link assinado. Sem update nem delete: o
-- relatório enviado é a prova do mês e não some.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faturamento-relatorios',
  'faturamento-relatorios',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists faturamento_relatorios_select on storage.objects;
create policy faturamento_relatorios_select on storage.objects
  for select to authenticated
  using (bucket_id = 'faturamento-relatorios' and (
    public.get_my_role() in ('admin', 'diretoria')
    or (public.get_my_role() = 'mentor' and (storage.foldername(name))[1] = public.meu_mentor_nome())
  ));

drop policy if exists faturamento_relatorios_insert on storage.objects;
create policy faturamento_relatorios_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'faturamento-relatorios' and (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'mentor' and (storage.foldername(name))[1] = public.meu_mentor_nome())
  ));

commit;
