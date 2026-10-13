# Transcrições das calls 1:1 no contexto do analista

- **Status**: em debate com o time (não iniciado)
- **Date**: 2026-10-13

## Ideia

Levar o que é dito nas calls 1:1 para a leitura por mentorado da Análise IA
(prós, contras e pauta), junto com o NPS da sessão.

## O que existe hoje (medido em 2026-10-13)

- Nenhuma transcrição no sistema. Das 304 sessões `Concluída`, nenhuma tem link real:
  188 têm texto de exemplo em `link_gravacao`/`link_anotacoes` ("link anotação") e o
  resto está vazio.
- `sync-google-calendar` lê só os eventos da agenda `primary` da conta conectada
  (OAuth com refresh token); não lê Drive nem Meet.

## Caminho proposto

Se a call for um Meet criado pela conta central com transcrição ou anotações do
Gemini ligadas, o documento fica anexado ao evento (`attachments`). O sync, que já
casa evento → mentorado e etapa, baixa o texto pelo Drive e grava uma transcrição por
sessão; o `nps-analista` lê um resumo das últimas calls de cada mentorado.

## Perguntas para o time

1. Onde as transcrições são geradas hoje: Meet/Gemini, outra ferramenta (tl;dv,
   Fireflies, Read) ou ainda não existem?
2. Quem cria a reunião: a conta central ou cada mentor? Se for o mentor, o documento
   fica no Drive dele e a conta central não enxerga.
3. Aceitamos reautorizar o Google com leitura do Drive?
4. Privacidade: só admin e diretoria leem (mesmo RLS da Análise IA); o analista cita
   trechos curtos, nunca a call inteira. O mentorado precisa ser avisado?
