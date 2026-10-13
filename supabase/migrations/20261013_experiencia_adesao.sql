-- Adesão à Pesquisa de Experiência, para o aviso dos mentores (AD-002).
--
-- Mentor não lê `experiencia_respostas` (RLS só admin e diretoria, AD-001), mas
-- precisa saber se a adesão caiu para reforçar o convite. A função devolve só
-- dois números — respostas e mentorados ativos com sessão 1:1 concluída desde
-- `p_desde` — nunca o conteúdo. `security definer` porque o mentor não alcança
-- as tabelas; a pesquisa é anônima, então a contagem não identifica ninguém.
-- `p_prazo_dias`: sessão realizada há menos que isso ainda está no prazo padrão
-- de resposta e não entra no denominador.
drop function if exists experiencia_adesao(date);
create or replace function experiencia_adesao(p_desde date, p_prazo_dias int default 2)
returns table (respostas bigint, mentorados_com_sessao bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from experiencia_respostas
      where (respondido_em at time zone 'America/Sao_Paulo')::date >= p_desde),
    (select count(distinct s.mentorado_id) from sessoes s join mentorados m on m.id = s.mentorado_id
      where s.status = 'Concluída' and s.data >= p_desde
        and s.data <= (now() at time zone 'America/Sao_Paulo')::date - p_prazo_dias
        and s.etapa not in ('Plantão de Dúvida Semanal', 'Sessão de Implementação Mensal')
        and coalesce(m.situacao, case when m.cancelado then 'cancelado' else 'ativo' end) = 'ativo');
$$;

revoke all on function experiencia_adesao(date, int) from public, anon;
grant execute on function experiencia_adesao(date, int) to authenticated;
