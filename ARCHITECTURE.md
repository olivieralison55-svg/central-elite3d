# Arquitetura — Central de Controle · Elite 3D

Documento técnico. Para o guia de uso, ver [README.md](README.md).

---

## Visão geral

Aplicação de página única em **HTML e JavaScript puros, num único arquivo**
(`index.html`, ~1.870 linhas). Sem framework, sem build, sem `package.json`.
O navegador fala direto com o Postgres do Supabase via PostgREST.

```
navegador (index.html)
   │  supabase-js (CDN)
   ▼
Supabase  ──  Postgres + Auth + RLS
   ▲
   │  service role
   ├── edge function  sync-google-calendar   ← pg_cron, a cada 15 min
   └── edge function  diagnostico-api        ← projeto separado (diagnostico-elite3d)
```

**Não existe camada de servidor própria.** Não há middleware, rota de API nem
função de servidor neste repositório. Isso tem uma consequência que governa todo
o resto: **a autorização real é o RLS do Postgres.** O `isAdmin` do JavaScript
serve para montar a interface, não para proteger dado — qualquer pessoa com um
login válido pode conversar com a API direto e receberá exatamente o que as
policies permitirem, independente do que a tela mostra.

### Stack

| | |
|---|---|
| Front | HTML + CSS + JS sem framework, arquivo único |
| Dependências | `@supabase/supabase-js@2` e `Chart.js@4.4.1`, ambas por CDN |
| Banco / Auth | Supabase — Postgres 17, Auth por e-mail e senha |
| Automação | 2 jobs `pg_cron` + 2 Edge Functions (Deno) |
| Deploy | Vercel, automático no push para `main`. Sem etapa de build |
| Projeto Supabase | `matgynpiscyoshnjzolo` (região `sa-east-1`) |
| Testes / lint | Nenhum |

A chave usada no front (`SUPABASE_KEY`, formato `sb_publishable_…`) é **pública
por desenho** e pode ficar no repositório. A `service_role` **não** aparece aqui
— vive apenas nas variáveis de ambiente das Edge Functions.

---

## Organização do `index.html`

Três blocos: `<style>` (tokens do design system e componentes), o HTML da casca
(tela de login, shell, navegação, modal, toast) e o `<script>` inline dividido em
seções marcadas por comentário:

| Seção | Responsabilidade |
|---|---|
| `CONFIG` | Cliente Supabase, defaults do Chart.js, faixas de faturamento, listas de mentores e etapas, estado global |
| `AUTH` | `boot`, `doLogin`, `afterLogin`, `doLogout` |
| `DATA` | `loadAll` — carrega tudo de uma vez, com escopo por papel |
| `HELPERS` | `esc`, formatadores de data e moeda, `pill*`, `progBar`, `situacaoDe` |
| `SESSÕES EM GRUPO` | `agruparGrupo`, `statusGrupo`, `resumoStatusGrupo` e o registro `GRUPO_REG` |
| `CAMPO DE DATA` | `dateField`/`monthField` e o popover `dp*`, usados por todo campo de data |
| `ORDENAÇÃO GENÉRICA` | `toggleSort`/`applySort`, reaproveitados por todas as tabelas |
| `RENDER ROUTER` | `setView` e `render`, que despacham para a view atual |
| `DASHBOARD` … `ROTAS / MARCOS` | As cinco telas |
| `FICHA DO MENTORADO` | Modal principal, em três modos: `completo`, `sessoes`, `financeiro` |
| `SESSÃO (form)`, `NOVO MENTORADO` | Modais de escrita |
| grupo (dentro de `SESSÕES`) | `openGrupo`/`confirmarGrupo` e `openSessaoGrupo`/`criarSessaoGrupo` |

Todo o estado vive em variáveis de módulo (`M`, `P`, `S`, `ROTAS`, `MARCOS`,
`MM`, `CANAIS_DB`, `MC`, `FAT`, `ORFAS`, `view`, `filtro`, `myRole`, mais
`GRUPO_REG`, `grupoAberto` e `dpState`). O ciclo é
sempre o mesmo: escrever no banco → `loadAll()` → `render()`. Não há atualização
otimista nem cache.

---

## Modelo de dados

11 tabelas e 2 views no schema `public`. Nomes e valores em português; colunas de
estado são `text`, não enums.

### Núcleo

**`mentorados`** — a entidade acompanhada. `nome`, `data_fechamento`, `ciclo`,
`situacao` (`ativo` | `pausado` | `cancelado`), `contrato_status`,
`entrada_status`, `entrada_forma_pgto`, `restante_status`,
`restante_forma_pgto`, `link_drive`, `link_mapa_mental`, `link_whatsapp`,
`cancelado` (booleano legado), `pausado_em`, `retorno_previsto`.

**`sessoes`** — `mentorado_id`, `etapa` (texto), `ordem`, `status`, `mentor`
(**texto**), `data`, `hora`, `link_meet`, `link_gravacao`, `link_anotacoes`,
`google_event_id` (único), `synced_at`.

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
aceitando apenas `admin` e `mentor`.

### Trilha de progresso

**`rotas`** → **`canais`** e **`marcos_definicao`** definem o catálogo;
**`mentorado_marcos`** e **`mentorado_canais`** guardam o estado por mentorado.

`rotas.modelo` é `simples` ou `rico`. O modelo simples usa
`passou`/`nao_passou`; o rico usa `NAO_INICIADO`, `EM_ANDAMENTO`, `BLOQUEADO`,
`AGUARDANDO_VALIDACAO`, `CONCLUIDO`, `NAO_APLICAVEL`, e habilita progresso em %,
critérios pendentes, bloqueios e próxima ação.

`mentorado_marcos` é a única tabela do núcleo com `updated_at` e
`atualizado_por`.

### Outras

**`faturamento_mensal`** — `mentorado_id`, `mes`, `canal_id`, `valor`,
`registrado_por`, `updated_at`. Chave de conflito: `(mentorado_id, mes, canal_id)`.

**`diagnosticos`** — `nome`, `turma`, `nivel`, `nivel_label`, `respostas`
(jsonb). RLS ligado e **sem nenhuma policy**: inacessível ao cliente por
desenho, servida pela Edge Function `diagnostico-api`. Liga a `mentorados` por
nome textual, sem FK.

### Views

- **`mentorados_basic`** — `SECURITY DEFINER`. Expõe os campos não financeiros
  de `mentorados` e é o que o mentor lê, já que `mentorados` só tem policy de
  admin. **Contorna o RLS deliberadamente**; qualquer coluna adicionada aqui
  passa a ser visível a todo mentor.
- **`sessoes_orfas`** — sessões com `google_event_id` preenchido que a última
  execução do sync **não confirmou**. A regra é esperta: compara o `synced_at` da
  linha com o maior `synced_at` da tabela inteira (que é o carimbo da rodada mais
  recente), com 5 minutos de tolerância. Quem ficou para trás é órfão — evento
  apagado, renomeado ou fora da janela. Já traz `mentorado_nome` pelo join.

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

Note o que **falta**: `sessoes` não tem único em `(mentorado_id, etapa)`, e já
houve etapas duplicadas por mentorado em produção. **Cuidado:** as sessões em
grupo passaram a depender dessa ausência — um mentorado tem uma linha de
`Plantão de Dúvida Semanal` por semana. Criar o único ingênuo quebraria a
feature; ver o débito 5.

---

## Permissões

Dois papéis: `admin` e `mentor`. A função `get_my_role()` (`SECURITY DEFINER`,
`STABLE`) lê `profiles.role` do usuário logado e é usada por praticamente todas
as policies.

| Tabela | admin | mentor |
|---|---|---|
| `mentorados` | tudo | **nada** — lê via `mentorados_basic` |
| `parcelas` | tudo | nada |
| `sessoes` | tudo | `SELECT` + `UPDATE`, **sem escopo** |
| `faturamento_mensal` | tudo | `SELECT` + `INSERT` + `UPDATE`, sem escopo |
| `mentorado_marcos` | tudo | `SELECT` + `INSERT` + `UPDATE`, sem escopo |
| `mentorado_canais` | tudo | `SELECT` + `INSERT` + `UPDATE`, sem escopo |
| `rotas`, `canais`, `marcos_definicao` | escrita | leitura |
| `profiles` | lê todos | lê o próprio |
| `diagnosticos` | — | — (só `service_role`) |

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
- **Mentorado** casa por palavras do nome (≥3 letras) presentes no título.
  Empate ou nenhuma correspondência descarta o evento — deliberado, para não
  atribuir errado em silêncio.
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
| `index.html` → `MENTORES` | Quem aparece nos formulários e recebe novos agendamentos |
| `index.html` → `MENTORES_HIST` | Quem saiu: some dos formulários, continua contando no histórico |
| edge function → `EMAIL_MENTOR` e `MENTORES` | E-mail → nome, mais os apelidos do fallback |

Esquecer o `EMAIL_MENTOR` faz as sessões daquele mentor entrarem sem mentor
identificado, silenciosamente.

### `sessoes.mentor` é texto, não referência

Não há FK para `profiles`. Isso é o que impede qualquer isolamento por mentor,
e o que torna a carga por mentor aproximada em vez de exata.

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
- **Toda contagem de sessão precisa declarar o tipo.** `progBar`, a legenda da
  trilha na ficha e o alerta de +30 dias usam `sessoes1a1De`; voltar a somar
  `S` inteiro infla a trilha de 12 sessões.
- **O alerta de +30 dias ignora encontro em grupo de propósito.** Se contasse,
  quem só aparece no plantão nunca acenderia o alerta — que é justamente o caso
  que ele existe para pegar.
- **`openGrupo` recebe um índice de `GRUPO_REG`, não a etapa.** É deliberado:
  `esc()` não protege dentro de handler inline, porque `&#39;` volta a ser `'`
  quando o atributo é parseado como JavaScript. Interpolar texto de coluna num
  `onclick` reabriria o XSS que a passada de `esc()` fechou.

### O campo de data guarda o valor num input hidden

`dateField(id, ...)` monta um `<input type="hidden">` com o **mesmo id** que o
`<input type="date">` tinha antes, mais um botão que abre o calendário. É o que
mantém todo `$("#id").value` funcionando sem tocar nos `salvar*`, e o evento
`change` continua sendo disparado como no input nativo. Ao acrescentar um campo
de data novo, use `dateField`/`monthField` — um `<input type="date">` solto faz
o sistema voltar a ter dois comportamentos diferentes.

O popover é filho de `<body>` com `position:fixed`, de propósito: dentro do modal
ele seria cortado pelo `overflow-y` do `.overlay`. O `z-index` precisa ficar
acima de 50, que é o do overlay.

### `cancelado` e `situacao` são a mesma informação

Redundância mantida em sincronia pelo trigger `sync_cancelado_situacao()`, que
também limpa `pausado_em` e `retorno_previsto` quando a situação sai de
`pausado`. O código lê por `situacaoDe()`, que usa `situacao` e cai no booleano
como fallback. Ao mexer aqui, mexa nos dois.

### Fuso horário

`HOJE` usa `toLocaleDateString("sv-SE", {timeZone:"America/Sao_Paulo"})` para
sair no formato `YYYY-MM-DD` já no fuso da operação. Já houve bug aqui:
`toISOString()` devolve UTC e entre 21h e meia-noite em Brasília o dia virava,
adiantando vencimentos e "próximas sessões". **Não troque por `toISOString()`.**

### Escape de HTML é obrigatório na renderização

As telas são montadas por template string e `innerHTML`. Colunas de texto do
banco **precisam** passar por `esc()` — inclusive dentro de atributos. Já houve
XSS armazenado aqui: valores de `sessoes.status`, `sessoes.etapa`,
`contrato_status`, `criterios_pendentes` e outros eram interpolados crus, e quem
conseguia escrever nessas colunas executava script no navegador de quem abrisse
a tela, inclusive admin.

O `CHECK` em `sessoes.status` fecha um dos veículos, mas as outras colunas
seguem sendo texto livre. **Ao adicionar qualquer campo novo na tela, use
`esc()`.**

Duas notas sobre a divisão de sessões: os nomes das categorias coletivas vêm da
constante `ETAPAS_GRUPO`, não do banco, mas passam por `esc()` de todo jeito; e
nenhum texto de coluna é interpolado dentro de `onclick` — encontro em grupo é
referenciado por índice. Ver *Encontro em grupo é N linhas* acima.

### Dependências vêm de CDN sem verificação de integridade

`supabase-js` está fixado em major flutuante (`@2`) e nenhuma das duas tags tem
`integrity`. Um release ruim ou um CDN comprometido executa com acesso total ao
banco no navegador de todos. Fixar versão exata e adicionar SRI é barato.

---

## Rodando localmente

Não há build. Mas **não abra o arquivo por `file://`**: as telas são montadas por
JavaScript e ambos os containers começam com `display:none`, então a página fica
em branco. Sirva por HTTP:

```bash
python -m http.server 8080
```

E acesse `http://localhost:8080`. O login funciona normalmente contra o Supabase
de produção — **atenção: é o banco real, não um ambiente de teste.** Não existe
projeto de staging hoje.

## Deploy

Push para `main` → a Vercel publica automaticamente em
`central-elite3d.vercel.app`. Sem etapa de build, sem CI, sem verificação
automática. Vale conferir a tela depois de cada deploy.

Alterações de banco não estão versionadas neste repositório: são aplicadas como
migrations no projeto Supabase. As duas mais recentes são
`harden_profiles_role_privilege_escalation` e `constrain_sessoes_status_domain`.

---

## Débitos conhecidos

Em ordem aproximada de retorno sobre esforço.

1. **Escopo de titularidade nas policies de mentor.** Depende de criar
   `mentor_id` com FK em `sessoes` e fazer o backfill. Hoje qualquer mentor lê e
   escreve tudo.
2. **`sessoes.mentor` como FK** em vez de texto livre. Destrava o item 1, o
   filtro "meus mentorados" e a carga confiável por mentor.
3. **Nenhum teste.** O mínimo útil: escape de HTML, permissões por papel, e o
   cálculo dos alertas.
4. **Sem histórico nem autoria** em `mentorados` e `sessoes` — nem `updated_at`,
   nem quem alterou. Impossível auditar mudanças.
5. **`unique (mentorado_id, etapa)`** não existe em `sessoes`; já houve etapas
   duplicadas por mentorado, o que distorce contagem de progresso. O único tem
   de ser **parcial**, restrito à trilha 1:1 (`where ordem < 90`): encontro em
   grupo é uma linha por participante por data e repete a etapa de propósito.
   As demais tabelas têm suas chaves de unicidade em ordem.
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
10. **Sem ambiente de staging.** Todo teste é contra produção.
