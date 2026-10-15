# AD-007 — Front em Next.js: dados só no browser, por uma porta única

- **Status**: active (o Lucas aprovou o `tasks.md` da migração em 14/10/2026).
- **Date**: 2026-10-13
- **Scope**: todo código em `src/`; `.specs/features/migracao-nextjs/`.
- **Decided by**: o orquestrador, no Design da migração, pela opção mais segura dentro da spec.
- **Detalhe**: `.specs/features/migracao-nextjs/design.md` (abordagem, componentes, riscos).

## Decisão

1. **Dado só no browser.** Toda leitura e escrita sai do cliente, com a sessão do Supabase Auth do
   usuário. Server Component, rota do Next e middleware não tocam o banco. O app não tem
   `service_role`. O RLS continua sendo a única autorização (AD-006, mapeamento §5.3).
2. **Uma porta.** `src/lib/data/` é o único lugar que importa `@supabase/supabase-js`. Toda resposta
   passa por um schema Zod. Leitura de lista é paginada de 1.000 em 1.000, na ordem de hoje e com
   desempate pela chave única. Toda escrita leva `.select(<chave>)` e trata 0 linhas como falha.
3. **Regra fora do componente.** Regra de negócio é função pura em `src/lib/`. O componente
   renderiza o que ela devolve.
4. **"Hoje" só no cliente.** Datas usam `hojeSP()` na hora do uso, em America/Sao_Paulo. Nada que
   dependa de relógio, sessão ou dado é renderizado no servidor.
5. **Design system como cópia verificável** (refina o AD-006). A cópia é feita por
   `scripts/sync-design-system.mjs`, que lê com `git show` um sha alcançável pela `origin/main` da
   plataforma. `src/design-system/SNAPSHOT` guarda o sha, o hash git de cada arquivo e as versões
   fixas dos pacotes compartilhados. Ficam fora `ui/chat/`, `ui/kanban.tsx` e `ui/tag.tsx`, que
   pedem dependências e domínio da plataforma.
6. **Nomes.** Identificadores de domínio em português, como o `index.html` e as edge functions.
   Primitivos do design system em inglês, como na plataforma. Commits em inglês.

## Por quê

- Ler no servidor exigiria levar o JWT para cookie, renovar a sessão num middleware e calcular
  datas em UTC: mais peças para o mesmo resultado, e todo usuário logaria de novo.
- Um lugar só para validar, paginar e conferir linhas. Espalhado pelos componentes, o teto de
  1.000 linhas e o sucesso falso de hoje voltariam um componente de cada vez.
- O hash git por arquivo deixa qualquer pessoa conferir a cópia com `git ls-tree` na plataforma.

## Consequências

- Teste de varredura falha se `@supabase/supabase-js` for importado fora de `src/lib/data/`, se
  `service_role` aparecer em `src/` ou no `next.config.ts`, ou se um arquivo copiado mudar. A guarda
  da chave é uma lista de permissão chamada pelo `next.config.ts` no build, sem texto de chave secreta.
- Navegação só pela `useNavegar`, que recusa destino de outra origem. Link vindo do banco só vira
  `href` se for `http(s)`.
- Feature nova que precise de dado no servidor (cron, webhook) vai para `supabase/functions/`, não
  para o Next.
- Atualizar o design system é rodar o script com um sha novo e passar o gate. Editar arquivo
  copiado à mão continua exigindo AD próprio (AD-006).
