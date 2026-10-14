# Migração do front para Next.js e o design system da product-ops — Specification

**Scope:** Complex · **Date:** 2026-10-13 · **Base:** `main@2aea455`; a paridade é medida contra o `index.html` do merge-base com a `main` a cada G2
**Status:** em execução desde 13/10/2026, a pedido do Lucas. Design pronto em [`design.md`](design.md), com as emendas listadas lá. Threat pass feito: os 14 achados viraram SEC-01 a SEC-08 e emendas (design, seção "Threat pass"). Tasks aprovado pelo Lucas em 14/10/2026: o texto EARS desta spec e do design está congelado (mudança reabre o Tasks). O Execute começou pela Fase 0. Em 14/10/2026 o Lucas escalonou o G0: cada item fecha antes do que ele protege (seção G0).
**Insumo:** [`docs/planejamento/mapeamento-migracao-nextjs.md`](../../../docs/planejamento/mapeamento-migracao-nextjs.md) (citado abaixo como "mapeamento §N"). O mapeamento descreve o comportamento de hoje e é o contrato de paridade desta spec.

## Problem Statement

O front da Central de Controle é um `index.html` de 3.785 linhas, sem build. Ele monta a tela por `innerHTML`, tem 90 `onclick` inline, cerca de 40 variáveis globais e 3 dependências de CDN sem SRI. O Lucas quer o app em Next.js com o design system da plataforma-product-ops, mantendo o Supabase e continuando fora da plataforma (AD-006). O deploy estático publica o repositório inteiro, e 13 leituras cortam em 1.000 linhas sem aviso. O arquivo dobrou de tamanho desde que o `ARCHITECTURE.md` foi escrito: cada feature nova encarece a troca.

## Goals

- [ ] Paridade: as 10 telas, a ficha com 5 abas, as escritas W01–W21 e o recorte por papel funcionam como no `index.html@2aea455`, salvo as exceções da seção "Exceções à paridade". Medido pela suíte portada e pelo UAT por papel.
- [ ] Backend intocado: o diff da feature em `supabase/` é vazio.
- [ ] Mesmo design system: `src/design-system/` e `src/components/ui/` são cópia literal da plataforma num commit registrado, e atualizar é copiar de novo (AD-006).
- [ ] Gate verde: `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0.
- [ ] Nenhum arquivo do repositório servido além do app: os 5 caminhos de CUT-01 respondem 404.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Mover o app para a plataforma-product-ops (login, papéis, hospedagem, envelope `/api`, registry de módulo) | Decisão do Lucas: o app continua separado, no Supabase (AD-006) |
| Mudança em `supabase/` (schema, RLS, funções SQL, edge functions, pg_cron) e nos workflows n8n | A migração é só do front (mapeamento §1). Os defeitos de backend (mapeamento §10, classe B) viram specs próprias |
| Corrigir as regras divergentes da classe P do mapeamento §10 | Mudariam números que a gestão e o fechamento dos mentores já usam. Cada uma é decisão separada |
| Versionar o schema do núcleo e montar staging | Trabalho de backend; a troca de stack não depende dele |
| Feature nova, tela nova ou redesenho de fluxo | Paridade primeiro |
| Aba de dossiê ou de transcrições na ficha | Não existe hoje (mapeamento §3.4) |
| Escopo de titularidade do mentor (`mentor_id` em `sessoes`) | Débito de backend nº 1 do `ARCHITECTURE.md` |
| Cadastro público, recuperação de senha, magic link | Não existem hoje; `disable_signup` continua ligado |

---

## Assumptions & Open Questions

Decisões do orquestrador, tomadas pela opção mais segura dentro do pedido. Só a primeira foi confirmada pelo Lucas (AD-006).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Destino da migração | App próprio em Next.js no repo `central-elite3d`, com o design system da plataforma copiado e o Supabase mantido. Não vira módulo da plataforma | Decisão do Lucas em 13/10/2026 (AD-006) | y |
| Onde os dados são lidos e escritos | Só no browser, com o supabase-js e a sessão do usuário, como hoje. Nenhum Server Component lê dado, nenhuma rota do Next toca o banco, e não existe `service_role` no app | O RLS continua sendo a única autorização (mapeamento §5.3). Ler no servidor exigiria levar o JWT do usuário em cookie (`@supabase/ssr`) e renovar a sessão num middleware: mais peças para o mesmo resultado | n |
| Porta única de dados | `src/lib/data/` é o único lugar que usa o cliente Supabase. Toda resposta passa por um schema Zod | Um lugar só para validar, paginar e conferir linhas afetadas (DATA-02, DATA-04, WRITE-02). Componente que lê o banco direto espalharia essas regras | n |
| Login | Continua e-mail e senha do Supabase Auth | O RLS exige a sessão deste projeto Supabase (AD-006) | n |
| Formato do endereço | Rotas do App Router com os mesmos nomes do hash de hoje (`/sessoes`, `/mentorado/<id>/financeiro`). Um link antigo `#/…` é trocado no cliente pelo caminho equivalente | O hash existia porque o deploy era estático, sem rota no servidor. O Next tem rota de verdade, com voltar e avançar nativos. O redirecionamento mantém os links de ficha que já circulam no WhatsApp | n |
| Identidade visual | Design system da plataforma sem acento próprio: Inter, `primary` `#4169e1`, tema claro e escuro pelo `ThemeToggle`, começando pelo tema do sistema operacional. O verde-limão e a Manrope saem | Pedido explícito: o mesmo design system. Cor fora dos tokens deixaria de ser o mesmo visual | n |
| Fonte do design system | Cópia literal da `plataforma-product-ops` na `main`, lida com `git show main:<caminho>`, com o commit registrado em `src/design-system/SNAPSHOT` | O snapshot do skill `design-system-ops` (30/09) está atrás da `main` (mapeamento §8). A pasta da plataforma está noutra branch, com trabalho de outra sessão: ler do working tree pegaria código não mesclado | n |
| Lacunas do design system | Primitivo do design system que já existe, composição deles, ou primitivo genérico novo como arquivo novo em `src/components/ui/`. Extensão de um arquivo copiado só com AD que nomeia o arquivo | Arquivo copiado e editado à mão deixa de ser o mesmo design system e trava a próxima cópia (AD-006) | n |
| Hospedagem e domínio | O mesmo projeto Vercel e o mesmo domínio `central-elite3d.vercel.app`. A branch leva `vercel.json` com `"framework": "nextjs"`, que sobrepõe o preset do projeto por deploy (documentação da Vercel, `project-configuration/vercel-json`). O dono não precisa mudar o projeto | O mesmo domínio preserva a sessão salva e os links. A `main` continua publicando o app estático até o merge, porque não tem `vercel.json` | n |
| Variáveis públicas | `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, com padrão igual aos valores de produção em `src/lib/data/config.ts` | A chave publicável é pública por desenho e já está no repo. O padrão evita uma configuração externa no corte; é o mesmo desenho do template da plataforma (`PLATFORM_URL`) | n |
| Versão do supabase-js | Fixa em `2.117.3` | É a que o `@2` do CDN entrega hoje: o mesmo comportamento que roda em produção | n |
| Testes | vitest no ambiente `node`, como na plataforma. Asserções de tela com `react-dom/server`, sem dependência nova de teste | O harness antigo não porta (mapeamento §7). jsdom e Testing Library seriam dependência nova para o que `renderToStaticMarkup` já cobre | n |
| UAT sem staging | No preview da branch, contra o banco de produção (G3). Leitura com contas reais de cada papel. Escrita só pelo admin, no registro de teste de GATE-09 | Não há staging (mapeamento §2). Montar um exige o schema versionado, que está fora do escopo | n |
| Registro de teste | Nome `ZZQ Migracao Xyzzy`, e-mail `zzq-migracao@example.invalid`, criado e excluído pelo admin no G3 e no G5 | O sync do Calendar casa evento por palavra do nome: essas palavras não aparecem em título de reunião. O domínio `.invalid` nunca casa com Lia, Circle nem convite | n |
| Congelamento | Do início do G2 ao fim do G5, a `main` não recebe mudança no `index.html`. Correção urgente entra nos dois apps e reabre o G2 (GATE-16) | Paridade contra um alvo que se move não fecha | n |
| Snapshot de paridade | Lido com a sessão de um admin, guardado fora do repo com permissão `0700` e apagado no G6. Nunca impresso na conversa nem enviado a serviço externo | É dado de produção: nome, e-mail, NPS e financeiro | n |
| Volta | `git revert -m 1 <merge>` e push na `main`, feitos pelo Lucas: sem `vercel.json`, o deploy volta a ser estático. "Instant Rollback" pelo dono do projeto é a alternativa | O Lucas não tem o projeto Vercel no time dele; a volta não pode depender de outra pessoa estar online | n |
| Janela do corte | Escolhida pelo Lucas fora dos dias em que a matriz é usada no fechamento dos mentores, com ele disponível de T a T + 2 h | O corte não pode coincidir com o uso que mais pesa | n |
| Contas de teste para diretoria e mentor | Criadas pelo Lucas no Supabase antes do UAT, se ele não tiver contas que possa usar | Criar usuário é escrita em produção com `service_role`: ação dele | n |
| Exceções à paridade | Só os defeitos da classe M do mapeamento §10 que perdem ou corrompem dado, mentem sobre o resultado, ou que o React elimina sozinho. Estão na seção "Exceções à paridade" | O resto mudaria números já usados no fechamento | n |
| Ameaça | Threat pass obrigatório depois do Design e antes do Tasks (auth, entrada externa, RLS). Feito em 13/10/2026 pelo `security-review`: 1 HIGH, 4 MEDIUM, 9 LOW, todos aceitos | Regra do Specify para feature que toca autenticação | n |

**Open questions:** none — all resolved or logged above (required before the spec is confirmed).

---

## Exceções à paridade

Tudo o mais segue o mapeamento, inclusive os defeitos da classe P.

| exceção | defeito no mapeamento §10 | requisito |
| ------- | ------------------------- | --------- |
| Paginar toda leitura de lista com ordem estável | 1 | DATA-04, DATA-05 |
| Nota pendente gravada ao sair; editor só leitura sem sanitizador | 2 | NOTE-03, NOTE-05 |
| Select de status nulo não grava valor que ninguém escolheu | 3 | OPS-14, OPS-15 |
| Escrita que volta com 0 linhas não anuncia sucesso | 4 | WRITE-02 |
| Botão travado durante o envio | 5 | WRITE-03, WRITE-04 |
| Erro na carga inicial com "Tentar de novo" | 6 | DATA-06 |
| Última recarga vence | 7 | DATA-09 |
| Erro de rpc mostrado; erro de uma relação só afeta as telas dela | 8 | DATA-07, WRITE-06, WRITE-07 |
| Logout limpa tudo; papel nulo ou desconhecido tem tela própria | 9, 10 | AUTH-06, AUTH-07, AUTH-08 |
| Modais acessíveis e Enter envia o login | 13 | AUTH-03, UI-05 |
| "Hoje" calculado na hora do uso | 14 | TEST-05, EDGE-03 |
| "Concluídas (últimas 30)" são as 30 mais recentes | 15 | OPS-09 |
| Campo de quem não edita é só leitura | 16 | OPS-12 |
| Login distingue senha errada de falha de rede | 20 | AUTH-04, AUTH-05 |
| Sessão não é lida da URL | threat pass (THREAT-10) | AUTH-10 |
| Nota guarda só `class` `checklist` e `feito`, `href` http(s) e nenhum `data-*` | threat pass (THREAT-07) | NOTE-02 |
| Escrita parcial não anuncia sucesso | threat pass (THREAT-11) | WRITE-02 |
| Hash antigo só vira caminho de tela conhecida | threat pass (THREAT-01) | NAV-02, SEC-01 |

Os itens 11, 12, 17, 18 e 19 do §10 somem com a troca de stack, sem requisito próprio.

---

## Gates de produção

O app está em produção, sem staging, e o push na `main` publica. Um gate só fica verde com evidência. Regras que valem para todos:

- **Evidência.** Cada execução grava `.specs/features/migracao-nextjs/evidence/G<n>.md`: sha testado, data e hora, cada comando com o código de saída, e o resultado de cada item. Sem nome, e-mail, comentário ou valor financeiro de mentorado: só ids e contagens.
- **Comando sem pipe.** Saída em arquivo e `echo exit=$?`, porque `| tail` devolve o código do `tail`. Os comandos rodam sob o `ram-guard`, com `nvm use default` antes: o Node 20.4 de `/usr/local/bin` quebra o vitest 4.
- **Vermelho para tudo.** Não existe verde com ressalva. Gate que falha é refeito inteiro depois do conserto.
- **Ação remota só com "go" do Lucas escrito na evidência:** push de branch, push de tag, merge e push na `main`, mudança na Vercel, criação de conta.
- **Ordem fixa:** G0 → G1 (a cada task) → G2 → G3 → G4 → G5 → G6, com os itens do G0 nos prazos da seção dele.

### G0 — Pré-voo (escalonado: cada item antes do que ele protege)

A Fase 0 do `tasks.md` (casca do repo, cópia do design system e script de snapshot) roda antes do G0, sob o G1: o G0.2 e o G0.3 dependem dela. Prazos, escalonados pelo Lucas em 14/10/2026: o G0.1 fecha antes da Fase 1; o G0.2 antes da Fase 4, porque as chaves de desempate que ele confere alimentam a leitura paginada; o G0.3 a G0.6 antes do G2.

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G0.1 | `node tests/testes.mjs` na base | exit 0 e 497 asserções |
| G0.2 | snapshot de paridade (GATE-05) | gravado fora do repo, com a contagem de linhas de R01–R22 na evidência |
| G0.3 | commit do design system | sha gravado em `src/design-system/SNAPSHOT` e alcançável pela `origin/main` da plataforma |
| G0.4 | Vercel | o dono confirma por escrito: previews de branch ligados, `main` como branch de produção, log do build do preview visível para o Lucas e nenhum Output Directory sobreposto nas Project Settings |
| G0.5 | contas de UAT | uma conta de diretoria e uma de mentor disponíveis |
| G0.6 | congelamento e janela | Lucas aprova o congelamento do `index.html` e a janela do corte |

Se falhar: a fase ou o gate que o item precede não começa.

### G1 — Task (cada commit da branch)

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G1.1 | `pnpm typecheck` | exit 0 |
| G1.2 | `pnpm test` | exit 0, com a contagem seguindo a cadeia `Test count: N → M` do `tasks.md` |
| G1.3 | `check_commit.py` | Conventional Commits; um commit por task |
| G1.4 | `pnpm build`, no fim de cada fase | exit 0 |

Se falhar: o conserto entra no commit da própria task, nunca num `fix:` por cima.

### G2 — Branch (antes de qualquer push)

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G2.1 | clone limpo: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` | os 4 com exit 0 |
| G2.2 | `git diff --stat <merge-base>..HEAD -- supabase/` | vazio |
| G2.3 | `scripts/gates/verificar-build.mjs`: valor `sb_secret_…` ou JWT com `role` diferente de `anon` em `.next/static` e `.next/server/app` (GATE-11) | 0 ocorrências |
| G2.4 | classe `__variable_` do `<html>` do HTML do servidor no CSS de `.next/static/css` (GATE-12) | presente |
| G2.5 | paridade offline (GATE-06) contra o `index.html` do merge-base | 0 divergências fora das exceções do Apêndice A |
| G2.6 | Verifier do skill: `validation.md` e `validate_state.py` | PASS, evidência `arquivo:linha` por AC, 0 mutantes sobreviventes |
| G2.7 | threat pass (`security-review`) do diff inteiro | 0 achados HIGH ou CRITICAL abertos; MEDIUM resolvido ou aceito pelo Lucas por escrito |
| G2.8 | `index.html` da `main` | sem commit novo desde o G2.5 (GATE-16) |
| G2.9 | `pnpm audit --prod --audit-level=high` (SEC-03) | exit 0, ou exceção aceita pelo Lucas por escrito |
| G2.10 | cada `blob` do `SNAPSHOT` contra `git ls-tree -r <sha>` da plataforma (SEC-03) | 0 diferenças |

Se falhar: volta para o Execute.

### G3 — Preview (UAT em produção, sem merge)

Entrada: G2 verde no mesmo sha e "go" do Lucas para o push da branch.

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G3.1 | build do preview na Vercel | estado "Ready" |
| G3.2 | os 5 caminhos de CUT-01 no preview | 404 |
| G3.3 | leitura por papel (admin, diretoria, mentor), pelo roteiro do Design | as 10 telas e a ficha abrem; 0 erro no console |
| G3.4 | paridade ao vivo: PAR-01, PAR-03, PAR-06 (mês corrente), PAR-11 (cards) e PAR-14 (geral), lidas no preview e no app em produção no mesmo minuto, por papel | 0 divergências |
| G3.5 | rede da diretoria (GATE-08), registrada só com método, caminho sem query e status (GATE-03) | nenhum POST, PATCH ou DELETE fora do permitido |
| G3.6 | escrita do admin no registro de teste (GATE-09): W01–W14 e W18–W21 | cada uma grava o que o app antigo mostra depois; W15–W17 ficam só nos testes, porque exigem cobrança real da Lia |
| G3.7 | matriz do mês e matriz em "Todos" depois de excluir o registro de teste (GATE-10) | idênticas às lidas antes do G3.6 |
| G3.8 | link antigo `#/mentorado/<id>/financeiro` | abre a ficha certa na aba Financeiro |
| G3.9 | tempo até o Dashboard com dados, mediana de 5 cargas frias | no máximo o do app em produção + 1 s |
| G3.10 | Dashboard, Sessões e Ficha com 390 px de largura | sem rolagem horizontal |
| G3.11 | fonte computada do `body` | Inter |
| G3.12 | temas claro e escuro nas 10 telas e na ficha | nenhum texto ilegível |
| G3.13 | `curl -I` em `/dash` no preview (SEC-04) | os 3 cabeçalhos de SEC-04 presentes e `X-Powered-By` ausente |
| G3.14 | sonda do RLS com as contas de diretoria e mentor no registro de teste (GATE-08) | cada escrita que o papel não tem volta com erro ou 0 linhas |

Se falhar: volta para o Execute; o registro de teste é excluído mesmo assim.

### G4 — Go/no-go

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G4.1 | sha que vai ser mesclado | igual ao do G3 verde |
| G4.2 | idade do G3 | verde há no máximo 24 h |
| G4.3 | ensaio da volta: branch descartável a partir da `main`, sem `vercel.json` e com o `.vercelignore` da volta, publicada como preview (GATE-15) | o preview serve o app antigo e responde 404 nos 5 caminhos de CUT-01 e em `/.specs/features/migracao-nextjs/spec.md` |
| G4.4 | URL imutável do deploy de produção atual | anotada na evidência |
| G4.5 | tag `pre-nextjs` no commit atual da `main` | criada e enviada |
| G4.6 | aviso aos usuários: data, o que muda no visual, mesmo login | enviado pelo Lucas |
| G4.7 | janela | Lucas disponível de T a T + 2 h |
| G4.8 | "go" do Lucas | escrito na evidência |

### G5 — Corte e fumaça (de T a T + 60 min)

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G5.1 | `git merge --no-ff`, G2.1 de novo na `main` mesclada, push | exit 0 nos comandos; deploy de produção "Ready" |
| G5.2 | fumaça por papel em produção: login, Dashboard, Ficha, Sessões, e Financeiro para admin e diretoria | abre sem erro no console |
| G5.3 | paridade ao vivo das métricas do G3.4, produção nova contra a URL imutável do G4.4 | 0 divergências |
| G5.4 | os 5 caminhos de CUT-01 no domínio de produção | 404 |
| G5.5 | escrita de ida e volta: W14, W10 e W13 num registro de teste novo | as 3 gravam e o registro some |

**Gatilhos de volta** (basta um): login falha num papel; um papel vê tela ou dado fora do recorte; divergência no G5.3; escrita falha ou anuncia sucesso sem gravar; erro no console ao abrir uma tela; fonte em serifa ou tela sem estilo; usuário relata bloqueio dentro da janela.

**Volta:** `git revert -m 1 <merge>` e push na `main`, ou "Instant Rollback" pelo dono (GATE-14).

### G6 — Estabilização (7 dias corridos depois do corte)

| item | verificação | passa quando |
| ---- | ----------- | ------------ |
| G6.1 | relatos dos usuários | nenhum bloqueio aberto |
| G6.2 | logs da API do Supabase | taxa de respostas 4xx e 5xx do PostgREST não maior que a dos 7 dias anteriores ao corte |
| G6.3 | fechamento | branch apagada local e remota; snapshot de paridade e arquivo de valores apagados; contas de UAT de diretoria e mentor removidas ou banidas, com as sessões revogadas; CUT-04 feito |

Depois do G6, problema vira correção para a frente, não revert.

---

## User Stories

### P1: Fundação em Next.js ⭐ MVP

**User Story**: Como Lucas, quero o repo como um app Next.js com o design system da plataforma, para portar as telas sem reabrir decisão de stack.

**Why P1**: Nenhuma tela porta sem isso.

**Acceptance Criteria**:

1. The app SHALL usar Next.js 15 com App Router, React 19, TypeScript com `strict`, Tailwind 3 e pnpm, com as versões de `next`, `react`, `react-dom`, `tailwindcss`, `zod`, `vitest`, `lucide-react` e `react-hot-toast` iguais às resolvidas no `pnpm-lock.yaml` da plataforma no commit de `src/design-system/SNAPSHOT`, fixadas sem `^`.  <!-- ubiquitous -->
2. The app SHALL manter o design system em `src/design-system/` e `src/components/ui/`, nos mesmos caminhos da plataforma, a camada de dados em `src/lib/data/` e as regras de negócio como funções puras em `src/lib/`, fora dos componentes.  <!-- ubiquitous -->
3. WHEN `pnpm typecheck`, `pnpm test` e `pnpm build` rodam THEN cada comando SHALL sair com código 0.  <!-- event-driven -->
4. The repo SHALL ter `.gitignore` cobrindo (`node_modules/`, `.next/`, `.vercel/`, `.env*` exceto `.env.example`, `supabase/.temp/`), e `git ls-files` SHALL não listar nenhum arquivo `.env*` além de `.env.example`.  <!-- ubiquitous -->
5. The código em `src/` SHALL ler só as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.  <!-- ubiquitous -->
6. IF `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` não começa com `sb_publishable_` nem é um JWT com `role` `anon`, ou `NEXT_PUBLIC_SUPABASE_URL` não é `https://matgynpiscyoshnjzolo.supabase.co`, THEN o `next build`, o `next dev` e o `next start` SHALL falhar com um erro que nomeia a variável, numa checagem do `next.config.ts`, fora do bundle do cliente.  <!-- unwanted-behavior -->
7. The código em `src/` e o `next.config.ts` SHALL não conter os textos `service_role`, `SUPABASE_SERVICE_ROLE_KEY` e `sb_secret_`, verificado por teste.  <!-- ubiquitous -->
8. The app SHALL não carregar script nem folha de estilo de outra origem em runtime; `@supabase/supabase-js` `2.117.3` e `dompurify` `3.2.6` SHALL vir do npm com versão exata, e o `package.json` SHALL não ter `chart.js`.  <!-- ubiquitous -->

**Independent Test**: `pnpm install && pnpm typecheck && pnpm test && pnpm build` sai com 0 num clone limpo, e `pnpm dev` abre a tela de login.

---

### P1: Login, sessão e papel ⭐ MVP

**User Story**: Como admin, diretoria ou mentor, quero entrar com o mesmo e-mail e senha de hoje e ver só o que meu papel permite.

**Why P1**: Sem sessão o RLS não devolve nada.

**Acceptance Criteria**:

1. WHEN alguém sem sessão abre o app THEN o app SHALL mostrar a tela de login (e-mail, senha, Entrar) e SHALL não fazer nenhuma leitura de dado.  <!-- event-driven -->
2. WHEN as credenciais são válidas THEN o app SHALL entrar com `signInWithPassword`, ler `profiles.role` do próprio usuário e abrir o endereço atual com o recorte desse papel.  <!-- event-driven -->
3. WHEN o usuário aperta Enter no campo de senha THEN o app SHALL enviar o login.  <!-- event-driven -->
4. IF o Supabase recusa a credencial THEN o app SHALL mostrar "E-mail ou senha inválidos.".  <!-- unwanted-behavior -->
5. IF o login falha por rede ou por limite de tentativas THEN o app SHALL mostrar uma mensagem que nomeia essa falha e SHALL não falar em senha.  <!-- unwanted-behavior -->
6. IF `profiles` não devolve linha ou devolve erro THEN o app SHALL encerrar a sessão e mostrar "Perfil não encontrado".  <!-- unwanted-behavior -->
7. IF `profiles.role` é nulo ou fora de (`admin`, `diretoria`, `mentor`) THEN o app SHALL mostrar a tela "Papel não reconhecido" com o botão Sair e SHALL não carregar dado.  <!-- unwanted-behavior -->
8. WHEN o usuário sai THEN o app SHALL descartar da memória os dados carregados, limpar o campo de senha e mostrar a tela de login, e WHEN outra pessoa entra na mesma aba THEN o menu e as telas SHALL refletir só o papel dela.  <!-- event-driven -->
9. The app SHALL manter a sessão entre recarregamentos no mesmo navegador, pelo armazenamento padrão do supabase-js.  <!-- ubiquitous -->
10. The app SHALL não oferecer cadastro nem recuperação de senha, e SHALL criar o cliente com `auth.detectSessionInUrl: false`, sem aceitar sessão vinda da URL.  <!-- ubiquitous -->

**Independent Test**: Entrar com uma conta de cada papel, sair, entrar com outra e conferir o menu.

---

### P1: Endereço e navegação ⭐ MVP

**User Story**: Como qualquer usuário, quero que o link de ficha que recebi no WhatsApp continue abrindo a mesma tela.

**Why P1**: Os links já circulam (mapeamento §3).

**Acceptance Criteria**:

1. The app SHALL abrir, nos caminhos `/dash`, `/acompanhamento`, `/mentorados`, `/sessoes`, `/rotas`, `/mentores`, `/analise`, `/nps`, `/ia`, `/financeiro`, `/mentorado/<id>` e `/mentorado/<id>/<aba>` (aba em `cadastro`, `financeiro`, `sessoes`, `notas`, `stlseller`, `completo`, `basico`), a mesma tela que o `index.html@2aea455` abre no hash de mesmo nome (mapeamento §3).  <!-- ubiquitous -->
2. WHEN o app abre com um hash antigo `#/<caminho>` THEN o app SHALL montar o caminho só a partir de uma tela de `TELAS` ou de `mentorado/<id>[/<aba de ABAS_FICHA>]`, com o id em `encodeURIComponent`, e SHALL trocar o endereço sem criar entrada nova no histórico; IF o hash não casa nenhum desses formatos THEN o app SHALL abrir `/dash`.  <!-- complex -->
3. WHEN o caminho é `/`, desconhecido ou tem codificação inválida (como `/mentorado/%E0%A4%A`) THEN o app SHALL mostrar o Dashboard sem lançar erro.  <!-- event-driven -->
4. WHEN um papel sem `verFinanceiro` abre `/financeiro`, `/analise`, `/nps` ou `/mentores` THEN o app SHALL trocar o endereço por `/dash`.  <!-- event-driven -->
5. WHEN um papel sem `verFinanceiro` abre a ficha nas abas `financeiro` ou `stlseller` THEN o app SHALL mostrar a aba `sessoes`.  <!-- event-driven -->
6. The menu SHALL mostrar Dashboard, Acompanhamento, Mentorados, Sessões, Rotas e Análise IA para os papéis (`admin`, `diretoria`, `mentor`), e Mentores, STLSeller, NPS e Financeiro só para `admin` e `diretoria`.  <!-- ubiquitous -->
7. WHEN o usuário usa voltar ou avançar do navegador THEN o app SHALL mostrar a tela do endereço novo.  <!-- event-driven -->
8. WHILE a primeira carga não terminou the app SHALL mostrar Skeleton no lugar da tela e SHALL não mostrar "Ficha não encontrada".  <!-- state-driven -->
9. WHEN a carga terminou e o id da ficha não está entre os mentorados carregados THEN o app SHALL mostrar "Ficha não encontrada".  <!-- event-driven -->
10. WHEN um aviso do Dashboard leva a Sessões (`dobradas`, `semData`, `semMentor`, `etapaDeduzida`) THEN o app SHALL recortar as linhas pelos ids daquele aviso antes dos filtros de tipo e mentor, e SHALL descartar o recorte quando o usuário sai de Sessões.  <!-- event-driven -->

**Independent Test**: Abrir cada caminho do critério 1 e um link antigo `#/mentorado/<id>/financeiro` com admin e com mentor, e comparar com o app antigo.

---

### P1: Porta de dados ⭐ MVP

**User Story**: Como Lucas, quero toda leitura passando por um só lugar, validada e paginada, para os números não mentirem quando a carteira crescer.

**Why P1**: É o lugar onde o teto de 1.000 linhas e o RLS se encontram.

**Acceptance Criteria**:

1. The código fora de `src/lib/data/` SHALL não importar `@supabase/supabase-js`, verificado por teste.  <!-- ubiquitous -->
2. The porta de dados SHALL validar com Zod cada linha das leituras R01–R23 listed in mapeamento §4.1, pelas colunas que o app usa.  <!-- ubiquitous -->
3. IF uma linha não passa no schema THEN o app SHALL escrever `[central-elite3d] <relação>: schema mismatch` com o problema no console e SHALL tratar a relação como falha de carga.  <!-- unwanted-behavior -->
4. The porta de dados SHALL ler as relações R02–R18 e R22 listed in mapeamento §4.1 em páginas de 1.000 linhas, ordenadas pela coluna de hoje e depois pela chave única da relação, até vir uma página com menos de 1.000 linhas.  <!-- ubiquitous -->
5. WHEN uma relação tem 2.500 linhas THEN a porta SHALL devolver as 2.500, cada uma uma vez só.  <!-- event-driven -->
6. IF a leitura de R02, R03, R04 ou R06 falha na primeira carga THEN o app SHALL mostrar a mensagem do erro com o botão "Tentar de novo" no lugar do Skeleton.  <!-- unwanted-behavior -->
7. IF a leitura de R05, de R07 a R19, ou de R22 falha THEN o app SHALL mostrar estado de erro só nas telas que usam aquela relação e SHALL manter as outras telas funcionando.  <!-- unwanted-behavior -->
8. The app SHALL chamar só as rpcs (`experiencia_adesao`, `analise_ia_mentor`, `lia_adotar_orfas`, `lia_refletir_financeiro`) e SHALL não chamar edge function.  <!-- ubiquitous -->
9. WHEN uma escrita termina THEN o app SHALL recarregar os dados, e WHEN duas recargas se sobrepõem THEN SHALL valer a resposta da última pedida.  <!-- event-driven -->

**Independent Test**: Teste com fixture de 2.500 linhas em `sessoes` e em `parcelas`; teste com uma relação devolvendo erro.

---

### P1: Escritas com o mesmo contrato ⭐ MVP

**User Story**: Como admin ou mentor, quero que salvar, confirmar e excluir gravem exatamente o que gravam hoje, e que o app não diga "salvo" quando nada foi gravado.

**Why P1**: O fechamento dos mentores e o financeiro saem dessas linhas.

**Acceptance Criteria**:

1. WHEN uma escrita W01–W21 listed in mapeamento §4.2 é disparada THEN a porta SHALL enviar a mesma relação, operação, chaves e valores de payload e `onConflict` da tabela do mapeamento, verificado por teste que captura a chamada.  <!-- event-driven -->
2. WHEN uma escrita W01–W21 volta sem erro e com 0 linhas afetadas THEN o app SHALL mostrar "Nada foi gravado: sem permissão ou registro não encontrado." e SHALL não mostrar sucesso, e WHEN uma escrita de várias linhas volta com menos linhas que as pedidas THEN o app SHALL mostrar quantas foram gravadas de quantas e SHALL não mostrar sucesso.  <!-- event-driven -->
3. WHILE uma escrita está em andamento the botão que a disparou SHALL ficar desabilitado e mostrar Spinner.  <!-- state-driven -->
4. WHEN o botão de uma escrita recebe dois cliques seguidos THEN a porta SHALL enviar uma escrita só.  <!-- event-driven -->
5. IF uma escrita falha THEN o app SHALL mostrar a mensagem do erro num toast e SHALL manter aberto o formulário com o que foi digitado.  <!-- unwanted-behavior -->
6. IF a rpc `lia_adotar_orfas` (W11b) falha depois que o W11 gravou THEN o app SHALL mostrar "Cadastro salvo, mas as cobranças da Lia não foram puxadas:" seguido do erro.  <!-- unwanted-behavior -->
7. IF a rpc `lia_refletir_financeiro` falha em W15, W16 ou W17 THEN o app SHALL mostrar o erro num toast e SHALL manter o resto da tela.  <!-- unwanted-behavior -->
8. IF o papel não tem a capacidade que o mapeamento §4.2 associa à escrita THEN o handler SHALL não chamar a porta de dados.  <!-- unwanted-behavior -->
9. WHILE o papel é `diretoria` the app SHALL não renderizar, nas 10 telas, na ficha e nos modais, controle que dispare uma escrita W01–W21, e o mesmo teste rodado como `admin` SHALL achar pelo menos 10 desses controles.  <!-- state-driven -->

**Independent Test**: Testes de payload por escrita; teste de 0 linhas com um stub que devolve `data: []`.

---

### P1: Telas operacionais com paridade

**User Story**: Como admin, diretoria ou mentor, quero Dashboard, Acompanhamento, Mentorados, Sessões, Ficha e Rotas com as mesmas regras de hoje.

**Why P1**: É o uso diário e a base do fechamento dos mentores.

**Acceptance Criteria**:

1. WHEN o Dashboard abre THEN o app SHALL mostrar os itens do painel "Precisa de atenção" listed in mapeamento §3.1, com as regras de entrada, a visibilidade por papel e os links da tabela, e os contadores SHALL ignorar a busca.  <!-- event-driven -->
2. The matriz mentor × etapa SHALL contar reuniões pela chave (`mentorado_id`, `data`, `hora`, `mentor` como gravado), manter no par a linha com `google_event_id` nulo e, no empate, a de menor `id`.  <!-- ubiquitous -->
3. The matriz SHALL agrupar o mentor pela chave normalizada (sem acento, espaços colapsados, minúsculas), exibir a grafia de `TODOS_MENTORES` e marcar "fora do projeto" quem não está em `MENTORES`.  <!-- ubiquitous -->
4. WHEN o mês da matriz não foi escolhido THEN o app SHALL usar o mês corrente se ele tiver reunião, senão o mês mais recente com reunião, senão "Todos".  <!-- event-driven -->
5. The app SHALL contar só sessões 1:1 (etapa fora de `ETAPAS_GRUPO`) na trilha de 12 segmentos, na legenda da trilha da ficha e no aviso de +30 dias sem sessão.  <!-- ubiquitous -->
6. WHEN o admin registra uma sessão em grupo com N participantes THEN a porta SHALL inserir N linhas em `sessoes` com a mesma `etapa`, `data`, `hora`, `mentor` e `status` (W02).  <!-- event-driven -->
7. The app SHALL agrupar encontros em grupo pela chave (`etapa`, `data`, `hora`) e SHALL aplicar a busca depois de agrupar.  <!-- ubiquitous -->
8. WHEN uma sessão é salva pelo formulário THEN a porta SHALL gravar `etapa_deduzida: false` (W03), e WHEN uma sessão é confirmada THEN a porta SHALL não enviar `etapa_deduzida` (W04).  <!-- event-driven -->
9. WHEN Sessões mostra o bloco "Concluídas (últimas 30)" fora de foco THEN o app SHALL mostrar as 30 concluídas de data mais recente.  <!-- event-driven -->
10. The busca SHALL casar sem caixa e sem acento, por partes (`casaBusca`), e SHALL recortar listas sem mudar cards, contadores de aviso e subtítulos.  <!-- ubiquitous -->
11. WHEN o admin pede para excluir um mentorado THEN o app SHALL mostrar o resumo de `resumoExclusao` e SHALL liberar o botão só quando o nome digitado casar por `chaveNome`.  <!-- event-driven -->
12. WHEN a ficha abre para um papel sem `editarMentorado` THEN os campos das abas Cadastro e Financeiro que ele vê hoje SHALL aparecer só para leitura, e o bloco Situação SHALL continuar oculto.  <!-- event-driven -->
13. WHEN o admin salva o cadastro com o e-mail na tela THEN a porta SHALL gravar `cadastro_incompleto: false` (W11) e chamar `lia_adotar_orfas` (W11b).  <!-- event-driven -->
14. IF `contrato_status`, `entrada_status` ou `restante_status` é nulo THEN o select SHALL mostrar a opção "— não informado —" selecionada.  <!-- unwanted-behavior -->
15. WHEN o admin salva o financeiro sem mexer num status nulo THEN a porta SHALL manter esse campo nulo.  <!-- event-driven -->
16. WHILE um marco está aberto, WHEN um critério é marcado THEN o app SHALL atualizar o contador e a barra sem fechar o painel e sem perder campo não salvo.  <!-- complex -->
17. WHEN o usuário abre um marco na tela Rotas THEN o app SHALL fechar o marco que estava aberto.  <!-- event-driven -->
18. WHEN a evolução de um marco de rota rica é salva THEN `criterios_ok` SHALL levar o texto de cada critério marcado, e `progresso` e `criterios_pendentes` SHALL ser derivados deles (W09).  <!-- event-driven -->
19. The régua de faturamento do marco SHALL somar os canais da rota no mês corrente quando `rotas.unidade` é `mes`, e no acumulado quando é `acumulado`.  <!-- ubiquitous -->
20. WHEN o usuário digita ou cola um valor em campo de moeda THEN o app SHALL interpretar como `lerBRL` e `mascaraBRL` interpretam hoje, com "2000.50" valendo 2000,50 e "1.234,56" valendo 1234,56.  <!-- event-driven -->

**Independent Test**: Fixture com par de linhas duplicadas pelo sync, encontro em grupo e marco rico; comparar matriz, avisos e payloads com os valores do mapeamento.

---

### P1: Dinheiro e cobranças da Lia

**User Story**: Como admin ou diretoria, quero o Financeiro e as cobranças órfãs funcionando como hoje, sem que a busca esconda dinheiro.

**Why P1**: Cobrança órfã é a única falha silenciosa da integração com a Lia.

**Acceptance Criteria**:

1. WHEN o Financeiro abre THEN os cards e os painéis de cobranças órfãs e descartadas SHALL ignorar a busca.  <!-- event-driven -->
2. The app SHALL mostrar "vincular" numa cobrança órfã só quando existe exatamente 1 mentorado com aquele e-mail, comparado em minúsculas como hoje.  <!-- ubiquitous -->
3. The app SHALL mostrar o motivo de cada órfã calculado na hora por `motivoOrfa` (sem e-mail, e-mail em mais de um cadastro, cadastro existe, nenhum cadastro).  <!-- ubiquitous -->
4. WHEN o admin descarta ou restaura uma cobrança THEN a porta SHALL gravar `ignorada` (W16, W17), e WHEN a cobrança tinha dono THEN SHALL chamar `lia_refletir_financeiro` desse mentorado.  <!-- event-driven -->
5. The ficha SHALL mostrar parcela com `lia_bill_id` sem controle de edição e SHALL esconder "Adicionar parcela" quando alguma parcela do mentorado veio da Lia.  <!-- ubiquitous -->
6. The app SHALL calcular vencimento e prazo ("venceu há N dias", "ontem", "hoje", "amanhã", "em N dias") por dia de calendário em America/Sao_Paulo.  <!-- ubiquitous -->

**Independent Test**: Fixture com órfãs nos 4 motivos e uma busca que não casa com nenhuma; conferir que todas aparecem.

---

### P1: Notas sem perda (AD-004)

**User Story**: Como admin ou mentor, quero escrever as notas do mentorado sem perder o que digitei ao trocar de aba.

**Why P1**: Hoje dá para perder a última edição e, sem o sanitizador, apagar a nota inteira (mapeamento §10, item 2).

**Acceptance Criteria**:

1. The editor SHALL usar `contenteditable` e os comandos de edição do navegador, sem biblioteca de editor.  <!-- ubiquitous -->
2. The app SHALL sanitizar o HTML da nota com DOMPurify, permitindo só as tags de `NOTA_TAGS`, `href` só com `http:` ou `https:`, `class` só com `checklist` e `feito` e nenhum atributo `data-*`, ao abrir, ao colar e ao salvar.  <!-- ubiquitous -->
3. IF o sanitizador não está disponível THEN o editor SHALL ficar só leitura, SHALL não exibir o HTML da nota e SHALL não gravar.  <!-- unwanted-behavior -->
4. WHEN o usuário fica 1 s sem digitar THEN a porta SHALL gravar a nota (W10).  <!-- event-driven -->
5. WHEN o usuário troca de aba, de ficha ou de tela com gravação pendente THEN o app SHALL gravar a nota antes de desmontar o editor.  <!-- event-driven -->
6. WHILE o papel é `diretoria` the editor SHALL ficar só leitura e sem barra de ferramentas.  <!-- state-driven -->
7. WHEN o usuário digita os atalhos (`#`, `##`, `###`, `-`, `*`, `1.`, `>`, `[]`) seguidos de espaço no início do bloco, ou três crases ou `---` seguidos de Enter, THEN o editor SHALL produzir os mesmos blocos de hoje.  <!-- event-driven -->
8. WHEN o usuário cria um link THEN o app SHALL aceitar só endereço `http:` ou `https:`, num Dialog com campo de texto.  <!-- event-driven -->

**Independent Test**: Digitar e trocar de aba em 300 ms; reabrir a nota e conferir o texto.

---

### P1: Telas gerenciais (STLSeller, NPS, Análise IA, Mentores)

**User Story**: Como admin ou diretoria, quero as telas de leitura com os mesmos números; como mentor, quero só o recorte que o AD-005 me dá.

**Why P1**: A troca de front só acontece com todas as telas portadas.

**Acceptance Criteria**:

1. WHEN admin ou diretoria abre STLSeller THEN o app SHALL mostrar os agregados, a concentração, os chips, a tabela e o diagnóstico de e-mail do mapeamento §3.8, com o recorte "Ativos" como padrão.  <!-- event-driven -->
2. The tela NPS SHALL calcular o NPS como `round(100 · (#nota ≥ 9 − #nota ≤ 6) / n)` e a média com 1 casa, contar o dia em America/Sao_Paulo e a semana de segunda a domingo.  <!-- ubiquitous -->
3. The tela NPS SHALL paginar a tabela por período de 10 em 10 e as respostas de 20 em 20, e WHEN a aba ou o período (semana ou mês) muda THEN as duas SHALL voltar para a página 1.  <!-- complex -->
4. WHEN o filtro de mentor das respostas muda THEN só a lista de respostas SHALL voltar para a página 1.  <!-- event-driven -->
5. WHEN um mentor abre a Análise IA THEN o app SHALL ler pela rpc `analise_ia_mentor()` e SHALL não mostrar a aba Por mentor, o resumo nem respostas de NPS.  <!-- event-driven -->
6. The Análise IA SHALL ler análises no formato antigo (`pontos_fortes`, `pontos_de_atencao`, `sinais`) nos mesmos blocos de hoje.  <!-- ubiquitous -->
7. WHEN admin ou diretoria abre Mentores THEN o app SHALL mostrar por mentor a carteira, 1:1 e grupo em 30 dias e no total, agendadas, NPS de 30 dias, calls aceitas e última atividade, pelas regras do mapeamento §3.11.  <!-- event-driven -->
8. WHEN o mentor abre o Dashboard e a adesão da rpc `experiencia_adesao` fica abaixo de 70%, com denominador maior que 0, THEN o app SHALL mostrar o aviso com o link da pesquisa.  <!-- event-driven -->

**Independent Test**: Fixture com NPS em duas semanas e dois mentores; conferir NPS, média e paginação.

---

### P1: Design system da plataforma

**User Story**: Como Lucas, quero a interface só com o design system da plataforma, para o app ter o mesmo visual da product-ops e receber as versões novas dele por cópia.

**Why P1**: É metade do pedido.

**Acceptance Criteria**:

1. The arquivos de `src/design-system/` e `src/components/ui/` que também existem na plataforma SHALL ser idênticos byte a byte aos do commit de `SNAPSHOT`, exceto os listados num AD de extensão, verificado por teste de hash.  <!-- ubiquitous -->
2. The código em `src/components/modules/` e `src/app/` SHALL não conter cor hexadecimal, `rgb(`, `rgba(` nem classe da paleta padrão do Tailwind (`gray-500`, `blue-600`, `red-400`), verificado por teste.  <!-- ubiquitous -->
3. The app SHALL usar a Inter auto-hospedada por `next/font/local`, com o `InterVariable.woff2` da plataforma (AD-037 dela), e SHALL não carregar Manrope nem fonte do Google.  <!-- ubiquitous -->
4. WHEN o usuário troca o tema no `ThemeToggle` THEN as 10 telas e a ficha SHALL usar os tokens do tema escolhido, e WHEN não há escolha salva THEN o tema SHALL seguir o do sistema operacional.  <!-- event-driven -->
5. The app SHALL usar `ConfirmDialog` para excluir sessão, parcela e faturamento (a exclusão de mentorado mantém o nome digitado de OPS-11), e o código SHALL não chamar `window.confirm`, `window.prompt` nem `window.alert`.  <!-- ubiquitous -->
6. The app SHALL resolver as lacunas listed in mapeamento §8 (data única, mês, combobox, trilha de 12 segmentos, paginação, ordenação e clique de linha em tabela, moeda BRL) com primitivo do design system (existente, composição de existentes ou arquivo novo genérico em `src/components/ui/`), sem editar arquivo copiado, e SHALL registrar a escolha de cada lacuna num AD em `docs/decisions/`.  <!-- ubiquitous -->
7. The app SHALL mostrar `EmptyState` em lista vazia e `Skeleton` durante carregamento.  <!-- ubiquitous -->
8. The casca do app (sidebar, menu mobile, usuário e Sair) SHALL ser montada com primitivos do design system (`NavItem`, `Button`, `Avatar`), sem CSS próprio.  <!-- ubiquitous -->

**Independent Test**: Teste de hash dos arquivos do design system e varredura de cor; abrir cada tela nos dois temas.

---

### P1: Testes portados

**User Story**: Como Lucas, quero a rede de proteção do `tests/` refeita antes de apagá-lo.

**Why P1**: Sem ela, as 497 asserções somem no mesmo commit que troca o front.

**Acceptance Criteria**:

1. WHEN `tests/` é apagado THEN cada grupo listed in mapeamento §7 SHALL ter pelo menos um teste vitest que afirma o mesmo resultado sobre o código novo.  <!-- event-driven -->
2. The suíte SHALL renderizar as 10 telas, a ficha e os modais com o nome de mentorado `<img src=x onerror=alert(1)>` e SHALL achar `&lt;img` e não achar `<img src=x` no HTML gerado.  <!-- ubiquitous -->
3. The código em `src/` SHALL inserir HTML (`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `createContextualFragment` ou `execCommand("insertHTML")`) só no editor de notas e sempre com a saída de `sanitizarNota`, verificado por teste.  <!-- ubiquitous -->
4. The suíte SHALL afirmar, lendo `supabase/functions/sync-google-calendar/index.ts`, que as etapas e ordens de `TRILHA` são as de `ETAPAS`/`ETAPA_ORD` e que cada nome de `MENTORES` aparece como valor de `EMAIL_MENTOR`.  <!-- ubiquitous -->
5. The suíte SHALL afirmar que `hojeSP()` às 23:30 de Brasília (02:30 UTC do dia seguinte) devolve a data de Brasília.  <!-- ubiquitous -->
6. WHEN `pnpm test` roda THEN a suíte SHALL sair com 0 sem rede e sem banco.  <!-- event-driven -->

**Independent Test**: `pnpm test` offline.

---

### P1: Gates de produção ⭐ MVP

**User Story**: Como Lucas, quero cada passo do corte com critério de passagem medido, para trocar um app em produção sem staging sem descobrir o problema pelo usuário.

**Why P1**: O push na `main` publica, e não há staging.

**Acceptance Criteria**:

1. The feature SHALL passar pelos gates G0 a G6 da seção "Gates de produção" nessa ordem, com cada item do G0 verde antes da fase ou do gate que a seção G0 lhe atribui, e IF um gate falha THEN o gate seguinte SHALL não começar antes de o que falhou ser refeito inteiro e verde.  <!-- complex -->
2. WHEN um gate roda THEN a evidência SHALL ser gravada em `.specs/features/migracao-nextjs/evidence/G<n>.md` com o sha, a data e hora e o código de saída de cada comando.  <!-- event-driven -->
3. The evidência SHALL conter só ids e contagens, sem nome, e-mail, comentário ou valor financeiro de mentorado, e SHALL não conter HAR, cabeçalho `Authorization`, corpo de `/auth/v1/`, `refresh_token` nem texto em formato JWT, verificado por um teste que varre `evidence/`.  <!-- ubiquitous -->
4. The branch SHALL ter `vercel.json` com `"framework": "nextjs"`, e WHILE a branch não foi mesclada the `main` SHALL continuar publicando o app estático.  <!-- complex -->
5. The script de snapshot SHALL ler R01–R22 com a sessão de um admin criada com `persistSession: false`, pedir e-mail e senha no terminal sem gravá-los, gravar o resultado fora do repo numa pasta com permissão `0700` excluída do Time Machine, recusar gravar numa pasta com outra permissão e encerrar a sessão ao terminar.  <!-- ubiquitous -->
6. The script de paridade SHALL calcular as métricas PAR-01 a PAR-17 do Apêndice A com o `index.html` do merge-base, executado pela técnica do `tests/ambiente.mjs` num carregador que alimenta o `loadAll` com o snapshot, e com o app novo, sobre o mesmo snapshot e a mesma data de "hoje", e SHALL sair com código 1 se houver divergência fora das exceções do Apêndice A.  <!-- ubiquitous -->
7. WHEN o script de paridade acha divergência THEN o relatório impresso SHALL mostrar só a métrica, a chave e o tipo (falta, sobra ou valor diferente), e os dois valores SHALL ir só para um arquivo `0600` na pasta do snapshot.  <!-- event-driven -->
8. WHILE o UAT da diretoria roda no preview the navegador SHALL não enviar POST, PATCH nem DELETE a `/rest/v1/` além de `POST /rest/v1/rpc/experiencia_adesao`, e WHEN o UAT de escrita roda THEN uma chamada direta à API com as contas de diretoria e de mentor SHALL tentar, no registro de teste, cada escrita que o papel não tem no mapeamento §4.2, e cada uma SHALL voltar com erro ou 0 linhas.  <!-- complex -->
9. WHEN o UAT de escrita roda THEN o admin SHALL usar como único mentorado de toda escrita o registro de teste `ZZQ Migracao Xyzzy` (`zzq-migracao@example.invalid`), SHALL datar toda sessão 1:1 ou em grupo em 31/12/2099 às 23:59 e SHALL excluir o registro no fim, e as contas de diretoria e mentor do UAT SHALL ser dedicadas, com senha digitada só pelo Lucas, e removidas ou banidas no G6.  <!-- event-driven -->
10. WHEN o registro de teste é excluído THEN a matriz do mês corrente e a matriz em "Todos" SHALL ser idênticas às lidas antes do UAT de escrita.  <!-- event-driven -->
11. WHEN o build termina THEN `.next/static` e `.next/server/app` SHALL não conter valor `sb_secret_…` nem JWT cujo payload decodificado tenha `role` diferente de `anon`.  <!-- event-driven -->
12. WHEN o build termina THEN a classe `__variable_` do `<html>` no HTML do servidor SHALL existir no CSS de `.next/static/css`.  <!-- event-driven -->
13. The merge na `main` SHALL acontecer só depois do "go" escrito do Lucas no G4, e o G2.1 SHALL estar verde na `main` mesclada antes do push.  <!-- ubiquitous -->
14. IF um gatilho de volta do G5 acontece THEN o app antigo SHALL voltar a responder no domínio de produção entre 0 e 15 minutos depois do gatilho, e o commit da volta SHALL levar um `.vercelignore` que publica só `index.html` e `favicon.png`.  <!-- unwanted-behavior -->
15. The commit da `main` anterior ao merge SHALL ter a tag `pre-nextjs`, e o ensaio da volta (G4.3) SHALL ter servido o app antigo num preview com o `.vercelignore` da volta, com 404 nos 5 caminhos de CUT-01 e em `/.specs/features/migracao-nextjs/spec.md`, antes do corte.  <!-- ubiquitous -->
16. IF a `main` recebe commit que muda `index.html` depois do último G2 THEN o G2 SHALL ser refeito contra o novo merge-base antes do G3.  <!-- unwanted-behavior -->

**Independent Test**: Rodar G2 inteiro num clone limpo e ler `evidence/G2.md`: todos os itens com código de saída 0 e nenhum dado pessoal.

---

### P1: Segurança (threat pass de 13/10/2026)

**User Story**: Como Lucas, quero os achados do threat pass do design como requisito, para a migração não abrir uma porta que o app de hoje não tem.

**Why P1**: o app está em produção, sem staging, com dado pessoal e financeiro.

**Acceptance Criteria**:

1. IF o destino pedido a `ir` ou `substituir` resolve para origem diferente de `location.origin` THEN o app SHALL navegar para `/dash` e SHALL não entregar esse destino ao roteador, verificado com `#//evil.example`, `#/\evil.example`, `#/%2F%2Fevil.example`, `#/%09/evil.example` e `#javascript:alert(1)`.  <!-- unwanted-behavior -->
2. WHILE o agente roda um gate the agente SHALL não ler o snapshot nem o arquivo de valores da paridade, SHALL não capturar DOM, tela ou resposta com nome, e-mail, comentário ou valor financeiro de mentorado, e SHALL registrar só códigos de saída, contagens, os agregados do G3.4 e erros de console.  <!-- state-driven -->
3. WHEN o G2 roda THEN `pnpm audit --prod --audit-level=high` SHALL sair com 0, salvo exceção aceita pelo Lucas por escrito, e cada `blob` do `SNAPSHOT` SHALL bater com `git ls-tree -r <sha>` da plataforma.  <!-- event-driven -->
4. The app SHALL responder com `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; connect-src 'self' https://matgynpiscyoshnjzolo.supabase.co`, `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin`, e SHALL não enviar `X-Powered-By`.  <!-- ubiquitous -->
5. The app SHALL renderizar link vindo do banco (`link_meet`, `link_gravacao`, `link_anotacoes`, `link_drive`, `link_mapa_mental`, `link_whatsapp` e o `link` de `stlseller_produtos_vendidos`) como `<a href>` só quando começa com `http:` ou `https:`, com `rel="noopener noreferrer"`, e SHALL mostrar outro valor como texto, verificado com `javascript:` e `data:` nos fixtures.  <!-- ubiquitous -->
6. IF, na hora de uma leitura ou escrita, o supabase-js não tem sessão ou tem a sessão de outro usuário que não o da tela THEN a porta SHALL não enviar a requisição, SHALL descartar a escrita pendente e o app SHALL mostrar a tela da sessão atual (o login, se não houver), e WHEN o usuário sai com nota pendente THEN o app SHALL gravar a nota antes do `signOut`.  <!-- complex -->
7. The repo SHALL fixar o pnpm em `packageManager` e SHALL não rodar script de instalação de dependência fora da lista `pnpm.onlyBuiltDependencies` do `package.json`.  <!-- ubiquitous -->
8. IF um aviso de segurança high ou critical atinge a versão fixada de `next`, `react` ou `react-dom` THEN o app SHALL fixar a versão corrigida sem esperar nova cópia do design system, com a exceção registrada no `SNAPSHOT` e aceita pelo teste de versões.  <!-- unwanted-behavior -->

**Independent Test**: `pnpm test` com os vetores de SEC-01 e SEC-05; `curl -I` no preview para SEC-04; `pnpm audit` no G2.

---

### P2: Corte

**User Story**: Como qualquer usuário, quero o app novo no mesmo endereço, com os links antigos funcionando e nada do repositório exposto.

**Why P2**: É o resultado do G5; depende das ações remotas dos gates.

**Acceptance Criteria**:

1. WHEN o app Next está publicado THEN `GET` em `/ARCHITECTURE.md`, `/supabase/config.toml`, `/tests/testes.mjs`, `/docs/decisions/001-analista-de-nps-so-com-claude.md` e `/supabase/functions/lia-webhook/index.ts` SHALL responder 404.  <!-- event-driven -->
2. WHEN um admin abre `https://central-elite3d.vercel.app/#/mentorado/<id>/financeiro` THEN o app SHALL abrir a ficha desse mentorado na aba Financeiro.  <!-- event-driven -->
3. The merge que publica o app Next SHALL apagar `index.html` e `tests/` e levar o `favicon.png` para o app.  <!-- ubiquitous -->
4. The `ARCHITECTURE.md` e o `README.md` SHALL descrever a stack nova (rodar, testar, publicar, voltar) e SHALL corrigir as divergências listed in mapeamento §12.  <!-- ubiquitous -->

**Independent Test**: `curl -s -o /dev/null -w '%{http_code}'` nos 5 caminhos depois do deploy.

---

## Edge Cases

- IF a ficha aberta é excluída por outro admin THEN, depois da recarga, o app SHALL mostrar "Ficha não encontrada". `[EDGE-01]`
- IF o supabase-js não consegue renovar a sessão THEN o app SHALL voltar para a tela de login. `[EDGE-02]`
- WHEN a aba fica aberta depois da meia-noite de Brasília THEN prazos e "hoje" SHALL usar a data nova na renderização seguinte. `[EDGE-03]`
- IF a nota passa de 500.000 caracteres THEN o app SHALL mostrar o erro do banco e SHALL manter o texto no editor. `[EDGE-04]`
- IF o banco devolve um valor de `sessoes.status` fora de `S_STATUS` THEN o app SHALL mostrar o texto cru, escapado, sem quebrar a tela. `[EDGE-05]`

---

## Implicit-requirement dimensions

| dimensão | resolução |
| -------- | --------- |
| Input validation & bounds | Zod em toda resposta (DATA-02, DATA-03); validações de formulário de hoje (mapeamento §3.5); moeda (OPS-20); limite da nota (EDGE-04) |
| Failure / partial-failure states | DATA-06, DATA-07, WRITE-05, WRITE-06, WRITE-07 |
| Idempotency / retry / duplicate handling | WRITE-03, WRITE-04; upserts mantêm o `onConflict` de hoje (WRITE-01) |
| Auth boundaries & rate limits | RLS como única autorização (STACK-06, STACK-07, DATA-01); navegação só na mesma origem (SEC-01); sessão nunca vem da URL (AUTH-10); identidade conferida antes de ler e escrever (SEC-06); cabeçalhos de segurança (SEC-04); capacidades (WRITE-08, WRITE-09, NAV-03, NAV-04); limite de tentativas do Auth (AUTH-05) |
| Concurrency / ordering | DATA-09; notas com último a salvar vence (AD-004, sem mudança) |
| Data lifecycle / expiry | N/A because o front não guarda dado além da sessão do supabase-js e da preferência de tema; nenhuma retenção muda |
| Observability | `console.error("[central-elite3d] …", detalhe)` em toda leitura e escrita que falha (DATA-03); sem telemetria nova, porque hoje não há e o escopo é paridade |
| External-dependency failure | Supabase fora: DATA-06 e DATA-07. As integrações não passam pelo front (mapeamento §6.4) |
| State-transition integrity | Status de sessão e de marco seguem as transições de hoje (OPS-08, OPS-18); o `CHECK` do banco continua sendo a guarda |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| STACK-01 | P1: Fundação — versões iguais às da plataforma (AC1) | Execute | Implementing |
| STACK-02 | P1: Fundação — onde mora cada camada (AC2) | Execute | Implementing |
| STACK-03 | P1: Fundação — gate verde (AC3) | Execute | Implementing |
| STACK-04 | P1: Fundação — `.gitignore` (AC4) | Execute | Implementing |
| STACK-05 | P1: Fundação — só 2 variáveis públicas (AC5) | Execute | Implementing |
| STACK-06 | P1: Fundação — recusa chave secreta (AC6) | Execute | Implementing |
| STACK-07 | P1: Fundação — sem `service_role` no código (AC7) | Execute | Implementing |
| STACK-08 | P1: Fundação — sem CDN, versões exatas (AC8) | Execute | Implementing |
| AUTH-01 | P1: Login — tela sem sessão (AC1) | Execute | Implementing |
| AUTH-02 | P1: Login — entrada e papel (AC2) | Execute | Implementing |
| AUTH-03 | P1: Login — Enter envia (AC3) | Execute | Implementing |
| AUTH-04 | P1: Login — credencial recusada (AC4) | Execute | Implementing |
| AUTH-05 | P1: Login — falha de rede ou limite (AC5) | Execute | Implementing |
| AUTH-06 | P1: Login — perfil ausente (AC6) | Execute | Implementing |
| AUTH-07 | P1: Login — papel não reconhecido (AC7) | Execute | Implementing |
| AUTH-08 | P1: Login — logout limpa tudo (AC8) | Execute | Implementing |
| AUTH-09 | P1: Login — sessão persiste (AC9) | Execute | Implementing |
| AUTH-10 | P1: Login — sem cadastro nem reset (AC10) | Execute | Implementing |
| NAV-01 | P1: Endereço — mesmos caminhos (AC1) | Execute | Implementing |
| NAV-02 | P1: Endereço — link antigo com hash (AC2) | Execute | Implementing |
| NAV-03 | P1: Endereço — caminho inválido (AC3) | Execute | Implementing |
| NAV-04 | P1: Endereço — guarda de tela (AC4) | Execute | Implementing |
| NAV-05 | P1: Endereço — guarda de aba (AC5) | Execute | Implementing |
| NAV-06 | P1: Endereço — menu por papel (AC6) | Execute | Implementing |
| NAV-07 | P1: Endereço — voltar e avançar (AC7) | Execute | Implementing |
| NAV-08 | P1: Endereço — Skeleton na 1ª carga (AC8) | Execute | Implementing |
| NAV-09 | P1: Endereço — ficha não encontrada (AC9) | - | Pending |
| NAV-10 | P1: Endereço — foco dos avisos (AC10) | Execute | Implementing |
| DATA-01 | P1: Porta — só ela importa o supabase-js (AC1) | Execute | Implementing |
| DATA-02 | P1: Porta — Zod em R01–R23 (AC2) | Execute | Implementing |
| DATA-03 | P1: Porta — schema mismatch (AC3) | Execute | Implementing |
| DATA-04 | P1: Porta — paginação estável (AC4) | Execute | Implementing |
| DATA-05 | P1: Porta — 2.500 linhas (AC5) | Execute | Implementing |
| DATA-06 | P1: Porta — carga inicial com erro (AC6) | Execute | Implementing |
| DATA-07 | P1: Porta — erro isolado por relação (AC7) | Execute | Implementing |
| DATA-08 | P1: Porta — só 4 rpcs (AC8) | Execute | Implementing |
| DATA-09 | P1: Porta — última recarga vence (AC9) | Execute | Implementing |
| WRITE-01 | P1: Escritas — payload igual (AC1) | Execute | Implementing |
| WRITE-02 | P1: Escritas — 0 linhas não é sucesso (AC2) | Execute | Implementing |
| WRITE-03 | P1: Escritas — botão travado (AC3) | Execute | Implementing |
| WRITE-04 | P1: Escritas — clique duplo (AC4) | Execute | Implementing |
| WRITE-05 | P1: Escritas — erro mantém o formulário (AC5) | Execute | Implementing |
| WRITE-06 | P1: Escritas — falha do `lia_adotar_orfas` (AC6) | Execute | Implementing |
| WRITE-07 | P1: Escritas — falha do `lia_refletir_financeiro` (AC7) | Execute | Implementing |
| WRITE-08 | P1: Escritas — capacidade no handler (AC8) | Execute | Implementing |
| WRITE-09 | P1: Escritas — diretoria sem controle de escrita (AC9) | - | Pending |
| OPS-01 | P1: Operação — painel de atenção (AC1) | - | Pending |
| OPS-02 | P1: Operação — matriz conta reunião (AC2) | - | Pending |
| OPS-03 | P1: Operação — mentor normalizado (AC3) | - | Pending |
| OPS-04 | P1: Operação — mês padrão (AC4) | - | Pending |
| OPS-05 | P1: Operação — só 1:1 na trilha (AC5) | - | Pending |
| OPS-06 | P1: Operação — grupo grava N linhas (AC6) | Execute | Implementing |
| OPS-07 | P1: Operação — grupo por etapa, data e hora (AC7) | - | Pending |
| OPS-08 | P1: Operação — etapa deduzida (AC8) | Execute | Implementing |
| OPS-09 | P1: Operação — últimas 30 concluídas (AC9) | - | Pending |
| OPS-10 | P1: Operação — busca (AC10) | - | Pending |
| OPS-11 | P1: Operação — exclusão pelo nome (AC11) | - | Pending |
| OPS-12 | P1: Operação — só leitura sem permissão (AC12) | - | Pending |
| OPS-13 | P1: Operação — cadastro e Lia (AC13) | Execute | Implementing |
| OPS-14 | P1: Operação — status nulo visível (AC14) | - | Pending |
| OPS-15 | P1: Operação — status nulo preservado (AC15) | Execute | Implementing |
| OPS-16 | P1: Operação — critério sem re-render (AC16) | - | Pending |
| OPS-17 | P1: Operação — um marco aberto (AC17) | - | Pending |
| OPS-18 | P1: Operação — critérios por texto (AC18) | Execute | Implementing |
| OPS-19 | P1: Operação — régua por unidade (AC19) | - | Pending |
| OPS-20 | P1: Operação — moeda BRL (AC20) | - | Pending |
| FIN-01 | P1: Dinheiro — busca não esconde (AC1) | - | Pending |
| FIN-02 | P1: Dinheiro — vincular com 1 cadastro (AC2) | - | Pending |
| FIN-03 | P1: Dinheiro — motivo da órfã (AC3) | - | Pending |
| FIN-04 | P1: Dinheiro — descartar e restaurar (AC4) | Execute | Implementing |
| FIN-05 | P1: Dinheiro — parcela da Lia (AC5) | - | Pending |
| FIN-06 | P1: Dinheiro — prazo em SP (AC6) | - | Pending |
| NOTE-01 | P1: Notas — contenteditable (AC1) | - | Pending |
| NOTE-02 | P1: Notas — DOMPurify (AC2) | - | Pending |
| NOTE-03 | P1: Notas — sem sanitizador, só leitura (AC3) | - | Pending |
| NOTE-04 | P1: Notas — grava em 1 s (AC4) | Execute | Implementing |
| NOTE-05 | P1: Notas — grava ao sair (AC5) | - | Pending |
| NOTE-06 | P1: Notas — diretoria só lê (AC6) | - | Pending |
| NOTE-07 | P1: Notas — atalhos (AC7) | - | Pending |
| NOTE-08 | P1: Notas — link http/https (AC8) | - | Pending |
| GER-01 | P1: Gerenciais — STLSeller (AC1) | - | Pending |
| GER-02 | P1: Gerenciais — fórmula do NPS (AC2) | - | Pending |
| GER-03 | P1: Gerenciais — paginação do NPS (AC3) | - | Pending |
| GER-04 | P1: Gerenciais — filtro de mentor volta as respostas (AC4) | - | Pending |
| GER-05 | P1: Gerenciais — recorte do mentor na IA (AC5) | - | Pending |
| GER-06 | P1: Gerenciais — formato antigo da IA (AC6) | - | Pending |
| GER-07 | P1: Gerenciais — Mentores (AC7) | - | Pending |
| GER-08 | P1: Gerenciais — aviso de adesão (AC8) | - | Pending |
| UI-01 | P1: Design system — cópia literal (AC1) | Execute | Implementing |
| UI-02 | P1: Design system — sem cor crua (AC2) | Execute | Implementing |
| UI-03 | P1: Design system — Inter (AC3) | Execute | Implementing |
| UI-04 | P1: Design system — dois temas (AC4) | Execute | Implementing |
| UI-05 | P1: Design system — ConfirmDialog (AC5) | Execute | Implementing |
| UI-06 | P1: Design system — lacunas com AD (AC6) | - | Pending |
| UI-07 | P1: Design system — EmptyState e Skeleton (AC7) | Execute | Implementing |
| UI-08 | P1: Design system — casca com primitivos do DS (AC8) | Execute | Implementing |
| TEST-01 | P1: Testes — 20 grupos portados (AC1) | - | Pending |
| TEST-02 | P1: Testes — XSS em toda tela (AC2) | Execute | Implementing |
| TEST-03 | P1: Testes — HTML atribuído só nas notas (AC3) | Execute | Implementing |
| TEST-04 | P1: Testes — listas iguais às da function (AC4) | - | Pending |
| TEST-05 | P1: Testes — `hojeSP()` às 23:30 (AC5) | - | Pending |
| TEST-06 | P1: Testes — offline (AC6) | Execute | Implementing |
| GATE-01 | P1: Gates — ordem e refazer o que falhou (AC1) | - | Pending |
| GATE-02 | P1: Gates — evidência por gate (AC2) | - | Pending |
| GATE-03 | P1: Gates — evidência sem dado pessoal (AC3) | Execute | Implementing |
| GATE-04 | P1: Gates — `vercel.json` e `main` estática (AC4) | - | Pending |
| GATE-05 | P1: Gates — snapshot com sessão de admin (AC5) | Execute | Implementing |
| GATE-06 | P1: Gates — script de paridade (AC6) | - | Pending |
| GATE-07 | P1: Gates — relatório de divergência (AC7) | - | Pending |
| GATE-08 | P1: Gates — rede da diretoria (AC8) | Execute | Implementing |
| GATE-09 | P1: Gates — registro de teste (AC9) | - | Pending |
| GATE-10 | P1: Gates — matriz igual depois do UAT (AC10) | - | Pending |
| GATE-11 | P1: Gates — sem chave secreta no bundle (AC11) | - | Pending |
| GATE-12 | P1: Gates — classe da fonte no CSS (AC12) | - | Pending |
| GATE-13 | P1: Gates — merge só com go e gate na main (AC13) | - | Pending |
| GATE-14 | P1: Gates — volta em até 15 min (AC14) | - | Pending |
| GATE-15 | P1: Gates — tag e ensaio da volta (AC15) | - | Pending |
| GATE-16 | P1: Gates — congelamento do `index.html` (AC16) | - | Pending |
| CUT-01 | P2: Corte — arquivos do repo em 404 (AC1) | - | Pending |
| CUT-02 | P2: Corte — link antigo (AC2) | Execute | Implementing |
| CUT-03 | P2: Corte — um front só (AC3) | Execute | Implementing |
| CUT-04 | P2: Corte — docs atualizadas (AC4) | - | Pending |
| EDGE-01 | Edge — ficha excluída por outro admin | - | Pending |
| EDGE-02 | Edge — sessão não renova | Execute | Implementing |
| EDGE-03 | Edge — virada do dia | - | Pending |
| EDGE-04 | Edge — nota grande demais | - | Pending |
| EDGE-05 | Edge — status fora do domínio | Execute | Implementing |
| SEC-01 | P1: Segurança — navegação só na mesma origem (AC1) | Execute | Implementing |
| SEC-02 | P1: Segurança — o agente não lê dado pessoal nos gates (AC2) | - | Pending |
| SEC-03 | P1: Segurança — auditoria e cópia conferida no G2 (AC3) | Execute | Implementing |
| SEC-04 | P1: Segurança — cabeçalhos (AC4) | Execute | Implementing |
| SEC-05 | P1: Segurança — link do banco só http(s) (AC5) | - | Pending |
| SEC-06 | P1: Segurança — identidade antes de ler e escrever (AC6) | Execute | Implementing |
| SEC-07 | P1: Segurança — pnpm fixo e scripts de instalação na lista (AC7) | Execute | Implementing |
| SEC-08 | P1: Segurança — correção de segurança sem nova cópia do DS (AC8) | Execute | Implementing |

**Coverage:** 135 total, 0 mapped to tasks, 135 unmapped ⚠️ (Design e threat pass prontos; Tasks em rascunho)

---

## Success Criteria

- [ ] No UAT do preview, com as 3 contas, os contadores do painel "Precisa de atenção" e a matriz do mês corrente batem com o app antigo lidos no mesmo minuto: 0 divergências.
- [ ] G0 a G6 verdes, cada um com a evidência em `evidence/`.
- [ ] `pnpm test` cobre os 20 grupos do mapeamento §7 e roda offline.
- [ ] Depois do corte, os 5 caminhos de CUT-01 respondem 404 e um link de ficha antigo abre a ficha certa.
- [ ] Nenhum mentor ou diretor precisa de ajuda para achar uma tela que já usava (feedback do Lucas na primeira semana).

---

## Apêndice A — Métricas de paridade

Calculadas pelo app antigo e pelo novo sobre o mesmo snapshot, com a mesma data de "hoje" em America/Sao_Paulo, para cada papel que vê a métrica (admin, diretoria, mentor). Regras de cada uma: mapeamento §3.

| ID | tela | métrica |
| -- | ---- | ------- |
| PAR-01 | Dashboard | contadores dos 12 itens do painel "Precisa de atenção" |
| PAR-02 | Dashboard | ids de mentorado das listas `#risco`, `#sem-implementacao`, `#sem-subida` (com os dias), `#orfas` e `#nps-pend` |
| PAR-03 | Dashboard | os 4 números gerais |
| PAR-04 | Dashboard | ids das próximas 8 sessões, na ordem |
| PAR-05 | Dashboard | progressão: total e nível por mentorado |
| PAR-06 | Matriz | para cada mês do seletor e "Todos": por mentor, a contagem por etapa, o total 1:1, os encontros e as presenças; a linha "sem mentor" |
| PAR-07 | Matriz | ids dos quatro avisos (`dobradas`, `semData`, `semMentor`, `etapaDeduzida`) |
| PAR-08 | Mentorados | ids por filtro (todos, ativos, pausados, incompletos, contrato pendente) |
| PAR-09 | Sessões | ids por bloco 1:1 (Aguardando, Agendadas, Concluídas, Bloqueadas) e chaves dos encontros por categoria, sem foco |
| PAR-10 | Ficha | por mentorado: parcelas pagas e total, N de M 1:1 concluídas, implementação, plantões |
| PAR-11 | Financeiro | os 3 cards; ids das parcelas vencidas; ids dos 10 próximos vencimentos; motivo de cada órfã; ids das descartadas |
| PAR-12 | Rotas | por mentorado ativo, rota e marco: estado no stepper, critérios feitos e total, régua e falta |
| PAR-13 | STLSeller | nos recortes Ativos e Todos: os 5 cards, a concentração (5 maiores e outros), a contagem por status real e por chip, os ids dos 15 anúncios |
| PAR-14 | NPS | NPS e média geral e por mentor; cada célula da tabela por semana e por mês |
| PAR-15 | Experiência | NPS da mentoria, índice, clareza e índice por item |
| PAR-16 | Análise IA | ordem dos mentorados por risco; contagem por risco; média e NPS por mentor |
| PAR-17 | Mentores | por mentor: ids da carteira, 1:1 em 30 dias e total, grupo em 30 dias e total, agendadas, NPS de 30 dias, calls aceitas, última atividade |

**Exceção na comparação:** o bloco Concluídas de PAR-09 diverge por desenho (OPS-09, as 30 mais recentes). Ele é conferido pelo teste de OPS-09, não pela comparação com o app antigo.

