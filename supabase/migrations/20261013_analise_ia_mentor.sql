-- Análise IA para mentores: o recorte que o mentor pode ler.
--
-- O mentor não tem SELECT em nps_analises (a linha inteira inclui o resumo da
-- gestão e a leitura de cada mentor). Esta função devolve só a última análise
-- sem `resumo` e `mentores`, e sem os alertas de tipo "mentor" — o que sobra é
-- o que pede ação junto ao mentorado ou à mentoria. Decisão em docs/decisions/005.

begin;

create or replace function analise_ia_mentor()
returns table (gerado_em timestamptz, modelo text, respostas integer, alertas jsonb, mentorados jsonb)
language sql stable security definer set search_path = public as $$
  select a.gerado_em, a.modelo, a.respostas,
         coalesce((select jsonb_agg(x) from jsonb_array_elements(a.alertas) x where x->>'tipo' <> 'mentor'), '[]'::jsonb),
         a.mentorados
  from nps_analises a
  where get_my_role() in ('admin', 'mentor')
  order by a.gerado_em desc
  limit 1
$$;

revoke all on function analise_ia_mentor() from public, anon;
grant execute on function analise_ia_mentor() to authenticated;

commit;
