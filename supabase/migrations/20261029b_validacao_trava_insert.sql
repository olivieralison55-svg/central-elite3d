-- Emenda de 20261029_validacao_faturamento.sql. Na criação da linha pelo mentor, a trava só olhava
-- parte das colunas da conferência: chamando a API direto, ele podia nascer o mês com
-- `meet_motivo = 'promocao'` ou `comunicado_em` preenchidos e pular as exigências da validação.
-- Agora toda coluna da conferência e do fechamento tem de chegar vazia.

create or replace function validacao_faturamento_travas()
returns trigger language plpgsql as $$
declare
  papel text := coalesce(public.get_my_role(), '');
  servico boolean := auth.uid() is null;
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
      if new.checklist <> '{}'::jsonb
         or num_nonnulls(new.motivo_ajuste, new.meet_motivo, new.meet_em, new.obs_admin,
              new.faturamento_elegivel, new.faixa_do_mes, new.faixa_vigente, new.faixa_seguinte, new.mudanca,
              new.comunicado_em, new.sessoes_ids, new.sessoes_qtd, new.valor_hora, new.valor_pagar,
              new.validado_por, new.validado_em, new.pago_em) > 0 then
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
