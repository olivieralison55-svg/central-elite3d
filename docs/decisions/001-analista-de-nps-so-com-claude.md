# AD-001 — O analista de NPS é só Claude, sem JEV

- **Status**: active
- **Date**: 2026-10-08
- **Scope**: `supabase/functions/nps-analista/`, `nps_analises`, tela NPS.
- **Decided by**: Lucas, sobre a medição abaixo.

## Contexto

O Lucas pediu um analista de IA que lê o NPS das sessões e a Pesquisa de Experiência e
gera avisos para a gestão, e pediu para medir se o Jev (TypeSafe, o modelo "System One" já
usado no holdon-shorts — AD-010 da plataforma-product-ops) poderia fazer a parte de score.

Também decidido nesta data: os avisos ficam **só para admin e diretoria**, sem notificar
mentores; o analista roda **uma vez por dia, só quando entrou resposta nova**.

## Medição (2026-10-08, cega)

Cada modelo recebeu só o texto e previu a faixa NPS (promotor 9–10, neutro 7–8, detrator
0–6), comparada com a nota real. 14 itens: 10 comentários do NPS da sessão (todos 9–10) e
4 respostas da Pesquisa de Experiência (notas 2, 5, 5, 10; as 6 perguntas abertas juntas).

| | acertos | latência média |
|---|---|---|
| Jev (`jev-latest`, `choice` + `score`) | 12/14 | 0,36 s |
| Claude (`claude-opus-5-5`) | 12/14 | 2,46 s |

Os dois erraram a mesma resposta de experiência (nota 5 lida como neutro). O Jev errou o
comentário de uma linha "A didática é as ideias" (nota 10 → neutro); o Claude, um
comentário de nota 9 (→ neutro).

## Decisão

Só Claude. O Jev empata na classificação, mas:

- **não escreve** — o aviso precisa de texto (resumo, evidência, ação), então o LLM entra de
  qualquer jeito;
- **a nota já existe** — prever a faixa pelo texto repete um número que o formulário já deu;
- **o volume é mínimo** — uma chamada por dia, só com novidade; um segundo fornecedor e uma
  segunda chave não se pagam.

## Quando revisitar

Com 100+ respostas, se surgir uma tarefa de classificação por resposta que o formulário não
dá (tema da crítica, contradição nota × texto) e o volume tornar a latência ou o custo do LLM
relevantes. A amostra de 14, com 11 promotores, não separa os dois modelos.
