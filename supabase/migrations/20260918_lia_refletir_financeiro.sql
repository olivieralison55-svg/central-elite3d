-- A regra de "refletir cobrança no financeiro", em um lugar só
--
-- Ela nasceu em TypeScript, dentro da edge function, porque só o webhook
-- precisava dela. Agora a aplicação também precisa: ao adotar uma cobrança
-- órfã, as parcelas têm que ser refeitas do mesmo jeito.
--
-- Escrever de novo no front deixaria a mesma regra em dois lugares, divergindo
-- em silêncio na primeira vez que alguém mexesse num só. No banco, webhook e
-- aplicação chamam a mesma função.
--
-- SECURITY INVOKER de propósito: quem chama pela aplicação passa pelo RLS, e só
-- admin tem policy de escrita em `parcelas` e `mentorados`. A edge function usa
-- service_role e continua passando por cima, como toda automação daqui.

begin;

create or replace function lia_refletir_financeiro(p_mentorado uuid)
returns void as $$
declare
  v_entrada_status    text;
  v_restante_status   text;
  v_entrada_forma     text;
  v_restante_forma    text;
  v_n_entrada         int;
  v_n_entrada_pagas   int;
  v_n_parcelas        int;
  v_n_parcelas_pagas  int;
  v_todas_pagas       boolean;
  v_metodo            text;
  v_patch_entrada     boolean := false;
  v_patch_restante    boolean := false;
begin
  select entrada_status, restante_status, entrada_forma_pgto, restante_forma_pgto
    into v_entrada_status, v_restante_status, v_entrada_forma, v_restante_forma
    from mentorados where id = p_mentorado;
  if not found then return; end if;

  -- Cobrança cancelada não conta para nada.
  select count(*) filter (where bill_type = 'down_payment'),
         count(*) filter (where bill_type = 'down_payment' and status = 'paid'),
         count(*) filter (where bill_type is distinct from 'down_payment'),
         count(*) filter (where bill_type is distinct from 'down_payment' and status = 'paid'),
         bool_and(status = 'paid')
    into v_n_entrada, v_n_entrada_pagas, v_n_parcelas, v_n_parcelas_pagas, v_todas_pagas
    from lia_cobrancas
   where mentorado_id = p_mentorado and status <> 'canceled';

  -- Nenhuma cobrança válida: não há o que refletir.
  if coalesce(v_n_entrada, 0) + coalesce(v_n_parcelas, 0) = 0 then return; end if;

  /* Patrocinado e Cancelou são decisão de pessoa, que a Lia não tem como saber:
     patrocinado não gera cobrança e cancelado é decisão de contrato. */
  if v_n_entrada > 0 and coalesce(v_entrada_status, '') not in ('Patrocinado', 'Cancelou') then
    v_entrada_status := case
      when v_n_entrada_pagas = 0          then 'Ainda não'
      when v_n_entrada_pagas = v_n_entrada then 'Pago'
      else 'Pago parcial' end;
    v_patch_entrada := true;
  end if;

  if coalesce(v_restante_status, '') not in ('Patrocinado', 'Cancelou') then
    v_restante_status := case
      when v_n_parcelas = 0 then (case when v_todas_pagas then 'Pago' else 'Ainda não' end)
      when v_n_parcelas_pagas = 0           then 'Ainda não'
      when v_n_parcelas_pagas = v_n_parcelas then 'Pago'
      else 'Pago parcial' end;
    v_patch_restante := true;
  end if;

  /* Forma de pagamento só preenche campo vazio — escolha de pessoa não é
     sobrescrita por inferência. E método desconhecido não vira "Outro": o campo
     ficaria travado com o valor errado, já que só se preenche o que está vazio. */
  if v_entrada_forma is null then
    select payment_method into v_metodo from lia_cobrancas
     where mentorado_id = p_mentorado and status <> 'canceled' and payment_method is not null
     order by (status = 'paid') desc, due_date nulls last limit 1;
    if v_metodo is not null then
      v_entrada_forma := coalesce(
        case v_metodo when 'pix' then 'Pix' when 'boleto' then 'Boleto'
                      when 'credit_card' then 'Cartão de crédito' end, 'Outro');
    end if;
  end if;

  if v_restante_forma is null and v_n_parcelas > 0 then
    if v_n_parcelas > 1 then
      v_restante_forma := 'Parcelado';
    else
      select payment_method into v_metodo from lia_cobrancas
       where mentorado_id = p_mentorado and status <> 'canceled'
         and bill_type is distinct from 'down_payment' and payment_method is not null
       order by (status = 'paid') desc limit 1;
      if v_metodo is not null then
        v_restante_forma := coalesce(
          case v_metodo when 'pix' then 'Pix' when 'boleto' then 'Boleto'
                        when 'credit_card' then 'Cartão de crédito' end, 'Outro');
      end if;
    end if;
  end if;

  update mentorados
     set entrada_status      = case when v_patch_entrada  then v_entrada_status  else entrada_status end,
         restante_status     = case when v_patch_restante then v_restante_status else restante_status end,
         entrada_forma_pgto  = coalesce(entrada_forma_pgto,  v_entrada_forma),
         restante_forma_pgto = coalesce(restante_forma_pgto, v_restante_forma)
   where id = p_mentorado;

  -- Sem parcelas vindas da Lia, as manuais ficam como estão.
  if v_n_parcelas = 0 then return; end if;

  /* Ordem importa: apagar antes de inserir. O único é (mentorado_id, numero), e
     uma linha manual no número 3 bloquearia a parcela 3 da Lia. */
  delete from parcelas where mentorado_id = p_mentorado and lia_bill_id is null;

  -- Cobrança cancelada some da ficha.
  delete from parcelas p using lia_cobrancas c
   where p.lia_bill_id = c.lia_bill_id and c.mentorado_id = p_mentorado and c.status = 'canceled';

  /* numero_parcela nem sempre vem no payload. O fallback é a posição por
     vencimento — a ordem em que a pessoa paga, e a que a ficha desenha. */
  insert into parcelas (mentorado_id, numero, status, vencimento, valor, lia_bill_id)
  select p_mentorado,
         coalesce(c.numero_parcela, row_number() over (order by c.due_date nulls last, c.lia_bill_id))::int,
         case when c.status = 'paid' then 'paga' else 'aberta' end,
         c.due_date,
         c.amount_cents / 100.0,
         c.lia_bill_id
    from lia_cobrancas c
   where c.mentorado_id = p_mentorado
     and c.status <> 'canceled'
     and c.bill_type is distinct from 'down_payment'
  on conflict (mentorado_id, numero) do update
     set status      = excluded.status,
         vencimento  = excluded.vencimento,
         valor       = excluded.valor,
         lia_bill_id = excluded.lia_bill_id;
end;
$$ language plpgsql;

comment on function lia_refletir_financeiro(uuid) is
  'Reflete as cobranças da Lia no financeiro do mentorado: entrada, restante, '
  'formas de pagamento e as linhas de `parcelas`. Implementação única — o '
  'webhook (service_role) e a aplicação (admin, ao adotar cobrança órfã) chamam '
  'esta mesma função. Escrever a regra de novo no front a faria divergir em '
  'silêncio.';

/* Adota as cobranças órfãs cujo e-mail bate com o do mentorado e reflete.
   Chamada ao salvar a ficha: e-mail preenchido ou corrigido puxa o que estava
   parado, sem ninguém precisar saber que havia algo parado. */
create or replace function lia_adotar_orfas(p_mentorado uuid)
returns integer as $$
declare
  v_email    text;
  v_adotadas integer;
begin
  select email into v_email from mentorados where id = p_mentorado;
  if v_email is null then return 0; end if;

  update lia_cobrancas set mentorado_id = p_mentorado
   where mentorado_id is null and lower(contact_email) = lower(v_email);
  get diagnostics v_adotadas = row_count;

  if v_adotadas > 0 then perform lia_refletir_financeiro(p_mentorado); end if;
  return v_adotadas;
end;
$$ language plpgsql;

commit;
