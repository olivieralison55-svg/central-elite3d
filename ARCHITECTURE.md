# Arquitetura — Central de Controle · Elite 3D

Documento técnico. Para o guia de uso, ver [README.md](README.md).

---

## Visão geral

Aplicação de página única em **HTML e JavaScript puros, num único arquivo**
(`index.html`, ~1.870 linhas). Sem framework, sem build, sem `package.json`.
O único outro código versionado é `tests/`, que roda no Node sem dependência.
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
o resto: **a autorização real é o RLS do Postgres.** O `pode()` do JavaScript
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
| Testes | `tests/` — 132 asserções em Node puro, sem dependência. Nenhum lint |

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
| `BUSCA POR MENTORADO` | `casaBusca`/`buscaField`/`setBusca` e `btnNovoMentorado`, repetidos nas cinco telas |
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

Cada alerta publica em `FOCO_ALERTA` os ids das linhas que ele contou, e o link
chama `focarSessoes(<nome do alerta>)` — **o nome, nunca o id**. Passar id por
handler inline seria furo de escape: `esc()` não protege dentro de `onclick`,
porque `&#39;` volta a ser `'` no parse de JS. É a mesma razão pela qual
`openGrupo` recebe um índice de `GRUPO_REG`.

`foco` recorta `renderSessoes` para esses ids, **antes** dos filtros de tipo e
mentor — um filtro ativo não deveria conseguir esconder a linha que o alerta
aponta, e por isso `focarSessoes` também os zera. `setView` descarta o foco ao
sair da tela: ele pertence ao alerta que trouxe a pessoa até ali.

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

### Capacidades, não `isAdmin`

O front decide o que mostrar por `pode("capacidade")`, sobre o mapa
`CAPACIDADES` no início do script. Antes era um booleano `isAdmin`, que
significava duas coisas ao mesmo tempo — *vê o financeiro* e *pode escrever*. O
papel `diretoria` separa as duas, e um booleano não expressa isso.

As capacidades são `verFinanceiro`, `criarMentorado`, `editarMentorado`,
`editarFinanceiro`, `escreverSessao`, `criarSessao`, `escreverRotas` e
`excluir`. Cada papel é uma lista de uma linha, o que deixa o recorte inteiro
legível de uma vez — `diretoria: ["verFinanceiro"]` diz tudo.

Ao acrescentar botão de escrita, envolva em `pode(...)`. A suíte tem uma
varredura que reprova qualquer handler de escrita aparecendo nas telas de
`diretoria`, com controle negativo em `admin` para garantir que o detector não
está passando vazio — então esquecer o `pode(...)` falha o teste, não a produção.
Ainda assim, isso é interface: quem impede a escrita é o RLS.

### Excluir mentorado é cascata, e o RLS não recusa — filtra

As cinco filhas de `mentorados` são `ON DELETE CASCADE`: `sessoes`, `parcelas`,
`mentorado_marcos`, `mentorado_canais` e `faturamento_mensal`. Um `delete` na
ficha apaga o histórico inteiro da pessoa, e as sessões concluídas que saem
mudam o fechamento dos mentores daquele mês. Nada disso apareceria num
`confirm()` do navegador, então a confirmação é um modal próprio
(`openExcluirMentorado`): `resumoExclusao(id)` conta o que vai embora, o texto
diz o efeito no fechamento, e o botão só destrava com o nome digitado
(`conferirNomeExclusao`). A comparação passa por `chaveNome` — sem caixa, sem
acento, sem espaço sobrando: o campo existe para provar intenção, não para
cobrar ortografia.

O `delete` vai com `.select("id")` de propósito. **O RLS do Postgres não recusa
um delete sem permissão: ele filtra as linhas.** Sem policy aplicável a resposta
volta sem erro e com zero linhas, e um `if(error)` sozinho declararia sucesso —
a ficha reapareceria no `loadAll()` seguinte, sem explicação. Hoje `admin` tem
`mentorados_admin_all` (`ALL`), então o caminho feliz funciona; a checagem de
`data.length` é o que mantém a mensagem honesta se a policy mudar. Vale para
qualquer `delete`/`update` novo que precise afirmar que escreveu.

### A busca de mentorado é por tela, e o input precisa do id

`filtro` guarda um termo por tela (`q` em Mentorados, `qDash`, `qSessoes`,
`qFin`, `qRotas`). São separados de propósito: um termo compartilhado faria quem
buscou um nome em Sessões abrir o Financeiro já recortado por ele, sem ter
pedido. A comparação é `casaBusca(termo, ...campos)` — sem caixa, sem acento e
por partes, a mesma em todas as telas.

O campo sai de `buscaField(campo, placeholder)`, que dá ao input o id
`busca_<campo>`. **O id não é decoração**: cada tecla dispara `setBusca`, que
re-renderiza a tela inteira por `innerHTML` e recria o input; é pelo id que ele é
reencontrado para devolver o foco e a posição do cursor. Um campo de busca novo
deve usar esse helper — um `<input>` solto perde o teclado a cada letra.

A busca recorta listas, nunca os contadores: cards, alertas do dashboard e o
subtítulo de cada tela continuam somando a operação inteira. Onde a busca esvazia
uma lista que existia, a tela diz quantos itens ficaram de fora em vez de mostrar
o vazio padrão — o vazio faria parecer que o dado sumiu.

Nos encontros em grupo o filtro é aplicado **depois** de `agruparGrupo`: filtrar
linha a linha deixaria o encontro com um participante só, e a coluna
*Participantes* passaria a mentir sobre quem esteve na sala.

A lista de participantes do modal de grupo é a exceção que não re-renderiza:
`filtrarParticipantes` esconde por atributo `hidden`, porque as marcações vivem
só no DOM e um re-render perderia quem já tinha sido selecionado. Por isso existe
a regra `[hidden]{display:none!important}` — o `display:flex` de `.chk` ganharia
do atributo por especificidade.

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

## Testes

```bash
node tests/testes.mjs
```

Sem dependência, sem instalar nada, sem tocar o banco. Sai com código 1 se algo
falhar, então serve em hook de pre-push ou CI.

`tests/ambiente.mjs` extrai o `<script>` inline do `index.html`, executa num
escopo controlado com stubs mínimos de browser, e guarda o `innerHTML` atribuído
a cada seletor. `carregarApp()` devolve uma instância nova por chamada — o estado
do app vive no closure do `new Function`, então dois papéis não se contaminam.
As escritas no Supabase são capturadas em vez de enviadas, o que permite afirmar
sobre o payload: é assim que se verifica que um encontro em grupo grava uma linha
por participante, com a mesma etapa, data e mentor.

O que está coberto — deliberadamente, o que já quebrou aqui ou quebraria calado:

- **Escape de HTML** em toda tela e modal, com payload de XSS armazenado num nome
  de mentorado. O critério é ausência de `<img` cru **mais** presença de
  `&lt;img`: provar só a ausência não distingue escape de dado descartado no
  caminho.
- **`diretoria` não recebe handler de escrita** em nenhuma tela ou modal, com
  controle negativo em `admin` provando que a varredura acha quando existe.
- **Nenhum texto de coluna dentro de `onclick`** — encontro em grupo referenciado
  por índice.
- **Permissões por papel:** o que mentor não vê (Financeiro, alertas financeiros,
  registrar sessão em grupo) e o que vê (confirmar presença).
- **Separação 1:1 x grupo:** classificação por etapa, agrupamento por
  etapa+data+hora, e as contagens que precisam ficar 1:1 (barra de progresso,
  legenda da trilha).
- **Formato de data e de moeda**, incluindo o eixo do gráfico e o contrato do
  campo de data (o `input hidden` com o id de antes).

O que **não** está coberto, e por isso não substitui uma passada no browser:
layout, CSS, evento real, posicionamento do popover do calendário, e qualquer
coisa que dependa de estar logado.

## Deploy

Push para `main` → a Vercel publica automaticamente em
`central-elite3d.vercel.app`. Sem etapa de build, sem CI, sem verificação
automática. Vale conferir a tela depois de cada deploy.

Alterações de banco não estão versionadas neste repositório: são aplicadas como
migrations no projeto Supabase. As duas mais recentes são
`harden_profiles_role_privilege_escalation` e `constrain_sessoes_status_domain`.

### A edge function é versionada aqui; o deploy é manual

`supabase/functions/sync-google-calendar/index.ts` passou a viver no repo em
08/09/2026 — antes existia só no Supabase, sem histórico nem diff. **O push não
a publica:** a Vercel serve só o `index.html`, e a função roda no Supabase. Para
publicar, da raiz do repo:

```bash
npx supabase@latest login
npx supabase@latest functions deploy sync-google-calendar --project-ref matgynpiscyoshnjzolo --use-api
```

Docker não é necessário (a CLI cai para deploy via API; `--use-api` força).
`--project-ref` dispensa o `supabase link`. O `verify_jwt = true` está fixado em
`supabase/config.toml` de propósito: a função escreve em `sessoes` com a
`service_role` key, e um deploy que o virasse para `false` a deixaria aberta a
qualquer chamada sem token.

**Ao mexer nela, confira se o arquivo do repo está à frente do que roda:**
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
3. **A suíte não cobre os alertas nem o browser.** `tests/` cobre escape de HTML,
   permissões por papel e a separação de sessões, mas o cálculo dos alertas do
   dashboard (parada há +30 dias, órfãs do Calendar, aguardando confirmação) só é
   verificado por "renderizou sem lixo" — não há asserção sobre quem deveria
   entrar em cada lista. Nada roda em browser, nada roda em CI.
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
10. **Sem ambiente de staging.** Todo teste é contra produção.
