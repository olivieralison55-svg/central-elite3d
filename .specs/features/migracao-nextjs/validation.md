# migracao-nextjs Validation

## Validation: migracao-nextjs - PASS

**Date**: 2026-10-15
**Spec**: `.specs/features/migracao-nextjs/spec.md`
**Diff range**: `2aea45579452463cb494f8c3312d0bedfcaa0006..90b13cd` (95 commits)
**Verifier**: independent sub-agent (author ≠ verifier), iteração 2

**Verdict**: PASS — os ACs do Execute estão cobertos, o sensor matou 15 de 15 mutantes e, depois do `90b13cd`, a cadeia `Test count` do `tasks.md` bate com o runner de T1 a T84 e fecha em `0 → 798`.

**Iteração 2**: `git diff a188184 90b13cd --stat` toca só `.specs/features/migracao-nextjs/tasks.md` (69+/69−); código e testes iguais aos da iteração 1, então ACs e sensor valem sem refazer.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T84 | ✅ Done | todas `[x]`; cadeia contínua (`N` = `M` da anterior, 84 linhas); `M` igual ao `Test count` do corpo do commit de cada task; medido no runner em T1, T3, T20, T24, T39, T40, T41–T84 |

Nenhum `- [ ]` aberto no `tasks.md`. Nenhum commit `fix:`/`revert:` no range.

---

## Spec-Anchored Acceptance Criteria

Evidência = `arquivo:linha` do caso de teste (o `it(` que afirma o resultado). Runtime: todos rodaram verdes no gate abaixo.

### P1: Fundação

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| STACK-01 | versões exatas = lockfile da plataforma no SNAPSHOT | `src/design-system/snapshot.test.ts:68` | ✅ PASS |
| STACK-02 | DS em `src/design-system`+`src/components/ui`, dados em `src/lib/data` | `src/test/varreduras.test.ts:163`, `src/test/render.test.tsx:38` | ✅ PASS |
| STACK-04 | `.gitignore` com as 5 entradas; nenhum `.env*` além do `.env.example` | `src/test/repo.test.ts:22`, `src/test/repo.test.ts:38` | ✅ PASS |
| STACK-05 | só as 2 `NEXT_PUBLIC_*` | `src/test/varreduras.test.ts:177`, `src/lib/data/config.test.ts:97` | ✅ PASS |
| STACK-06 | config recusa chave/URL, erro nomeia a variável, no `next.config.ts` | `src/lib/data/config.test.ts:49`, `src/lib/data/config.test.ts:66`, `src/lib/data/config.test.ts:80` | ✅ PASS |
| STACK-07 | 0 ocorrências de `service_role`/`SUPABASE_SERVICE_ROLE_KEY`/`sb_secret_` | `src/test/varreduras.test.ts:184` | ✅ PASS |
| STACK-08 | sem outra origem; supabase-js 2.117.3 e dompurify 3.2.6 exatos; sem chart.js | `src/test/varreduras.test.ts:189` | ✅ PASS |

STACK-03 (gate verde): evidência é o próprio gate desta validação (typecheck, test, build com exit 0); não há teste que o afirme — ver spec-precision gap 7.

### P1: Login, sessão e papel

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| AUTH-01 | login sem leitura de dado | `src/components/shell/sessao.test.tsx:110`, `src/components/shell/tela-login.test.tsx:85` | ✅ PASS |
| AUTH-02 | `signInWithPassword` + `profiles.role` | `src/lib/data/auth.test.ts:82`, `src/lib/data/auth.test.ts:120` | ✅ PASS |
| AUTH-03 | Enter envia (form com submit único) | `src/components/shell/tela-login.test.tsx:24` | ✅ PASS |
| AUTH-04 | "E-mail ou senha inválidos." literal | `src/lib/data/auth.test.ts:91` | ✅ PASS |
| AUTH-05 | mensagem de rede/limite sem "senha" | `src/lib/data/auth.test.ts:100`, `src/lib/data/auth.test.ts:108` | ⚠️ Spec-precision gap (texto não definido na spec) |
| AUTH-06 | signOut + "Perfil não encontrado" | `src/lib/sessao.test.ts:61`, `src/components/shell/tela-papel.test.tsx:42` | ✅ PASS |
| AUTH-07 | "Papel não reconhecido" + Sair, sem dado | `src/lib/sessao.test.ts:66`, `src/components/shell/tela-papel.test.tsx:46` | ✅ PASS |
| AUTH-08 | sair descarta dados; outro usuário vê só o papel dele | `src/components/shell/dados.test.tsx:217`, `src/components/shell/menu.test.tsx:63` | ✅ PASS |
| AUTH-09 | storage padrão do supabase-js | `src/lib/data/cliente.test.ts:32` | ✅ PASS |
| AUTH-10 | sem cadastro/reset; `detectSessionInUrl: false` | `src/lib/data/cliente.test.ts:32`, `src/lib/data/auth.test.ts:173`, `src/components/shell/tela-login.test.tsx:70` | ✅ PASS |

### P1: Endereço e navegação

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| NAV-01 | 12 rotas → mesma tela | `src/test/estrutura.test.ts:73`, `src/lib/endereco.test.ts:19` | ✅ PASS (paridade de tela: G2.5/G3) |
| NAV-02 | hash de TELAS/ABAS_FICHA vira caminho, sem entrada nova; resto → `/dash` | `src/app/ponte.test.tsx:45`, `src/app/ponte.test.tsx:50` | ✅ PASS |
| NAV-03 | `/`, desconhecido e `/mentorado/%E0%A4%A` → Dashboard sem lançar | `src/lib/endereco.test.ts:35`, `src/middleware.test.ts:12` | ✅ PASS |
| NAV-04 | sem verFinanceiro → `/dash` nas 4 telas | `src/components/shell/casca.test.tsx:83`, `src/lib/endereco.test.ts:84` | ✅ PASS |
| NAV-05 | abas financeiro/stlseller → sessoes | `src/components/modules/ficha/ficha.test.tsx:92` | ✅ PASS |
| NAV-06 | 6 itens para todos, 4 só admin/diretoria | `src/components/shell/menu.test.tsx:63` | ✅ PASS |
| NAV-07 | voltar/avançar pelo roteador | `src/components/shell/casca.test.tsx:121` | ✅ PASS |
| NAV-08 | Skeleton, nunca "Ficha não encontrada" | `src/components/modules/ficha/ficha.test.tsx:82` | ✅ PASS |
| NAV-09 | "Ficha não encontrada" | `src/components/modules/ficha/ficha.test.tsx:64` | ✅ PASS |
| NAV-10 | recorte pelos ids do aviso; descarta ao sair | `src/components/shell/casca.test.tsx:96`, `src/components/modules/sessoes/sessoes.test.tsx:202` | ✅ PASS |

### P1: Porta de dados

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| DATA-01 | supabase-js só em `src/lib/data/` | `src/test/varreduras.test.ts:163` | ✅ PASS |
| DATA-02 | Zod em R01–R23 | `src/lib/data/esquemas.test.ts:248`, `src/lib/data/esquemas.test.ts:276` | ✅ PASS |
| DATA-03 | `[central-elite3d] <relação>: schema mismatch` e falha | `src/lib/data/paginar.test.ts:141` | ✅ PASS |
| DATA-04 | páginas de 1.000, ordem de hoje + chave única | `src/lib/data/paginar.test.ts:72`, `src/lib/data/leituras.test.ts:207` | ✅ PASS |
| DATA-05 | 2.500 linhas, cada uma uma vez | `src/lib/data/paginar.test.ts:61` | ✅ PASS |
| DATA-06 | erro + "Tentar de novo" em R02/R03/R04/R06 | `src/components/shell/dados.test.tsx:163` | ✅ PASS |
| DATA-07 | erro só nas telas da relação | `src/components/shell/dados.test.tsx:304`, `src/components/modules/rotas/rotas.test.tsx:390` | ✅ PASS |
| DATA-08 | só as 4 rpcs, nenhuma edge function | `src/test/varreduras.test.ts:170` | ✅ PASS |
| DATA-09 | vale a última recarga pedida | `src/lib/recarga.test.ts:20`, `src/components/shell/dados.test.tsx:241` | ✅ PASS |

### P1: Escritas

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| WRITE-01 | W01–W21: relação, operação, chaves, payload, onConflict | `src/lib/data/escritas.test.ts:127` (W01) … `src/lib/data/escritas.test.ts:632` (W21), um caso por escrita | ✅ PASS |
| WRITE-02 | "Nada foi gravado: sem permissão ou registro não encontrado." e "N de M" | `src/lib/escrita.test.ts:61`, `src/lib/data/escritas.test.ts:205` | ✅ PASS |
| WRITE-03 | botão desabilitado com Spinner | `src/components/shell/use-escrita.test.tsx:97` | ✅ PASS |
| WRITE-04 | 2 cliques → 1 escrita | `src/lib/escrita.test.ts:46`, `src/components/modules/sessoes/grupo.test.tsx:195` | ✅ PASS |
| WRITE-05 | toast com o erro, formulário aberto | `src/lib/escrita.test.ts:55`, `src/components/modules/mentorados/novo-mentorado.test.tsx:184` | ✅ PASS |
| WRITE-06 | "Cadastro salvo, mas as cobranças da Lia não foram puxadas:" + erro | `src/lib/escrita.test.ts:112` | ✅ PASS |
| WRITE-07 | toast do erro do `lia_refletir_financeiro`, tela segue | `src/lib/data/escritas.test.ts:577`, `src/components/modules/financeiro/financeiro.test.tsx:324` | ✅ PASS |
| WRITE-08 | sem capacidade, porta não é chamada | `src/components/shell/use-escrita.test.tsx:171` | ✅ PASS |
| WRITE-09 | diretoria 0 controles; admin ≥ 10 | `src/test/papeis.test.tsx:151`, `src/test/papeis.test.tsx:156` | ✅ PASS |

### P1: Telas operacionais

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| OPS-01 | itens de "Precisa de atenção" por papel; contadores ignoram busca | `src/lib/painel.test.ts:57`, `src/components/modules/dashboard/dashboard.test.tsx:137` | ✅ PASS |
| OPS-02 | chave (mentorado, data, hora, mentor); `google_event_id` nulo; menor id | `src/lib/matriz.test.ts:45`, `src/lib/matriz.test.ts:52` | ✅ PASS |
| OPS-03 | mentor normalizado, grafia de TODOS_MENTORES, "fora do projeto" | `src/lib/matriz.test.ts:117` | ✅ PASS |
| OPS-04 | mês corrente → mais recente → "Todos" | `src/lib/matriz.test.ts:98` | ✅ PASS |
| OPS-05 | só 1:1 na trilha | `src/lib/sessoes.test.ts:98`, `src/components/modules/ficha/aba-sessoes.test.tsx:123` | ✅ PASS |
| OPS-06 | N participantes → N linhas iguais | `src/components/modules/sessoes/grupo.test.tsx:217` | ✅ PASS |
| OPS-07 | grupo por (etapa, data, hora); busca depois | `src/lib/sessoes.test.ts:58` | ✅ PASS |
| OPS-08 | `etapa_deduzida: false` no W03; ausente no W04 | `src/lib/data/escritas.test.ts:170`, `src/lib/data/escritas.test.ts:185` | ✅ PASS |
| OPS-09 | 30 concluídas mais recentes | `src/lib/sessoes.test.ts:134` | ✅ PASS |
| OPS-10 | `casaBusca` sem caixa/acento; não muda cards | `src/components/modules/rotas/escolher-mentorado.test.tsx:75`, `src/components/modules/sessoes/sessoes.test.tsx:229` | ✅ PASS |
| OPS-11 | resumoExclusao; botão só com `chaveNome` | `src/components/modules/ficha/aba-cadastro.test.tsx:271` | ✅ PASS |
| OPS-12 | só leitura sem editarMentorado; Situação oculta | `src/components/modules/ficha/aba-cadastro.test.tsx:127`, `src/components/modules/ficha/aba-financeiro.test.tsx:176` | ✅ PASS |
| OPS-13 | `cadastro_incompleto: false` + W11b | `src/components/modules/ficha/aba-cadastro.test.tsx:180` | ✅ PASS |
| OPS-14 | "— não informado —" selecionado | `src/components/modules/ficha/aba-financeiro.test.tsx:128` | ✅ PASS |
| OPS-15 | status nulo continua nulo | `src/lib/data/escritas.test.ts:425` | ✅ PASS |
| OPS-16 | critério atualiza contador e barra sem fechar | `src/components/modules/rotas/rotas.test.tsx:264` | ✅ PASS |
| OPS-17 | abrir marco fecha o aberto | `src/components/modules/rotas/rotas.test.tsx:195` | ✅ PASS |
| OPS-18 | `criterios_ok` com texto; progresso derivado (3 de 4 = 75) | `src/lib/rotas.test.ts:96`, `src/lib/data/escritas.test.ts:291` | ✅ PASS |
| OPS-19 | régua mês × acumulado | `src/components/modules/rotas/rotas.test.tsx:240`, `src/components/modules/rotas/rotas.test.tsx:254` | ✅ PASS |
| OPS-20 | "2000.50" = 2000,50; "1.234,56" = 1234,56 | `src/lib/moeda.test.ts:22`, `src/lib/moeda.test.ts:27` | ✅ PASS |

### P1: Dinheiro e cobranças da Lia

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| FIN-01 | cards e órfãs ignoram a busca | `src/components/modules/financeiro/financeiro.test.tsx:141` | ✅ PASS |
| FIN-02 | "vincular" só com exatamente 1 cadastro | `src/lib/financeiro.test.ts:38` | ✅ PASS |
| FIN-03 | 4 motivos de `motivoOrfa` | `src/lib/financeiro.test.ts:28` | ✅ PASS |
| FIN-04 | `ignorada` true/false; rpc só com dono | `src/lib/data/escritas.test.ts:560` | ✅ PASS |
| FIN-05 | parcela da Lia sem controle; sem "Adicionar parcela" | `src/components/modules/ficha/aba-financeiro.test.tsx:194` | ✅ PASS |
| FIN-06 | prazos por dia em America/Sao_Paulo | `src/lib/datas.test.ts:26`, `src/lib/datas.test.ts:37` | ✅ PASS |

### P1: Notas

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| NOTE-01 | contenteditable + comandos do navegador | `src/components/modules/ficha/editor-notas.test.tsx:343` | ✅ PASS |
| NOTE-02 | NOTA_TAGS, href http(s), class checklist/feito, sem data-* | `src/lib/notas.test.ts:40`, `src/components/modules/ficha/editor-notas.test.tsx:394` | ✅ PASS |
| NOTE-03 | sem sanitizador: só leitura, sem HTML, sem gravar | `src/components/modules/ficha/editor-notas.test.tsx:248` | ✅ PASS |
| NOTE-04 | grava 1 s depois (W10) | `src/lib/notas.test.ts:135`, `src/components/modules/ficha/editor-notas.test.tsx:279` | ✅ PASS |
| NOTE-05 | grava antes de desmontar | `src/components/modules/ficha/editor-notas.test.tsx:293`, `src/lib/notas.test.ts:157` | ✅ PASS |
| NOTE-06 | diretoria só leitura, sem barra | `src/components/modules/ficha/editor-notas.test.tsx:224` | ✅ PASS |
| NOTE-07 | atalhos produzem os blocos de hoje | `src/lib/notas.test.ts:100`, `src/lib/notas.test.ts:117` | ✅ PASS |
| NOTE-08 | link só http(s), num Dialog | `src/components/modules/ficha/editor-notas.test.tsx:408`, `src/lib/notas.test.ts:126` | ✅ PASS |

### P1: Telas gerenciais

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| GER-01 | STLSeller com "Ativos" padrão | `src/components/modules/stlseller/stlseller.test.tsx:99` | ✅ PASS |
| GER-02 | `round(100·(#≥9 − #≤6)/n)`, média 1 casa, semana seg–dom em SP | `src/components/modules/nps/nps.test.tsx:105`, `src/components/modules/nps/nps.test.tsx:113` | ✅ PASS |
| GER-03 | 10 períodos / 20 respostas; aba/período voltam à página 1 | `src/components/modules/nps/nps.test.tsx:133`, `src/components/modules/nps/nps.test.tsx:159` | ✅ PASS |
| GER-04 | mentor volta só as respostas | `src/components/modules/nps/nps.test.tsx:170` | ✅ PASS |
| GER-05 | mentor lê `analise_ia_mentor()`, sem Por mentor | `src/components/modules/ia/ia.test.tsx:203`, `src/lib/data/leituras.test.ts:237` | ✅ PASS |
| GER-06 | formato antigo nos mesmos blocos | `src/components/modules/ia/ia.test.tsx:97` | ✅ PASS |
| GER-07 | Mentores por mentor (carteira, 1:1, grupo, NPS 30d…) | `src/components/modules/mentores/mentores.test.tsx:110` | ✅ PASS |
| GER-08 | aviso de adesão < 70% com denominador > 0 | `src/lib/painel.test.ts:228` | ✅ PASS |

### P1: Design system

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| UI-01 | byte a byte com o SNAPSHOT (hash) | `src/design-system/snapshot.test.ts:60`, `src/design-system/snapshot.test.ts:90` | ✅ PASS |
| UI-02 | sem hexa/rgb/paleta padrão | `src/test/varreduras.test.ts:255` | ✅ PASS |
| UI-03 | Inter local, sem Google nem Manrope | `src/test/varreduras.test.ts:263`, `scripts/gates/verificar-build.test.mjs:64` | ✅ PASS |
| UI-04 | ThemeToggle; sem escolha segue o SO | `src/test/theme-init.test.ts:55`, `src/components/shell/menu.test.tsx:126` | ⚠️ Spec-precision gap (tokens nas 10 telas só no G3.12) |
| UI-05 | ConfirmDialog; sem window.confirm/prompt/alert | `src/test/varreduras.test.ts:269`, `src/components/modules/ficha/aba-financeiro.test.tsx:305` | ✅ PASS |
| UI-06 | lacunas com primitivo do DS + AD (`docs/decisions/008-lacunas-do-design-system.md`) | `src/components/modules/comum/campo-moeda.test.tsx:50`, `src/components/modules/mentorados/mentorados.test.tsx:85` | ✅ PASS |
| UI-07 | EmptyState e Skeleton | `src/components/modules/mentorados/mentorados.test.tsx:147`, `src/components/shell/dados.test.tsx:144` | ✅ PASS |
| UI-08 | casca com NavItem/Button/Avatar, sem CSS | `src/components/shell/menu.test.tsx:132` | ✅ PASS |

### P1: Testes portados

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| TEST-01 | os 20 grupos do §7 com teste | `src/test/estrutura.test.ts:77` | ✅ PASS |
| TEST-02 | `&lt;img` presente, `<img src=x` ausente, em toda tela | `src/test/xss.test.tsx:162`, `src/test/xss.test.tsx:174` | ✅ PASS |
| TEST-03 | HTML só no editor, com `sanitizarNota` | `src/test/varreduras.test.ts:202` | ✅ PASS |
| TEST-04 | TRILHA/EMAIL_MENTOR da function = ETAPAS/MENTORES | `src/lib/constantes.test.ts:26`, `src/lib/constantes.test.ts:35` | ✅ PASS |
| TEST-05 | `hojeSP()` às 02:30 UTC = data de Brasília | `src/lib/datas.test.ts:13` | ✅ PASS |
| TEST-06 | `pnpm test` sem rede: rodado sob `sandbox-exec` com saída de rede negada (sonda `fetch` → EPERM), 798 passed, exit 0; vitest `environment: node` em `vitest.config.ts:14` | ✅ PASS |

### P1: Gates de produção (parte do Execute)

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| GATE-03 | `evidence/` sem HAR, Authorization, /auth/v1/, refresh_token, JWT | `src/test/varreduras.test.ts:219` | ✅ PASS |
| GATE-04 | `vercel.json` com `"framework": "nextjs"` | `src/test/vercel.test.ts:12` | ✅ PASS (a `main` estática é G4) |
| GATE-05 | admin, `persistSession: false`, pasta 0700 sem Time Machine, recusa outro modo | `scripts/parity/snapshot.test.mjs:139`, `scripts/parity/snapshot.test.mjs:156`, `scripts/parity/snapshot.test.mjs:166` | ✅ PASS |
| GATE-06 | PAR-01–PAR-17 dos dois lados; exit 1 com divergência | `scripts/parity/metricas.test.ts:66`, `scripts/parity/relatorio.test.ts:66` | ✅ PASS (corrida real é G2.5) |
| GATE-07 | impresso só métrica/chave/tipo; valores num 0600 | `scripts/parity/relatorio.test.ts:39`, `scripts/parity/relatorio.test.ts:47` | ✅ PASS |
| GATE-08 | diretoria sem escrita além do R20; sonda recusa cada escrita | `src/lib/data/leituras.test.ts:250`, `scripts/gates/sondar-rls.test.mjs:89` | ✅ PASS (sonda real é G3.14) |
| GATE-11 | 0 `sb_secret_`/JWT não-anon no build | `scripts/gates/verificar-build.test.mjs:38`, `scripts/gates/verificar-build.test.mjs:49` | ✅ PASS |
| GATE-12 | classe `__variable_` no CSS | `scripts/gates/verificar-build.test.mjs:64` | ✅ PASS |

GATE-14 (volta em ≤ 15 min com `.vercelignore`): a parte do Execute é documento (`README.md:473`, `ARCHITECTURE.md:1135`); o comportamento só existe no G5 — ver spec-precision gap 7.

### P1: Segurança

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| SEC-01 | os 5 vetores → `/dash`, nunca ao roteador | `src/components/shell/contexto.test.tsx:56`, `src/lib/endereco.test.ts:61` | ✅ PASS |
| SEC-02 | relatório e sonda sem nome/e-mail/valor | `scripts/parity/relatorio.test.ts:39`, `scripts/gates/sondar-rls.test.mjs:89`, `scripts/parity/metricas-legado.test.mjs:218` | ✅ PASS |
| SEC-03 | conferência blob × `ls-tree` | `scripts/sync-design-system.test.mjs:81` | ✅ PASS (`pnpm audit` e a conferência real são G2.9/G2.10) |
| SEC-04 | CSP literal, nosniff, Referrer-Policy, sem X-Powered-By | `src/test/cabecalhos.test.ts:21`, `src/test/cabecalhos.test.ts:29` | ✅ PASS |
| SEC-05 | link do banco só http(s), `rel="noopener noreferrer"`; `javascript:`/`data:` como texto | `src/test/xss.test.tsx:212`, `src/components/modules/sessoes/sessoes.test.tsx:177` | ✅ PASS |
| SEC-06 | sem sessão / sessão de outro: nada sai; nota antes do signOut | `src/components/shell/use-escrita.test.tsx:126`, `src/components/shell/sessao.test.tsx:75`, `src/components/shell/dados.test.tsx:234` | ✅ PASS |
| SEC-07 | `packageManager` fixo + `onlyBuiltDependencies` | `src/test/varreduras.test.ts:250` | ✅ PASS |
| SEC-08 | exceção de versão registrada no SNAPSHOT e aceita pelo teste | `src/design-system/snapshot.test.ts:73` | ✅ PASS |

### P2: Corte (parte do Execute)

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| CUT-02 | `#/mentorado/<id>/financeiro` → ficha na aba Financeiro | `src/lib/endereco.test.ts:102`, `src/app/ponte.test.tsx:45` | ✅ PASS (no domínio: G3.8) |

CUT-03 e CUT-04: sem teste de runtime. CUT-03 conferido no git: `git ls-files index.html tests favicon.png` vazio; `HEAD:src/app/icon.png` tem o mesmo blob do `2aea455:favicon.png` (`0b11dd25…`). CUT-04 conferido por leitura (`README.md:470`, seções Rodar/Testar/Publicar e voltar do `ARCHITECTURE.md`) — ver spec-precision gap 7.

### Edge Cases

| AC | Spec-defined outcome | Evidência | Result |
| -- | -------------------- | --------- | ------ |
| EDGE-01 | ficha excluída → "Ficha não encontrada" | `src/components/modules/ficha/ficha.test.tsx:73` | ✅ PASS |
| EDGE-02 | renovação falha → login | `src/lib/sessao.test.ts:77`, `src/components/shell/sessao.test.tsx:156` | ✅ PASS |
| EDGE-03 | virada do dia usa a data nova | `src/lib/datas.test.ts:18`, `src/lib/datas.test.ts:44` | ✅ PASS |
| EDGE-04 | erro do banco; texto fica no editor | `src/components/modules/ficha/editor-notas.test.tsx:332` | ✅ PASS |
| EDGE-05 | status fora de S_STATUS cru, escapado | `src/lib/sessoes.test.ts:171`, `src/lib/data/esquemas.test.ts:293` | ✅ PASS |

### Fora do Execute (gate de produção, não contados como gap)

Pendentes por desenho, sem evidência de runtime aqui: GATE-01, GATE-02, GATE-09, GATE-10, GATE-13, GATE-15, GATE-16, CUT-01; e os itens G0.3–G0.6, G2.5 (`pnpm parity` com o snapshot real), G3 (UAT, preview, sonda do RLS no banco), G4–G6.

**Status**: ✅ Todos os ACs do Execute com evidência · ⚠️ 7 spec-precision gaps (abaixo)

---

## Discrimination Sensor

Scratch: `git worktree add --detach …/scratchpad/verifier HEAD` + `pnpm install --offline --frozen-lockfile`. Um mutante por vez, suíte inteira (85 arquivos) a cada um, arquivo restaurado por `git checkout --` depois. Scratch removida; `git status --porcelain` da worktree real vazio antes e depois.

| # | Mutation | File:line | Description | Killed? |
| - | -------- | --------- | ----------- | ------- |
| 1 | auth | `src/lib/data/auth.ts:19` | `\|\|` → `&&` na credencial recusada | ✅ Killed (1) |
| 2 | papel | `src/lib/sessao.ts:44` | papel desconhecido vira `pronto` | ✅ Killed (1) |
| 3 | papel | `src/lib/papeis.ts:32` | diretoria ganha `editarMentorado` | ✅ Killed (5) |
| 4 | trava | `src/lib/escrita.ts:30` | remove a trava do segundo clique | ✅ Killed (6) |
| 5 | sessão | `src/lib/escrita.ts:35` | pula a checagem de identidade (SEC-06) | ✅ Killed (2) |
| 6 | linhas | `src/lib/data/escritas.ts:35` | 0 linhas vira sucesso | ✅ Killed (4) |
| 7 | linhas | `src/lib/data/escritas.ts:39` | escrita parcial vira sucesso | ✅ Killed (1) |
| 8 | sanitizador | `src/lib/notas.ts:43` | `ALLOWED_URI_REGEXP` aceita `javascript:` | ✅ Killed (1) |
| 9 | sanitizador | `src/lib/notas.ts:17` | `class` livre | ✅ Killed (2) |
| 10 | links | `src/lib/links.ts:5` | `data:` vira href | ✅ Killed (12) |
| 11 | dinheiro | `src/lib/financeiro.ts:41` | "vincular" com ≥ 1 cadastro | ✅ Killed (2) |
| 12 | dinheiro | `src/lib/moeda.ts:16` | ponto deixa de ser decimal ("2000.50") | ✅ Killed (7) |
| 13 | erro isolado | `src/components/shell/dados.tsx:111` | complementar com falha derruba a tela | ✅ Killed (5) |
| 14 | erro isolado | `src/lib/data/leituras.ts:109` | erro da relação engolido (tela vazia sem aviso) | ✅ Killed (1) |
| 15 | navegação | `src/components/shell/contexto.tsx:133` | destino de outra origem vai ao roteador | ✅ Killed (1) |

Entre parênteses, os testes que falharam.

**Sensor depth**: P0-full (15 mutações manuais nos caminhos P0)
**Result**: 15/15 killed, 0 survived

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ (`git diff --stat 2aea455..HEAD -- supabase/` vazio) |
| No scope creep | ✅ |
| Matches patterns | ✅ |
| Spec-anchored outcome check (asserted values match spec) | ✅ textos literais conferidos: AUTH-04, WRITE-02, WRITE-06, DATA-03, SEC-04, OPS-20, TEST-05, GER-02 |
| Per-layer Coverage Expectation met | ✅ regra pura em `src/lib/*.test.ts`, tela por `renderToStaticMarkup`, varreduras em `src/test/` |
| Every test maps to a spec requirement | ✅ 107 IDs citados em títulos de teste; os sem ID são PAR-xx, design-system copiado ou helpers de fixture |
| Documented guidelines followed: spec "Gates de produção" (comando sem pipe, ram-guard, nvm) | ✅ |

---

## Gate Check

- **Gate command**: `source ~/.nvm/nvm.sh && nvm use default && bash ~/.claude/skills/ram-guard/guard.sh && pnpm typecheck > LOG 2>&1; echo exit=$?` (idem `pnpm test` e `pnpm build`), Node v24.20.0, no HEAD `90b13cd`
- **Result**: typecheck exit=0 · test exit=0, 85 arquivos, 798 passed, 0 failed, 0 skipped · build exit=0 (15/15 páginas estáticas, middleware)
- **Test count before feature**: 0
- **Test count after feature**: 798 (medido); declarado no `tasks.md`: `Feature total: Test count: 0 → 798`
- **Delta**: +798
- **Skipped tests**: none
- **Failures**: none

**Cadeia `Test count` × runner**: na iteração 1 a cadeia divergia desde a T42 (T42 320 × 318 … T84 627 × 798; linha final `0 → 627`). No `90b13cd` as 84 linhas `- [x] Test count` do `tasks.md` são idênticas, na ordem, às `Test count` dos corpos dos 84 commits de task (`diff` vazio), a cadeia não tem quebra e T41–T84 batem com os medidos abaixo. Iteração 2 mediu de novo numa scratch (`git worktree add --detach`, `pnpm install --offline --frozen-lockfile`, `pnpm test`): T1 `49a0700` = 2, T20 `fad6193` = 170, T41 `a3de335` = 308, T60 `ccb13da` = 520, T84 `a188184` = 798, todos iguais ao `M` declarado; scratch removida, `git status --porcelain` da worktree real só com este arquivo. `validate_tasks.py`: 0 erros, 10 avisos (granularidade e `Tests: none` em T20/T41/T83/T84), exit 0. Os medidos de T41 a T84 (iteração 1), na ordem: 308, 318, 330, 343, 353, 360, 368, 380, 393, 407, 417, 430, 437, 440, 453, 463, 474, 489, 499, 520, 524, 533, 560, 581, 601, 610, 635, 653, 669, 685, 702, 717, 731, 734, 736, 741, 759, 778, 784, 791, 795, 798, 798, 798.

---

## Fix Plans

### Fix 1: cadeia `Test count` diverge do runner desde a T42 — ✅ resolvido em `90b13cd`

- **Root cause**: o `M` de cada task de T42 em diante não é o total que o `vitest run` dá naquele commit. Até a T47 o declarado passa do real em 2 a 6; da T48 em diante fica abaixo, e a diferença chega a 171. O padrão sugere testes acrescentados por amend nas correções dos sensores de fase sem atualizar o `Test count`.
- **Fix task**: reescrever as linhas `Test count: N → M` de T42 a T84 com os medidos acima (`N` de cada task = `M` da anterior) e a linha final para `Feature total: Test count: 0 → 798`; rodar `validate_tasks.py migracao-nextjs`. É só declaração: nenhum código nem teste muda.
- **Priority**: Major (G1.2 da spec exige a contagem na cadeia; o G2.6 exige este relatório em PASS)
- **Resolução**: `90b13cd docs(migration): record the measured test counts in tasks.md` reescreveu as linhas com o `N → M` do corpo de cada commit; linha final `0 → 798`; conferido na iteração 2 (Gate Check).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status | Runtime evidence |
| ----------- | --------------- | ---------- | ---------------- |
| ACs do Execute (tabelas acima) | Implementing | ✅ Verified | o `arquivo:linha` de cada linha das tabelas |
| CUT-03, CUT-04, GATE-14, STACK-03 | Implementing | ✅ Verified sem teste de runtime | git, documento, gate |
| Fora do Execute | Pending | Pending | G0, G2.5, G3–G6 |

---

## Summary

**Overall**: ✅ PASS

**Spec-anchored check**: todos os ACs do Execute com evidência; 7 spec-precision gaps
**Sensor**: 15/15 mutations killed
**Gate**: 798 passed, 0 failed; typecheck e build exit 0

**What works**: login e papéis, porta de dados paginada e validada, escritas com trava, sessão e checagem de linhas, sanitizador e links, dinheiro e órfãs, erro isolado por relação, navegação na mesma origem, varreduras de XSS e de controles por papel. A suíte roda sem rede.

**Issues found**: nenhum aberto (Fix 1 resolvido em `90b13cd`).

**Spec-precision gaps**:
1. AUTH-05: a spec não fixa o texto da mensagem de rede e de limite; o teste afirma o texto da implementação e que não fala em senha.
2. UI-04: "as 10 telas e a ficha usam os tokens do tema" não tem asserção de runtime; o teste cobre o `theme-init` e o `ThemeToggle`. O visual só é medido no G3.12.
3. NAV-01, OPS-01, GER-01, GER-07, NOTE-07: o resultado é "o mesmo de hoje" ou "as regras do mapeamento §3.x", sem valor na spec. Os testes usam os fixtures do harness antigo, e `scripts/parity/metricas.test.ts:66` compara com o app antigo sobre os fixtures; a prova com dado real é o G2.5.
4. EDGE-02: "não consegue renovar a sessão" foi lido como o evento `SIGNED_OUT` do supabase-js; a spec não diz qual sinal conta.
5. GATE-06 e GATE-08: no Execute só os scripts são testados, com cliente falso; o critério da spec (0 divergências, recusa do RLS) só vale no G2.5 e no G3.14.
6. TEST-06: nenhum teste afirma "sem rede"; a evidência é a corrida com a rede negada, feita só por este Verifier.
7. STACK-03, CUT-03, CUT-04, GATE-14: são estado do repo, documento ou comportamento do G5, sem asserção de runtime possível no Execute.

**Next steps**: seguir para os gates de produção fora do Execute (G0.3–G0.6, G2.5, G3–G6).
