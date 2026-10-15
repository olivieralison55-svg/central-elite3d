# AD-002 — O mentor vê a adesão da Pesquisa de Experiência, só o número

- **Status**: active
- **Date**: 2026-10-13
- **Scope**: `experiencia_adesao()` (migration `20261013_experiencia_adesao.sql`), dashboard do mentor.
- **Decided by**: Lucas. Abre uma exceção ao "nada vai para os mentores" do AD-001.

## Contexto

O Lucas pediu para sinalizar os mentores quando as respostas da Pesquisa de Experiência
caírem, para eles reforçarem o convite com os mentorados. O AD-001 deixava as pesquisas e a
Análise IA só para admin e diretoria, e o RLS de `experiencia_respostas` barra o mentor.

## Decisão

- O mentor recebe **só a adesão**: respostas da Pesquisa de Experiência contra mentorados
  ativos com sessão 1:1 concluída, as duas contagens desde `INICIO_COBRANCA_NPS` (13/10/2026).
  Sessão realizada há menos de `PRAZO_RESPOSTA_DIAS` (2 dias, o prazo padrão de resposta)
  não entra no denominador — a mesma regra do alerta de satisfação pendente do admin.
  Nunca o conteúdo, a nota ou o NPS.
- A contagem vem da RPC `experiencia_adesao(p_desde, p_prazo_dias)`, `security definer`, com grant para
  `authenticated`. O RLS das tabelas fica como estava.
- A pesquisa é **anônima**, então o aviso é geral: igual para todos os mentores, sem nome de
  quem falta e sem atribuir a um mentor.
- O aviso aparece quando a taxa fica abaixo de `META_ADESAO_EXP` (70%, constante no
  `index.html`, marcada como ponto de ajuste). Admin e diretoria não veem esse aviso: eles têm
  o totalizador no "Precisa de atenção agora".

## Quando revisitar

Se a gestão quiser a meta configurável sem deploy, ou se a pesquisa deixar de ser anônima.
Nesse caso o aviso pode passar a ser por mentor.
