# Migração do front para Next.js — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

**Test count contract.** Every `Test count:` line in this file uses the literal shape `Test count: N → M` (numbers, arrow, numbers - `->` also parses). The LAST such line in the file is the declaration external collectors judge against a count they take themselves; free prose there (`+10 new`, `≥971`) is measured as an out-of-contract declaration, not as a number.

**Contagem estimada.** Os `N → M` abaixo são estimativa de desenho. Cada task grava no próprio commit a contagem real que o `pnpm test` imprimiu, e a task seguinte começa dela.

---

**Design**: `.specs/features/migracao-nextjs/design.md`
**Spec**: `.specs/features/migracao-nextjs/spec.md`
**Status**: Approved (Lucas, 14/10/2026)
**Worktree**: `~/.worktrees/central-elite3d-migracao`, branch `feat/migracao-nextjs`. Push, deploy e banco só com o "go" do Lucas (spec, "Gates de produção").

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: spec "Assumptions" (vitest no ambiente `node`, telas com `react-dom/server`, sem dependência nova de teste), spec "Gates de produção" (G1), `tests/testes.mjs` + `tests/ambiente.mjs` (o harness que está sendo portado, 20 grupos), `vitest.config.ts` da plataforma. Sem `AGENTS.md` nem limiar de cobertura no repo: valem os padrões fortes.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Regras puras (`src/lib/*.ts`) | unit | todos os ramos; 1:1 com os ACs; todo edge case listado; o grupo do mapeamento §7 que a regra herda | `src/lib/*.test.ts` | `pnpm test` |
| Porta de dados (`src/lib/data/`) | unit com cliente falso | cada leitura R01–R23 e escrita W01–W21: chamada capturada (relação, operação, payload, `onConflict`, `order`, `range`, `select`), erro, 0 linhas, linha fora do schema | `src/lib/data/*.test.ts` | `pnpm test` |
| Casca e telas (`src/components/shell/`, `src/components/modules/`) | unit (`renderToStaticMarkup`) | por papel: o que aparece, o que some, escape do XSS, controles `data-escrita`, `EmptyState` e `Skeleton` | `src/components/**/*.test.tsx` | `pnpm test` |
| Primitivos novos (`src/components/ui/<novo>.tsx`) | unit (`renderToStaticMarkup`) | props → markup e `aria-*` | `src/components/ui/<novo>.test.tsx` | `pnpm test` |
| Varreduras e estrutura (`src/test/`) | unit (lê arquivos) | uma asserção por regra | `src/test/*.test.ts(x)` | `pnpm test` |
| Middleware (`src/middleware.ts`) | unit (função pura) | redireciona codificação inválida; deixa passar o resto | `src/middleware.test.ts` | `pnpm test` |
| Scripts (`scripts/`) | unit nas partes puras | parse, hash, desempate, relatório sem dado pessoal | `scripts/**/*.test.mjs`, `scripts/**/*.test.ts` | `pnpm test` |
| Paridade (`scripts/parity/paridade.parity.ts`) | parity | PAR-01…PAR-17 nos 3 papéis, 0 divergências fora do Apêndice A | `scripts/parity/*.parity.ts` | `pnpm parity` (G2.5, fora do `pnpm test`) |
| Rotas (`src/app/**/page.tsx`, `not-found.tsx`, `layout.tsx`) | none | build gate; a lógica mora em `src/lib/endereco.ts` | - | `pnpm build` |
| Config e docs (`package.json`, `tsconfig.json`, `tailwind.config.ts`, `vercel.json`, `*.md`) | none | build gate | - | `pnpm build` |

## Gate Check Commands

> Generated from codebase - confirm before Execute. Todo comando roda sob o skill `ram-guard` (um processo pesado por vez), com `source ~/.nvm/nvm.sh && nvm use default` antes: o Node 20.4 de `/usr/local/bin` quebra o vitest 4. Saída em arquivo e `echo exit=$?`, nunca `| tail` (spec, "Gates de produção").

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | task com teste unitário | `pnpm typecheck > $TMP/tc.log 2>&1; echo exit=$?` e `pnpm test > $TMP/test.log 2>&1; echo exit=$?` |
| Full | igual ao Quick: não há suíte e2e | os dois comandos do Quick |
| Build | última task de cada fase, task de config, rota ou docs | Quick e depois `pnpm build > $TMP/build.log 2>&1; echo exit=$?` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. Cada fase é uma linha só: a execução é uma task por vez.

### Phase 0: Pré-voo

Casca do repo, cópia do design system e script de snapshot. Depois dela vem o G0, escalonado pelo Lucas em 14/10/2026 (spec, G0): o G0.1 fecha antes da Fase 1, o G0.2 antes da Fase 4 e o G0.3 a G0.6 antes do G2.

```
T1 → T2 → T3 → T4
```

### Phase 1: Fundação

```
T5 → T6 → T7 → T8
```

### Phase 2: Sessão e endereço (regras)

```
T9 → T10 → T11 → T12 → T13 → T14
```

### Phase 3: Casca

```
T15 → T16 → T17 → T18 → T19 → T20
```

### Phase 4: Leituras

Começa só com o G0.2 verde: snapshot gravado e as chaves de desempate conferidas no banco.

```
T21 → T22 → T23 → T24 → T25
```

### Phase 5: Escritas

```
T26 → T27 → T28 → T29 → T30 → T31
```

### Phase 6: Regras base e primitivos

```
T32 → T33 → T34 → T35 → T36 → T37 → T38 → T39 → T40 → T41
```

### Phase 7: Dashboard, Mentorados e Sessões

```
T42 → T43 → T44 → T45 → T46 → T47 → T48 → T49 → T50
```

### Phase 8: Ficha

```
T51 → T52 → T53 → T54 → T55 → T56 → T57 → T58 → T59
```

### Phase 9: Rotas e Financeiro

```
T60 → T61 → T62 → T63 → T64
```

### Phase 10: Telas gerenciais

```
T65 → T66 → T67 → T68 → T69 → T70 → T71 → T72
```

### Phase 11: Varreduras de tela e paridade

```
T73 → T74 → T75 → T76 → T77 → T78 → T79 → T80 → T81
```

### Phase 12: Corte local

```
T82 → T83 → T84
```

Depois da T84: o Verifier do skill (G2.6) e o resto do G2. Os gates seguintes estão em "Gates de produção (fora do Execute)", no fim do arquivo.

---

## Task Breakdown

### Phase 0: Pré-voo

### T1: Casca do repo com versões fixas

**What**: `package.json` com os scripts `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `parity` e `parity:snapshot`; dependências fixas sem `^`; `tsconfig.json` (o da plataforma, sem `allowImportingTsExtensions`); `vitest.config.ts` (`environment: "node"`, `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"]`, alias `@`, `oxc.jsx.runtime: "automatic"`); `.gitignore`; `.env.example`; lockfile.
**Where**: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`
**Depends on**: None
**Reuses**: `package.json`, `tsconfig.json`, `vitest.config.ts` e `.gitignore` da plataforma em `main` (`git show <sha>:<arquivo>`); versões resolvidas no `pnpm-lock.yaml` dela
**Requirement**: STACK-01, STACK-02, STACK-03, STACK-04, STACK-08, TEST-06, SEC-07

**Tools**:

- MCP: NONE
- Skill: `ram-guard` (`pnpm install`)

**Done when**:

- [x] `next` 15.5.21, `react` 19.2.8, `react-dom` 19.2.8, `tailwindcss` 3.4.19, `zod` 3.25.76, `vitest` 4.1.10, `lucide-react` 0.475.0 e `react-hot-toast` 2.6.0, ou as resolvidas no sha que a T3 copiar; `@supabase/supabase-js` 2.117.3 e `dompurify` 3.2.6; nenhuma com `^`; sem `chart.js`
- [x] `.gitignore` cobre `node_modules/`, `.next/`, `.vercel/`, `.env*` (com exceção de `.env.example`) e `supabase/.temp/`
- [x] `.env.example` só com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, sem valor
- [x] `packageManager` com a versão exata do pnpm desta máquina; `pnpm.onlyBuiltDependencies` com a lista mínima que o `pnpm install` pedir, cada item justificado no commit
- [x] `src/test/repo.test.ts`: o `.gitignore` cobre os 5 padrões; `git ls-files` não lista `.env*` além de `.env.example`
- [x] `node tests/testes.mjs` continua com exit 0
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 0 → 2

**Tests**: unit
**Gate**: quick
**Commit**: `build(app): scaffold the Next.js repo with pinned versions`

---

### T2: Script de cópia do design system

**What**: `scripts/sync-design-system.mjs <repo> <sha>` copia por `git show` os arquivos de `src/design-system/`, `src/components/ui/` e `src/public/fonts/InterVariable.woff2`, menos `ui/chat/`, `ui/kanban.tsx` e `ui/tag.tsx`; escreve `src/app/globals.css` sem o import de `report.css`; lê as versões dos 8 pacotes de STACK-01 no lockfile do sha; grava `SNAPSHOT`; avisa em `stderr` se o sha não é ancestral da `origin/main`.
**Where**: `scripts/sync-design-system.mjs`
**Depends on**: T1
**Reuses**: formato de saída do `git ls-tree -r`
**Requirement**: UI-01, STACK-01, UI-03, SEC-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Funções puras exportadas: hash git de blob, filtro de exclusão, leitura de versão no lockfile, remoção da linha de `report.css`, comparação do `SNAPSHOT` com a saída do `git ls-tree -r <sha>`
- [x] Modo `--verificar <repo>` (G2.10): compara cada `blob` do `SNAPSHOT` com a árvore da plataforma e sai com 1 se houver diferença
- [x] `scripts/sync-design-system.test.mjs` cobre as cinco, com o hash git conferido contra um `git hash-object` conhecido
- [x] Nada lido do working tree da plataforma
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 2 → 7

**Tests**: unit
**Gate**: quick
**Commit**: `build(design-system): add the platform copy script`

---

### T3: Cópia do design system e Tailwind

**What**: roda a T2 com o sha atual da `main` da plataforma; adiciona `tailwind.config.ts` e `postcss.config.mjs` iguais aos da plataforma; teste de hash.
**Where**: `src/design-system/SNAPSHOT`
**Depends on**: T2
**Reuses**: `tailwind.config.ts` e `postcss.config.mjs` da plataforma
**Requirement**: UI-01, STACK-01, UI-03, SEC-08

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [x] `SNAPSHOT` tem o sha, uma linha `versao` por pacote de STACK-01, uma linha `blob` por arquivo copiado e, se houver, uma linha `excecao <pacote> <versão> <aviso>` por correção de segurança (SEC-08)
- [x] O teste de versões aceita a versão de uma linha `excecao` no lugar da `versao` e recusa qualquer outra diferença
- [x] `src/design-system/snapshot.test.ts`: cada arquivo bate com o hash do `SNAPSHOT`; o `package.json` fixa as 8 versões do `SNAPSHOT`; nenhum arquivo em `src/design-system/` ou `src/components/ui/` fora do `SNAPSHOT`, salvo os primitivos novos listados no AD-008
- [x] Os testes copiados rodam e passam: `tokens.contrast.test.ts` (31), `select.test.ts` (9), `color-swatch-picker.test.ts` (10)
- [x] `src/public/fonts/InterVariable.woff2` copiada
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 7 → 61

**Tests**: unit
**Gate**: quick
**Commit**: `feat(design-system): copy the platform design system`

---

### T4: Script de snapshot de paridade

**What**: `scripts/parity/snapshot.mjs` pede e-mail e senha com eco desligado, entra com supabase-js, lê R01–R22 (inclui `mentorados_basic` e as duas rpcs) na ordem da porta com o desempate do design, confere existência e unicidade de cada chave de desempate, grava `~/.central-elite3d-paridade/snapshot-<data>.json` (pasta `0700`, arquivo `0600`) e imprime só contagens.
**Where**: `scripts/parity/snapshot.mjs`
**Depends on**: T3
**Reuses**: `paginado` (`index.html:726–735`), com o desempate novo
**Requirement**: GATE-05, GATE-03, DATA-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `scripts/parity/snapshot.test.mjs` com cliente falso: lê até vir página com menos de 1.000; manda `order` com o desempate; falha com chave duplicada; falha com coluna de desempate ausente; grava com `0700`/`0600` numa pasta temporária; recusa pasta existente com outro modo; cria o cliente com `persistSession: false` e chama `signOut` no fim
- [x] Exclui a pasta do Time Machine com `tmutil addexclusion` (sem falhar fora do macOS)
- [x] A saída do script só tem nome de relação e contagem
- [x] E-mail e senha não vão para arquivo, argumento nem variável de ambiente
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 61 → 68

**Tests**: unit
**Gate**: build
**Commit**: `feat(parity): add the admin snapshot script`

---

### Phase 1: Fundação

### T5: Configuração pública do Supabase e guarda da chave

**What**: `config.ts` com URL e chave publicável (env `NEXT_PUBLIC_*` ou o padrão de produção) e `validarConfig({ url, chave })`, uma lista de permissão; o `next.config.ts` chama `validarConfig` na carga e lança se ela devolver erro.
**Where**: `src/lib/data/config.ts`, `next.config.ts`
**Depends on**: T1
**Reuses**: `index.html:530–531`
**Requirement**: STACK-05, STACK-06, STACK-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Aceita a chave `sb_publishable_` de produção e um JWT com `role` `anon`
- [x] Recusa qualquer outra chave (um JWT com `role` diferente de `anon`, um texto qualquer), com erro que nomeia `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [x] Recusa URL diferente de `https://matgynpiscyoshnjzolo.supabase.co`, com erro que nomeia `NEXT_PUBLIC_SUPABASE_URL`
- [x] Nenhum texto `sb_secret_`, `service_role` nem `SUPABASE_SERVICE_ROLE_KEY` em `config.ts` nem no `next.config.ts`
- [x] Lê só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 68 → 74

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): read the public Supabase config and refuse secret keys`

---

### T6: Cabeçalhos de segurança

**What**: `headers()` no `next.config.ts` com `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; connect-src 'self' https://matgynpiscyoshnjzolo.supabase.co`, `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin` em todo caminho, menos no `next dev`; `poweredByHeader: false`.
**Where**: `next.config.ts`
**Depends on**: T5
**Reuses**: `headers()` do `next.config.ts` da plataforma
**Requirement**: SEC-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `src/test/cabecalhos.test.ts` importa a config: os 3 cabeçalhos com os valores acima em `/:path*`; `poweredByHeader` falso
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 74 → 76

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): send security headers and hide the framework banner`

---

### T7: Layout raiz, tema sem flash e favicon

**What**: `src/app/layout.tsx` com `<html lang="pt-BR">`, Inter por `next/font/local` (`variable: "--font-inter"`), `<script src="/theme-init.js" />` no `<head>` e o `Toaster`; `public/theme-init.js` com a lógica do script inline da plataforma; `favicon.png` vira `src/app/icon.png`.
**Where**: `src/app/layout.tsx`, `public/theme-init.js`
**Depends on**: T6
**Reuses**: `src/app/layout.tsx` da plataforma
**Requirement**: UI-03, UI-04, STACK-08, CUT-03

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [x] `src/test/theme-init.test.ts` roda o script num `vm` com `localStorage` e `matchMedia` falsos: preferência `dark` salva liga a classe; `light` salva não liga; sem preferência segue o sistema
- [x] Nenhum `dangerouslySetInnerHTML` no layout
- [x] `pnpm build` gera o HTML de `/` com o `<script src="/theme-init.js">` dentro do `<head>`
- [x] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [x] Test count: 76 → 79

**Tests**: unit
**Gate**: build
**Commit**: `feat(app): add the root layout with Inter and the no-flash theme`

---

### T8: Varreduras estáticas

**What**: um teste por regra de texto proibido, valendo para tudo o que entrar depois.
**Where**: `src/test/varreduras.test.ts`
**Depends on**: T7
**Reuses**: NONE
**Requirement**: DATA-01, DATA-08, STACK-05, STACK-07, STACK-08, TEST-03, UI-02, UI-03, UI-05, GATE-03, SEC-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] DATA-01: nenhum import de `@supabase/supabase-js` fora de `src/lib/data/`
- [x] DATA-08: nenhum `.functions.invoke(` em `src/`; `.rpc(` só com `experiencia_adesao`, `analise_ia_mentor`, `lia_adotar_orfas` e `lia_refletir_financeiro`
- [x] STACK-05: `process.env.` só com os dois nomes `NEXT_PUBLIC_*`
- [x] STACK-07: nenhum `service_role`, `SUPABASE_SERVICE_ROLE_KEY` nem `sb_secret_` em `src/` nem no `next.config.ts`
- [x] STACK-08: nenhum `<script src="http`, `<link href="http` ou `fonts.googleapis`; `@supabase/supabase-js` `2.117.3` e `dompurify` `3.2.6` exatos; `chart.js` ausente do `package.json`
- [x] TEST-03: `dangerouslySetInnerHTML`, `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `createContextualFragment` e `execCommand("insertHTML"` só em `src/components/modules/ficha/editor-notas.tsx`, e só com `sanitizarNota(`
- [x] GATE-03: nenhum arquivo de `.specs/features/migracao-nextjs/evidence/` com HAR, `Authorization`, `/auth/v1/`, `refresh_token` ou texto em formato JWT
- [x] SEC-07: `packageManager` presente com versão exata; `pnpm.onlyBuiltDependencies` presente
- [x] UI-02: em `src/components/modules/` e `src/app/`, nenhum hexa de cor, `rgb(`, `rgba(` ou classe da paleta padrão do Tailwind (`slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose`-número)
- [x] UI-03: nenhum `next/font/google` nem `Manrope` em `src/`
- [x] UI-05: nenhum `window.confirm`, `window.prompt`, `window.alert`, `confirm(`, `prompt(` ou `alert(` em `src/`
- [x] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [x] Test count: 79 → 89

**Tests**: unit
**Gate**: build
**Commit**: `test(app): scan the source for forbidden patterns`

---

### Phase 2: Sessão e endereço (regras)

### T9: Middleware de codificação inválida (com PoC)

**What**: `src/middleware.ts` com `matcher: ["/mentorado/:path*"]`; redireciona para `/dash` quando `decodeURIComponent(pathname)` lança. Começa pela PoC do design: `next build && next start` local e `curl` em `/mentorado/%E0%A4%A`.
**Where**: `src/middleware.ts`
**Depends on**: T8
**Reuses**: `next/dist/server/lib/router-utils/resolve-routes.js:308–316` (o middleware roda antes do casamento de rota)
**Requirement**: NAV-03

**Tools**:

- MCP: NONE
- Skill: `ram-guard` (`next build`, `next start`)

**Done when**:

- [x] PoC registrada em `.specs/features/migracao-nextjs/evidence/poc-middleware.md`: o `curl` devolve 307 para `/dash`, e um id válido devolve a página
- [x] `src/middleware.test.ts`: codificação inválida → redirect para `/dash`; caminho válido → segue; o `matcher` é só `/mentorado/:path*`
- [x] O middleware não lê cookie nem sessão
- [x] Se a PoC falhar: parar e reabrir o NAV-03 como emenda (Critical Rule 6)
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 89 → 92

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): send malformed ficha addresses to the dashboard`

---

### T10: Papéis e capacidades

**What**: `CAPACIDADES`, `PAPEL_LABEL`, `pode(papel, cap)`, `ehPapel(valor)` e os itens do menu por papel.
**Where**: `src/lib/papeis.ts`
**Depends on**: T9
**Reuses**: `index.html:662–670`
**Requirement**: AUTH-07, NAV-04, NAV-06, WRITE-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] admin: `verFinanceiro`, `criarMentorado`, `editarMentorado`, `editarFinanceiro`, `escreverSessao`, `criarSessao`, `escreverRotas`, `escreverNotas`, `excluir`, `verIa`
- [x] diretoria: `verFinanceiro`, `verIa`
- [x] mentor: `escreverSessao`, `escreverRotas`, `escreverNotas`, `verIa`
- [x] papel nulo ou fora de (`admin`, `diretoria`, `mentor`): nenhuma capacidade e `ehPapel` falso
- [x] Menu: Dashboard, Acompanhamento, Mentorados, Sessões, Rotas e Análise IA para os 3 papéis; Mentores, STLSeller, NPS e Financeiro só para admin e diretoria
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 92 → 98

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port role capabilities and menu items`

---

### T11: Endereço

**What**: `lerCaminho(segmentos)`, `caminhoDoHash(hash)`, `telaPermitida(tela, papel)` e `abaVisivel(aba, papel)`.
**Where**: `src/lib/endereco.ts`
**Depends on**: T10
**Reuses**: `lerEndereco`, `TELAS`, `ABAS_FICHA`, `aplicarEndereco` (`index.html:1344–1400`)
**Requirement**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, CUT-02, SEC-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `/dash`, `/acompanhamento`, `/mentorados`, `/sessoes`, `/rotas`, `/mentores`, `/analise`, `/nps`, `/ia`, `/financeiro` resolvem para a tela de mesmo nome
- [x] `/mentorado/<id>` e `/mentorado/<id>/<aba>` com aba em `cadastro`, `financeiro`, `sessoes`, `notas`, `stlseller`; `completo`, `basico` e qualquer outra viram `cadastro`
- [x] `caminhoDoHash` só monta tela de `TELAS` ou `mentorado/<id>[/<aba>]`, com o id em `encodeURIComponent`; `#`, `#/`, vazio e codificação inválida (`#/mentorado/%E0%A4%A`) → `null`
- [x] Vetores do THREAT-01 devolvem `null`: `#//evil.example/login`, `#/\\evil.example`, `#/%2F%2Fevil.example`, `#/%09/evil.example`, `#javascript:alert(1)`
- [x] `/financeiro`, `/analise`, `/nps` e `/mentores` sem `verFinanceiro` → `/dash`; abas `financeiro` e `stlseller` sem `verFinanceiro` → `sessoes`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 98 → 113

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the address rules and map legacy hash links`

---

### T12: Autenticação na porta

**What**: `cliente()` (singleton preguiçoso, criado só no browser) e `entrar(email, senha)`, `sair()`, `ouvirSessao(cb)`, `lerPerfil(userId)` (R01) e `classificarErroLogin(erro)`.
**Where**: `src/lib/data/cliente.ts`, `src/lib/data/auth.ts`
**Depends on**: T11
**Reuses**: `index.html:672–720`; classes de erro do auth-js 2.117.3 (`lib/fetch.js:32–88`)
**Requirement**: AUTH-02, AUTH-04, AUTH-05, AUTH-06, AUTH-09, AUTH-10, EDGE-02, SEC-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `entrar` chama `signInWithPassword({ email, password })`; `lerPerfil` faz `from("profiles").select("*").eq("id", id).single()`
- [x] `invalid_credentials` ou status 400 → "E-mail ou senha inválidos."; `AuthRetryableFetchError` → mensagem de conexão; 429 → mensagem de limite; outro → "Não foi possível entrar: <mensagem>." — as três últimas sem a palavra "senha"
- [x] O cliente é criado com `createClient(URL, KEY, { auth: { detectSessionInUrl: false } })`: storage e chave da sessão padrão, sem ler sessão da URL
- [x] `usuarioDaSessao()` devolve o id da sessão atual ou `null`
- [x] Nenhuma chamada a `signUp`, `resetPasswordForEmail`, `signInWithOtp` ou `signInWithOAuth` (varredura no teste)
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 113 → 123

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): add sign-in, sign-out and profile reads`

---

### T13: Máquina da sessão

**What**: `reduzirSessao(estado, evento)` com as fases `verificando`, `anonimo`, `lendoPerfil`, `semPerfil`, `papelInvalido` e `pronto`.
**Where**: `src/lib/sessao.ts`
**Depends on**: T12
**Reuses**: `boot` e `afterLogin` (`index.html:672–708`)
**Requirement**: AUTH-01, AUTH-06, AUTH-07, AUTH-08, EDGE-02, SEC-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `registrarPendencia(fn)` e `descarregarPendencias()`: o que foi registrado roda uma vez, e um registro desfeito não roda
- [x] `INITIAL_SESSION` sem sessão → `anonimo`; com sessão → `lendoPerfil`
- [x] perfil válido → `pronto` com o papel; sem linha ou com erro → `semPerfil` com pedido de `signOut`; papel nulo ou desconhecido → `papelInvalido`
- [x] `SIGNED_OUT` em qualquer fase → `anonimo`, sem perfil; `SIGNED_IN` de outro usuário → `lendoPerfil` desse usuário; `TOKEN_REFRESHED` não muda a fase
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 123 → 133

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): model the session lifecycle`

---

### T14: Contextos e helper de render

**What**: `useSessao`, `useDados`, `useUi` e `useNavegar` com os providers; `renderTela(el, { papel, dados, ui, navegar })` e os fixtures para os testes.
**Where**: `src/components/shell/contexto.tsx`, `src/test/render.tsx`, `src/test/fixtures.ts`
**Depends on**: T13
**Reuses**: estado global de `index.html:607–654` (forma do `Ui`); fixtures de `tests/ambiente.mjs:193–340`, com o XSS de `:31`
**Requirement**: STACK-02, TEST-02, SEC-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `Ui` com as chaves do design (`filtro` inteiro, `mesMatriz`, `foco`, `rotaAtual`, `rotaMentoradoId`, `marcoAberto`, `voltarPara = "/mentorados"`, `sortState`)
- [x] `useNavegar` embrulha `useRouter` e `usePathname`; o teste injeta um stub
- [x] `useNavegar` manda para `/dash` todo destino que resolve para outra origem (os 5 vetores da T11, como caminho) e entrega ao roteador o destino da mesma origem
- [x] `src/test/render.test.tsx`: `renderTela` entrega os quatro valores; o stub de navegação registra `ir` e `substituir`
- [x] `fixtures.ts` monta um `Dataset` com os mentorados m1–m4, as sessões s1–s5 e g1–g5, as parcelas p1–p3, a rota rica, as cobranças, o STLSeller, o NPS, a Experiência e a análise de `tests/ambiente.mjs`
- [x] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [x] Test count: 133 → 137

**Tests**: unit
**Gate**: build
**Commit**: `feat(shell): add the app contexts and the render helper`

---

### Phase 3: Casca

### T15: Provider da sessão

**What**: `SessaoProvider` que assina `ouvirSessao`, guarda o evento no estado e lê o perfil num efeito separado.
**Where**: `src/components/shell/sessao.tsx`
**Depends on**: T14
**Reuses**: `reduzirSessao` (T13), `auth.ts` (T12)
**Requirement**: AUTH-01, AUTH-02, AUTH-08, EDGE-02, SEC-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O callback do `onAuthStateChange` não chama o cliente
- [x] `sair()` espera `descarregarPendencias()` e só depois chama `signOut`
- [x] Render por fase: `anonimo` → login; `semPerfil` e `papelInvalido` → telas da T17; `pronto` → filhos
- [x] Nenhuma leitura de dado antes de `pronto`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 137 → 141

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shell): add the session provider`

---

### T16: Tela de login

**What**: e-mail, senha e Entrar num `<form>` com `FormField`, `Input` e `Button loading`.
**Where**: `src/components/shell/tela-login.tsx`
**Depends on**: T15
**Reuses**: `Card`, `FormField`, `Input`, `Button` do DS; `classificarErroLogin` (T12)
**Requirement**: AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Campos com `label` ligado por `htmlFor`; Entrar é `type="submit"` (Enter no campo de senha envia)
- [x] Mostra as quatro mensagens da T12 conforme o erro
- [x] Sem link de cadastro nem de recuperação de senha
- [x] Ao desmontar, a senha some (estado local)
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 141 → 147

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shell): add the login screen`

---

### T17: Telas de perfil e papel

**What**: "Perfil não encontrado" e "Papel não reconhecido" com o botão Sair.
**Where**: `src/components/shell/tela-papel.tsx`
**Depends on**: T16
**Reuses**: `EmptyState`, `Button` do DS
**Requirement**: AUTH-06, AUTH-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Cada tela com o texto do AC e o botão Sair
- [x] Nenhuma leitura de dado nessas fases
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 147 → 150

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shell): add the profile and role screens`

---

### T18: Menu, usuário e tema

**What**: sidebar com `NavItem`, menu mobile em `Drawer`, `Avatar` com nome e papel, Sair e `ThemeToggle`.
**Where**: `src/components/shell/menu.tsx`
**Depends on**: T17
**Reuses**: `NavItem`, `Drawer`, `Avatar`, `Button`, `ThemeToggle` do DS; itens de menu da T10
**Requirement**: NAV-06, UI-04, UI-08, AUTH-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] admin e diretoria: 10 itens; mentor: 6 itens (lista da T10)
- [x] Na ficha, o item aceso é o `voltarPara`
- [x] `ThemeToggle` presente; nenhum CSS próprio na casca
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 150 → 155

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shell): add the sidebar, mobile menu and user block`

---

### T19: Casca

**What**: `Casca` no `src/app/(app)/layout.tsx`: gate de sessão, menu, guardas de tela e as regras de `foco` e `voltarPara` na troca de caminho.
**Where**: `src/components/shell/casca.tsx`
**Depends on**: T18
**Reuses**: `telaPermitida` (T11); `aplicarEndereco` (`index.html:1370–1388`)
**Requirement**: NAV-04, NAV-07, NAV-10, UI-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Tela sem permissão → `substituir("/dash")`
- [x] Sair de `/sessoes` zera `foco`; sair de `/mentorado/*` grava `voltarPara`
- [x] A navegação usa só o roteador do Next (voltar e avançar nativos)
- [x] O servidor renderiza só `Skeleton` (nada de sessão, dado ou relógio)
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 155 → 160

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shell): add the app shell with screen guards`

---

### T20: Ponte do hash e caminho desconhecido

**What**: `src/app/page.tsx` faz `substituir(caminhoDoHash(location.hash) ?? "/dash")`; `src/app/not-found.tsx` faz `substituir("/dash")`.
**Where**: `src/app/page.tsx`, `src/app/not-found.tsx`
**Depends on**: T19
**Reuses**: `caminhoDoHash` (T11)
**Requirement**: NAV-02, NAV-03, CUT-02

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [x] As duas páginas só chamam `caminhoDoHash` e `substituir` (a lógica e os testes estão na T11)
- [x] `pnpm build` lista `/` e a página 404
- [x] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [x] Test count: 160 → 160

**Tests**: none
**Gate**: build
**Commit**: `feat(app): bridge legacy hash links to the new routes`

---

### Phase 4: Leituras

### T21: Schemas das relações

**What**: um schema Zod por relação de R01–R23, com as colunas que o `index.html` lê; tipos por `z.infer`.
**Where**: `src/lib/data/esquemas.ts`
**Depends on**: T20
**Reuses**: colunas usadas pelos renderers de `index.html`; migrations versionadas para `NOT NULL`
**Requirement**: DATA-02, DATA-03, EDGE-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Um schema para cada uma de: `profiles`, `mentorados`, `mentorados_basic`, `parcelas`, `lia_cobrancas`, `sessoes`, `rotas`, `marcos_definicao`, `mentorado_marcos`, `faturamento_mensal`, `canais`, `mentorado_canais`, `sessoes_orfas`, `stlseller_mentorados`, `stlseller_pedidos_marketplace`, `stlseller_produtos_vendidos`, `nps_respostas`, `experiencia_respostas`, `nps_analises` (com o formato antigo de GER-06), `experiencia_adesao`, `analise_ia_mentor`, `transcricoes`, `mentorado_notas`
- [x] `sessoes.status` aceita texto fora de `S_STATUS`; `numeric` que o PostgREST entrega como string é aceito
- [x] Linha inválida falha com o caminho do campo
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 160 → 172

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): add zod schemas for every read`

---

### T22: Leitura paginada

**What**: `lerPaginado(rel, consulta, ordem, schema)`.
**Where**: `src/lib/data/paginar.ts`
**Depends on**: T21
**Reuses**: `paginado` (`index.html:726–735`)
**Requirement**: DATA-03, DATA-04, DATA-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Fixture de 2.500 linhas: devolve as 2.500, cada uma uma vez, em 3 páginas
- [x] `order` acumula a coluna de hoje e o desempate; `range` de 1.000 em 1.000; para na página com menos de 1.000
- [x] Erro numa página devolve `{ ok: false }`; linha fora do schema escreve `[central-elite3d] <relação>: schema mismatch` e devolve falha
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 172 → 178

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): read lists in stable pages`

---

### T23: Carga inteira e nota

**What**: `carregarTudo(papel, usuarioId)` com as 20 leituras em paralelo e `lerNota(mentoradoId)`.
**Where**: `src/lib/data/leituras.ts`
**Depends on**: T22
**Reuses**: `loadAll` (`index.html:736–799`); tabela "Leituras" do design
**Requirement**: DATA-02, DATA-04, DATA-06, DATA-07, DATA-08, GATE-08, SEC-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Paginadas: R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18 e R22, cada uma com a ordem e o desempate da tabela do design
- [x] admin e diretoria leem `mentorados`, R04, R05, R14–R19 e R22; mentor lê `mentorados_basic` e R21 e não pede R04, R05, R14–R19 nem R22
- [x] R20 para os 3 papéis; nenhuma outra rpc; nenhuma escrita
- [x] Falha de R02/R03, R04 ou R06 → `{ ok: false }`; falha de outra → `erros[rel]` com o resto carregado
- [x] `lerNota` faz `select("conteudo,atualizado_em").eq("mentorado_id", id).maybeSingle()`
- [x] Sem sessão ou com sessão de outro usuário que não `usuarioId`: nenhuma leitura sai e o resultado diz que a sessão mudou
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 178 → 192

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): load every relation per role`

---

### T24: Recarga em que a última pedida vence

**What**: `criarRecarga()` que numera os pedidos e só entrega o resultado do último.
**Where**: `src/lib/recarga.ts`
**Depends on**: T23
**Reuses**: NONE
**Requirement**: DATA-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Duas recargas sobrepostas com respostas fora de ordem: vale a da última pedida
- [x] Recarga que falha mantém o dataset anterior e devolve o erro
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 192 → 196

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): let the latest reload win`

---

### T25: Provider de dados

**What**: `DadosProvider` com `key` = id do usuário dentro da `Casca`: `Skeleton` até a 1ª carga, erro com "Tentar de novo", e `recarregar()`. Exporta também `AvisoRelacoes({ essenciais, complementares })`, que cada tela usa para o escopo de erro da tabela do design (componente 6).
**Where**: `src/components/shell/dados.tsx`
**Depends on**: T24
**Reuses**: `carregarTudo` (T23), `criarRecarga` (T24), `Skeleton`, `EmptyState`, `Button` do DS
**Requirement**: NAV-08, DATA-06, DATA-07, AUTH-08, UI-07

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [x] Antes da 1ª carga: `Skeleton`, nunca "Ficha não encontrada"
- [x] Falha de R02/R03, R04 ou R06 na 1ª carga: a mensagem do erro e "Tentar de novo"
- [x] Falha numa recarga: o dataset anterior fica e o erro vai para um toast
- [x] Trocar de usuário desmonta o provider e descarta os dados
- [x] `AvisoRelacoes`: relação essencial com falha troca o conteúdo por `EmptyState` com "Tentar de novo"; complementar com falha põe um `Alert` com o nome dela e renderiza o resto
- [x] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [x] Test count: 196 → 202

**Tests**: unit
**Gate**: build
**Commit**: `feat(shell): load data once per user with retry`

---

### Phase 5: Escritas

### T26: Escritas de sessão (W01–W05)

**What**: `confirmarGrupo`, `criarSessaoGrupo`, `salvarSessao`, `confirmarSessao` e `delSessao`, cada uma com `.select("id")`.
**Where**: `src/lib/data/escritas.ts`
**Depends on**: T25
**Reuses**: `index.html:2024`, `:2089`, `:3631`, `:3670`, `:3677`; mapeamento §4.2
**Requirement**: WRITE-01, WRITE-02, OPS-06, OPS-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] W01: `update({ status: "Concluída", mentor }).in("id", ids)`
- [x] W02: `insert` de N linhas com `mentorado_id`, `etapa`, `ordem` (`ETAPA_ORD` ou 99), `status`, `mentor`, `data`, `hora`, `link_meet`, `link_gravacao`, vazios como `null`, mesma etapa, data, hora, mentor e status
- [x] W03: payload com `etapa_deduzida: false`; `insert` sem id e `update` com id
- [x] W04: `update({ status: "Concluída", mentor })` sem `etapa_deduzida`
- [x] W05: `delete().eq("id", id)`
- [x] Resposta sem erro e com 0 linhas → `{ ok: false, zeroLinhas: true }`
- [x] W01 e W02 com menos linhas que as pedidas → `{ ok: false, linhas, esperadas }`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 202 → 215

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): port the session writes with row checks`

---

### T27: Escritas de rotas e nota (W06–W10)

**What**: `salvarCanalMentorado`, `salvarFaturamento`, `excluirFaturamento`, `salvarMarco` e `salvarNota`.
**Where**: `src/lib/data/escritas.ts`
**Depends on**: T26
**Reuses**: `index.html:2479`, `:2488`, `:2498`, `:2521`, `:3396`
**Requirement**: WRITE-01, WRITE-02, OPS-18, NOTE-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] W06: `upsert` com `onConflict: "mentorado_id,rota_id"`
- [x] W07: `upsert` com `mes` `AAAA-MM-01`, valor vazio como 0 e `onConflict: "mentorado_id,mes,canal_id"`
- [x] W08: `delete` por id
- [x] W09: rota simples com `mentorado_id`, `marco_id`, `status`, `data`; rota rica com `criterios_ok`, `criterios_pendentes`, `progresso`, `bloqueios`, `proxima_acao`; `onConflict: "mentorado_id,marco_id"`
- [x] W10: `upsert` de `mentorado_id`, `conteudo` e `atualizado_em`
- [x] 0 linhas → `zeroLinhas`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 215 → 223

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): port the route and note writes`

---

### T28: Escritas de mentorado (W11–W14)

**What**: `salvarMentorado`, `adotarOrfas` (W11b), `salvarSituacao`, `excluirMentorado` e `criarMentorado`.
**Where**: `src/lib/data/escritas.ts`
**Depends on**: T27
**Reuses**: `index.html:3451`, `:3490`, `:3533`, `:3731`, `:3769`
**Requirement**: WRITE-01, WRITE-02, OPS-13, OPS-15

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] W11 aba Cadastro: `nome`, `cadastro_incompleto: false`, `email`, `data_fechamento`, `link_drive`, `link_mapa_mental`, `link_whatsapp`; aba Financeiro: os 5 campos de status e forma, com `null` preservado
- [x] W11b: `rpc("lia_adotar_orfas", { p_mentorado })`, com o erro devolvido
- [x] W12: `situacao`, `pausado_em` (hoje se vazio), `retorno_previsto`
- [x] W13: `delete().eq("id", id).select("id")`
- [x] W14: `insert` com `nome`, `email`, `data_fechamento`, `entrada_status`, `entrada_forma_pgto`, `contrato_status`, `restante_status`, `cancelado: false`, e `.select().single()`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 223 → 231

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): port the mentee writes`

---

### T29: Escritas financeiras (W15–W21)

**What**: `vincularCobranca`, `descartarCobranca`, `restaurarCobranca`, `refletirFinanceiro`, `toggleParcela`, `addParcela`, `salvarParcela` e `delParcela`.
**Where**: `src/lib/data/escritas.ts`
**Depends on**: T28
**Reuses**: `index.html:3501`, `:3513`, `:3522`, `:3542`, `:3549`, `:3578`, `:3589`
**Requirement**: WRITE-01, WRITE-02, WRITE-07, FIN-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] W15: `update({ mentorado_id }).eq("lia_bill_id", bill)` e depois `rpc("lia_refletir_financeiro", { p_mentorado })`
- [x] W16 e W17: `ignorada: true` e `ignorada: false`; a rpc só com dono; o erro da rpc devolvido à parte
- [x] W18: `status` aberta ↔ paga; W19: `insert` com `numero` = maior + 1 e `status: "aberta"`; W20: `numero`, `vencimento`, `valor`, `status`; W21: `delete`
- [x] 0 linhas → `zeroLinhas`
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 231 → 243

**Tests**: unit
**Gate**: quick
**Commit**: `feat(data): port the billing and installment writes`

---

### T30: Executor de escrita

**What**: `executarEscrita` com capacidade, trava, erro, 0 linhas, sucesso e recarga.
**Where**: `src/lib/escrita.ts`
**Depends on**: T29
**Reuses**: `pode` (T10)
**Requirement**: WRITE-02, WRITE-03, WRITE-04, WRITE-05, WRITE-06, WRITE-07, WRITE-08, DATA-09, SEC-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sem capacidade: `escrever` não é chamado
- [x] Duas chamadas no mesmo tick: `escrever` roda uma vez
- [x] Erro: toast com a mensagem e `false`
- [x] 0 linhas: "Nada foi gravado: sem permissão ou registro não encontrado." e `false`
- [x] Escrita parcial: "N de M gravadas" e `false`
- [x] Sessão ausente ou de outro usuário: `escrever` não é chamado e a escrita é descartada
- [x] Sucesso: toast, `recarregar()` e `true`
- [x] W11 seguido de W11b com falha: "Cadastro salvo, mas as cobranças da Lia não foram puxadas:" seguido do erro
- [x] Falha de `lia_refletir_financeiro`: o erro num toast
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 243 → 253

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): guard every write with capability, lock and row check`

---

### T31: Hook de escrita

**What**: `useEscrita(cap, escrever, sucesso?)` ligado ao toast, ao `pode` da sessão e ao `recarregar`.
**Where**: `src/components/shell/use-escrita.ts`
**Depends on**: T30
**Reuses**: `executarEscrita` (T30), `react-hot-toast`
**Requirement**: WRITE-03, WRITE-08

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [x] `ocupado` é `true` durante a escrita e vai para o `loading` do `Button`
- [x] A capacidade vem do papel da sessão
- [x] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [x] Test count: 253 → 255

**Tests**: unit
**Gate**: build
**Commit**: `feat(shell): expose writes to components through a hook`

---

### Phase 6: Regras base e primitivos

### T32: Constantes de domínio

**What**: `MENTORES`, `MENTORES_HIST`, `TODOS_MENTORES`, `ETAPAS`, `ETAPAS_GRUPO`, `ETAPA_ORD`, `S_STATUS`, `NIVEIS`, `INICIO_COBRANCA_NPS`, `PRAZO_RESPOSTA_DIAS`, `META_ADESAO_EXP` e `LINK_PESQUISA_EXP`.
**Where**: `src/lib/constantes.ts`
**Depends on**: T31
**Reuses**: `index.html:561–671`, `:807–809`
**Requirement**: TEST-04, OPS-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O teste lê `supabase/functions/sync-google-calendar/index.ts`: etapas e ordens de `TRILHA` iguais a `ETAPAS`/`ETAPA_ORD`; cada nome de `MENTORES` aparece como valor de `EMAIL_MENTOR`
- [x] `ETAPAS_GRUPO` com ordens 90 e 91; fallback 99
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 255 → 260

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the domain constants`

---

### T33: Datas

**What**: `hojeSP`, `fmtD`, `dpLabel`, `diasAte`, `prazoTexto`, `mesDe` e a semana do NPS.
**Where**: `src/lib/datas.ts`
**Depends on**: T32
**Reuses**: `index.html:606`, `:813–970`
**Requirement**: FIN-06, TEST-05, EDGE-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `hojeSP()` às 23:30 de Brasília (02:30 UTC do dia seguinte) devolve a data de Brasília
- [x] `prazoTexto`: "venceu há N dias", "ontem", "hoje", "amanhã", "em N dias", por dia de calendário em America/Sao_Paulo
- [x] Dois `hojeSP()` com o relógio virando a meia-noite de Brasília devolvem dias diferentes (nada fica congelado)
- [x] Os casos de data do grupo "Formatadores e campo de data" do mapeamento §7
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 260 → 272

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the date helpers with today computed on use`

---

### T34: Moeda

**What**: `fmtBRL`, `lerBRL` e `mascaraBRL`.
**Where**: `src/lib/moeda.ts`
**Depends on**: T33
**Reuses**: helpers de moeda de `index.html:813–970`
**Requirement**: OPS-20

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] "2000.50" vale 2000,50; "1.234,56" vale 1234,56; vazio vale vazio
- [x] `mascaraBRL(v, true)` fecha as casas no blur
- [x] Os casos de moeda do grupo "Formatadores e campo de data"
- [x] Gate check passes: `pnpm typecheck` e `pnpm test`
- [x] Test count: 272 → 280

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the BRL parsing and masking`

---

### T35: Busca

**What**: `casaBusca`, `alvoBuscaData` e `chaveNome`.
**Where**: `src/lib/busca.ts`
**Depends on**: T34
**Reuses**: `index.html:1231–1343`
**Requirement**: OPS-10, OPS-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Sem caixa, sem acento e por partes
- [ ] Data nos 4 formatos do grupo "Busca por data"
- [ ] `chaveNome` sem caixa, acento nem espaço extra
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 280 → 290

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the accent-insensitive search`

---

### T36: Link seguro

**What**: `linkSeguro(url)` devolve o `href` só para `http:` e `https:`, e `null` para o resto.
**Where**: `src/lib/links.ts`
**Depends on**: T35
**Reuses**: `linkOr` (`index.html:965–969`)
**Requirement**: SEC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `http:` e `https:` passam; `javascript:`, `data:`, `mailto:`, caminho relativo e vazio devolvem `null`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 290 → 294

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the http-only link guard`

---

### T37: Ordenação de tabela

**What**: `alternarOrdem` e `aplicarOrdem`.
**Where**: `src/lib/ordem.ts`
**Depends on**: T36
**Reuses**: `toggleSort`/`applySort` (`index.html:1198–1230`)
**Requirement**: UI-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Alterna asc → desc na mesma coluna; nova coluna começa asc
- [ ] Ordena texto sem acento, número e data; `null` no fim
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 294 → 298

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port table sorting`

---

### T38: Primitivo SegmentedProgress

**What**: N segmentos com tom e rótulo, para a trilha de 12 etapas.
**Where**: `src/components/ui/segmented-progress.tsx`
**Depends on**: T37
**Reuses**: tokens do DS; `Progress` como referência de pele
**Requirement**: UI-06, OPS-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Um segmento por item com `title` e um `aria-label` no conjunto
- [ ] Tons `success`, `primary`, `warning`, `danger` e `neutral` só por token
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 298 → 301

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add the SegmentedProgress primitive`

---

### T39: Primitivo Pagination

**What**: "Página X de Y" com anterior e próxima.
**Where**: `src/components/ui/pagination.tsx`
**Depends on**: T38
**Reuses**: `Button` do DS
**Requirement**: UI-06, GER-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Anterior desabilitado na página 1; próxima desabilitada na última
- [ ] `aria-label` nos dois botões
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 301 → 305

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add the Pagination primitive`

---

### T40: Primitivo SortHeader

**What**: cabeçalho de coluna clicável com o ícone da direção.
**Where**: `src/components/ui/sort-header.tsx`
**Depends on**: T39
**Reuses**: ícones do `lucide-react`
**Requirement**: UI-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Ícone para `asc`, `desc` e `null`; `aria-label` com o estado
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 305 → 308

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add the SortHeader primitive`

---

### T41: AD-008 das lacunas do design system

**What**: o AD com a resolução de cada uma das 7 lacunas (tabela do componente 8 do design) e a lista dos primitivos novos que o teste do `SNAPSHOT` aceita.
**Where**: `docs/decisions/008-lacunas-do-design-system.md`
**Depends on**: T40
**Reuses**: design, componente 8
**Requirement**: UI-06

**Tools**:

- MCP: NONE
- Skill: `decision-log`

**Done when**:

- [ ] Uma linha para cada lacuna: data única, mês, combobox, trilha de 12 segmentos, paginação, ordenação e clique de linha, moeda BRL
- [ ] O teste da T3 lê a lista de primitivos novos deste AD
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 308 → 308

**Tests**: none
**Gate**: build
**Commit**: `docs(arch): record how each design-system gap is closed`

---

### Phase 7: Dashboard, Mentorados e Sessões

### T42: Regras de sessão

**What**: `ehGrupo`, `eh1a1`, `agruparGrupo`, `statusGrupo`, `resumoStatusGrupo`, `sessoes1a1De`, `sessoesGrupoDe` e os blocos de Sessões.
**Where**: `src/lib/sessoes.ts`
**Depends on**: T41
**Reuses**: `index.html:971–1008`, `:1856–1960`
**Requirement**: OPS-05, OPS-07, OPS-09, EDGE-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Grupo por (`etapa`, `data`, `hora`), herdando o primeiro mentor e o primeiro link não nulos; busca depois de agrupar
- [ ] Só 1:1 conta na trilha
- [ ] "Concluídas (últimas 30)" são as 30 de data mais recente; sem corte sob foco
- [ ] Status fora de `S_STATUS` não quebra
- [ ] Os casos do grupo "1:1 × grupo"
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 308 → 320

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the 1:1 and group session rules`

---

### T43: Matriz mentor × etapa

**What**: `reunioesConcluidas1a1`, a matriz, o mês padrão e os ids dos 4 avisos.
**Where**: `src/lib/matriz.ts`
**Depends on**: T42
**Reuses**: `index.html:1445–1470`, `:1537–1601`
**Requirement**: OPS-02, OPS-03, OPS-04, NAV-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Reunião pela chave (`mentorado_id`, `data`, `hora`, `mentor` como gravado); fica a linha com `google_event_id` nulo; empate pelo menor `id`
- [ ] Mentor normalizado sem acento, com espaços colapsados e em minúsculas; grafia de `TODOS_MENTORES`; "fora do projeto" para quem não está em `MENTORES`; "Sem mentor identificado" no fim
- [ ] Mês padrão: corrente com reunião, senão o mais recente com reunião, senão "Todos"
- [ ] Ids de `dobradas`, `semData`, `semMentor` e `etapaDeduzida`
- [ ] Os casos dos grupos "Matriz por mentor" e "Alertas que focam linhas"
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 320 → 332

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the mentor matrix that closes the month`

---

### T44: Painel e números do Dashboard

**What**: os 12 itens de "Precisa de atenção", os números gerais, a progressão e as próximas 8 sessões.
**Where**: `src/lib/painel.ts`
**Depends on**: T43
**Reuses**: `renderDash` (`index.html:1474–1800`)
**Requirement**: OPS-01, OPS-05, GER-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Os 12 itens com regra de entrada, papel que vê e link: contratos pendentes; parcelas vencidas em aberto; criados pela Lia sem cadastro completo; sem sessão há +30 dias; sem subir de marco há +30 dias; sem sessão de implementação; aguardando confirmação; sem evento no Google Agenda; cobranças da Lia sem mentorado; pesquisa da sessão não respondida; pesquisa de Experiência não respondida; poucas respostas na Experiência
- [ ] Os contadores ignoram a busca
- [ ] Aviso de adesão só para mentor, com denominador > 0 e taxa < 0,7
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 332 → 348

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the dashboard attention panel and numbers`

---

### T45: Tela Dashboard e Acompanhamento

**What**: `Dashboard` com `modo` (`completo` e `acompanhamento`) e as páginas `/dash` e `/acompanhamento`.
**Where**: `src/components/modules/dashboard/dashboard.tsx`
**Depends on**: T44
**Reuses**: `StatCard`, `Card`, `Alert`, `DataTable`, `Select`, `SearchInput`, `Badge`, `Progress`, `EmptyState` do DS
**Requirement**: OPS-01, OPS-04, OPS-10, NAV-10, GER-08, UI-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Acompanhamento sem números gerais, progressão e detalhe
- [ ] Os 4 avisos da matriz gravam `foco` e levam a `/sessoes`
- [ ] Busca recorta listas sem mudar cards, contadores e subtítulos
- [ ] `EmptyState` em lista vazia
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 348 → 356

**Tests**: unit
**Gate**: quick
**Commit**: `feat(dashboard): port the dashboard and follow-up screens`

---

### T46: Regras de mentorado

**What**: filtros de Mentorados, `resumoExclusao`, `normalizaEmail`, `msgErroMentorado` e situação.
**Where**: `src/lib/mentorados.ts`
**Depends on**: T45
**Reuses**: `index.html:1803–1855`, `:3691–3700`, helpers de e-mail
**Requirement**: OPS-11, OPS-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Filtros todos, ativos, pausados, incompletos e contrato pendente, com a busca depois do filtro
- [ ] `resumoExclusao` conta os 4 tipos de hoje
- [ ] Os casos dos grupos "Exclusão", "E-mail do mentorado" e "Ficha criada pela Lia"
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 356 → 366

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the mentee list and deletion rules`

---

### T47: Tela Mentorados

**What**: filtros, busca, tabela ordenável com a trilha, link na primeira célula e a página `/mentorados`.
**Where**: `src/components/modules/mentorados/mentorados.tsx`
**Depends on**: T46
**Reuses**: `DataTable`, `SortHeader`, `SegmentedProgress`, `SearchInput`, `SegmentedControl`, `EmptyState`
**Requirement**: OPS-10, UI-06, UI-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Coluna Contrato só com `verFinanceiro`; não ativos com opacidade reduzida
- [ ] Ordenação pela T37; linha leva à ficha por `<Link>`
- [ ] "+ Novo mentorado" só com `criarMentorado`, com `data-escrita="W14"`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 366 → 372

**Tests**: unit
**Gate**: quick
**Commit**: `feat(mentorados): port the mentee list screen`

---

### T48: Modal Novo mentorado (W14)

**What**: `NovoMentoradoForm` e o invólucro com `Dialog`.
**Where**: `src/components/modules/mentorados/novo-mentorado.tsx`
**Depends on**: T47
**Reuses**: `Dialog`, `FormField`, `Input`, `Select`, `Button`; `useEscrita`
**Requirement**: WRITE-01, WRITE-03, WRITE-05, OPS-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Padrões de hoje: fechamento hoje, entrada Pago, contrato e restante "Ainda não"
- [ ] Nome obrigatório; e-mail normalizado; e-mail duplicado com a mensagem própria
- [ ] Erro mantém o formulário aberto com o que foi digitado
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 372 → 376

**Tests**: unit
**Gate**: quick
**Commit**: `feat(mentorados): port the new mentee dialog`

---

### T49: Tela Sessões

**What**: foco do aviso, filtros de mentor e tipo, busca, blocos 1:1, encontros em grupo e a página `/sessoes`.
**Where**: `src/components/modules/sessoes/sessoes.tsx`
**Depends on**: T48
**Reuses**: `Alert`, `Section`, `DataTable`, `Select`, `SegmentedControl`, `Badge`
**Requirement**: NAV-10, OPS-07, OPS-09, OPS-10, SEC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Recortes nesta ordem: foco, mentor, tipo, busca
- [ ] `link_meet`, `link_gravacao` e `link_anotacoes` por `linkSeguro`, com `rel="noopener noreferrer"`
- [ ] Blocos Aguardando confirmação, Agendadas, Concluídas (últimas 30) e Bloqueadas
- [ ] Marcas por linha: contada, ignorada, sem data, sem mentor, etapa deduzida
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 376 → 384

**Tests**: unit
**Gate**: quick
**Commit**: `feat(sessoes): port the sessions screen`

---

### T50: Modais de encontro em grupo (W01, W02)

**What**: confirmar encontro e registrar encontro, com corpo exportado.
**Where**: `src/components/modules/sessoes/grupo.tsx`
**Depends on**: T49
**Reuses**: `Dialog`, `Checkbox`, `SearchInput`, `Select`, `Input type="date"`, `Button`; `useEscrita`
**Requirement**: OPS-06, WRITE-03, WRITE-04

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [ ] Confirmar exige mentor; registrar exige ≥ 1 participante
- [ ] Participantes com busca, "selecionar visíveis" e "limpar"
- [ ] Botões com `data-escrita="W01"` e `"W02"` e `loading` durante o envio
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 384 → 390

**Tests**: unit
**Gate**: build
**Commit**: `feat(sessoes): port the group encounter dialogs`

---

### Phase 8: Ficha

### T51: Ficha: topo, abas e página

**What**: `Ficha({ id, aba })` com o topo comum, as abas por papel, "Ficha não encontrada" e a página `/mentorado/[id]/[[...aba]]`.
**Where**: `src/components/modules/ficha/ficha.tsx`
**Depends on**: T50
**Reuses**: `PageHeader`, `Tabs`, `DescriptionList`, `EmptyState`; `abaVisivel` (T11)
**Requirement**: NAV-05, NAV-08, NAV-09, EDGE-01, OPS-05, UI-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Topo: fechamento, parcelas pagas (só `verFinanceiro`), N de M 1:1 concluídas, implementação, plantões
- [ ] Id fora dos mentorados carregados → "Ficha não encontrada"
- [ ] Abas `financeiro` e `stlseller` sem `verFinanceiro` desenham `sessoes`
- [ ] Voltar aponta para `voltarPara`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 390 → 398

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ficha): port the mentee record with role-aware tabs`

---

### T52: Aba Cadastro (W11, W11b, W12, W13)

**What**: campos editáveis só com `editarMentorado`, Situação, Salvar e Excluir pelo nome.
**Where**: `src/components/modules/ficha/aba-cadastro.tsx`
**Depends on**: T51
**Reuses**: `FormField`, `Input`, `DescriptionList`, `ConfirmDialog` com `confirmDisabled`; `chaveNome`, `resumoExclusao`
**Requirement**: OPS-11, OPS-12, OPS-13, WRITE-06, UI-05, SEC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Sem `editarMentorado`: `DescriptionList` só leitura e bloco Situação oculto
- [ ] Salvar com e-mail na tela: W11 e depois W11b
- [ ] Excluir mostra o `resumoExclusao` e libera o botão só com o nome que casa por `chaveNome`
- [ ] `link_drive`, `link_mapa_mental` e `link_whatsapp` por `linkSeguro`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 398 → 406

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ficha): port the profile tab`

---

### T53: Regras financeiras

**What**: `cobrancasOrfas`, `motivoOrfa`, `podeVincular`, `cobrancasDescartadas`, `parcelaDaLia`, `proximaParcela`, cards, vencidas e próximos 10.
**Where**: `src/lib/financeiro.ts`
**Depends on**: T52
**Reuses**: `index.html:2105–2320`
**Requirement**: FIN-01, FIN-02, FIN-03, FIN-05, FIN-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Motivos: sem e-mail, e-mail em mais de um cadastro, cadastro existe, nenhum cadastro
- [ ] "vincular" só com exatamente 1 mentorado com o e-mail, comparado em minúsculas
- [ ] Cards e painéis ignoram a busca
- [ ] Parcela com `lia_bill_id` não é editável; "Adicionar parcela" some se alguma veio da Lia
- [ ] Os casos dos grupos "Cobrança órfã" e "Parcelas da Lia"
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 406 → 420

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the billing and orphan charge rules`

---

### T54: Campo de moeda

**What**: `CampoMoeda`: `Input` com `inputMode="decimal"`, `mascaraBRL` no `onChange` e no `onBlur`.
**Where**: `src/components/modules/comum/campo-moeda.tsx`
**Depends on**: T53
**Reuses**: `Input` do DS; `mascaraBRL`, `lerBRL` (T34)
**Requirement**: OPS-20, UI-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Colar "2000.50" mostra R$ 2.000,50 e entrega 2000,5
- [ ] O `NumberInput` do DS não é usado para dinheiro
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 420 → 423

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ficha): add the BRL money field`

---

### T55: Aba Financeiro (W11 financeiro, W18–W21)

**What**: status do contrato, entrada e restante; parcelas com alternar, editar, adicionar e excluir.
**Where**: `src/components/modules/ficha/aba-financeiro.tsx`
**Depends on**: T54
**Reuses**: `Select`, `DataTable`, `Dialog`, `ConfirmDialog`, `CampoMoeda`, `Input type="date"`
**Requirement**: OPS-12, OPS-14, OPS-15, FIN-05, UI-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `contrato_status`, `entrada_status` e `restante_status` nulos mostram "— não informado —" selecionado e continuam nulos se ninguém mexer
- [ ] Diretoria vê os campos só para leitura
- [ ] Parcela número ≥ 1 e único no mentorado; excluir por `ConfirmDialog`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 423 → 431

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ficha): port the finance tab`

---

### T56: Aba Sessões e modais de sessão (W03–W05)

**What**: trilha 1:1 por etapa, grupo por data, modal de sessão e de confirmação.
**Where**: `src/components/modules/ficha/aba-sessoes.tsx`
**Depends on**: T55
**Reuses**: `SegmentedProgress`, `Dialog`, `ConfirmDialog`, `Select`, `Input type="date"`
**Requirement**: OPS-05, OPS-08, UI-05, WRITE-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Legenda da trilha conta só 1:1
- [ ] Mentor edita e confirma; não cria nem exclui; "+ Nova sessão" só com `criarSessao`
- [ ] Excluir sessão por `ConfirmDialog`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 431 → 439

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ficha): port the sessions tab and session dialogs`

---

### T57: Regras das notas

**What**: `NOTA_TAGS`, `sanitizarNota`, `atalhoPara`, `linkValido` e `criarAutosave`.
**Where**: `src/lib/notas.ts`
**Depends on**: T56
**Reuses**: `index.html:3343–3420`
**Requirement**: NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-07, NOTE-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `sanitizarNota` chama o `purify` injetado com `ALLOWED_TAGS: NOTA_TAGS`, `ALLOWED_ATTR: ["href", "class"]`, `ALLOW_DATA_ATTR: false` e `ALLOWED_URI_REGEXP` só `http(s)`; devolve `null` sem suporte
- [ ] `filtrarClasses` deixa só `checklist` e `feito` (`"fixed inset-0 z-50 checklist"` vira `"checklist"`)
- [ ] Atalhos `#`, `##`, `###`, `-`, `*`, `1.`, `>`, `[]` com espaço; três crases e `---` com Enter
- [ ] `linkValido` aceita `http:` e `https:` e recusa `javascript:`, `data:` e texto solto
- [ ] Autosave: grava 1 s depois da última mudança; `descarregar` em 300 ms grava uma vez com o último HTML
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 439 → 455

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the note rules with flush on leave`

---

### T58: Editor de notas e aba Notas (W10)

**What**: editor não controlado com HTML pela ref, barra, atalhos, link num `Dialog` e gravação ao sair.
**Where**: `src/components/modules/ficha/editor-notas.tsx`
**Depends on**: T57
**Reuses**: `Dialog`, `Input`, `Alert`; `notas.ts` (T57); `lerNota` (T23)
**Requirement**: NOTE-01, NOTE-03, NOTE-05, NOTE-06, NOTE-08, EDGE-04, TEST-03, SEC-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O JSX do editor não tem filho; o HTML entra só por `ref.current.innerHTML = sanitizarNota(…)`
- [ ] Desmontar com gravação pendente grava a partir do `htmlRef`; `visibilitychange` para `hidden` também
- [ ] O `descarregar` do autosave fica em `registrarPendencia` enquanto o editor está montado
- [ ] Diretoria: sem barra e sem `contentEditable`
- [ ] Sem sanitizador: `Alert`, sem HTML e sem gravar
- [ ] Erro do banco no toast; o texto fica no editor
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 455 → 461

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ficha): port the notes editor without losing edits`

---

### T59: Aba STLSeller da ficha

**What**: dados do STLSeller casando o e-mail da ficha com `email` ou `email_stlflix`.
**Where**: `src/components/modules/ficha/aba-stlseller.tsx`
**Depends on**: T58
**Reuses**: `DescriptionList`, `DataTable`, `EmptyState`, `Alert`
**Requirement**: NAV-05, GER-01, DATA-07

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [ ] Só para `verFinanceiro`
- [ ] Falha de R14–R16 mostra erro só nesta aba
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 461 → 464

**Tests**: unit
**Gate**: build
**Commit**: `feat(ficha): port the STLSeller tab`

---

### Phase 9: Rotas e Financeiro

### T60: Regras de rotas

**What**: régua de faturamento, estado do stepper e `montarEvolucao` (W09).
**Where**: `src/lib/rotas.ts`
**Depends on**: T59
**Reuses**: `renderRotas` (`index.html:2321–2606`)
**Requirement**: OPS-16, OPS-17, OPS-18, OPS-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Régua soma os canais da rota no mês corrente com `unidade = mes` e no acumulado com `acumulado`
- [ ] `criterios_ok` guarda o texto; `progresso` e `criterios_pendentes` derivados
- [ ] Os casos do grupo "Rotas"
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 464 → 476

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the route milestone rules`

---

### T61: Campo de mês

**What**: `CampoMes`: dois `Select` (mês e ano) com valor `AAAA-MM`, padrão no mês corrente.
**Where**: `src/components/modules/rotas/campo-mes.tsx`
**Depends on**: T60
**Reuses**: `Select` do DS; `dpLabel` (T33)
**Requirement**: UI-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Entrega `AAAA-MM`; os anos vêm por prop
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 476 → 479

**Tests**: unit
**Gate**: quick
**Commit**: `feat(rotas): add the month field`

---

### T62: Escolha de mentorado

**What**: `Popover` + `SearchInput` + lista, com `casaBusca`; troca no clique ou no Enter.
**Where**: `src/components/modules/rotas/escolher-mentorado.tsx`
**Depends on**: T61
**Reuses**: `Popover`, `SearchInput` do DS; `casaBusca` (T35)
**Requirement**: UI-06, OPS-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Enter escolhe o primeiro que casa; sem escolha, o primeiro ativo
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 479 → 483

**Tests**: unit
**Gate**: quick
**Commit**: `feat(rotas): add the mentee picker`

---

### T63: Tela Rotas (W06–W09)

**What**: rota, canais, mentorado, gráfico de marcos, stepper com um marco aberto, painel do marco e faturamento; a página `/rotas`.
**Where**: `src/components/modules/rotas/rotas.tsx`
**Depends on**: T62
**Reuses**: `Select`, `CollapsibleSection`, `LineChart`, `TrendChart`, `Checkbox`, `Progress`, `StatCard`, `DataTable`, `ConfirmDialog`, `CampoMes`, `CampoMoeda`
**Requirement**: OPS-16, OPS-17, OPS-19, WRITE-03, UI-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Abrir um marco fecha o anterior
- [ ] Marcar critério atualiza contador e barra sem fechar o painel nem perder campo
- [ ] Excluir faturamento por `ConfirmDialog`
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 483 → 491

**Tests**: unit
**Gate**: quick
**Commit**: `feat(rotas): port the routes screen`

---

### T64: Tela Financeiro (W15–W17)

**What**: cards, tabelas, cobranças órfãs com vincular e descartar, descartadas com restaurar; a página `/financeiro`.
**Where**: `src/components/modules/financeiro/financeiro.tsx`
**Depends on**: T63
**Reuses**: `StatCard`, `DataTable`, `Button`, `Alert`; `financeiro.ts` (T53)
**Requirement**: FIN-01, FIN-02, FIN-03, FIN-04, WRITE-07, DATA-07

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [ ] A busca não esconde cards, órfãs nem descartadas
- [ ] Falha de R05: erro só nos painéis de órfãs e descartadas
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 491 → 499

**Tests**: unit
**Gate**: build
**Commit**: `feat(financeiro): port the finance screen`

---

### Phase 10: Telas gerenciais

### T65: Regras do STLSeller

**What**: agregados por e-mail, situação, concentração, chips, 15 anúncios e diagnóstico de e-mail.
**Where**: `src/lib/stlseller.ts`
**Depends on**: T64
**Reuses**: `renderAnalise` (`index.html:2607–2876`)
**Requirement**: GER-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Recorte "Ativos" como padrão; e-mail STLFLIX primeiro no diagnóstico
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 499 → 509

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the STLSeller aggregates`

---

### T66: Tela STLSeller

**What**: a tela e a página `/analise`.
**Where**: `src/components/modules/stlseller/stlseller.tsx`
**Depends on**: T65
**Reuses**: `StatCard`, `SentimentBar`, `PillGroup`, `DataTable`, `EmptyState`
**Requirement**: GER-01, UI-07, DATA-07, SEC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Link de anúncio por `linkSeguro`, com `rel="noopener noreferrer"`
- [ ] Falha de R14–R16 vira `EmptyState` com "Tentar de novo"
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 509 → 513

**Tests**: unit
**Gate**: quick
**Commit**: `feat(stlseller): port the STLSeller screen`

---

### T67: Regras do NPS

**What**: NPS, média, semana e mês em SP, tabela por período e Pesquisa de Experiência.
**Where**: `src/lib/nps.ts`
**Depends on**: T66
**Reuses**: `renderNps` (`index.html:2919–3008`)
**Requirement**: GER-02, GER-03, GER-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] NPS = `round(100 · (#nota ≥ 9 − #nota ≤ 6) / n)`; média com 1 casa; semana de segunda a domingo; resposta às 22h de domingo em Brasília conta no domingo
- [ ] Índice da Experiência (0/25/50/75/100, média das médias), clareza e índice por item, pior primeiro
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 513 → 525

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the NPS and experience survey math`

---

### T68: Tela NPS

**What**: as duas abas, tabela por período (10 por página), respostas (20 por página) e a página `/nps`.
**Where**: `src/components/modules/nps/nps.tsx`
**Depends on**: T67
**Reuses**: `Tabs`, `SegmentedControl`, `DataTable`, `Pagination`, `Select`, `SearchInput`
**Requirement**: GER-03, GER-04, DATA-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Trocar aba ou período volta as duas paginações para 1; trocar o mentor volta só as respostas
- [ ] Falha de R18 afeta só a aba Experiência
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 525 → 531

**Tests**: unit
**Gate**: quick
**Commit**: `feat(nps): port the NPS screen`

---

### T69: Regras da Análise IA

**What**: ordem por risco, contagens, médias e NPS por mentor, formato antigo.
**Where**: `src/lib/ia.ts`
**Depends on**: T68
**Reuses**: `renderIa` (`index.html:2877–2918`)
**Requirement**: GER-05, GER-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `pontos_fortes`, `pontos_de_atencao` e `sinais` lidos nos mesmos blocos de hoje
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 531 → 537

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the AI analysis rules`

---

### T70: Tela Análise IA

**What**: Visão geral, Por mentor e Por mentorado; recorte do mentor; a página `/ia`.
**Where**: `src/components/modules/ia/ia.tsx`
**Depends on**: T69
**Reuses**: `Tabs`, `Alert`, `Badge`, `Card`
**Requirement**: GER-05, GER-06, DATA-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Mentor: lê R21, sem a aba Por mentor, sem resumo e sem respostas de NPS
- [ ] Falha de R18 não afeta esta tela
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 537 → 542

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ia): port the AI analysis screen`

---

### T71: Regras de Mentores

**What**: carteira, 1:1 e grupo em 30 dias e no total, agendadas, NPS de 30 dias, calls aceitas, última atividade, 6 meses e 10 respostas.
**Where**: `src/lib/mentores.ts`
**Depends on**: T70
**Reuses**: `renderMentores` (`index.html:3009–3081`)
**Requirement**: GER-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Carteira: ativos cuja última 1:1 Concluída foi com o mentor
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 542 → 550

**Tests**: unit
**Gate**: quick
**Commit**: `feat(lib): port the mentor overview rules`

---

### T72: Tela Mentores

**What**: a tela e a página `/mentores`.
**Where**: `src/components/modules/mentores/mentores.tsx`
**Depends on**: T71
**Reuses**: `Card`, `DescriptionList`, `DataTable`, `Alert`
**Requirement**: GER-07, DATA-07

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [ ] Falha de R17, R19 ou R22 vira `Alert` e o resto renderiza
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 550 → 554

**Tests**: unit
**Gate**: build
**Commit**: `feat(mentores): port the mentors screen`

---

### Phase 11: Varreduras de tela e paridade

### T73: Varredura de XSS

**What**: renderiza as 10 telas, a ficha nas 5 abas e os corpos de modal com o nome `<img src=x onerror=alert(1)>` (e o XSS de `tests/ambiente.mjs:31` nos campos de texto vindos do banco, do modelo e do marketplace).
**Where**: `src/test/xss.test.tsx`
**Depends on**: T72
**Reuses**: fixtures (`src/test/fixtures.ts`, porte de `tests/ambiente.mjs:193–340`)
**Requirement**: TEST-02, SEC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Em cada render: `&lt;img` presente e `<img src=x` ausente
- [ ] Links `javascript:` e `data:` dos fixtures nunca aparecem como `href`
- [ ] Dashboard, Acompanhamento, Mentorados, Sessões, Rotas, Mentores, STLSeller, NPS, Análise IA, Financeiro, Ficha (5 abas) e os corpos de modal
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 554 → 567

**Tests**: unit
**Gate**: quick
**Commit**: `test(app): sweep every screen for escaped user content`

---

### T74: Varredura de controles de escrita por papel

**What**: conta `data-escrita` nas 10 telas, na ficha e nos modais por papel.
**Where**: `src/test/papeis.test.tsx`
**Depends on**: T73
**Reuses**: `renderTela` (T14)
**Requirement**: WRITE-09, GATE-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] diretoria: 0 controles
- [ ] admin: ≥ 10 controles
- [ ] mentor: só W01, W03, W04, W06, W07, W09 e W10
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 567 → 570

**Tests**: unit
**Gate**: quick
**Commit**: `test(app): sweep write controls per role`

---

### T75: Estrutura de rotas e porte dos grupos

**What**: as 12 rotas existem (e nenhuma a mais), e cada grupo do mapeamento §7 tem o seu teste.
**Where**: `src/test/estrutura.test.ts`
**Depends on**: T74
**Reuses**: tabela de porte do design (componente 11)
**Requirement**: NAV-01, TEST-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Páginas: `/dash`, `/acompanhamento`, `/mentorados`, `/sessoes`, `/rotas`, `/mentores`, `/analise`, `/nps`, `/ia`, `/financeiro`, `/mentorado/[id]/[[...aba]]` e `/`
- [ ] Os 20 grupos: Formatadores e campo de data; 1:1 × grupo; Telas do admin; Modais e telas; Escrita do grupo; Papel mentor; Papel diretoria; Controle negativo com admin; Matriz por mentor; Alertas que focam linhas; Busca e botão de criar; Exclusão; Cobrança órfã; Ficha criada pela Lia; Parcelas da Lia; Etapa deduzida; Busca por data; E-mail do mentorado; Rotas; Notas — cada um apontando para um arquivo de teste que existe
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 570 → 572

**Tests**: unit
**Gate**: quick
**Commit**: `test(app): pin the route set and the ported test groups`

---

### T76: Carregador do app antigo

**What**: `scripts/parity/legado.mjs` executa o `index.html` de um merge-base com stubs de DOM e de `location`, um cliente Supabase falso que responde do snapshot, e o `afterLogin` e o `loadAll` reais.
**Where**: `scripts/parity/legado.mjs`
**Depends on**: T75
**Reuses**: técnica de `tests/ambiente.mjs:47–185`
**Requirement**: GATE-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `scripts/parity/legado.test.mjs` carrega as fixtures de `tests/ambiente.mjs` pelo cliente falso: admin lê `mentorados`; mentor lê `mentorados_basic`; as rpcs respondem; navegar pelo hash troca o HTML de `#app`
- [ ] Lê o `index.html` de um caminho dado (o do merge-base, extraído por `git show`)
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 572 → 576

**Tests**: unit
**Gate**: quick
**Commit**: `feat(parity): run the legacy app on snapshot data`

---

### T77: Métricas do lado antigo

**What**: uma função por métrica, lida do HTML e dos símbolos do app antigo.
**Where**: `scripts/parity/metricas-legado.mjs`
**Depends on**: T76
**Reuses**: âncoras de hoje (`#risco`, `#sem-implementacao`, `#sem-subida`, `#orfas`, `#nps-pend`, `openMentorado('<id>'`)
**Requirement**: GATE-06, PAR-01, PAR-02, PAR-03, PAR-04, PAR-05, PAR-06, PAR-07, PAR-08, PAR-09, PAR-10, PAR-11, PAR-12, PAR-13, PAR-14, PAR-15, PAR-16, PAR-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] PAR-01 a PAR-17, cada uma com chave estável e um teste sobre as fixtures antigas
- [ ] Nenhuma métrica devolve nome, e-mail ou comentário
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 576 → 593

**Tests**: unit
**Gate**: quick
**Commit**: `feat(parity): extract the parity metrics from the legacy app`

---

### T78: Métricas do lado novo

**What**: as mesmas 17 métricas a partir das regras de `src/lib/`.
**Where**: `scripts/parity/metricas.ts`
**Depends on**: T77
**Reuses**: `painel.ts`, `matriz.ts`, `sessoes.ts`, `mentorados.ts`, `financeiro.ts`, `rotas.ts`, `stlseller.ts`, `nps.ts`, `ia.ts`, `mentores.ts`
**Requirement**: GATE-06, PAR-01, PAR-02, PAR-03, PAR-04, PAR-05, PAR-06, PAR-07, PAR-08, PAR-09, PAR-10, PAR-11, PAR-12, PAR-13, PAR-14, PAR-15, PAR-16, PAR-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] PAR-01 a PAR-17 com as mesmas chaves da T77
- [ ] Sobre as fixtures antigas, as duas tasks dão o mesmo valor em cada métrica
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 593 → 610

**Tests**: unit
**Gate**: quick
**Commit**: `feat(parity): compute the parity metrics from the new rules`

---

### T79: Corrida de paridade e relatório

**What**: `paridade.parity.ts` e `vitest.parity.config.ts` (`pnpm parity`): relógio fixo no "hoje" do snapshot, validação das linhas por `esquemas.ts`, 3 papéis, diff e relatório.
**Where**: `scripts/parity/paridade.parity.ts`
**Depends on**: T78
**Reuses**: T21, T76, T77, T78
**Requirement**: GATE-03, GATE-06, GATE-07, SEC-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Relatório impresso só com `PAR-xx | chave | falta, sobra ou valor diferente`; os dois valores vão para `divergencias-<data>.json` (`0600`) na pasta do snapshot
- [ ] Exit 1 com divergência fora do Apêndice A; o bloco Concluídas de PAR-09 fica fora da comparação
- [ ] Linha do snapshot fora do schema conta como divergência
- [ ] `scripts/parity/relatorio.test.ts`: o relatório impresso não carrega valor nem campo pessoal; o arquivo de valores sai com `0600`; a exceção do PAR-09 vale; o código de saída segue o diff
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 610 → 615

**Tests**: unit
**Gate**: quick
**Commit**: `feat(parity): compare both apps and report divergences without PII`

---

### T80: Conferência do build

**What**: `scripts/gates/verificar-build.mjs` procura em `.next/static` e `.next/server/app` valor `sb_secret_…` e JWT cujo payload decodificado tenha `role` diferente de `anon`, e confere que a classe `__variable_` do `<html>` existe no CSS de `.next/static/css`.
**Where**: `scripts/gates/verificar-build.mjs`
**Depends on**: T79
**Reuses**: NONE
**Requirement**: GATE-11, GATE-12

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [ ] `scripts/gates/verificar-build.test.mjs` com uma pasta falsa: acha um valor `sb_secret_…`; acha um JWT `service_role`; não acusa o JWT `anon` nem a palavra solta `sb_secret_`; acha e não acha a classe
- [ ] Roda sobre o `.next/` real depois do `pnpm build` e sai com 0
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 615 → 622

**Tests**: unit
**Gate**: build
**Commit**: `feat(gates): check the build for secrets and the font class`

---

### T81: Sonda do RLS

**What**: `scripts/gates/sondar-rls.mjs` (G3.14): pede e-mail e senha da conta de diretoria ou de mentor no terminal, entra com `persistSession: false`, tenta no registro `ZZQ Migracao Xyzzy` cada escrita que o papel não tem no mapeamento §4.2 e imprime só `Wnn | recusada` ou `Wnn | GRAVOU`.
**Where**: `scripts/gates/sondar-rls.mjs`
**Depends on**: T80
**Reuses**: `CAPACIDADES` (T10); payloads de `escritas.ts` (T26–T29)
**Requirement**: GATE-08, SEC-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `scripts/gates/sondar-rls.test.mjs`: a lista de escritas proibidas por papel sai das capacidades; o alvo só pode ser o registro cujo e-mail é `zzq-migracao@example.invalid`, e qualquer outro é recusado antes de tentar; a saída não tem nome, e-mail nem valor
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 622 → 625

**Tests**: unit
**Gate**: build
**Commit**: `feat(gates): probe that RLS refuses the writes each role lacks`

---

### Phase 12: Corte local

### T82: vercel.json

**What**: `{ "framework": "nextjs", "installCommand": "pnpm install --frozen-lockfile", "buildCommand": "pnpm build" }` e o teste que o lê.
**Where**: `vercel.json`
**Depends on**: T81
**Reuses**: NONE
**Requirement**: GATE-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `src/test/vercel.test.ts`: as 3 chaves com os valores acima
- [ ] A `main` não ganha `vercel.json` antes do merge
- [ ] Gate check passes: `pnpm typecheck` e `pnpm test`
- [ ] Test count: 625 → 627

**Tests**: unit
**Gate**: quick
**Commit**: `build(vercel): build the branch as a Next.js app`

---

### T83: Um front só

**What**: apaga `index.html` e `tests/`. O `favicon.png` já foi para `src/app/icon.png` na T7.
**Where**: `index.html`
**Depends on**: T82
**Reuses**: NONE
**Requirement**: CUT-03, TEST-01, TEST-06

**Tools**:

- MCP: NONE
- Skill: `ram-guard`

**Done when**:

- [ ] `git ls-files` não lista `index.html` nem `tests/`
- [ ] O teste da T75 continua verde sem `tests/`; a paridade lê o app antigo do merge-base por `git show`
- [ ] `pnpm test` sem rede e sem banco
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 627 → 627

**Tests**: none
**Gate**: build
**Commit**: `chore(app): remove the static front and its harness`

---

### T84: Documentação da stack nova

**What**: `ARCHITECTURE.md` e `README.md` com rodar, testar, publicar e voltar, e as correções do mapeamento §12.
**Where**: `ARCHITECTURE.md`
**Depends on**: T83
**Reuses**: mapeamento §12
**Requirement**: CUT-04, GATE-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Cada linha do mapeamento §12 corrigida ou removida
- [ ] Seções de rodar, testar (`pnpm test`, `pnpm parity`), publicar e voltar (`git revert -m 1` com o `.vercelignore` que publica só `index.html` e `favicon.png`)
- [ ] Gate check passes: `pnpm typecheck`, `pnpm test` e `pnpm build`
- [ ] Test count: 627 → 627

**Tests**: none
**Gate**: build
**Commit**: `docs(app): describe the Next.js stack, release and rollback`

---

## Verificações antes da aprovação

`validate_tasks.py`: 0 erros; 8 avisos, todos esperados (abaixo); nenhum requisito da spec sem task.

**Check 1, granularidade.** Uma task, um entregável. Quatro tasks citam mais de um arquivo porque são uma peça só: T1 (a casca do repo não passa no gate sem `tsconfig` e `vitest.config`), T7 (o layout carrega o `theme-init.js`), T14 (o helper de render existe para os contextos) e T20 (as duas páginas são a mesma ponte). Página de rota de uma linha entra no "What" da tela que ela monta.

**Check 2, diagrama × `Depends on`.**

| fase | diagrama | `Depends on` | status |
| ---- | -------- | ------------ | ------ |
| 0–12 | uma linha por fase, cada task depois da anterior | cada task depende da anterior; a primeira de cada fase depende só de task de fase anterior (T5 → T1; T9 → T8; T15 → T14; T21 → T20; T26 → T25; T32 → T31; T42 → T41; T51 → T50; T60 → T59; T65 → T64; T73 → T72; T82 → T81) | ✅ 84 de 84 |

**Check 3, testes co-localizados.**

| camada | tasks | matriz pede | tasks dizem | status |
| ------ | ----- | ----------- | ----------- | ------ |
| regras puras | T10, T11, T13, T24, T30, T32–T35, T36, T37, T42–T44, T46, T53, T57, T60, T65, T67, T69, T71 | unit | unit | ✅ |
| porta de dados | T5, T12, T21–T23, T26–T29 | unit | unit | ✅ |
| casca e telas | T14–T19, T25, T31, T45, T47–T52, T54–T56, T58, T59, T61–T64, T66, T68, T70, T72 | unit | unit | ✅ |
| primitivos novos | T38–T40 | unit | unit | ✅ |
| varreduras e estrutura | T8, T73–T75 | unit | unit | ✅ |
| middleware | T9 | unit | unit | ✅ |
| scripts | T2, T4, T76–T80, T81 | unit | unit | ✅ |
| config (com teste do que dá para testar) | T1, T3, T6, T7, T82 | none | unit | ✅ (acima do mínimo) |
| rotas, docs e remoção | T20, T41, T83, T84 | none | none | ✅ |

**Check 4, caminho de ponta a ponta.**

| fluxo | começa | termina | tasks |
| ----- | ------ | ------- | ----- |
| entrar | tela de login | tela do endereço atual com o recorte do papel, ou tela de perfil ou papel | T12, T13, T15–T17, T19 |
| sair | botão Sair | login com dado descartado | T13, T15, T18, T25 |
| link antigo do WhatsApp | `/#/mentorado/<id>/financeiro` | ficha na aba (ou Sessões sem `verFinanceiro`) | T11, T20, T51 |
| escrever | botão com `data-escrita` | toast de sucesso e recarga, ou formulário aberto com o erro | T26–T31 e as telas |
| nota | digitar | gravada em 1 s ou ao sair | T57, T58 |
| carga que falha | erro de relação | "Tentar de novo" ou `Alert` na tela | T23, T25 e as telas |
| paridade | `pnpm parity:snapshot` (Lucas) | relatório e código de saída | T4, T76–T79 |
| tema | `ThemeToggle` ou o sistema | todas as telas com os tokens do tema | T7, T18 |

Não há job em segundo plano novo: cron e webhooks ficam no Supabase, fora do escopo.

**Ferramentas.** Pelo regime de execução sem perguntas, as ferramentas de cada task já estão nela: `ram-guard` em toda task com `pnpm install`, `next build` ou `next start`; `decision-log` no AD da T41. Nenhuma task pede MCP. O `context7` não entra: as APIs de terceiros que o desenho usa já têm fonte no `design.md`.

---

## Gates de produção (fora do Execute)

Executados na ordem da spec, com evidência em `.specs/features/migracao-nextjs/evidence/G<n>.md` (GATE-01, GATE-02, GATE-03). O G1 é o gate de cada task acima.

| gate | quando | quem | requisitos conferidos |
| ---- | ------ | ---- | --------------------- |
| G0 | escalonado: G0.1 antes da Fase 1, G0.2 antes da Fase 4, G0.3 a G0.6 antes do G2 | Lucas roda `pnpm parity:snapshot` num terminal dele; o dono da Vercel confirma previews, `main` de produção, log liberado e Output Directory sem sobreposição; Lucas empurra a `main` da plataforma, aprova o congelamento e a janela, e separa as contas de UAT | GATE-05, UI-01 (sha alcançável) |
| G2 | depois da T84 | agente, sem ler valores (SEC-02) | STACK-03 (clone limpo), GATE-06, GATE-07 (paridade), GATE-11, GATE-12 (build), GATE-16 (congelamento), SEC-03 (`pnpm audit`, `SNAPSHOT` × plataforma), Verifier, threat pass do diff |
| G3 | depois do "go" do push da branch | agente e Lucas no preview; senhas só pelo Lucas; nada de captura de tela, DOM ou HAR (SEC-02) | CUT-01 (5 caminhos em 404), CUT-02 e NAV-07 (link antigo, voltar e avançar), GATE-08 (rede da diretoria e sonda do RLS), GATE-09 e GATE-10 (escrita no registro de teste, tudo em 31/12/2099), AUTH-09 (recarregar mantém a sessão), UI-04 (temas), SEC-04 (`curl -I`), G3.9 a G3.11 |
| G4 | antes do corte | Lucas | GATE-13, GATE-15 (tag `pre-nextjs`, ensaio da volta com o `.vercelignore`), janela |
| G5 | no corte | Lucas e agente | GATE-13 (G2.1 na `main` mesclada), GATE-14 (volta em até 15 min), CUT-01 em produção |
| G6 | 7 dias depois | Lucas e agente | logs; branch, snapshot e arquivo de valores apagados; contas de UAT removidas ou banidas (GATE-09); CUT-04 |

Feature total: Test count: 0 → 627
