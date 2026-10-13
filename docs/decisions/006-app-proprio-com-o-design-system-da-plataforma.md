# AD-006 — App próprio em Next.js com o design system da plataforma, no Supabase

- **Status**: active
- **Date**: 2026-10-13
- **Scope**: o repo inteiro; `.specs/features/migracao-nextjs/`.
- **Decided by**: Lucas: "eu não quero mover para a plataforma, só quero usar o mesmo design-system mantendo o supabase".

## Decisão

O central-elite3d migra para Next.js **no próprio repo e continua um app separado**. Ele não vira
módulo da `plataforma-product-ops`.

- **Visual:** o design system da plataforma, como cópia literal dos arquivos de `src/design-system/` e
  `src/components/ui/`, nos mesmos caminhos.
- **Backend:** continua o Supabase (`matgynpiscyoshnjzolo`): Auth por e-mail e senha, RLS, edge
  functions, pg_cron. Continuam também os workflows do n8n.
- **Hospedagem:** continua a Vercel.

## O que a decisão preserva

- **A fronteira de autorização.** Quem recorta o dado por papel é o RLS, que lê `auth.uid()` e
  `get_my_role()` da sessão do Supabase Auth. Nada disso muda (mapeamento §5.3).
- **Os papéis e os usuários.** admin, diretoria e mentor continuam em `profiles`. Mentores e diretoria
  não precisam de conta na plataforma.

## Consequências

- **Exceção à regra global da pasta azul.** O `~/.claude/CLAUDE.md` §5c diz que todo projeto STLFLIX é
  módulo da plataforma; **neste repo isso não vale**. Não proponha absorção.
- **Não se aplicam as regras de módulo da plataforma:** login da plataforma, registry por `slug`,
  `showHeader`, envelope `/api` e acesso a dado pelo n8n.
- **O design system é cópia, não fork.** Os arquivos copiados não são editados à mão; o commit de origem
  fica em `src/design-system/SNAPSHOT`, e atualizar é copiar de novo. Primitivo que falta entra como
  arquivo **novo** em `src/components/ui/`, genérico e sem domínio. Extensão de um arquivo copiado só com
  AD próprio, que nomeia o arquivo, porque ele deixa de ser cópia.
- O mapeamento (`docs/planejamento/mapeamento-migracao-nextjs.md`) e a spec foram escritos antes desta
  decisão e foram corrigidos no mesmo dia.
