# Arquitetura — Central de Controle · Elite 3D

Documento técnico. Para o guia de uso, ver [README.md](README.md).

---

## Visão geral

Aplicação **Next.js 15 (App Router) com React 19 e TypeScript**, em `src/`. É uma
aplicação de cliente: toda leitura e escrita de dado sai do navegador, com a
sessão do Supabase Auth do usuário, e nenhum Server Component, rota do Next ou
middleware toca o banco (AD-007). Fora de `src/` ficam `supabase/` (migrations e
edge functions), `scripts/` (paridade com o app antigo e gates de publicação) e
`public/`. O navegador fala direto com o Postgres do Supabase via PostgREST.

```
navegador (Next.js, React)
   │  supabase-js (pacote npm, só em src/lib/data/)
   ▼
Supabase  ──  Postgres + Auth + RLS
   ▲
   │  service role
   ├── edge functions (9, em supabase/functions/)
   │     sync-google-calendar   ← pg_cron, a cada 15 min
   │     lia-webhook            ← webhook da Lia
   │     sync-stlseller         ← pg_cron, a cada 6 h
   │     nps-forms              ← n8n, a cada 6 h
   │     sync-experiencia       ← pg_cron, a cada 6 h
   │     nps-analista           ← pg_cron, diário
   │     circle-presenca        ← webhook do Circle
   │     buscar-transcricoes    ← pg_cron, diário
   │     sync-transcricoes      ← pg_cron, a cada 10 min
   └── edge function  diagnostico-api  ← projeto separado (diagnostico-elite3d)
```

**Não existe camada de servidor própria.** Não há middleware que toque o banco,
rota de API nem função de servidor no app; as únicas funções de servidor são as
edge functions acima, que rodam no Supabase. Isso tem uma consequência que
governa todo o resto: **a autorização real é o RLS do Postgres.** O `pode()` do
TypeScript serve para montar a interface, não para proteger dado — qualquer
pessoa com um login válido pode conversar com a API direto e receberá
exatamente o que as policies permitirem, independente do que a tela mostra.

### Stack

| | |
|---|---|
| Front | Next.js 15.5 (App Router), React 19, TypeScript, Tailwind 3.4. Páginas de cliente; nada é renderizado no servidor que dependa de sessão, dado ou relógio |
| Dependências | `@supabase/supabase-js`, `dompurify`, `zod`, `lucide-react`, `react-hot-toast`, `next`, `react` e `react-dom`, todas em versão exata e com `pnpm-lock.yaml` versionado. Nada é carregado de CDN |
| Design system | Cópia verificável do design system da plataforma (`src/design-system/`, `src/components/ui/`, `scripts/sync-design-system.mjs`; AD-006, AD-007, AD-008) |
| Banco / Auth | Supabase — Postgres 17, Auth por e-mail e senha |
| Automação | 7 jobs `pg_cron` + Edge Functions (Deno) + 4 workflows n8n (STLSeller, NPS, Experiência, Transcrições) + analista de IA (Claude) |
| Deploy | Vercel pela `main`, com `vercel.json` (`framework: nextjs`). Ver *Publicar e voltar* |
| Projeto Supabase | `matgynpiscyoshnjzolo` (região `sa-east-1`) |
| Testes | Vitest: `pnpm test` (offline, sem banco) e `pnpm parity` (compara com o app antigo). Nenhum lint, nenhum CI |

A chave usada no front (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, formato
`sb_publishable_…`) é **pública por desenho** e pode ficar no repositório.
`src/lib/data/config.ts` a valida contra uma lista de permissão, e o
`next.config.ts` interrompe o build e o `next dev` se a chave ou a URL não forem
as de produção. A `service_role` **não** aparece aqui — vive apenas nas
variáveis de ambiente das Edge Functions, e uma varredura de teste falha se o
texto dela entrar em `src/`.

---

## Organização do código

| Onde | Responsabilidade |
|---|---|
| `src/app/` | Rotas do App Router: `(app)/<tela>/page.tsx` para cada uma das 10 telas, `(app)/mentorado/[id]/[[...aba]]` para a ficha, `page.tsx` na raiz (a ponte do link antigo `#/…`), `layout.tsx` e `not-found.tsx` |
| `src/middleware.ts` | Só decodifica o caminho de `/mentorado/…` e manda codificação inválida ao Dashboard. Não toca o banco |
| `src/components/shell/` | A casca: login, sessão, contextos (`useSessao`, `useDados`, a `Ui` com os filtros), carga de dados, menu e o executor de escrita `useEscrita` |
| `src/components/modules/<tela>/` | Uma pasta por tela e a ficha (`ficha/`, com as 5 abas), mais `comum/` para o que as telas dividem |
| `src/components/ui/`, `src/design-system/` | Primitivos copiados do design system da plataforma. Lacuna de primitivo vai para o AD-008 |
| `src/lib/*.ts` | Regra de negócio pura, sem React nem rede: `papeis`, `endereco`, `matriz`, `painel`, `sessoes`, `financeiro`, `nps`, `ia`, `stlseller`, `datas`, `busca` e as demais. O componente só renderiza o que ela devolve |
| `src/lib/data/` | A porta única para o Supabase: `cliente`, `auth`, `config`, `leituras` (paginadas de 1.000 em 1.000), `escritas`, `esquemas` (Zod) e `paginar`. É o único lugar que importa `@supabase/supabase-js` |
| `scripts/parity/`, `scripts/gates/` | Paridade com o app antigo e as verificações de publicação (`verificar-build.mjs`, `sondar-rls.mjs`) |

O estado vive em React context (`src/components/shell/contexto.tsx`): `useSessao`
(usuário, papel e `pode`), `useDados` (a carga do usuário) e a `Ui`, com os
filtros e a seleção que sobrevivem à troca de tela. O ciclo é sempre o mesmo:
escrever pela porta (`useEscrita`, que confere a capacidade antes) → `recarregar()`.
A recarga lê tudo de novo e **só a última pedida vale** (`src/lib/recarga.ts`);
uma recarga que falha mantém a carga anterior e avisa por toast. Não há
atualização otimista nem cache.

### A tela é o endereço

Cada tela é um caminho do Next, e a ficha tem o seu. A tela e a aba são lidas do
caminho por `src/lib/endereco.ts`; trocar de tela é navegar.

| Endereço | Tela |
|---|---|
| `/dash`, `/acompanhamento`, `/mentorados`, `/sessoes`, `/rotas` | as telas de todos os papéis |
| `/mentores`, `/analise` (STLSeller), `/nps`, `/financeiro` | só com `verFinanceiro` |
| `/ia` | Análise IA, só com `verIa` |
| `/mentorado/<id>` | ficha, aba Cadastro |
| `/mentorado/<id>/financeiro`, `/sessoes`, `/notas`, `/stlseller` | ficha, nas outras quatro abas |

A raiz `/` lê o hash do link antigo (`#/mentorado/<id>/financeiro`) e leva ao
caminho novo, sem entrada nova no histórico. O caminho é montado só a partir das
formas conhecidas: nada do hash é copiado para a URL.

Três consequências que não são óbvias:

- **O endereço é público, a permissão não.** Um link da aba financeira mandado a
  um mentor abre a ficha nas sessões, e `/financeiro` abre o Dashboard para quem
  não vê financeiro (`telaPermitida` e `abaVisivel`). O recorte por papel não
  pode morar só no menu, que o link contorna.
- **A tela só desenha depois da primeira carga.** O endereço pode pedir a ficha
  antes de os dados chegarem; `dados.tsx` mostra o Skeleton até lá, senão a ficha
  de alguém que existe piscaria como "não encontrada".
- **Os submodais continuam modais.** Parcela, sessão, confirmação e exclusão
  abrem por cima da ficha, sem mudar o endereço.

Com o App Router, o caminho direto (`/mentorado/<id>`) funciona no deploy: é o
`vercel.json` com `framework: nextjs` que faz a Vercel servir o app do Next em
vez do arquivo estático.

---

## Modelo de dados

24 tabelas e 3 views no schema `public`. Nomes e valores em português; colunas de
estado são `text`, não enums.

### Núcleo

**`mentorados`** — a entidade acompanhada. `nome`, `email`, `data_fechamento`,
`ciclo`, `situacao` (`ativo` | `pausado` | `cancelado`), `contrato_status`,
`entrada_status`, `entrada_forma_pgto`, `restante_status`,
`restante_forma_pgto`, `link_drive`, `link_mapa_mental`, `link_whatsapp`,
`cancelado` (booleano legado), `pausado_em`, `retorno_previsto`.

`email` não é campo de contato: é a **chave de casamento do sync**. É o e-mail
com que o mentorado entra como convidado no evento do Google, e é por ele que a
sessão encontra a ficha. Índice **único parcial em `lower(email)`**
(`mentorados_email_unico`), porque dois donos possíveis para o mesmo endereço
fariam o sync descartar o evento em silêncio — o mesmo destino do empate por
nome. Guardar sempre normalizado, minúsculo e sem espaço: qualquer outra grafia
passa no único e mesmo assim não casa com o convite. Nulo é normal e esperado
enquanto as fichas antigas não forem preenchidas.

**`sessoes`** — `mentorado_id`, `etapa` (texto), `ordem`, `status`, `mentor`
(**texto**), `data`, `hora`, `link_meet`, `link_gravacao`, `link_anotacoes`,
`google_event_id` (único), `synced_at`, `etapa_deduzida`.

`etapa_deduzida` marca que a etapa não veio do título do evento nem de uma
pessoa: o sync a escolheu pela trilha. Ver *Automação* — a marca é o que impede
um palpite de passar por certeza dentro da matriz de fechamento.

`status` tem `CHECK` restringindo a: `Não iniciada`, `Agendada`,
`Aguardando confirmação`, `Concluída`, `Bloqueada`.

`etapa` carrega **dois tipos de sessão**, sem coluna de tipo. As 12 etapas da
trilha 1:1 (`Diagnóstico de Negócio`, `Plano de Ação`, `Checkup 1..10`) usam
`ordem` 1–12; as duas categorias de encontro coletivo
(`Plantão de Dúvida Semanal`, `Sessão de Implementação Mensal`) usam `ordem` 90
e 91. A classificação é derivada da `etapa` no front, por `ehGrupo`/`eh1a1`.
Um encontro coletivo é **N linhas, uma por participante** — ver
*Pontos de atenção*. A divisão não exigiu migration.

**`parcelas`** — `mentorado_id`, `numero` (1–12), `status` (`aberta`/`paga`),
`vencimento`, `valor`.

**`profiles`** — espelha `auth.users`. `nome`, `email`, `role` com `CHECK`
aceitando `admin`, `diretoria` e `mentor`. Não há `cs`: o atendimento usa
`admin`.

### Trilha de progresso

**`rotas`** → **`canais`** e **`marcos_definicao`** definem o catálogo;
**`mentorado_marcos`** e **`mentorado_canais`** guardam o estado por mentorado.

`rotas.modelo` é `simples` ou `rico`. O modelo simples usa
`passou`/`nao_passou`; o rico usa `NAO_INICIADO`, `EM_ANDAMENTO`, `BLOQUEADO`,
`AGUARDANDO_VALIDACAO`, `CONCLUIDO`, `NAO_APLICAVEL`, e habilita progresso em %,
critérios pendentes, bloqueios e próxima ação. As três rotas em produção são
`rico`; o caminho `simples` ficou no código para não quebrar rota criada à mão.

`mentorado_marcos` é a única tabela do núcleo com `updated_at` e
`atualizado_por`.

#### A régua do Compilado das Rotas Elite 3D

O catálogo de marcos é o documento *Compilado das Rotas Elite 3D*, aplicado pela
migration `supabase/migrations/20260916_rotas_elite3d.sql`. Três rotas —
Marketplace, Feiras e Lives, B2B / Varejo — com **seis marcos cada e os mesmos
valores**: R$ 500, 2.000, 10.000, 20.000, 50.000 e 100.000. `marcos_definicao`
carrega o conteúdo do marco (`subtitulo`, `restricao`, `alavanca`,
`pergunta_chave`, `apoios[]`, `indicadores[]`, `criterios`, `meta_valor`,
`placa`), e é ele que a trilha desenha.

**A unidade muda por rota e isso não é detalhe.** `rotas.unidade` é `mes` no
Marketplace e `acumulado` em Feiras e B2B. Marketplace é canal de fluxo contínuo
com anúncio ativo: acumular meses esconderia queda de ranqueamento. Feiras e B2B
são canais de evento e de recompra, com faturamento irregular por natureza.
Consequência prática: **no Marketplace o mês é o critério de passagem e o
acumulado é histórico; em Feiras e B2B é o oposto** — o mês é indicador de
saúde, não portão. A placa entra a partir do Marco 03 nas três rotas e, no
Marketplace, é conquista registrada e não status corrente: mês seguinte pior não
revoga (`marcos_definicao.placa`).

`marcos_definicao.criterios` é o teste de passagem, em jsonb:
`[{"grupo": null|texto, "itens": [...]}]` — uma lista de portões. Só o Marco 01
de Marketplace tem dois (*Portão A · Apto a vender* e *Portão B · Primeira
receita*); nos demais o grupo vem `null` e vira um bloco único.

`mentorado_marcos.criterios_ok` guarda o **texto** do critério marcado, não o
índice. É de propósito: reescrever ou reordenar o catálogo não pode migrar em
silêncio a marcação de "tenho embalagem" para "conheço meu CMV". `progresso` e
`criterios_pendentes` são **derivados** do que está marcado — não há campo
manual para eles discordarem da lista.

Na tela de Rotas cada marco é um painel expansível (`toggleMarco`), um aberto
por vez, porque os ids dos campos (`mk_status`, `mk_data`, `mk_acao`, `mk_bloq`)
são únicos na página e o `salvarMarco` lê por id. O painel mostra o conteúdo do
marco ao lado do teste de passagem e o faturamento do mentorado **na rota
inteira** — não no canal aberto na sanfona — comparado com `meta_valor`, pela
unidade da rota. Marcar um critério não re-renderiza: só atualiza contador e
barra (`atualizarProgressoMarco`), senão o calendário fecharia e o que ainda não
foi salvo iria embora.

Quatro pendências ficaram abertas no documento de origem e aparecem como campo
nulo, não como texto inventado: restrição e alavanca dos seis marcos de
Marketplace (a rota usa PERGUNTA-CHAVE no lugar), e restrição e alavanca dos
Marcos 01 e 03 de Feiras.

### Outras

**`faturamento_mensal`** — `mentorado_id`, `mes`, `canal_id`, `valor`,
`registrado_por`, `updated_at`. Chave de conflito: `(mentorado_id, mes, canal_id)`.

**`diagnosticos`** — `nome`, `turma`, `nivel`, `nivel_label`, `respostas`
(jsonb). RLS ligado e **sem nenhuma policy**: inacessível ao cliente por
desenho, servida pela Edge Function `diagnostico-api`. Liga a `mentorados` por
nome textual, sem FK.

**`stlseller_mentorados`**, **`stlseller_pedidos_marketplace`** e
**`stlseller_produtos_vendidos`** — foto do STLSeller gravada pelo
`sync-stlseller`, em colunas (um `jsonb` com o objeto inteiro existiu por uma
migration e foi substituído). A primeira tem uma linha por e-mail do formulário:
status no formulário, `status_real`, plano, loja e o pagamento na Lia visto pelo
STLSeller (`lia_*`). As outras duas penduram nela por `email` com `ON DELETE
CASCADE`: chave `(email, marketplace)` e `(email, marketplace, anuncio_id)`.
`total_liquido` nulo é "o marketplace não informa" (Mercado Livre), não zero.

**Sem `mentorado_id` de propósito:** o front casa pelo e-mail da ficha contra
`email` ou `email_stlflix`, então corrigir o e-mail na ficha reflete na hora,
sem esperar o próximo sync.

### Views

- **`mentorados_basic`** — `SECURITY DEFINER`. Expõe os campos não financeiros
  de `mentorados` e é o que o mentor lê, já que `mentorados` só tem policy de
  admin. **Contorna o RLS deliberadamente**; qualquer coluna adicionada aqui
  passa a ser visível a todo mentor — `email` entrou nessa conta, de propósito,
  porque a ficha mostra o campo a todos os papéis. Ao adicionar coluna, use
  `create or replace view` com o campo novo **no fim** da lista: é a única forma
  aceita pelo Postgres, e é o que preserva os grants (o `revoke` de escrita
  abaixo não pode ser refeito por engano).

  `authenticated` tem **só `SELECT`** nela, e isso é essencial. A view é
  auto-atualizável e o dono é `postgres`, num schema sem `FORCE ROW LEVEL
  SECURITY` — enquanto `insert/update/delete` estavam concedidos, qualquer
  usuário logado podia alterar, criar e apagar mentorados por ela, contornando
  `mentorados_admin_all`, e o `delete` levava o histórico de sessões junto pelo
  `ON DELETE CASCADE`. Corrigido na migration
  `revoke_write_on_mentorados_basic`. **Não reconceda escrita aqui:** é o que
  sustenta o perfil `diretoria` ser somente-leitura. O app nunca escreveu por
  essa view — todas as escritas vão para `mentorados` direto.
- **`sessoes_orfas`** — sessões com `google_event_id` preenchido que a última
  execução do sync **não confirmou**. Compara o `synced_at` da linha com o maior
  `synced_at` da tabela inteira (que é o carimbo da rodada mais recente), com 5
  minutos de tolerância. Quem ficou para trás é órfão — evento apagado ou
  renomeado. Já traz `mentorado_nome` pelo join.

  **Só olha sessões dos últimos 28 dias**, e esse recorte é o que torna a view
  útil. O sync busca a janela `hoje-30d → hoje+90d`
  (`sync-google-calendar/index.ts`), então toda sessão parava de ser confirmada
  exatamente 30 dias depois de acontecer, por envelhecer — não por sumir do
  Agenda. Sem o recorte a view acusava isso como problema: em 21/09/2026 eram 40
  linhas no painel, das quais **39 eram sessões velhas normais** e só uma era
  evento realmente apagado. O painel crescia ~1 linha/dia e ia engolir as 76
  sessões sincronizadas. Corrigido na migration
  `sessoes_orfas_so_dentro_da_janela_do_sync`. Fora da janela do sync o silêncio
  é esperado, não sintoma. São 28 dias e não 30 de propósito: a margem evita que
  a sessão pisque entrando e saindo na borda.

  **O custo:** a marcação não é permanente. Um evento apagado no dia 5 aparece no
  painel até o dia 28 e depois some sozinho, sem ninguém ter conferido. Para
  rastro permanente o sync teria que gravar a ausência explicitamente (uma
  `evento_removido_em`) em vez de deixar o `synced_at` inferir.

### Chaves de unicidade

Existem e importam, porque os `upsert` do app dependem delas:

| Tabela | Único |
|---|---|
| `parcelas` | `(mentorado_id, numero)` |
| `faturamento_mensal` | `(mentorado_id, mes, canal_id)` |
| `mentorado_marcos` | `(mentorado_id, marco_id)` |
| `mentorado_canais` | `(mentorado_id, rota_id)` |
| `marcos_definicao` | `(rota_id, ordem)` |
| `canais` | `(rota_id, nome)` |
| `rotas` | `nome`, `slug` |
| `sessoes` | `google_event_id` |

Note o que **falta**: `sessoes` não tem único em `(mentorado_id, etapa)`, e há
etapas repetidas por mentorado em produção. **Não crie esse único** — nem o
parcial: as repetições são reuniões reais em datas diferentes, e as sessões em
grupo dependem da ausência dele (um mentorado tem uma linha de `Plantão de
Dúvida Semanal` por semana). O débito 5 explica por quê.

---

## Permissões

Três papéis: `admin`, `diretoria` e `mentor`. A função `get_my_role()` (`SECURITY DEFINER`,
`STABLE`) lê `profiles.role` do usuário logado e é usada por praticamente todas
as policies.

| Tabela | admin | diretoria | mentor |
|---|---|---|---|
| `mentorados` | tudo | `SELECT` | **nada** — lê via `mentorados_basic` |
| `parcelas` | tudo | `SELECT` | nada |
| `sessoes` | tudo | `SELECT` | `SELECT` + `UPDATE`, **sem escopo** |
| `faturamento_mensal` | tudo | `SELECT` | `SELECT` + `INSERT` + `UPDATE`, sem escopo |
| `mentorado_marcos` | tudo | `SELECT` | `SELECT` + `INSERT` + `UPDATE`, sem escopo |
| `mentorado_canais` | tudo | `SELECT` | `SELECT` + `INSERT` + `UPDATE`, sem escopo |
| `rotas`, `canais`, `marcos_definicao` | escrita | leitura | leitura |
| `profiles` | lê todos | lê o próprio | lê o próprio |
| `diagnosticos` | — | — | — (só `service_role`) |
| `stlseller_*` (3 tabelas) | `SELECT` | `SELECT` | nada — tem status de pagamento e faturamento |

`diretoria` **não tem uma única policy de `INSERT`, `UPDATE` ou `DELETE`** —
em nenhuma tabela. É o que torna o perfil somente-leitura verdadeiro e não
apenas cosmético: esconder botão no front é acabamento, o limite é aqui.
Não existe papel `cs`: quem está no atendimento usa `admin`.

**"Sem escopo" quer dizer sem titularidade:** a policy checa apenas
`get_my_role() = 'mentor'`, nunca `auth.uid()`. Qualquer mentor pode ler e
escrever as sessões, o faturamento e os marcos de **qualquer** mentorado. Isso é
intencional hoje — o app mostra a lista global e mentores confirmam sessões uns
dos outros — mas é o principal débito de segurança em aberto. Ver *Débitos*.

O `UPDATE` em `profiles` é restrito por coluna: `authenticated` só pode alterar
`nome` e `email`. `role` não é atualizável pelo próprio usuário, e a policy
reforça com `WITH CHECK (id = auth.uid() AND role = get_my_role())`. Trocar
papel exige `service_role`.

Todo registro novo em `auth.users` recebe um `profiles` com `role = 'mentor'`
via trigger `handle_new_user()`. O cadastro público está desligado
(`disable_signup: true`) — se algum dia for habilitado, isso passa a criar
acesso de mentor para qualquer pessoa.

---

## Automação

### `sync-google-calendar` — Edge Function, a cada 15 min

Job `pg_cron` `sync-google-calendar-15min` (`*/15 * * * *`) chama a função via
`net.http_post`. Ela usa `service_role`, então ignora RLS.

Fluxo: renova o token do Google por refresh token → lê a agenda `primary` na
janela de −30 a +90 dias (máx. 250 eventos) → para cada evento tenta casar
**etapa** e **mentorado**; se falhar em qualquer um dos dois, ignora o evento.

- **Etapa** vem do título: `Diagnóstico` → *Diagnóstico de Negócio*,
  `Plano de Ação` → *Plano de Ação*, `Checkup N` → *Checkup N*. A `ordem` é
  derivada disso.
- **Mentorado** casa em dois passos, nesta ordem. Primeiro pelo **e-mail do
  convidado**, contra `mentorados.email` — exato, e é o caminho preferido:
  quando a ficha tem e-mail, o título do evento não precisa mais trazer o nome
  dele. Se nenhum convidado bate, cai no fallback por **palavras do nome
  (≥3 letras) presentes no título**; empate ou nenhuma correspondência descarta
  o evento, deliberado, para não atribuir errado em silêncio.

  A ordem importa: e-mail é exato e nome é heurística, então inverter faria um
  título mal escrito ganhar de um convidado identificado. O fallback por nome
  continua existindo porque a maioria das fichas ainda não tem e-mail — tirá-lo
  hoje pararia o sync dos mentorados antigos. Ele some sozinho conforme o campo
  for preenchido, e a resposta da função traz `mentoradoPorEmail`,
  `mentoradoPorNome` e `fichasComEmail` justamente para medir isso sem
  consultar o banco.

- **Etapa** vem do título (`Diagnóstico`, `Plano de Ação`, `Checkup N`). Nem o
  Calendar nem a API do Meet sabem que a reunião é o Checkup 5 — quem sabe é o
  título ou a trilha. Quando o título não diz, o sync **deduz pela trilha**:
  `deduzirEtapa` devolve a primeira das 12 etapas ainda **livre** para aquele
  mentorado, onde ocupada é *concluída*, *já presa a um evento do Calendar* ou
  *já deduzida nesta mesma rodada*. As três condições existem pelo mesmo motivo:
  sem elas, dois eventos de título livre do mesmo mentorado cairiam na mesma
  etapa e virariam duas sessões iguais — a duplicata que o passo 2 da adoção
  existe para evitar. Trilha inteira ocupada devolve `null` e o evento é
  ignorado, em vez de inventar um 13º Checkup.

  **A dedução só roda quando o mentorado veio do e-mail do convidado.** Casar
  por nome já é heurística sobre o título; deduzir em cima disso empilharia
  palpite sobre palpite, e "Reunião sobre a Ana Clara" viraria um Checkup.

  A linha nasce com `sessoes.etapa_deduzida = true` e o front a marca com a
  etiqueta *etapa deduzida*, além de um alerta no dashboard
  (`focarSessoes('etapaDeduzida')`). O campo zera quando alguém **salva a
  sessão pelo formulário** — é o ato de olhar a etapa e responder por ela.
  Confirmar a sessão não zera: confirmar é sobre o mentor e a presença, não
  sobre qual etapa era. Título sempre vence dedução, e o passo 2 da adoção
  (`manterEtapa`) não toca no marcador, senão apagaria a marca de uma dedução
  anterior sem ninguém ter olhado a etapa.

  A lista `TRILHA` da função e `ETAPAS`/`ETAPA_ORD` do front **precisam
  concordar** — se divergirem, o sync grava uma etapa que a tela não sabe
  desenhar.
- **Mentor** vem do **e-mail do convidado**, pelo mapa `EMAIL_MENTOR`. Só entra
  quem atende; CS e observadores ficam fora de propósito, senão a sessão seria
  creditada a quem apenas acompanhou. Fallback: nome ou apelido no título ou na
  descrição.

Depois grava: cria a sessão, ou atualiza a existente casada por
`google_event_id`, ou adota uma sessão órfã do mesmo mentorado e etapa que ainda
não tem evento. Sempre atualiza `synced_at`. Sessão `Agendada` cuja data já
passou vira `Aguardando confirmação`.

**O sync nunca cria sessão em grupo.** Ele exige casar etapa *e* mentorado, e as
categorias coletivas não estão no reconhecedor de título. Plantão e implementação
são sempre registrados à mão, na tela de Sessões.

Aceita `?debug=1`, que devolve uma amostra de eventos reconhecidos sem mentor
identificado — útil para descobrir e-mail faltando no mapa.

### `lia-webhook` — Edge Function, sob demanda

A Lia é o gestor de pagamentos. O fluxo é de **mão única**: nada aqui escreve
nela; a aplicação só reflete o que ela informa.

**Esta é uma das 3 funções publicadas com `verify_jwt` FALSE** (as outras duas
são `nps-forms` e `circle-presenca`, que também recebem chamada sem JWT e se
autenticam por token), e tem que ser: a Lia não faz login no Supabase e não manda JWT. Quem garante a procedência é o
header `X-Lia-Signature` — HMAC-SHA1 do **corpo cru** assinado com a
`LIA_API_KEY`. Por isso o handler lê `request.text()` antes de qualquer parse:
reserializar o JSON muda espaços e invalida a assinatura. A comparação é de
tempo constante. Sem `LIA_API_KEY` no ambiente a função **falha fechada** —
rejeita tudo com 401.

Tabelas: **`lia_cobrancas`** espelha as faturas (`bill`) e **`lia_eventos`**
registra todo webhook. As duas têm RLS: cobranças seguem o recorte de
`parcelas` (admin escreve, diretoria lê, mentor não vê), e `lia_eventos` é só
admin — `payload` guarda o webhook cru, com contato do cliente.

`lia_eventos.lia_delivery_id` é **único, e é isso que dá idempotência**: a Lia
reenvia quando não recebe 200, e reprocessar duplicaria pagamento. A reserva é
feita por `insert` — checar antes e inserir depois abriria janela de corrida. A
mesma linha é **atualizada** com o desfecho no fim; inserir outra bateria no
único e o log ficaria eternamente em `recebido`. Envio com assinatura inválida é
registrado **sem** reservar o id, para um forjado não bloquear o log do
legítimo.

`lia_cobrancas.lia_updated_at` é o carimbo que veio da Lia e serve para
descartar webhook atrasado: evento antigo não sobrescreve o novo.

**De quem é a cobrança:** primeiro por `mentorados.lia_order_id`, depois por
`mentorados.email` — por **igualdade**, nunca `ilike`, senão `_` e `%` num
endereço virariam curinga. Casando por e-mail, grava o `order_id` para as
próximas irem pelo caminho rápido. Dois mentorados com o mesmo e-mail é
ambíguo: a cobrança fica órfã (`mentorado_id` nulo) em vez de ir para a pessoa
errada.

**Não achando ninguém, o webhook CRIA o mentorado** — `nome` (só o envelope de
`order` traz `customer_name`; nos outros a ficha nasce nomeada pelo e-mail),
`email`, `lia_order_id`, `situacao` ativa e `cadastro_incompleto = true`. O
fluxo de venda é pagar primeiro e entrar na mentoria depois, então esse é o
caminho comum, não a exceção.

`mentorados.cadastro_incompleto` é a mesma mecânica de `sessoes.etapa_deduzida`:
automação marca, pessoa desmarca. O dashboard conta as marcadas e o link já leva
à tela de Mentorados com o filtro `incompletos` aplicado; `salvarMentorado`
zera o campo, mas **só quando o bloco básico está na tela** — num recorte
financeiro não houve revisão de cadastro nenhuma.

Duas condições impedem a criação: **sem e-mail** (é a chave do vínculo; sem ela
nem a próxima cobrança da mesma pessoa cairia na ficha) e **e-mail em dois
cadastros** (ambíguo — resolver a duplicidade vem antes). Nos dois casos a
cobrança fica órfã com o dado íntegro. Criação concorrente é resolvida pelo
único em `lower(email)`: quem perde a corrida lê a linha do vencedor em vez de
devolver órfão.

**A regra de refletir vive no banco, não no TypeScript.**
`lia_refletir_financeiro(uuid)` é a implementação única — entrada, restante,
formas de pagamento e as linhas de `parcelas`. O webhook a chama por RPC com
`service_role`; a aplicação a chama quando alguém vincula uma cobrança órfã.
Ela nasceu em TS e foi movida quando a aplicação passou a precisar dela:
manter uma cópia de cada lado as faria divergir na primeira vez que alguém
mexesse numa só. `SECURITY INVOKER` de propósito — pela aplicação o RLS vale, e
só admin escreve em `parcelas` e `mentorados`.

`lia_adotar_orfas(uuid)` assume as órfãs cujo e-mail bate com o do mentorado e
chama a anterior. `salvarMentorado` a dispara quando o e-mail esteve na tela:
preencher ou corrigir o endereço puxa o que estava parado, sem quem salva
precisar saber que havia algo parado.

**Cobrança órfã é a única falha silenciosa da integração.** Ela existe inteira
em `lia_cobrancas`, mas toda a tela mostra dinheiro a partir da ficha de
alguém — sem `mentorado_id` ela não aparece em lugar nenhum. Por isso o alerta
no dashboard e o painel `#cobrancas-orfas` no Financeiro, com o motivo derivado
na hora (`motivoOrfa`): guardar o motivo o faria envelhecer, já que ele muda
quando o cadastro muda. O painel **não responde à busca da tela** — órfã não
tem mentorado para casar, e sumir por causa de um texto digitado seria esconder
dinheiro. `vincularCobranca` só aparece quando existe exatamente um cadastro
com aquele e-mail: com zero não há a quem, com dois escolher seria adivinhar.

`lia_cobrancas.ignorada` é o descarte — tipicamente compra de teste, que chega
idêntica a venda real. **Marca em vez de apagar:** apagada, a linha voltaria no
próximo webhook da mesma fatura e o alerta com ela. Marcada, sai do alerta, do
painel e de `lia_refletir_financeiro`, e o webhook segue atualizando a linha sem
desmarcá-la — `salvarCobranca` não escreve nesse campo. Reversível pelo painel
de descartadas. Descartar uma cobrança **já vinculada** dispara o reflexo, para
a parcela dela sair da ficha.

**A Lia é a fonte das parcelas de quem tem cobrança lá.** `parcelas.lia_bill_id`
diz quem manda na linha: preenchido, veio da Lia e a tela não deixa editar;
nulo, foi uma pessoa. Ao refletir, as linhas manuais **daquele mentorado** são
apagadas antes do upsert — o único é `(mentorado_id, numero)`, então uma linha
manual no número 3 bloquearia a parcela 3 da Lia. Quem não tem cobrança na Lia
não é tocado: não há de onde tirar dado para substituir. A foto anterior está em
`parcelas_backup_20260917`.

`entrada_status` e `restante_status` são derivados das faturas, **exceto**
quando valem `Patrocinado` ou `Cancelou` — decisões de pessoa que a Lia não tem
como saber. Forma de pagamento só preenche campo vazio, nunca sobrescreve.

`parcelas_numero_check` foi de `1..12` para `1..60`: a trilha tinha 12 por
desenho, mas a Lia parcela no que o cliente contratar, e um plano fora da faixa
faria o webhook falhar em silêncio.

### `sync-stlseller` — Edge Function, a cada 6 h

Traz para a aba **STLSeller** da ficha o que o STLSeller sabe de cada
mentorado. Cadeia, de mão única:

```
BigQuery financial-448617.stlseller_raw        (só leitura)
   │  vw_mentorados_status_real + sellers + marketplace_orders + products
   ▼
n8n-ops · workflow "GET - SELLERS" (obqbyo0K7cPB6Ycb) · webhook GET
   │  Header Auth (X-Central-Token)
   ▼
edge function sync-stlseller ──rpc──▶ stlseller_sincronizar(payload)
                                          │  uma transação
                                          ▼
          stlseller_mentorados · stlseller_pedidos_marketplace · stlseller_produtos_vendidos
                                          ▲
                          app, tela STLSeller (admin e diretoria)
```

A **view `vw_mentorados_status_real` é a fonte da lista**: todos os status do
formulário (ATIVO, PAUSADO, CANCELADO), com o `status_real_sugerido` que ela
cruza com a Lia. Duas particularidades do nó BigQuery do n8n, tratadas no
`Assemble payload`: e-mail vem com caixa alta em algumas linhas, e **timestamp
nulo chega como o epoch** (`1969-12-31T21:00-03:00`) — sem o tratamento, a
ficha mostraria "último pedido em 1969".

**A regra de gravar vive no banco:** `stlseller_sincronizar(jsonb)` mapeia o
JSON para colunas e grava as três tabelas **numa transação só** — via PostgREST
seriam três chamadas, e uma falha no meio deixaria um mentorado com os pedidos
de uma rodada e os produtos de outra. Pedidos e produtos são a foto da rodada:
apaga e regrava. Quem sumiu da view sai, e leva os filhos pelo cascade — **mas
só depois de um payload com mentorados**: sem eles a função levanta exceção
antes de apagar qualquer coisa. `SECURITY INVOKER`, execute só para
`service_role`. A edge function só busca e entrega; sem `STLSELLER_WEBHOOK_URL`
ou `STLSELLER_WEBHOOK_TOKEN` ela falha fechada.

**Em produção desde 22/09/2026.** Job `pg_cron` `sync-stlseller-6h`
(`20 */6 * * *`, UTC — 21:20, 03:20, 09:20 e 15:20 em Brasília) chama a função
por `net.http_post` com o mesmo `Authorization` do job do Calendar, **mais
`timeout_milliseconds := 60000`**: o `pg_net` corta em 5 s por padrão e a
rodada leva ~8 s (três queries no BigQuery). O webhook do n8n exige o header
`X-Central-Token`; o valor vive só na credencial n8n
`Central Elite3D - sync-stlseller` e no secret `STLSELLER_WEBHOOK_TOKEN` da
função — trocar um exige trocar o outro.

**`safeupdate`:** o Supabase carrega essa extensão nas sessões do PostgREST, e
ela recusa `DELETE`/`UPDATE` sem `WHERE`. Rodando como `postgres` (SQL direto)
não aparece — foi assim que a primeira versão de `stlseller_sincronizar` passou
nos testes e falhou na primeira chamada pela função. Por isso os `delete ...
where true`; não "simplifique" tirando o `where`.

Forçar uma rodada agora (resposta em `net._http_response`):

```sql
do $$ begin execute (select command from cron.job where jobname = 'sync-stlseller-6h'); end $$;
```

**Tela STLSeller (`/analise`, menu lateral)** — a visão da carteira sobre as
mesmas três tabelas: bruto vendido, quanto dele foi atribuído a anúncio
(cobertura), pedidos e % de cancelados, concentração do bruto nos 5 maiores,
distribuição do `status_real`, tabela ordenável por mentorado com filtros, os
15 anúncios que mais faturam e as listas de sem venda, sem conta de seller e
e-mail não cadastrado corretamente.

**E-mail: o STLFLIX vem primeiro.** Quando o formulário traz `email_stlflix`,
ele é o preferido para achar a loja — no n8n, o `QUALIFY` das duas queries
ordena primeiro pela loja cujo e-mail é o STLFLIX, antes de plano ativo e data.
Na tela (`situacaoEmail`), o mentorado só sai da lista de cadastro incorreto se
o e-mail STLFLIX for igual ao do formulário ou **de fato encontrar a loja**
(`loja_email`); os demais ficam com o motivo: formulário sem e-mail STLFLIX,
STLFLIX que não é o da loja, ou STLFLIX sem conta de seller. O recorte padrão é **Ativos** (status do formulário); os
números do topo seguem o recorte. **Bruto vem de `stlseller_pedidos_marketplace`
e a receita por anúncio de `stlseller_produtos_vendidos`** — são fontes
diferentes de propósito, e a diferença entre elas é a venda sem anúncio
atribuído. Fechada por `verFinanceiro`, como a aba: link colado por mentor cai
no Dashboard.

**A aba não escreve nada e não compete com a ficha.** O bloco "Pagamento na
Lia, segundo o STLSeller" pode divergir das parcelas, que vêm do `lia-webhook`:
são duas leituras da mesma Lia por caminhos diferentes, e a aba diz de qual
veio. O que estiver errado se corrige na origem.

Redeploy da função, da raiz do repo:

```bash
npx supabase@latest functions deploy sync-stlseller --project-ref matgynpiscyoshnjzolo --use-api
```

### NPS — n8n a cada 6 h → edge function `nps-forms`

Traz para a tela **NPS** (`/nps`) as notas que o mentorado dá à sessão.

```
Planilha "Pesquisa de Satisfação com a Sessão - Elite 3D (respostas)"
   │  aba "Respostas NPS 2" (gid 1875301760) — A data, B mentorado, C mentor, D nota, E comentário
   ▼
n8n-ops · "[Central Elite3D] NPS - planilha -> nps-forms (6h)" (oNBtTs1TVwtsAaaf)
   │  Schedule a cada 6 h (minuto 40, America/Sao_Paulo) · service account @lucasstlflix
   │  POST, header X-NPS-Token
   ▼
edge function nps-forms ──upsert on origem_id──▶ nps_respostas ◀── tela NPS do app
```

**A aba certa não é a do link.** O `gid=274559119` que circula é a aba
"Dashboard" (só gráfico, zero célula); "Respostas NPS 2" tem **s** no nome. O nó
do Sheets aponta pelo gid 1875301760, não pelo nome.

**`nps-forms`, a tabela e a view `nps_mentores_mensal` nasceram fora do repo.**
Foram aplicadas direto no projeto em 23/09/2026 (migrations `nps_mentores` e
`nps_forms`), pensadas para um Apps Script no próprio Forms. O código da função
**está versionado** em `supabase/functions/nps-forms/`. O n8n passou a ser o
alimentador: o `NPS_FORMS_TOKEN` foi
regenerado nessa data e vive só no secret da função e na credencial n8n
`Central Elite3D - nps-forms`; um Apps Script instalado antes disso recebe 401.

**Idempotência:** a planilha não tem o id da resposta no Forms, então o
workflow manda `id = sheet:<data ISO>|<nome em minúsculas>` — estável se a
planilha for reordenada ou tiver linha apagada, ao contrário do número da
linha. A função grava `origem_id = forms:<id>`, então rodar de novo atualiza em
vez de duplicar. A data da planilha é hora de Brasília sem fuso; o workflow
anexa `-03:00`. Cabeçalho renomeado faz o nó falhar em vez de gravar vazio.

**Vínculo com a ficha:** `mentorado_id` é preenchido pela função quando o nome
digitado casa com um cadastro só (primeiro nome + duas palavras em comum). Na
tela, nome vinculado vira link para a ficha; o resto mostra `nome_informado`.

**Tela NPS:** média e NPS (% de 9–10 menos % de 0–6) geral e por mentor, tabela de média por **semana**
(segunda a domingo, no fuso de Brasília) ou **mês** com uma coluna por mentor,
e a lista de respostas, com o comentário, filtro por mentor e busca. As duas tabelas
paginam no front (10 períodos, 20 respostas); trocar filtro volta para a página 1. Fechada por
`verFinanceiro`, como o STLSeller — o RLS de `nps_respostas` só deixa admin e
diretoria lerem. A tela não escreve nada.

Forçar uma rodada agora (devolve `{recebidas, gravadas, descartadas, vinculadas}`):

```bash
curl -H "X-Central-Token: <credencial n8n 'Central Elite3D - sync-nps'>" \
  https://n8n-ops.stlflix.com/webhook/central-elite3d-nps
```

### Pesquisa de Experiência e analista de IA — `sync-experiencia` (6 h) e `nps-analista` (diário)

Desde 08/10/2026. Decisão e medição em [docs/decisions/001](docs/decisions/001-analista-de-nps-so-com-claude.md).

```
Planilha "Pesquisa de Experiência Mentoria Elite 3D" (1XqsvW…), aba única "Experiência Mentoria"
   │  ANÔNIMA: nota 0-10, satisfação geral, grade de 10 itens, clareza, 6 perguntas abertas
   ▼
n8n-ops · "[Central Elite3D] Experiência - planilha -> sync-experiencia" (oNudNeSFgwrAH8pW)
   │  webhook GET, Header Auth X-Central-Token (credencial "Central Elite3D - sync-experiencia")
   │  nó Google Drive (export xlsx, credencial @software) → Extract From File → Assemble payload
   ▼
edge function sync-experiencia ──upsert on origem_id──▶ experiencia_respostas
   ▲ pg_cron sync-experiencia-6h (45 */6 UTC)

nps_respostas + experiencia_respostas ──▶ edge function nps-analista
  + mentorado_dossies (AD-003) + presença em grupo (sessoes ordem ≥ 90) ──▶ Claude (claude-opus-5-5)
   ▲ pg_cron nps-analista-diario (0 10 UTC = 07:00 Brasília)      └──insert──▶ nps_analises
```

**Lida pelo Drive, não pelo nó Sheets.** A service account `@software`
(`lucas-prodops@n8n-ops-503317`) é editora da planilha e mesmo assim o nó Google
Sheets devolve 403 — com as quatro credenciais Google do n8n-ops. O export do
Drive em xlsx funciona. Na exportação o carimbo vem como **número de série do
Excel** em hora de Brasília; o `Assemble payload` converte e anexa `-03:00`.
Como a pesquisa é anônima, o id é só o carimbo (`sheet:<ISO>`), e grade e
perguntas abertas ficam em `jsonb` com o texto da planilha como chave — pergunta
nova no Forms entra sem migration.

**O analista só gasta quando há novidade.** `nps_analises.dados_ate` guarda o
maior `created_at` que a rodada viu; o job diário compara com o maior
`created_at` atual das duas tabelas e responde `{pulou: …}` sem chamar o Claude
se nada entrou. O upsert preserva `created_at`, então ressincronizar não conta
como novidade. Não existe modo "forçar": o job chama com a chave pública, então
qualquer um com ela pode chamar a função, e sem novidade a chamada não custa
nada. Para rodar de novo com os mesmos dados, apague a última linha de
`nps_analises`.

A rodada manda ao Claude os últimos 90 dias das duas pesquisas, as métricas já
calculadas (NPS e média geral e por mentor, índice 0–100 por item da grade),
quais respostas são novas e a análise anterior, para ele não repetir alerta.
A saída é `{resumo, alertas[], mentores[], mentorados[]}` por **structured
output** (`output_config.format`): alertas com severidade, tipo
(`mentorado`/`mentor`/`mentoria`), evidência literal e ação sugerida; uma
leitura **por mentor** e uma **por mentorado**, cada uma com `pros`, `contras`
(frases curtas com a evidência entre parênteses) e `pauta` (2 a 4 perguntas
abertas), escritas para serem debatidas com a própria pessoa; o mentorado leva
ainda risco alto/médio/baixo e ação. A leitura do mentor sai só do NPS da sessão
— a Pesquisa de Experiência é anônima e não é atribuída a ninguém. Linhas
antigas (`pontos_fortes`, `pontos_de_atencao`, `sinais`) seguem legíveis: os dois
primeiros caem em prós e contras; `sinais` é evidência neutra e aparece sob a
leitura, nunca como contra. A função recusa a
rodada se o modelo devolver um `mentorado_id` que não veio dos dados: um id
inventado viraria link para a ficha errada. `fallbacks: "default"` cobre recusa de classificador.
A chave é o secret `ANTHROPIC_API_KEY` da função, a mesma ANTHROPIC_API_KEY da plataforma-product-ops.

**Tela Análise IA** (`/ia`, com `verIa`: admin, diretoria e o recorte do mentor): três abas — **Visão geral**
(resumo e alertas, mais grave primeiro), **Por mentor** e **Por mentorado**:
cada uma é uma lista de integrantes (números calculados do NPS carregado, risco,
quantos prós e contras) e o clique abre a tela única da pessoa — leitura, prós e
contras lado a lado, pauta para a conversa e o histórico de respostas. **Tela
NPS** (`/nps`): só números, em duas abas — **NPS das sessões** e **Pesquisa de
Experiência** (NPS da mentoria, índice de experiência = média da grade,
clareza dos próximos passos, índice por item com o pior primeiro, e as
respostas abertas). **Nada vai para os
mentores**: o RLS das duas tabelas novas só deixa admin e diretoria lerem.

**Avisos das pesquisas no dashboard** (desde `INICIO_COBRANCA_NPS` = 13/10/2026,
com prazo de resposta de `PRAZO_RESPOSTA_DIAS` = 2 dias após a sessão): admin e
diretoria veem *Pesquisa de satisfação da sessão não respondida* (por mentorado,
última 1:1 concluída sem resposta vinculada com dia ≥ o da sessão) e o
totalizador anônimo da Pesquisa de Experiência. O mentor vê só a adesão
agregada, pela RPC `experiencia_adesao(p_desde, p_prazo_dias)`, quando fica
abaixo de `META_ADESAO_EXP` (70%) — ver docs/decisions/002.

**Perguntas novas da Pesquisa de Satisfação** (13/10/2026): `nps_respostas`
ganhou `clareza`, `direcionamento` e `apoio` (nulos antes disso). O workflow do
n8n acha as colunas pelo prefixo do cabeçalho ("1. Ao finalizar", "2. O
direcionamento", "3. Existe alguma"), como opcionais; o `nps-forms` grava; o
analista as usa nos prós, contras e pauta; a tela NPS e a tela da pessoa as mostram.
O código do `nps-forms` passou a morar no repo (baixado da versão publicada).

### `circle-presenca` — presença nas lives do Circle

Os plantões de dúvida e as sessões de implementação acontecem em lives do
Circle. A API admin v2 do Circle só expõe inscrição (RSVP), não comparecimento,
então a presença vem de uma **automação do Circle**: gatilho *Attended live
event* → ação *Send webhook* para
`https://matgynpiscyoshnjzolo.supabase.co/functions/v1/circle-presenca?token=<CIRCLE_WEBHOOK_TOKEN>`.
O gatilho dispara ao fim da live, uma vez por membro que esteve nela, com ou sem RSVP.

O gatilho exige **um evento específico** (só lista os futuros): é uma automação
por live. O corpo real é `{"type":"live_event_ended","data":{"community_member_id",
"event_id",…}}`, sem e-mail. A função grava o payload cru em `circle_presencas`,
acha o membro e o evento em qualquer profundidade, busca o e-mail do membro em
`community_members/{id}`,
busca nome e início do evento na API (`CIRCLE_API_KEY`), deduz a etapa pelo nome
("Plantão…"/"Sessão de Implementação…") e o mentor pelo sufixo do título, casa o
mentorado pelo **e-mail da ficha** e faz upsert em `sessoes` (status Concluída)
por `(mentorado_id, circle_event_id)`. O que não casa fica com `erro` preenchido
na linha crua, para corrigir a ficha e reprocessar. `verify_jwt` desligado; a
procedência é o `?token=`, comparado em tempo constante.

Rodar na mão (devolvem JSON):

```bash
K=sb_publishable_S7cckKfundDsqo-s_qL2-A_lgPkY9Yl
curl -X POST -H "Authorization: Bearer $K" https://matgynpiscyoshnjzolo.supabase.co/functions/v1/sync-experiencia
curl -X POST -H "Authorization: Bearer $K" https://matgynpiscyoshnjzolo.supabase.co/functions/v1/nps-analista
```

Redeploy: `npx supabase@latest functions deploy <sync-experiencia|nps-analista> --project-ref matgynpiscyoshnjzolo --use-api`.

### `buscar-transcricoes` (diária) e `sync-transcricoes` (10 min) — dossiê do mentorado

Desde 13/10/2026. Decisão e calibragem em [docs/decisions/003](docs/decisions/003-dossie-do-mentorado-a-partir-das-transcricoes.md).

```
Drive "gravações" (1CK91G…), uma pasta por call: doc "Anotações do Gemini" (notas + 📖 Transcrição)
   ▼
n8n-ops · "[Central Elite3D] Transcrições - Drive -> sync-transcricoes" (iK1jiqXLhD8JzmSV)
   │  ?desde=<ISO> lista docs alterados · ?id=<doc> exporta o texto (credencial @software)
   │  Header Auth: a mesma credencial do sync-experiencia (EXPERIENCIA_WEBHOOK_TOKEN)
   ▼
edge function buscar-transcricoes ── enfileira ──▶ transcricoes (status pendente)
   ▲ pg_cron buscar-transcricoes-diario (0 9 UTC = 06:00 Brasília)
   ▼
edge function sync-transcricoes ── ?id= de cada pendente
   │  2 por rodada, da mais antiga: grupo? → casa mentorado/sessão → triagem → Jev → Claude
   ▼
mentorado_dossies (markdown em `documento`, jsonb em `estrutura`)
   ▲ pg_cron sync-transcricoes-10min (*/10, timeout 150 s)
```

`status` em `transcricoes`: `aceita`, `rejeitada` (com `motivo`), `grupo`, `sem_vinculo`,
`erro` (tenta de novo até 3 vezes). Só calls dos últimos 30 dias entram na fila.
O `nps-analista` lê o dossiê (objetivos, pendências, pontos de atenção, última
mentoria) de cada mentorado com mentoria nos últimos 90 dias, e quem tem dossiê
entra na leitura mesmo sem nota. A presença em grupo (Circle e manual) só
enriquece quem já está na leitura: incluir quem só tinha presença levou a lista
de 10 para 42 mentorados e estourou o limite de 150 s da função. Doc editado depois de processado não volta sozinho:
volte o `status` para `pendente` à mão. Os agentes leem `mentorado_dossies.documento`.
Secrets: `JEV_API_KEY`, `TRANSCRICOES_WEBHOOK_URL`, `ANTHROPIC_API_KEY`.

### `promover_sessoes_vencidas()` — função Postgres

Job `promover-sessoes-vencidas-15min` (minutos 5, 20, 35, 50). Promove
`Agendada` → `Aguardando confirmação` quando `data + hora` já passou no fuso de
São Paulo. É a rede de segurança para quando o sync do Calendar não roda.

---

## Pontos de atenção

### As três listas de mentores precisam ficar em sincronia

Adicionar ou remover um mentor exige mexer em **três lugares**, em dois deploys
diferentes:

| Onde | O quê |
|---|---|
| `src/lib/constantes.ts` → `MENTORES` | Quem aparece nos formulários e recebe novos agendamentos |
| `src/lib/constantes.ts` → `MENTORES_HIST` | Quem saiu: some dos formulários, continua contando no histórico |
| edge function → `EMAIL_MENTOR` e `MENTORES` | E-mail → nome, mais os apelidos do fallback |

Esquecer o `EMAIL_MENTOR` faz as sessões daquele mentor entrarem sem mentor
identificado, silenciosamente.

André e Gabriella (13/10/2026) entraram em `MENTORES`, no formulário de NPS e
em `EMAIL_MENTOR`, com login de mentor. André fica **sem apelido** no
fallback por nome: há mentorado chamado André, e o título "Mentoria André
Bertozzi" creditaria a sessão ao mentor.

### A matriz do dashboard conta reunião, não linha

A tabela "Sessões concluídas por mentor" é a base do fechamento dos mentores,
então ela não conta linhas de `sessoes` — conta **reuniões**, agrupando por
`(mentorado_id, data, hora, mentor)`. O motivo é um caminho estreito do sync:

```
.eq("mentorado_id", …).eq("etapa", etapaInfo.etapa).is("google_event_id", null)
```

O sync procura a linha manual **por etapa**. Quando o título do evento no Google
nomeia uma etapa diferente da que já estava na trilha — mentor abre o convite
como "Plano de Ação" e a sessão registrada na ficha era "Checkup 5" — ele não
acha nada e **insere outra linha**. Sobram duas sessões concluídas no mesmo
mentorado, data, hora e mentor: uma reunião, dois registros, contada em dobro no
fechamento. Em 08/09/2026 havia 5 casos assim em produção, inflando quatro
mentores (Evaldo +2, Diovani +1, Sergio +1, Petare +1).

Ao colapsar o slot fica a linha com `google_event_id` **nulo** — a registrada na
mão, cuja etapa uma pessoa escolheu olhando a trilha, em vez da herdada do
título que alguém digitou no Calendar. A tabela mostra quantas colapsou.

Repetir a mesma etapa **em datas diferentes** é outro caso e não é colapsado:
são reuniões distintas, ainda que a etapa esteja errada. É o que acontece quando
o mentor reaproveita um convite recorrente titulado "Plano de Ação" para o que é
um checkup. Isso não distorce o fechamento — distorce a trilha.

### Os alertas do dashboard apontam linhas, não telas

Cada alerta calcula os ids das linhas que contou (`focoDoAviso`, em
`src/lib/matriz.ts`) e os guarda na `Ui` como `foco`, com o título e a dica. O
clique vai para Sessões e zera os filtros de tipo e mentor.

`foco` recorta Sessões para esses ids, **antes** dos filtros de mentor, tipo e
busca (`recortarSessoes`, `src/lib/sessoes.ts`) — um filtro ativo não deveria
conseguir esconder a linha que o alerta aponta. A casca descarta o foco ao sair
da tela de Sessões: ele pertence ao alerta que trouxe a pessoa até ali.

Sob foco, "Concluídas" não corta em 30. O alerta pode apontar uma sessão de
meses atrás, e o corte esconderia exatamente a linha que a pessoa veio conferir.

As etiquetas nas linhas (`contada`, `ignorada · mesma reunião`, `sem data`,
`sem mentor`) saem de `reunioesConcluidas1a1()` — o **mesmo** helper que o
dashboard usa para contar. Duas implementações da regra divergiriam, e é ela que
decide o fechamento dos mentores.

### `Aguardando confirmação` não tinha bloco na tela de Sessões

Corrigido em 08/09/2026. Os blocos eram Agendadas, Concluídas e Bloqueadas, então
as 27 sessões nesse estado só eram alcançáveis abrindo a ficha de cada mentorado,
uma por uma — e o alerta "aguardando confirmação sem mentor definido" mandava
para uma tela onde elas não apareciam. `Não iniciada` (42 linhas) continua sem
bloco de propósito: são as vagas da trilha que ninguém tocou, não pendência.

### `sessoes.mentor` é texto, não referência

Não há FK para `profiles`. Isso é o que impede qualquer isolamento por mentor,
e o que torna a carga por mentor aproximada em vez de exata.

A matriz do dashboard normaliza o nome antes de agrupar (sem acento, espaço
colapsado, caixa baixa) e reexibe pela grafia canônica de `TODOS_MENTORES`.
Em 08/09/2026 os dados estavam limpos — uma grafia por mentor, nenhum espaço
sobrando. A normalização é o que impede uma grafia nova, vinda do sync ou de
edição direta no banco, de partir a contagem de um mentor em duas linhas sem
ninguém perceber.

Existe um caminho para corrigir: o `EMAIL_MENTOR` da edge function já mapeia
e-mail → nome, e `profiles` também tem e-mail. Dá para fazer o backfill de um
`mentor_id` com precisão, em vez de casar nomes por aproximação.

### Encontro em grupo é N linhas, não uma

`sessoes.mentorado_id` é `NOT NULL`, então não existe linha de sessão sem
mentorado. Um encontro coletivo é gravado como **uma presença por
participante**, e a interface reagrupa com `agruparGrupo()` pela chave
`etapa + data + hora`. O que isso implica ao mexer aqui:

- **Não existe id de encontro.** Mudar data ou hora de parte dos participantes
  parte o encontro em dois, porque a chave muda.
- **Toda contagem de sessão precisa declarar o tipo.** a barra de
  progresso, a legenda da trilha na ficha e o alerta de +30 dias usam `sessoes1a1De`; voltar a somar
  todas as sessões infla a trilha de 12 sessões.
- **O alerta de +30 dias ignora encontro em grupo de propósito.** Se contasse,
  quem só aparece no plantão nunca acenderia o alerta — que é justamente o caso
  que ele existe para pegar.
- **Não há handler inline.** O React monta cada botão com a função na mão e o
  encontro em grupo é referenciado pela chave `etapa + data + hora`; nenhum
  texto de coluna vira atributo de evento.

### Capacidades, não `isAdmin`

O front decide o que mostrar por `pode("capacidade")`, sobre o mapa
`CAPACIDADES` de `src/lib/papeis.ts`. Antes era um booleano `isAdmin`, que
significava duas coisas ao mesmo tempo — *vê o financeiro* e *pode escrever*. O
papel `diretoria` separa as duas, e um booleano não expressa isso.

As capacidades são `verFinanceiro`, `verIa`, `criarMentorado`,
`editarMentorado`, `editarFinanceiro`, `escreverSessao`, `criarSessao`,
`escreverRotas`, `escreverNotas` e `excluir`. Cada papel é uma lista, o que deixa
o recorte inteiro legível de uma vez: `diretoria` tem `verFinanceiro` e `verIa`
e nenhuma de escrita; `mentor` tem `escreverSessao`, `escreverRotas`,
`escreverNotas` e `verIa` — **não** tem `criarSessao`, então o mentor edita e
confirma sessão mas não cria.

Ao acrescentar botão de escrita, envolva em `pode(...)` e marque o botão com
`data-escrita="W.."`. O executor `useEscrita` recusa a escrita sem a capacidade,
e a suíte tem testes por papel (o controle some para quem não tem a capacidade).
Ainda assim, isso é interface: quem impede a escrita é o RLS, e o
`scripts/gates/sondar-rls.mjs` confere que ele recusa o que cada papel não pode.

### Excluir mentorado é cascata, e o RLS não recusa — filtra

As cinco filhas de `mentorados` são `ON DELETE CASCADE`: `sessoes`, `parcelas`,
`mentorado_marcos`, `mentorado_canais` e `faturamento_mensal`. Ainda em cascata
pelo mesmo `delete`, caem as notas, as transcrições e os dossiês do mentorado, e
as cobranças da Lia ficam **órfãs** (sem o mentorado ao qual ligar). Um `delete`
na ficha apaga o histórico inteiro da pessoa, e as sessões concluídas que saem
mudam o fechamento dos mentores daquele mês. Nada disso apareceria num
`confirm()` do navegador, então a confirmação é um `ConfirmDialog` próprio, na aba
Cadastro: `resumoExclusao` (`src/lib/mentorados.ts`) conta o que vai embora, o
texto diz o efeito no fechamento, e o botão só destrava com o nome digitado. A
comparação passa por `chaveNome` — sem caixa, sem acento, sem espaço sobrando: o
campo existe para provar intenção, não para cobrar ortografia.

O `delete` vai com `.select("id")` de propósito. **O RLS do Postgres não recusa
um delete sem permissão: ele filtra as linhas.** Sem policy aplicável a resposta
volta sem erro e com zero linhas, e um `if(error)` sozinho declararia sucesso —
a ficha reapareceria na recarga seguinte, sem explicação. Hoje `admin` tem
`mentorados_admin_all` (`ALL`), então o caminho feliz funciona; a checagem de
linhas é o que mantém a mensagem honesta se a policy mudar. A porta
(`src/lib/data/escritas.ts`) trata zero linhas como falha em **toda** escrita.

### A busca de mentorado é por tela

`Ui.filtro` guarda um termo por tela (`q` em Mentorados, `qDash`, `qSessoes`,
`qFin`, `qRotas`, `qAnalise`, `qNps`). São separados de propósito: um termo
compartilhado faria quem buscou um nome em Sessões abrir o Financeiro já
recortado por ele, sem ter pedido. A comparação é `casaBusca(termo, ...campos)`
(`src/lib/busca.ts`) — sem caixa, sem acento e por partes, a mesma em todas as
telas.

A busca recorta listas, nunca os contadores: cards, alertas do dashboard e o
subtítulo de cada tela continuam somando a operação inteira. Onde a busca esvazia
uma lista que existia, a tela diz quantos itens ficaram de fora em vez de mostrar
o vazio padrão — o vazio faria parecer que o dado sumiu.

Nos encontros em grupo o filtro é aplicado **depois** de `agruparGrupo`: filtrar
linha a linha deixaria o encontro com um participante só, e a coluna
*Participantes* passaria a mentir sobre quem esteve na sala.

### Datas são texto `AAAA-MM-DD`, e "hoje" é do cliente

O campo de data e o de mês são os componentes do design system, e o valor que
sai deles é o texto `AAAA-MM-DD` (ou `AAAA-MM`) que o banco guarda. A escrita
recebe a data de quem chama; "hoje" nunca fica dentro da porta.

### `cancelado` e `situacao` são a mesma informação

Redundância mantida em sincronia pelo trigger `sync_cancelado_situacao()`, que
também limpa `pausado_em` e `retorno_previsto` quando a situação sai de
`pausado`. O código lê por `situacaoDe()`, que usa `situacao` e cai no booleano
como fallback. Ao mexer aqui, mexa nos dois.

### Fuso horário

`hojeSP()` (`src/lib/datas.ts`) usa `toLocaleDateString("sv-SE", {timeZone:"America/Sao_Paulo"})`
para sair no formato `YYYY-MM-DD` já no fuso da operação, e é calculado **na hora
do uso**: o `HOJE` do app antigo era fixado no carregamento, e com a aba aberta
de um dia para o outro todo prazo ficava um dia atrás. Já houve bug aqui:
`toISOString()` devolve UTC e entre 21h e meia-noite em Brasília o dia virava,
adiantando vencimentos e "próximas sessões". **Não troque por `toISOString()`.**

### O React escapa; HTML só entra no editor de notas, sanitizado

As telas são componentes React, que escapam todo texto interpolado. Já houve XSS
armazenado no app antigo (colunas de texto interpoladas cruas em `innerHTML`), e
o `CHECK` em `sessoes.status` fecha só um dos veículos: as outras colunas seguem
sendo texto livre. Por isso:

- **HTML inserido só no editor de notas**, e só passando por `sanitizarNota(`
  (DOMPurify, `src/lib/notas.ts`). Uma varredura de teste (`src/test/varreduras.test.ts`)
  reprova qualquer outro ponto que insira HTML.
- Um teste renderiza as telas com payload de XSS nos nomes e confere o texto
  escapado (`&lt;img`) em vez de ausente, para não confundir escape com dado
  descartado (`src/test/xss.test.tsx`).
- Os nomes das categorias coletivas vêm da constante `ETAPAS_GRUPO`, não do
  banco.

### As dependências vêm do npm, em versão exata

`@supabase/supabase-js` e `dompurify` ficam fixados em versão exata, com
`pnpm-lock.yaml` e `pnpm install --frozen-lockfile` no deploy. Nada é carregado
de outra origem, e a `Content-Security-Policy` do `next.config.ts` só libera
`connect-src` para o próprio site e o Supabase de produção. A varredura
`STACK-08` falha se uma origem externa aparecer.

---

## Rodar

Requisitos: Node 24 (use o `nvm`: `nvm use default`) e `pnpm` 9.9.0 (o
`packageManager` do `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:3000
```

Sem variável de ambiente: a URL e a chave publicável de produção são o padrão
(`src/lib/data/config.ts`). `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (veja `.env.example`) só existem para
trocar de projeto, e o `next.config.ts` recusa qualquer valor que não seja o de
produção. O login funciona normalmente contra o Supabase de produção —
**atenção: é o banco real, não um ambiente de teste.** Não existe projeto de
staging hoje.

## Testar

```bash
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest; sem rede e sem banco
pnpm parity              # paridade com o app antigo, fora do pnpm test
```

`pnpm test` roda `src/**/*.test.{ts,tsx}` e `scripts/**/*.test.{ts,mjs}` no
`node`, sem browser. O que está coberto — deliberadamente, o que já quebrou aqui
ou quebraria calado:

- **Regra de negócio** em `src/lib/*.test.ts`: o dashboard e seus alertas, a
  matriz de fechamento, sessões 1:1 e em grupo, financeiro, NPS, Análise IA,
  STLSeller, datas e moeda.
- **Telas e casca**, renderizadas com fixtures (`src/test/fixtures.ts`): o que
  cada papel vê, a ligação de cada botão com a regra e a escrita certas, o payload
  de cada escrita, e o escape de HTML com payload de XSS.
- **Permissões por papel**: `diretoria` não recebe controle de escrita em
  nenhuma tela, e o mentor não vê Financeiro.
- **Varreduras de texto** (`src/test/varreduras.test.ts`): `supabase-js` só em
  `src/lib/data/`, sem `service_role`, sem origem externa, sem `window.confirm`,
  sem cor fora dos tokens.
- **A porta de dados** (`src/lib/data/`): schemas Zod, paginação e o tratamento de
  zero linhas como falha.
- **Os scripts de gate** (`scripts/**/*.test.*`), sem rede.

O que **não** está coberto, e por isso não substitui uma passada no browser:
layout, CSS, evento real, e qualquer coisa que dependa de estar logado.

`pnpm parity` compara os números do app antigo (o `index.html` do merge-base,
lido por `git show`) com os do novo, sobre um snapshot de produção. **O snapshot
vive fora do repositório**, em `~/.central-elite3d-paridade/` (ou no caminho de
`PARIDADE_SNAPSHOT`), porque tem nome, e-mail, nota e financeiro: nunca o copie
para o repo nem o cole em evidência. Quem o gera é o dono, num terminal dele
(`pnpm parity:snapshot`), com a senha pedida sem eco. A saída da paridade lista
só `métrica | chave | tipo`, sem valor; os valores ficam num arquivo 0600 na
pasta do snapshot.

Verificações de publicação, depois do build:

```bash
pnpm build
node scripts/gates/verificar-build.mjs                     # sem sb_secret_, sem JWT não anônimo, classe da fonte no CSS
node --import ./scripts/gates/alias.mjs scripts/gates/sondar-rls.mjs   # G3.14: o RLS recusa o que cada papel não pode
```

O segundo script pede, sem eco, o e-mail e a senha de uma conta de UAT
(diretoria ou mentor) e mexe só no registro de teste.

## Publicar e voltar

**Publicar.** A Vercel publica pela `main`, no mesmo projeto e domínio de antes
(`central-elite3d.vercel.app`). O `vercel.json` da raiz (`framework: nextjs`,
`pnpm install --frozen-lockfile`, `pnpm build`) diz à Vercel que o repositório é
um app Next.js e não um site estático. Não há CI: rode `pnpm typecheck`,
`pnpm test` e `pnpm build` antes do merge e confira a tela depois do deploy.

**Voltar.** Se algo der errado depois do corte, o Lucas desfaz o merge:

```bash
git revert -m 1 <merge>     # e push na main
```

O revert devolve a `main` ao que ela era antes do corte: sem `vercel.json` e com
o `index.html` na raiz, a Vercel volta a publicar um site estático. Um deploy
estático serve **todo arquivo do repositório** (`/supabase/…`, `/docs/…`,
`/.specs/…`), então o commit da volta leva um **`.vercelignore` que publica só
`index.html` e `favicon.png`**. O ensaio da volta (G4.3) publica, como preview,
uma branch descartável a partir da `main` com esse `.vercelignore`, e confere o
app antigo respondendo e os arquivos do repositório dando 404. A alternativa, sem
commit, é o "Instant Rollback" do dono do projeto na Vercel. O alvo é o app
antigo respondendo em até 15 minutos depois do gatilho (login falha num papel,
papel vendo dado fora do recorte, divergência na paridade ao vivo, escrita que
não grava, erro no console, tela sem estilo).

Alterações de banco são migrations em `supabase/migrations/` (16 hoje); o núcleo
do schema, anterior a elas, **não** está versionado. As duas mais recentes são
`20261013_experiencia_adesao.sql` e `20261013_transcricoes_e_dossies.sql`.

### As edge functions são versionadas aqui; o deploy é manual

As 9 funções vivem em `supabase/functions/<nome>/index.ts`. **O push não as
publica:** a Vercel serve só o app, e as funções rodam no Supabase. Para
publicar uma, da raiz do repo (exemplo com `sync-google-calendar`):

```bash
npx supabase@latest login
npx supabase@latest functions deploy sync-google-calendar --project-ref matgynpiscyoshnjzolo --use-api
```

Docker não é necessário (a CLI cai para deploy via API; `--use-api` força).
`--project-ref` dispensa o `supabase link`. O `verify_jwt = true` das 6 funções que exigem JWT está
fixado em `supabase/config.toml` de propósito: `sync-google-calendar` escreve em
`sessoes` com a `service_role` key, e um deploy que a virasse para `false` a
deixaria aberta a qualquer chamada sem token.

**Ao mexer numa função, confira se o arquivo do repo está à frente do que roda:**
`get_edge_function` pelo MCP devolve o código publicado.

---

## Débitos conhecidos

Em ordem aproximada de retorno sobre esforço.

1. **Escopo de titularidade nas policies de mentor.** Depende de criar
   `mentor_id` com FK em `sessoes` e fazer o backfill. Hoje qualquer mentor lê e
   escreve tudo.

   Relacionado, e independente do escopo: **não há tela para atribuir papel.**
   `handle_new_user()` cria todo usuário como `mentor`, e `profiles_update_own`
   tem `WITH CHECK (role = get_my_role())` — ninguém muda papel pela aplicação,
   só `service_role`. Com dois papéis isso passava; com três, e com o CS usando
   `admin`, cada admissão é um `UPDATE` manual, e no intervalo a pessoa fica com
   acesso de mentor sem nenhum aviso na tela.
2. **`sessoes.mentor` como FK** em vez de texto livre. Destrava o item 1, o
   filtro "meus mentorados" e a carga confiável por mentor.
3. **A suíte não cobre o browser, e nada roda em CI.** O `pnpm test` roda no
   `node`: cobre regra, telas renderizadas, escape de HTML e permissões por
   papel, mas não layout, CSS nem evento real, e só roda quando alguém o chama.
4. **Sem histórico nem autoria** em `mentorados` e `sessoes` — nem `updated_at`,
   nem quem alterou. Impossível auditar mudanças.
5. **~~`unique (mentorado_id, etapa)`~~ — não faça.** Este débito estava
   errado e fica registrado para não voltar. A ideia era um único parcial na
   trilha 1:1 (`where ordem < 90`) contra as etapas duplicadas por mentorado.
   Os dados mostram por que não serve: em 08/09/2026 havia 11 pares
   `(mentorado_id, etapa)` repetidos e **nenhum era linha duplicada** — eram
   reuniões distintas, em datas distintas, cada uma com seu `google_event_id`,
   porque o mentor reaproveita um convite titulado "Plano de Ação" para o que é
   um checkup. Criar o único exigiria **apagar registro de reunião que
   aconteceu** (subnotificando o fechamento de quem a conduziu) e faria o
   `insert` do sync falhar calado a cada novo caso. O problema é de rótulo, não
   de duplicidade: corrige-se no título do evento e na etapa da linha, não com
   restrição de banco. Para a contagem, ver *A matriz do dashboard conta
   reunião, não linha*. As demais tabelas têm suas chaves de unicidade em ordem.
6. **Colunas de estado sem `CHECK`** — `ciclo`, `contrato_status`,
   `entrada_status`, `restante_status`. Há registros com valor de *situação*
   gravado na coluna de *ciclo*.
7. **Índice em `sessoes.data`.** É o único faltando que se usa de fato — a coluna
   ordena e filtra as três telas de agenda. No resto o banco é bem indexado
   (`sessoes` tem índices em `mentorado_id`, `status`, `google_event_id` e um
   dedicado à view de órfãs; `parcelas`, `faturamento_mensal` e
   `mentorado_marcos` têm os seus). Com o volume atual não é gargalo real.
8. **Listas de mentores em três lugares** (acima). O certo é derivar de
   `profiles`.
9. **Features construídas e não alimentadas:** `parcelas.valor` vazio,
   `faturamento_mensal` e `mentorado_marcos` quase sem uso, `mentorado_canais`
   vazia. Ou se resolve a origem do dado, ou se remove a feature.
10. **Sem ambiente de staging.** O `pnpm test` é offline, mas rodar o app, a
    paridade e os gates é contra produção.
