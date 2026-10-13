# AD-005 — Mentor vê a Análise IA num recorte servido pelo banco

- **Status**: active
- **Date**: 2026-10-13
- **Scope**: `index.html` (`renderIa`, `iaGeral`, `telaPessoa`, capacidade `verIa`), função `analise_ia_mentor()` (migration `20261013_analise_ia_mentor.sql`).

## Decisão

O mentor entra na Análise IA com duas abas: **Visão geral** e **Por mentorado**.
A visão geral dele só traz os alertas de tipo `mentorado` e `mentoria`, sem o
resumo da gestão. Ele não vê a aba **Por mentor** nem as respostas de NPS dentro
da leitura de um mentorado.

## Por quê

- O recorte é feito no banco, não na tela. `nps_analises` continua legível só
  para admin e diretoria. O mentor lê pela função `security definer`
  `analise_ia_mentor()`, que devolve a última análise sem `resumo`, sem
  `mentores` e sem os alertas de tipo `mentor`. Esconder só no front deixaria a
  leitura de todos os mentores a um `select` de distância pela API.
- O resumo é escrito para a gestão (o prompt do `nps-analista` diz isso) e pode
  citar mentores, por isso fica fora em vez de ser filtrado.

## Particularidades

- O mentor vê a leitura de **todos** os mentorados, não só os dele: `profiles`
  não liga o usuário ao nome do mentor usado em `sessoes.mentor`. Filtrar por
  mentor exige essa ligação primeiro.
- `verIa` sem `verFinanceiro` é o que identifica o recorte do mentor na tela.
