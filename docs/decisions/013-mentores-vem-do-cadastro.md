# AD-013 — Os mentores vêm do cadastro, não de uma lista no código

- **Status**: active
- **Date**: 2026-10-29
- **Scope**: migration `20261029_mentores_do_cadastro.sql` (`profiles.nome_mentor`, trigger `preencher_nome_mentor`, rpc `mentores_ativos()`), `Dataset.mentores`, `src/lib/mentores.ts`, `src/lib/matriz.ts`, formulários de sessão, edge functions `sync-google-calendar` e `circle-presenca`.

## Contexto

Mentor cadastrado na tela Usuários não aparecia em nenhum select de sessão: a lista era
`MENTORES` em `src/lib/constantes.ts`, repetida no `EMAIL_MENTOR`/aliases do sync do Google
Agenda e no `MENTORES` do circle-presenca. Mentor novo exigia editar três arquivos e
publicar; sem isso o sync gravava as sessões dele como "sem mentor identificado", calado.

## Decisão

`profiles` com `role = 'mentor'` é a única fonte. `sessoes.mentor` continua texto, então o
perfil ganhou `nome_mentor`: a grafia gravada nas sessões (`profiles.nome` é o nome completo,
"Luan Alves Maker", e não casa com "Luan").

- O trigger preenche `nome_mentor` com o primeiro nome quando o perfil vira mentor, ou o nome
  inteiro se o primeiro já é de outro mentor. Nunca reescreve: trocar o nome do perfil não
  parte o histórico em dois. Corrigir a grafia é um `update` direto na coluna.
- O app lê a lista por `mentores_ativos()` (`security definer`): o mentor só lê o próprio perfil.
- Quem saiu do projeto (Israel, Evaldo) não tem perfil: aparece pelos nomes gravados nas
  sessões, como histórico. `MENTORES_HIST` deixou de existir.
- O sync casa pelo e-mail do perfil e, como fallback, pelo `nome_mentor` no título — exceto
  quando ele é também primeiro nome de um mentorado ativo (o caso André × André Bertozzi,
  que antes era uma exceção escrita à mão).

## Consequências

- Perderam-se as variantes de grafia do fallback por título (`diovane`, `michele`,
  `gabriela`…) e os e-mails legados (`diovane_martins@hotmail.com`, o do Evaldo). Só afetam
  evento antigo, e o sync nunca apaga um mentor já gravado (só escreve quando acha um).
- Rebaixar um mentor para outro papel o tira dos formulários; as sessões dele seguem no histórico.
