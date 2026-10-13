# Mapeamento do central-elite3d para a migração a Next.js

- **Status**: insumo da spec `.specs/features/migracao-nextjs/spec.md`
- **Date**: 2026-10-13
- **Base medida**: `main@2aea455`. `index.html` com 3.785 linhas, 9 edge functions, 16 migrations, `tests/` com 497 asserções verdes.
- **Método**: leitura do código com linha, `curl` no deploy, `node tests/testes.mjs`. O que não foi conferido diz "não verificado".

Este documento descreve **o sistema como ele é hoje**, inclusive os defeitos. A spec decide o que muda. O
*porquê* de cada regra continua no `ARCHITECTURE.md`, com as divergências da §12. Referência curta:
`:NNNN` é `index.html:NNNN`.

1. Veredito
2. Stack e execução hoje
3. Telas e features
4. Dados: leituras (R) e escritas (W)
5. Permissões
6. Backend, automação e integrações
7. Testes
8. Design system: o que cobre e o que falta
9. O que pode quebrar na migração
10. Defeitos que já existem
11. Plataforma: fora do escopo (AD-006)
12. Documentação desatualizada

---

## 1. Veredito

- **A migração é só do front.** Nenhuma integração depende da origem da página (§6.4). Calendar, Lia,
  Circle, n8n, Claude e Jev falam com o Supabase. O front não chama nenhuma edge function.
- **A autorização real é o RLS**, amarrado ao `auth.uid()` da sessão do Supabase Auth deste projeto.
  Levar leitura ou escrita para o servidor com `service_role` apaga o recorte por papel. É o risco nº 1.
- **O deploy de hoje publica o repositório inteiro.** `ARCHITECTURE.md`, `docs/decisions/`, `tests/`,
  `supabase/config.toml` e o código das edge functions respondem 200 em `central-elite3d.vercel.app`
  (conferido com `curl` em 13/10/2026). O Next só serve `public/` e as rotas.
- **O design system cobre a maior parte da interface.** As lacunas são: data única e mês, combobox de
  busca, trilha de 12 segmentos, stepper de marcos, paginação, e o `DataTable` não ordena nem tem clique de
  linha (§8).
- **13 leituras de lista não paginam** e cortam em 1.000 linhas sem aviso. A paginação que existe ordena por
  coluna que empata (§4.1). `parcelas` e `faturamento_mensal` são as primeiras a passar do teto.
- **O `tests/` não porta.** Ele executa o `<script>` inline do `index.html`. As 497 asserções protegem 20
  comportamentos que precisam ser reescritos em vitest (§7).
- **O projeto Vercel não está no time do Lucas.** O repo é `github.com/olivieralison55-svg/central-elite3d`.
  Trocar o preset de framework para Next.js é ação do dono do projeto.

---

## 2. Stack e execução hoje

| item | hoje | fonte |
|---|---|---|
| Front | `index.html` único: `<style>` (16–467), casca HTML (471–526), `<script>` inline (529–3785) | — |
| Dependências | supabase-js `@2` (o CDN resolve hoje para **2.117.3**), Chart.js 4.4.1, DOMPurify 3.2.6. Todas por CDN, síncronas, sem `integrity`. Se o supabase-js não carregar, o script inteiro morre | `:12–14`, `:532` |
| Fonte e tema | Manrope 400–800. Só tema escuro, acento verde-limão `#B9FF46`, corpo com peso 600 | `:11`, `:16–68` |
| Banco e Auth | Supabase `matgynpiscyoshnjzolo` (sa-east-1). Auth por e-mail e senha, cadastro público desligado | ARCHITECTURE.md |
| Cliente | `supabase.createClient(URL, KEY)` sem opções. Sessão no `localStorage` (padrão da lib). URL e chave publicável fixas no código | `:530–532` |
| Deploy | Vercel, o push na `main` publica sem build | ARCHITECTURE.md |
| Ambiente | sem staging: local e produção usam o mesmo banco | ARCHITECTURE.md:1061 |
| Testes | `node tests/testes.mjs`, sem dependência, fora de CI | §7 |
| Variáveis | `.env.local` com `SUPABASE_URL`, `SUPABASE_KEY` e `CIRCLE_API_KEY`. Nada no repo as lê. **Não há `.gitignore`**: o arquivo só fica fora do git pelo ignore global desta máquina | — |

### 2.1 Organização do script

| seção | linhas | conteúdo |
|---|---|---|
| CONFIG | 529–671 | cliente, defaults do Chart.js, constantes de domínio, `CAPACIDADES`, estado global |
| AUTH | 672–720 | `boot`, `afterLogin`, `doLogin`, `doLogout` |
| DATA | 721–812 | `paginado`, `loadAll` (20 consultas em paralelo), seletores |
| HELPERS | 813–970 | moeda, data, pílulas, parcela, prazo, situação, `esc`, `normalizaEmail`, `linkOr` |
| SESSÕES EM GRUPO | 971–1008 | `agruparGrupo`, `statusGrupo`, `GRUPO_REG` |
| CAMPO DE DATA | 1009–1197 | `dateField`/`monthField` e o popover `dp*`, com listeners globais |
| ORDENAÇÃO | 1198–1230 | `toggleSort`/`applySort` |
| BUSCA | 1231–1343 | `casaBusca`, `setBusca` (redesenha a tela a cada tecla), combobox de Rotas |
| ROTEADOR | 1344–1466 | `lerEndereco`/`aplicarEndereco`/`irPara`/`render`, foco dos alertas, `reunioesConcluidas1a1` |
| telas | 1467–3081 | Dashboard, Mentorados, Sessões, Financeiro, Rotas, STLSeller, NPS, Análise IA, Mentores |
| FICHA | 3082–3595 | 5 abas, Lia, parcelas |
| modais | 3596–3785 | sessão, exclusão, novo mentorado; `boot()` na última linha |

O estado vive em ~40 variáveis de módulo (`M`, `P`, `S`, `ROTAS`, `MARCOS`, `MM`, `FAT`, `COBRANCAS`, `NPS`,
`ANALISE`, `filtro`, `foco`, `sortState`, `fichaId`…). O ciclo é sempre: escrever no banco → `loadAll()` →
`render()` por `innerHTML`. Há 25 `innerHTML`, 90 `onclick=` inline, 22 outros `on*=` e 57 funções
penduradas em `window`.

### 2.2 Constantes que são contrato

| constante | valor | linha | quem mais depende |
|---|---|---|---|
| `MENTORES` | Luan, Sergio, Diovani, Petare, Michelle, André, Gabriella | 582 | `EMAIL_MENTOR`/`MENTORES` do `sync-google-calendar`, formulário do NPS |
| `MENTORES_HIST` | Israel, Evaldo | 583 | histórico da matriz |
| `ETAPAS` | Diagnóstico de Negócio, Plano de Ação, Checkup 1 a 10 | 585 | `TRILHA` do `sync-google-calendar` |
| `ETAPAS_GRUPO` | Plantão de Dúvida Semanal, Sessão de Implementação Mensal | 588 | `circle-presenca`, `experiencia_adesao()` (literal no SQL), `nps-analista` (ordem ≥ 90) |
| `ETAPA_ORD` | 1–12; grupo 90 e 91; fallback 99 | 597–600 | sync do Calendar, Circle |
| `S_STATUS` | Não iniciada, Agendada, Aguardando confirmação, Concluída, Bloqueada | 603 | `CHECK` de `sessoes.status`, `promover_sessoes_vencidas()` |
| `HOJE` | `toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"})`, **calculado uma vez** no carregamento | 606 | todo prazo |
| `NIVEIS` | Diamante ≥ 100.000, Platina ≥ 50.000, Ouro ≥ 20.000, Prata ≥ 10.000, Bronze ≥ 1, Iniciante ≥ 0 | 561–568 | Dashboard |
| `INICIO_COBRANCA_NPS`, `PRAZO_RESPOSTA_DIAS`, `META_ADESAO_EXP` | 2026-10-13, 2, 0.7 | 807, 809, 631 | rpc `experiencia_adesao`, AD-002 |
| `NOTA_TAGS` | 22 tags permitidas nas notas | 3350 | AD-004 |
| `CAPACIDADES` | §5.1 | 662–668 | testes |

---

## 3. Telas e features

O endereço é o hash. Trocar de tela é trocar o `location.hash`; `aplicarEndereco` aplica a guarda e chama
`render`. Nada é desenhado antes do primeiro `loadAll` (`dadosProntos`).

| endereço | tela | guarda | sem permissão |
|---|---|---|---|
| `#/dash`, vazio ou desconhecido | Dashboard | sessão | — |
| `#/acompanhamento` | Dashboard sem números gerais, progressão e detalhe | sessão | — |
| `#/mentorados` | Mentorados | sessão | — |
| `#/sessoes` | Sessões (agenda e grupo) | sessão | — |
| `#/rotas` | Rotas e marcos | sessão | — |
| `#/mentores` | Mentores | `verFinanceiro` | vai para `#/dash` |
| `#/analise` (menu "STLSeller") | STLSeller | `verFinanceiro` | `#/dash` |
| `#/nps` | NPS | `verFinanceiro` | `#/dash` |
| `#/ia` (menu "Análise IA") | Análise IA | `verIa` (os 3 papéis) | `#/dash` |
| `#/financeiro` | Financeiro | `verFinanceiro` | `#/dash` |
| `#/mentorado/<id>[/<aba>]` | Ficha. Aba ∈ cadastro, financeiro, sessoes, notas, stlseller; `completo` e `basico` levam a cadastro | sessão | aba financeira sem `verFinanceiro` desenha `sessoes` sem reescrever a URL; id inexistente mostra "Ficha não encontrada" |

**Os links de ficha já circulam** (WhatsApp, README:250–253). Mudar o formato do endereço exige
redirecionamento no cliente, porque o hash não chega ao servidor.

### 3.1 Dashboard e Acompanhamento (`renderDash`, 1474)

**Painel "Precisa de atenção"** (1657–1708). Os contadores ignoram a busca.

| item | quem vê | quem entra | link |
|---|---|---|---|
| Contratos pendentes | admin, diretoria | ativo com `contrato_status ≠ "Assinado"` | — |
| Parcelas vencidas em aberto | admin, diretoria | `status ≠ "paga"` e `vencimento < HOJE`, mentorado ativo | Financeiro |
| Criados pela Lia sem cadastro completo | todos | `cadastro_incompleto` e situação ≠ cancelado | Mentorados, filtro `incompletos` |
| Sem sessão há +30 dias | todos | ativo **sem nenhuma** 1:1 "Agendada" (de qualquer data). Referência: última 1:1 Concluída com data, senão `data_fechamento`. Entra se `(HOJE − ref) > 30 dias` | âncora `#risco` |
| Sem subir de marco há +30 dias | todos | ativo com contrato "Assinado". Referência: última linha de `mentorado_marcos` CONCLUIDO ou `passou` (data do marco ou `updated_at`), senão fechamento. Entra se `floor(dias) > 30` | `#sem-subida` |
| Sem sessão de implementação | todos | ativo sem "Sessão de Implementação Mensal" Concluída | `#sem-implementacao` |
| Aguardando confirmação | todos, se > 0 | **linhas** de `sessoes` (1:1 e grupo) "Aguardando confirmação" | Sessões |
| Sem evento no Google Agenda | todos, se > 0 | linhas de `sessoes_orfas` | `#orfas` |
| Cobranças da Lia sem mentorado | admin, diretoria, se > 0 | sem `mentorado_id`, status ≠ `canceled`, não ignorada | Financeiro |
| Pesquisa da sessão não respondida | admin, diretoria | ativo cuja última 1:1 Concluída com data em [`INICIO_COBRANCA_NPS`, HOJE − 2 dias] não tem NPS vinculado com dia (SP) ≥ o da sessão | `#nps-pend` |
| Pesquisa de Experiência não respondida | admin, diretoria | `max(0, ativos com 1:1 Concluída no período − respostas no período)`, anônimo | — |
| Poucas respostas na Experiência | só mentor | `respostas / mentorados_com_sessao < 0,7` (rpc `experiencia_adesao`), com denominador > 0 | link do Forms |

**Matriz mentor × etapa, a base do fechamento dos mentores** (1537–1601):
- **Conta reunião, não linha.** `reunioesConcluidas1a1` (1445) agrupa as 1:1 Concluídas por
  `mentorado_id|data|hora|mentor`, com o mentor como foi gravado. Sem data, cada linha é uma reunião. No par
  fica a linha com `google_event_id` nulo (a registrada à mão); empate pelo menor `id`.
- O mentor é normalizado para agrupar (NFD sem acento, espaços colapsados, minúsculas) e exibido pela grafia
  de `TODOS_MENTORES`. Quem não está em `MENTORES` ganha a pílula "fora do projeto". A linha "Sem mentor
  identificado" fica no fim.
- Colunas: etapas de **todas** as 1:1, de qualquer status, por `ETAPA_ORD`. Depois, total 1:1 e Grupo
  (encontros, com as presenças no `title`).
- Mês: seletor. Padrão: o mês corrente se tiver reunião, senão o mais recente com reunião, senão "Todos".
- Rodapé com 4 avisos que focam linhas em Sessões (`FOCO_ALERTA`, pelo **nome** do alerta): reuniões em duas
  etapas (as duas linhas do par), concluídas sem data, aguardando sem mentor, etapa deduzida pelo sync.

**Outros blocos:** números gerais (ativos, pausados e cancelados; 1:1 concluídas **por linha**; agendadas;
encontros); progressão por faturamento (`nivelDe`, barra até o próximo nível); próximas 8 sessões (1:1 e
grupo "Agendada" com data ≥ HOJE); listas de órfãs, risco, sem implementação, sem subida, NPS pendente.

**Escrita:** nenhuma.

### 3.2 Mentorados (`renderMentorados`, 1803)

- Filtros (`filtro.statusFin`): todos (inclui cancelados), ativos, pausados, incompletos (inclui cancelados),
  contrato pendente (só quem vê financeiro). A busca por nome vem depois do filtro.
- Colunas: Mentorado (situação e "cadastro incompleto"), Fechamento, Contrato (só `verFinanceiro`), Sessões
  (trilha de 12 segmentos; ordena pelo nº de 1:1 concluídas). Não ativos com opacidade reduzida.
- O mentor lê `mentorados_basic`, que não tem `contrato_status` nem `cadastro_incompleto`. Para ele,
  "incompletos" e "Sem subir de marco" saem sempre vazios.
- **Escrita:** nenhuma. O botão "+ Novo mentorado" abre o W14.

### 3.3 Sessões (`renderSessoes`, 1856)

- Recortes nesta ordem: foco do alerta (ids) → mentor (texto exato, ou "sem mentor") → tipo (1:1 ou grupo)
  → busca. Na 1:1 a busca é por linha (nome, etapa, mentor e data em 4 formatos). No grupo ela vem depois de
  agrupar, sobre todos os participantes.
- Blocos 1:1: Aguardando confirmação, Agendadas, Concluídas (últimas 30; sem corte sob foco), Bloqueadas.
  "Não iniciada" não tem bloco: são as vagas da trilha.
- Marcas por linha: contada, ignorada · mesma reunião, sem data, sem mentor, etapa deduzida. Saem do mesmo
  helper da matriz.
- **Encontro em grupo = N linhas, uma por participante**, reagrupadas por `etapa|data|hora`. O mentor fica
  fora da chave e o encontro herda o primeiro mentor e o primeiro link não nulos. O `onclick` leva o índice
  em `GRUPO_REG`, nunca texto de coluna.
- **Escritas:** confirmar encontro (W01) e registrar encontro (W02). Pela ficha: editar, criar, confirmar e
  excluir sessão (W03–W05).

### 3.4 Ficha do mentorado (`renderFicha`, 3188)

Topo comum a todas as abas: fechamento, parcelas pagas (só `verFinanceiro`), N de M 1:1 concluídas,
implementação feita ou pendente, nº de plantões. "+ Nova sessão" só com `criarSessao`, na aba Sessões.

| aba | quem vê | lê | escreve |
|---|---|---|---|
| Cadastro | todos; campos editáveis só com `editarMentorado` | nome, fechamento, e-mail, 3 links, situação, pausa e retorno | W11 (salva, zera `cadastro_incompleto` e chama a rpc `lia_adotar_orfas`), W12 (situação), W13 (excluir) |
| Financeiro | admin, diretoria | contrato, entrada, restante e formas; parcelas (Lia ou manuais) | W11 (status), W18–W21 (parcelas) |
| Sessões | todos | trilha 1:1 por etapa; grupo por data desc | W03–W05. O mentor edita e confirma; não cria nem exclui |
| Notas | todos; editam admin e mentor | `mentorado_notas` ao abrir a aba | W10 |
| STLSeller | admin, diretoria | `stlseller_*`, casando o e-mail da ficha com `email` ou `email_stlflix` | nenhuma |

- Parcela com `lia_bill_id` veio da Lia e não é editável. "Adicionar parcela" some se **qualquer** parcela
  do mentorado vier da Lia.
- **Não existe aba de dossiê nem de transcrições.** `mentorado_dossies` não é lido pelo front.
  `transcricoes` só alimenta a tela Mentores (4 colunas).
- As cobranças da Lia não aparecem na ficha. Vincular, descartar e restaurar ficam no Financeiro.

**Notas (AD-004).** `contenteditable` + `execCommand`, sem biblioteca de editor. Barra: H1–H3, parágrafo,
negrito, itálico, sublinhado, tachado, código, listas, checklist, citação, divisor e link (`prompt()`, só
http/https). Atalhos no início do bloco seguidos de espaço: `#`, `##`, `###`, `-`, `*`, `1.`, `>`, `[]`;
três crases + Enter viram bloco de código; `---` + Enter vira divisor. O HTML passa pelo DOMPurify com as 22
tags e os atributos `href`/`class` ao abrir, ao colar e ao salvar. Salva 1 s depois da última tecla (upsert
por `mentorado_id`). Quem salva por último vence.

### 3.5 Modais de escrita

| modal | campos | validação | grava |
|---|---|---|---|
| Sessão | etapa (1:1, grupo, registro atual), status (padrão Agendada), mentor (`MENTORES` + o atual), data, hora, 3 links | **nenhuma** | W03 (zera `etapa_deduzida`); W05 (excluir, `confirm()`) |
| Confirmar sessão | quem atendeu | mentor obrigatório | W04 (não zera `etapa_deduzida`) |
| Encontro em grupo | presenças, quem atendeu | mentor obrigatório | W01 |
| Nova sessão em grupo | categoria, status, mentor, data, hora, Meet, gravação, participantes (busca, "selecionar visíveis", "limpar") | ≥ 1 participante | W02 (N linhas) |
| Parcela | número, vencimento, valor (máscara BRL), status | número ≥ 1 e único no mentorado | W20; W21 (`confirm()`) |
| Excluir mentorado | resumo do que some, nome digitado | `chaveNome` (sem caixa, acento nem espaço extra), conferido de novo no clique | W13 |
| Novo mentorado | nome, e-mail, fechamento (HOJE), entrada (padrão Pago), forma, contrato (Ainda não), restante (Ainda não) | nome obrigatório; e-mail normalizado; e-mail duplicado tem mensagem própria | W14 |

Todos reaproveitam o mesmo `#modalBox`. Não há Esc, `role="dialog"`, `aria-modal` nem trap de foco.

### 3.6 Financeiro (`renderFinanceiro`, 2105)

- Os cards não respondem à busca: parcelas vencidas; restante "Ainda não" (+ "Pago parcial"); contratos
  assinados sobre ativos.
- Tabelas: parcelas vencidas; próximos 10 vencimentos; situação por mentorado (contrato, entrada, restante,
  formas, pagas sobre total).
- **Cobranças sem mentorado** (`#cobrancas-orfas`) e **descartadas** não respondem à busca: esconder órfã
  seria esconder dinheiro. O motivo é derivado na hora (`motivoOrfa`): sem e-mail, e-mail em mais de um
  cadastro, cadastro existe, nenhum cadastro. "Vincular" só aparece com exatamente um cadastro com aquele
  e-mail (comparado com `lower`, sem `trim`).
- **Escritas:** W15 vincular (+ rpc `lia_refletir_financeiro`), W16 descartar, W17 restaurar.

### 3.7 Rotas e marcos (`renderRotas`, 2321)

- Seletor de rota (slug), sanfona de canais (com mais de 1 canal), combobox de mentorado. A busca só troca
  o mentorado no clique ou no Enter; sem escolha, abre o primeiro ativo.
- Gráfico de linha "Evolução mensal de marcos": 12 meses, uma série por marco.
- Stepper de marcos com **um aberto por vez** (os ids `mk_*` são únicos na página). O painel mostra o
  conteúdo do marco (subtítulo, restrição, alavanca, pergunta-chave, apoios, indicadores), o teste de
  passagem por portão em checkboxes, a régua de faturamento **da rota inteira** contra `meta_valor` (o mês no
  Marketplace, o acumulado em Feiras e B2B) e o registro (status, data, próxima ação, bloqueios). Marcar um
  critério não re-renderiza: só o contador e a barra mudam.
- `criterios_ok` guarda o **texto** do critério. `progresso` e `criterios_pendentes` são derivados.
- Cards e gráfico de barras do faturamento do canal; registros por mês.
- **Escritas:** W06 canal do mentorado, W07 faturamento, W08 excluir faturamento (`confirm()`), W09 evolução.

### 3.8 STLSeller (`renderAnalise`, 2607). Admin e diretoria, só leitura

Agrega por e-mail: pedidos, cancelados, bruto (dos pedidos), receita por anúncio (dos produtos), cobertura =
receita / bruto, fora do catálogo, canais, último pedido. Situação: sem conta, vende, parado. Concentração do
bruto (5 maiores + outros). Recorte padrão "Ativos" (status do formulário). Diagnóstico de e-mail, com o
e-mail STLFLIX primeiro. Os 15 anúncios que mais faturam.

### 3.9 NPS (`renderNps`, 2919). Admin e diretoria, só leitura

- NPS = `round(100 · (#nota ≥ 9 − #nota ≤ 6) / n)`. Média com 1 casa. O dia é sempre o de
  America/Sao_Paulo; a semana vai de segunda a domingo.
- Aba "NPS das sessões": card geral e um por mentor; tabela por semana ou mês com uma coluna por mentor (10
  períodos por página); respostas com filtro por mentor e busca (20 por página).
- Aba "Pesquisa de Experiência": NPS da mentoria, índice (grade 0/25/50/75/100, média das médias), clareza (%
  de "Sim"), índice por item (pior primeiro), respostas abertas.

### 3.10 Análise IA (`renderIa`, 2877). Os 3 papéis

- Admin e diretoria: Visão geral (resumo e alertas por severidade), Por mentor, Por mentorado; a tela da
  pessoa traz prós, contras, pauta e as respostas de NPS.
- Mentor: lê pela rpc `analise_ia_mentor()`, sem resumo, sem mentores e sem alertas de tipo mentor (AD-005).
  Sem a aba Por mentor e sem respostas.
- O risco vem do modelo. Médias e NPS vêm do NPS carregado. O formato antigo (`pontos_fortes`,
  `pontos_de_atencao`, `sinais`) continua legível.

### 3.11 Mentores (`renderMentores`, 3009). Admin e diretoria, só leitura

Por mentor: carteira (ativos cuja última 1:1 Concluída foi com ele), 1:1 e grupo em 30 dias e no total,
agendadas, NPS de 30 dias, calls transcritas aceitas, última atividade, leitura da IA, atividade dos últimos
6 meses, agenda e as 10 últimas respostas.

---

## 4. Dados

### 4.1 Leituras (`loadAll`, 736–799)

Vinte consultas num único `Promise.all`. `paginado` (726) busca páginas de 1.000 em sequência até vir uma
página menor.

| # | relação | papel | paginado | ordem | se falhar |
|---|---|---|---|---|---|
| R01 | `profiles` (o próprio, `.single()`) | todos | — | — | toast e signOut |
| R02 | `mentorados` | admin, diretoria | **não** | data_fechamento | aborta a carga; no 1º load o skeleton fica para sempre |
| R03 | `mentorados_basic` (view) | mentor | **não** | data_fechamento | idem |
| R04 | `parcelas` | admin, diretoria | **não** | numero | idem |
| R05 | `lia_cobrancas` | admin, diretoria | **não** | due_date | ignorado |
| R06 | `sessoes` | todos | sim | **ordem (empata)** | aborta |
| R07–R12 | `rotas`, `marcos_definicao`, `mentorado_marcos`, `faturamento_mensal`, `canais`, `mentorado_canais` | todos | **não** | ordem ou nenhuma | ignorado calado |
| R13 | `sessoes_orfas` (view) | todos | **não** | — | ignorado calado |
| R14 | `stlseller_mentorados` | admin, diretoria | **não** | — | painel de erro na tela |
| R15 | `stlseller_pedidos_marketplace` | admin, diretoria | **não** | — | idem |
| R16 | `stlseller_produtos_vendidos` | admin, diretoria | sim | faturamento (empata) | idem |
| R17 | `nps_respostas` | admin, diretoria | sim | respondido_em (empata) | painel de erro |
| R18 | `experiencia_respostas` | admin, diretoria | sim | respondido_em (empata) | painel de erro, **compartilhado com a IA** |
| R19 | `nps_analises` (limit 1) | admin, diretoria | — | gerado_em desc | idem |
| R20 | rpc `experiencia_adesao(p_desde, p_prazo_dias)` | todos; só o mentor usa | — | — | console |
| R21 | rpc `analise_ia_mentor()` | mentor | — | — | painel de erro |
| R22 | `transcricoes` (mentor, status, realizada_em, mentorado_id) | admin, diretoria | **não** | — | console |
| R23 | `mentorado_notas` (ao abrir a aba) | todos | — | — | mensagem no editor |

- **Teto de 1.000:** R02–R05, R07–R15 e R22 cortam sem aviso.
- **Ordem instável:** sem desempate por chave única, o OFFSET entre páginas pode repetir ou pular linha. R06
  alimenta o fechamento dos mentores.
- **Corrida:** algumas escritas chamam `loadAll()` sem `await` (3496, 3547). Respostas fora de ordem podem
  sobrescrever estado mais novo.

### 4.2 Escritas

Nenhum handler checa `pode()` por dentro e **nenhum trava o botão durante o envio**. O RLS filtra `update` e
`delete` sem permissão **sem devolver erro**; só o W13 confere as linhas afetadas.

| # | função (linha) | relação | operação | payload | onConflict | capacidade na UI |
|---|---|---|---|---|---|---|
| W01 | `confirmarGrupo` (2024) | sessoes | update `.in("id", pendentes)` | `status: "Concluída"`, `mentor` | — | escreverSessao |
| W02 | `criarSessaoGrupo` (2089) | sessoes | insert de N linhas | `mentorado_id`, `etapa`, `ordem` (`ETAPA_ORD` ou 99), `status`, `mentor`, `data`, `hora`, `link_meet`, `link_gravacao` (vazios viram null) | — | criarSessao |
| W03 | `salvarSessao` (3631) | sessoes | insert ou update por id | `mentorado_id`, `etapa`, `ordem`, `etapa_deduzida: false`, `status`, `mentor`, `data`, `hora`, `link_meet`, `link_gravacao`, `link_anotacoes` | — | escreverSessao; criar exige criarSessao |
| W04 | `confirmarSessao` (3670) | sessoes | update | `status: "Concluída"`, `mentor` | — | escreverSessao |
| W05 | `delSessao` (3677) | sessoes | delete | — | — | excluir |
| W06 | `salvarCanalMentorado` (2479) | mentorado_canais | upsert | `mentorado_id`, `rota_id`, `canal_id` | `mentorado_id,rota_id` | escreverRotas |
| W07 | `salvarFaturamento` (2488) | faturamento_mensal | upsert | `mentorado_id`, `mes` ("AAAA-MM-01"), `canal_id`, `valor` (`lerBRL`, vazio vira 0) | `mentorado_id,mes,canal_id` | escreverRotas |
| W08 | `excluirFaturamento` (2498) | faturamento_mensal | delete | — | — | excluir |
| W09 | `salvarMarco` (2521) | mentorado_marcos | upsert | rota simples: `mentorado_id`, `marco_id`, `status`, `data`. Rota rica: + `criterios_ok`, `criterios_pendentes`, `progresso`, `bloqueios`, `proxima_acao` | `mentorado_id,marco_id` | escreverRotas |
| W10 | `salvarNota` (3396) | mentorado_notas | upsert | `mentorado_id`, `conteudo` (DOMPurify), `atualizado_em` (relógio do cliente) | PK `mentorado_id` | escreverNotas |
| W11 | `salvarMentorado` (3451) | mentorados | update | aba Cadastro: `nome`, `cadastro_incompleto: false`, `email`, `data_fechamento`, `link_drive`, `link_mapa_mental`, `link_whatsapp`. Aba Financeiro: `contrato_status`, `entrada_status`, `entrada_forma_pgto`, `restante_status`, `restante_forma_pgto` | — | editarMentorado |
| W11b | idem (3490) | rpc `lia_adotar_orfas(p_mentorado)` | rpc; **erro ignorado** | — | — | sempre que o e-mail está na tela |
| W12 | `salvarSituacao` (3533) | mentorados | update | `situacao`, `pausado_em` (HOJE se vazio), `retorno_previsto` | — | editarMentorado |
| W13 | `excluirMentorado` (3731) | mentorados | delete + `.select("id")`, confere `data.length` | — | — | excluir |
| W14 | `criarMentorado` (3769) | mentorados | insert + `.select().single()` | `nome`, `email`, `data_fechamento`, `entrada_status`, `entrada_forma_pgto`, `contrato_status`, `restante_status`, `cancelado: false` | — | criarMentorado |
| W15 | `vincularCobranca` (3501) | lia_cobrancas, depois rpc `lia_refletir_financeiro` | update por `lia_bill_id` | `mentorado_id` | — | editarFinanceiro |
| W16 | `descartarCobranca` (3513) | lia_cobrancas (+ rpc se tinha dono; **erro ignorado**) | update | `ignorada: true` | — | editarFinanceiro |
| W17 | `restaurarCobranca` (3522) | idem | update | `ignorada: false` | — | editarFinanceiro |
| W18 | `toggleParcela` (3542) | parcelas | update | `status` aberta ↔ paga | — | editarFinanceiro |
| W19 | `addParcela` (3549) | parcelas | insert | `mentorado_id`, `numero` (maior + 1), `status: "aberta"`, `vencimento`, `valor` | — | editarFinanceiro |
| W20 | `salvarParcela` (3578) | parcelas | update | `numero`, `vencimento`, `valor`, `status` | — | editarFinanceiro |
| W21 | `delParcela` (3589) | parcelas | delete | — | — | editarFinanceiro |

Auth: `signInWithPassword` (714), `signOut` (687, 719). Não há cadastro, reset de senha, magic link, OAuth,
Storage, Realtime nem Functions.

---

## 5. Permissões

### 5.1 Capacidades do front (`CAPACIDADES`, 662–668)

| capacidade | admin | diretoria | mentor |
|---|---|---|---|
| verFinanceiro | ✓ | ✓ | — |
| verIa | ✓ | ✓ | ✓ |
| criarMentorado, editarMentorado, editarFinanceiro, criarSessao, excluir | ✓ | — | — |
| escreverSessao, escreverRotas, escreverNotas | ✓ | — | ✓ |

Papel fora do mapa fica sem capacidade nenhuma. Papel nulo trava o roteador no dashboard (1373). O menu é
escondido com `style.display="none"` e nada o mostra de volta (693–706). Tudo isso é **interface**: quem
recusa é o RLS.

### 5.2 RLS efetivo

| relação | admin | diretoria | mentor | fonte |
|---|---|---|---|---|
| mentorados | tudo | leitura | nada (lê pela view) | ARCHITECTURE.md (só no banco) |
| mentorados_basic (view, roda como dono) | leitura | leitura | leitura de todos, com e-mail | migration 20260916_email_do_mentorado |
| parcelas, lia_cobrancas | tudo | leitura | nada | ARCHITECTURE.md; 20260917_lia_pagamentos |
| sessoes | tudo | leitura | leitura + update **sem escopo**, sem insert | ARCHITECTURE.md |
| faturamento_mensal, mentorado_marcos, mentorado_canais | tudo | leitura | leitura + insert + update, sem escopo | ARCHITECTURE.md |
| rotas, canais, marcos_definicao | escrita | leitura | leitura | ARCHITECTURE.md |
| profiles | lê todos | lê o próprio | lê o próprio; update só em nome e e-mail | ARCHITECTURE.md |
| lia_eventos | tudo | nada | nada | 20260917_lia_pagamentos |
| stlseller_*, nps_respostas, experiencia_respostas, nps_analises, circle_presencas, transcricoes, mentorado_dossies | leitura | leitura | nada | migrations de 22/09, 08/10, 13/10 |
| mentorado_notas | leitura, insert, update | leitura | leitura, insert, update; ninguém apaga | 20261013_mentorado_notas |
| rpc `experiencia_adesao` | `SECURITY DEFINER`, sem checagem de papel, só contagens | | | 20261013_experiencia_adesao |
| rpc `analise_ia_mentor` | `SECURITY DEFINER`, responde a admin e mentor | | | 20261013_analise_ia_mentor |
| rpc `lia_refletir_financeiro`, `lia_adotar_orfas` | `SECURITY INVOKER`: o RLS decide (só admin escreve) | | | 20260918_lia_refletir_financeiro |

A diretoria **não tem nenhuma policy de escrita**. O "somente leitura" é do banco.

### 5.3 O que a migração não pode mexer

- `get_my_role()` e `auth.uid()` vêm do JWT do Supabase Auth deste projeto. Sem esse JWT na requisição, o RLS
  some (com `service_role`) ou recusa tudo (com a chave anônima).
- O recorte do mentor mora no banco (`mentorados_basic`, `analise_ia_mentor()`, AD-005). Não mover para o
  servidor Next.
- O AD-002 (mentor só vê contagens da Experiência) e o AD-003 (transcrição nunca vai para o banco; dossiê só
  para admin e diretoria) continuam valendo sem mudança de código.

---

## 6. Backend, automação e integrações

### 6.1 Edge functions

Nenhuma é chamada pelo front e nenhuma responde CORS. Todas escrevem com `service_role`.

| function | gatilho | autenticação de entrada | serviço externo | escreve |
|---|---|---|---|---|
| sync-google-calendar | pg_cron, 15 min | `verify_jwt` | Google OAuth + Calendar | sessoes |
| lia-webhook | Lia | HMAC-SHA1 do corpo cru em `X-Lia-Signature`; `verify_jwt` false | — | mentorados (cria a ficha), lia_cobrancas, lia_eventos, rpc refletir |
| nps-forms | n8n, 6 h | `X-NPS-Token`; `verify_jwt` false | — | nps_respostas |
| sync-stlseller | pg_cron, 6 h | `verify_jwt` | n8n → BigQuery | stlseller_* (rpc numa transação) |
| sync-experiencia | pg_cron, 6 h | `verify_jwt` | n8n → Drive | experiencia_respostas |
| nps-analista | pg_cron, diário | `verify_jwt` | Anthropic (`claude-opus-5-5`, structured output) | nps_analises |
| buscar-transcricoes | pg_cron, diário | `verify_jwt` | n8n → Drive | transcricoes |
| sync-transcricoes | pg_cron, 10 min | `verify_jwt` | n8n, TypeSafe Jev, Anthropic | transcricoes, mentorado_dossies |
| circle-presenca | automação do Circle, uma por live | `?token=`; `verify_jwt` false | Circle API v2 | circle_presencas, sessoes |

As três com `verify_jwt` false **não estão no `config.toml`**: só ficam abertas porque o deploy passa
`--no-verify-jwt`. Um redeploy sem a flag dá 401 para Lia, n8n e Circle, e o Circle não reenvia.

### 6.2 pg_cron (7 jobs, nenhum versionado)

| job | agenda (UTC) | Brasília | alvo |
|---|---|---|---|
| sync-google-calendar-15min | `*/15 * * * *` | a cada 15 min | sync-google-calendar |
| promover-sessoes-vencidas-15min | minutos 5, 20, 35, 50 | igual | `promover_sessoes_vencidas()` |
| sync-stlseller-6h | `20 */6 * * *` | 21:20, 03:20, 09:20, 15:20 | sync-stlseller (timeout 60 s) |
| sync-experiencia-6h | `45 */6 * * *` | 21:45, 03:45, 09:45, 15:45 | sync-experiencia |
| nps-analista-diario | `0 11` no ARCHITECTURE, `0 10` no comentário da migration | 08:00 ou 07:00 | nps-analista (150 s) |
| buscar-transcricoes-diario | `0 9 * * *` | 06:00 | buscar-transcricoes |
| sync-transcricoes-10min | `*/10 * * * *` | a cada 10 min | sync-transcricoes (150 s) |

### 6.3 n8n e terceiros

| integração | fluxo | workflow e credencial | segredo (nome) |
|---|---|---|---|
| Google Calendar | function → Google, refresh token | — | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` |
| Lia | Lia → `lia-webhook`, mão única | — | `LIA_API_KEY` |
| STLSeller / BigQuery | function → n8n → BigQuery `financial-448617.stlseller_raw` | `obqbyo0K7cPB6Ycb`; `Central Elite3D - sync-stlseller` | `STLSELLER_WEBHOOK_URL`, `STLSELLER_WEBHOOK_TOKEN` |
| NPS (Sheets) | n8n → `nps-forms` | `oNBtTs1TVwtsAaaf`; `Central Elite3D - nps-forms` | `NPS_FORMS_TOKEN` |
| Pesquisa de Experiência | function → n8n → Drive (xlsx) | `oNudNeSFgwrAH8pW`; `Central Elite3D - sync-experiencia` | `EXPERIENCIA_WEBHOOK_URL`, `EXPERIENCIA_WEBHOOK_TOKEN` |
| Transcrições (notas do Gemini) | function → n8n → Drive | `iK1jiqXLhD8JzmSV`; reaproveita o token do Experiência | `TRANSCRICOES_WEBHOOK_URL` |
| Circle | automação → `circle-presenca`; a function consulta a API | — | `CIRCLE_WEBHOOK_TOKEN`, `CIRCLE_API_KEY` |
| Anthropic | function → API | mesma chave da plataforma | `ANTHROPIC_API_KEY` |
| Jev (TypeSafe) | function → API | — | `JEV_API_KEY` |

### 6.4 O que depende da origem do front

Nenhuma integração. Só:
- a sessão do Auth, guardada no `localStorage` por origem (domínio novo = todo mundo faz login de novo, uma
  vez);
- os links `#/…` já compartilhados;
- Site URL e Redirect URLs do Auth, que hoje não são usados (sem reset, magic link nem OAuth);
- o CORS do PostgREST e do Auth, que segue o padrão do Supabase e não muda.

### 6.5 Schema que só existe no banco

As migrations do repo **alteram** o núcleo, mas não o criam. Não estão versionados:
- as tabelas `mentorados`, `sessoes`, `parcelas`, `profiles`, `rotas`, `canais`, `marcos_definicao`,
  `mentorado_marcos`, `mentorado_canais`, `faturamento_mensal`, `diagnosticos`, `nps_respostas`, com
  colunas, uniques e índices;
- as views `sessoes_orfas` e `nps_mentores_mensal`, e a criação original de `mentorados_basic`;
- as funções `get_my_role()`, `handle_new_user()`, `sync_cancelado_situacao()`, `set_updated_at()`,
  `promover_sessoes_vencidas()`;
- as policies do núcleo, o grant por coluna em `profiles`, os 7 jobs de cron;
- as colunas `mentorados.cadastro_incompleto` e `lia_cobrancas.ignorada`;
- a versão de `lia_refletir_financeiro` que exclui `ignorada` (a do repo não exclui).

Além disso, as migrations usam versão de 8 dígitos repetida (6 arquivos em `20261013`). Um `supabase db push`
provavelmente falha (não verificado). Consequência para a migração: **não dá para gerar tipos nem montar
staging a partir do repo**. Os tipos do front saem do contrato da §4 e são validados por Zod em runtime.

---

## 7. Testes

**Como funciona.** `tests/ambiente.mjs` lê o `index.html`, recorta o `<script>` a partir do marcador de
CONFIG, tira o `boot()` e executa o resto com `new Function`. Um DOM falso guarda o `innerHTML` de cada
seletor; um `supabase.createClient` falso **captura** as escritas e responde vazio; `location.hash` e
`hashchange` são simulados. As fixtures trazem payload de XSS nos nomes.

**Por que não porta.** No Next não há script inline nem marcador, o HTML não sai por `innerHTML`, as funções
não ficam em `window`, o estado vive em hooks, o supabase-js vem por import e várias asserções olham texto de
template (`onclick="openGrupo(\d+)"`). O stub de `range()` devolve vazio: o caminho acima de 1.000 linhas
nunca foi testado.

| grupo | asserções | protege |
|---|---|---|
| Formatadores e campo de data | 33 | R$, DD/MM/AAAA, máscara de moeda, `input hidden` com o id antigo |
| 1:1 × grupo | 18 | `ehGrupo`/`eh1a1`, agrupamento por etapa+data+hora, contagens só de 1:1 |
| Telas do admin | 39 | escape; nenhum `onclick` com texto de coluna; filtro de tipo |
| Modais e telas (ficha, STLSeller, NPS, IA) | 110 | escape de texto do modelo e do marketplace; `javascript:` não vira href; semana do NPS em SP |
| Escrita do grupo | 10 | N linhas por participante; confirmar exige mentor |
| Papel mentor | 29 | sem financeiro; deep links redirecionados; recorte da IA; adesão |
| Papel diretoria | 25 | capacidades exatas; **nenhum handler de escrita**; não cria mentorado |
| Controle negativo com admin | 1 | a varredura acha ≥ 10 handlers |
| Matriz por mentor | 15 | conta reunião, não linha; mês padrão |
| Alertas que focam linhas | 18 | foco pelo nome, nunca por id |
| Busca e botão de criar | 60 | sem acento e por partes; nunca encolhe os contadores |
| Exclusão | 14 | confirmação pelo nome; diretoria não exclui |
| Cobrança órfã | 24 | a busca não esconde dinheiro; vincular, descartar, restaurar |
| Ficha criada pela Lia | 9 | `cadastro_incompleto` |
| Parcelas da Lia | 17 | linha da Lia não é editável; prazo |
| Etapa deduzida | 7 | marca e limpeza ao salvar |
| Busca por data | 13 | formatos aceitos |
| E-mail do mentorado | 13 | normalização; colisão |
| Rotas | 33 | `criterios_ok` guarda texto; progresso derivado |
| Notas | 9 | admin e mentor editam; diretoria só lê |

Os testes Deno (`circle-presenca/index_test.ts`, `sync-transcricoes/logica_test.ts`) ficam com o backend e
não são afetados.

---

## 8. Design system: o que cobre e o que falta

Fonte da verdade: `plataforma-product-ops/main`. O snapshot do skill `design-system-ops` (`cabcca6`,
30/09/2026) está **atrás** da `main`: os tokens mudaram em um commit, e faltam no catálogo `alert`,
`copy-button`, `description-list`, `file-dropzone`, `inline-code`, `nav-item`, `option-card`, `popover`,
`progress`, `prose`, `section-label` e `status-dot`.

| hoje | design system | situação |
|---|---|---|
| input, select, textarea | Input, Select, Textarea | cobre |
| `.f` + label | FormField | cobre (hoje 0 de 61 `<label>` têm `for`) |
| `.btn` | Button | cobre |
| card de KPI | StatCard | cobre; sem tom de alerta |
| `.panel` | Card / Section | cobre; sem sombra em conteúdo |
| `.pill` | Badge (status), Tag (categoria) | cobre |
| `.abas` | Tabs (com `count`) | cobre |
| modal; exclusão | Dialog; ConfirmDialog | cobre |
| toast | react-hot-toast | cobre |
| skeleton; vazio | Skeleton; EmptyState | cobre |
| painel de foco | Alert | cobre |
| concentração do bruto | SentimentBar | cobre |
| leitura de campo sem edição | DescriptionList | cobre |
| gráfico de linha (marcos) | LineChart | parcial: altura fixa de 150 px, sem formatador de eixo |
| gráfico de barras em R$ | TrendChart `view="bar"` | parcial: sem eixo em R$ |
| matriz mentor × etapa | MatrixChart | parcial: sem colunas de total e Grupo, sem pílula, sem linha "sem mentor" |
| tabela ordenável e clicável | DataTable | **lacuna**: `sortable` só desenha o ícone; sem `onRowClick`; sem paginação |
| paginação (NPS 10 e 20) | — | **lacuna** |
| `dateField` / `monthField` | DateRangeCalendar (só intervalo sobre dias com dado) | **lacuna**: data única e mês |
| combobox de mentorado | SearchInput + Popover | **lacuna** (compor) |
| trilha de 12 segmentos | Progress (uma barra) | **lacuna** |
| stepper de marcos | CollapsibleSection | parcial (compor) |
| editor de notas | — | fica no módulo (AD-004 proíbe biblioteca de editor) |
| lista de atenção com contador | — | compor com Card |
| máscara BRL | NumberInput | **risco**: não trata "." como decimal. `mascaraBRL` trata: "2000.50" colado é R$ 2.000,50 hoje e viraria 200.050 |
| shell, navegação, login | NavItem, Button, Avatar | compor: o app tem casca própria (sidebar, menu mobile, login) |
| tema | ThemeToggle, tokens claro e escuro | hoje só escuro. Muda a identidade: verde-limão + Manrope viram azul `#4169e1` + Inter |

---

## 9. O que pode quebrar na migração

Ordenado por dano.

| # | risco | sintoma | como evitar ou detectar |
|---|---|---|---|
| 1 | Ler ou escrever pelo servidor com `service_role` | diretoria escreve; mentor vê financeiro; `atualizado_por` nulo | dados só no cliente, com a sessão do usuário; teste estático proibindo `service_role` em `src/` |
| 2 | Teto de 1.000 linhas e ordem instável | números menores ou duplicados no fechamento | paginar toda leitura de lista com desempate por chave única; teste com 2.500 linhas |
| 3 | Notas: debounce perdido ao trocar de aba em menos de 1 s; sem sanitizador o editor grava "" | nota apagada sem aviso | gravar o pendente no unmount e na navegação; DOMPurify do npm; editor só leitura se o sanitizador falhar |
| 4 | Select financeiro com valor nulo mostra a 1ª opção e o "Salvar" grava | "Assinado" ou "Pago" gravado sem ninguém escolher | opção vazia; campo não tocado não é escrito |
| 5 | RLS filtra `update`/`delete` calado | sucesso anunciado para escrita que não aconteceu | `.select("id")` e conferir as linhas em toda escrita |
| 6 | Duplo clique em escrita | encontro em grupo gravado duas vezes (2N linhas) | botão desabilitado durante o envio |
| 7 | Mudar o formato do endereço | link de ficha no WhatsApp abre o dashboard | manter `#/…` ou redirecionar no cliente |
| 8 | Vercel com preset "Other" e sem build recebendo um app Next | site fora do ar no merge | o dono troca o preset antes; preview da branch primeiro |
| 9 | Data calculada no servidor (UTC) | "hoje" errado entre 21h e 0h; erro de hidratação | datas só no cliente, em America/Sao_Paulo, na hora do uso; nunca `toISOString()` para "hoje" |
| 10 | Strings compartilhadas com as functions (`ETAPAS`/`TRILHA`, 90/91, nomes de mentor) | sessão sem mentor; grupo virando 1:1 | teste que lê `supabase/functions/sync-google-calendar/index.ts` e compara as listas |
| 11 | NumberInput do DS no lugar de `mascaraBRL` | R$ 2.000,50 colado vira 200.050 | testes de paridade de `lerBRL`/`mascaraBRL`; estender o primitivo sem quebrar |
| 12 | DataTable do DS sem ordenação e sem clique | tabelas perdem ordenação e navegação | estender o DataTable sem quebrar call site e subir para a plataforma |
| 13 | `contenteditable` controlado pelo React | cursor pulando, conteúdo duplicado | componente não controlado, com `ref` |
| 14 | O harness de teste não porta | regressão sem rede de proteção | portar os 20 comportamentos antes de apagar `tests/` |
| 15 | supabase-js `@2` flutuante virando versão fixa | API diferente da que roda hoje | fixar 2.117.3, a versão que o CDN entrega hoje |
| 16 | Sem staging | UAT escreve no banco real | roteiro de UAT por papel com escrita controlada |
| 17 | Sem `.gitignore`; `CIRCLE_API_KEY` no `.env.local` | segredo commitado ou exposto com `NEXT_PUBLIC_` | `.gitignore` do padrão; o app só lê as 2 variáveis públicas |
| 18 | Sessão em domínio novo ou em cookie | todo mundo faz login de novo | aceitável uma vez; avisar |
| 19 | Identidade visual nova | estranhamento de mentores e diretoria | decisão registrada na spec |
| 20 | Gráficos do DS menos ricos que o Chart.js | legenda e eixo diferentes | aceitar ou estender o DS |
| 21 | Gate nesta máquina | vitest 4 quebra com o Node 20.4 de `/usr/local/bin`; build e dev competem por RAM | `nvm use default`; um processo pesado por vez |

---

## 10. Defeitos que já existem

**M** = a migração corrige (exceção à paridade, declarada na spec). **P** = mantido por paridade, decidir
depois. **B** = backend, fora da migração.

| # | defeito | onde | classe |
|---|---|---|---|
| 1 | 13 leituras sem paginação; paginação com ordem que empata | §4.1 | M |
| 2 | Notas: edição perdida ao navegar em menos de 1 s; `beforeunload` assíncrono; sem DOMPurify grava "" por cima | 3352–3405 | M |
| 3 | Selects financeiros nulos gravam a 1ª opção | 3278–3281 | M |
| 4 | `update`/`delete` sem conferir linhas (todos menos W13) | §4.2 | M |
| 5 | Nenhum botão trava durante o envio; duplo clique duplica W02, W14 e W19 | §4.2 | M |
| 6 | Carga inicial que falha deixa o skeleton para sempre, sem tentar de novo | 772, 797 | M |
| 7 | `loadAll` sem `await` permite corrida entre respostas | 3496, 3547 | M |
| 8 | Erros das rpcs ignorados (W11b, W16, W17); erro da Experiência derruba a tela IA | 3490, 3519, 3526, 785–791 | M |
| 9 | Menu escondido por papel nunca volta; senha fica no campo; a tela do usuário anterior aparece até a carga | 693–719 | M |
| 10 | Papel nulo trava o roteador | 1373 | M |
| 11 | `onclick` com `lia_bill_id` interpolado (o padrão que o próprio código proíbe) | 2185, 2186, 2198 | M |
| 12 | Instâncias do Chart.js acumulam (`ctx._chart` nunca é o canvas novo) | 2455, 2466 | M |
| 13 | Modais sem Esc, `role="dialog"` e foco; labels sem `for`; toast sem `aria-live`; Enter não envia o login | §3.5, 477 | M |
| 14 | `HOJE` congelado no carregamento | 606 | M |
| 15 | "Concluídas (últimas 30)" corta antes de ordenar: mostra as 30 de menor `ordem`, não as mais recentes | 1858, 1925, 1956 | M |
| 16 | Diretoria consegue mexer nos selects financeiros (sem botão de salvar) | 3278 | M |
| 17 | `salvarMarco` sem o fallback de rota: slug inválido dá TypeError | 2522 | M |
| 18 | CDN sem SRI e `@2` flutuante; CDN fora derruba o app | 12–14 | M |
| 19 | O deploy publica o repositório inteiro | §1 | M |
| 20 | `doLogin` mostra "E-mail ou senha inválidos." para qualquer erro, inclusive rede | 712–715 | M |
| 21 | Card "1:1 concluídas" conta linha; a matriz conta reunião | 1481, 1537 | P |
| 22 | "Sem sessão há +30 dias" ignora quem tem qualquer "Agendada", mesmo vencida | 1520 | P |
| 23 | Dedupe de reunião usa o mentor cru; duas grafias contam duas reuniões | 1449, 1545 | P |
| 24 | `updated_at.slice(0,10)` em UTC contra `HOJE` em SP | 1506 | P |
| 25 | Etapa fora do catálogo deixa a ordem das colunas instável | 1571 | P |
| 26 | Filtro "incompletos" inclui cancelados; o alerta não | 1491, 1808 | P |
| 27 | "Aguardando confirmação" conta por linha (encontro de 30 = 30) | 1486, 1591 | P |
| 28 | Link de cobrança órfã não leva à âncora `#cobrancas-orfas` | 1670 | P |
| 29 | Nova sessão em grupo aceita Concluída sem mentor, não checa duplicata, não tem link de anotações | 2093–2098 | P |
| 30 | Formulário de sessão sem validação; a sugestão "Checkup extra" não existe como opção | 3600, 3611 | P |
| 31 | Filtro de mentor em Sessões, NPS e Mentores compara texto cru | 1865, 2921, 2982 | P |
| 32 | Vínculo de cobrança compara `lower` sem `trim`; o alvo pode estar cancelado | 2176 | P |
| 33 | Rota simples: critérios marcados não são gravados (as 3 rotas de produção são ricas) | 2529 | P |
| 34 | Salvar marco apaga de `criterios_ok` os textos que saíram do catálogo | 2533 | P |
| 35 | Faturamento com valor vazio grava 0 | 2491 | P |
| 36 | Rotas: legenda oculta com N séries; `NAO_APLICAVEL` aparece como futuro; faturamento do canal aberto, não do salvo | 2462, 2411, 2345 | P |
| 37 | STLSeller: chip "Sem venda" inclui sem conta e o painel não; largura "NaN%" com bruto 0 | 2624, 2635, 2663 | P |
| 38 | NPS: nota nula contaria como detrator (não verificado se existe); tabela por período ignora filtro e busca; a busca não volta para a página 1 | 2737–2739, 2953, 1250 | P |
| 39 | Mentores: Agenda e "Agendadas" contam uma linha por participante de grupo; hora sem corte | 2998, 3034, 3074 | P |
| 40 | `resumoExclusao` conta 4 tipos; também somem canais, notas, transcrições e dossiês, e as cobranças viram órfãs | 3691–3700 | P |
| 41 | `criarMentorado` não chama `lia_adotar_orfas` (o `salvarMentorado` chama) | 3769 | P |
| 42 | Número de parcela sem limite no JS (o banco aceita 1–60) | 3579 | P |
| 43 | `atualizado_em` das notas vem do relógio do cliente | 3401 | P |
| 44 | Lia: depois de um 500, o reenvio bate no único e volta 200 "duplicado"; o evento nunca é reprocessado | lia-webhook:334–377 | B |
| 45 | Sync do Calendar: escritas sem checagem de erro; 250 eventos sem paginação; N+1 | sync-google-calendar:181–380 | B |
| 46 | `circle-presenca` casa e-mail com `ilike` (a regra é igualdade) | circle-presenca:130 | B |
| 47 | `?debug=1` do sync devolve títulos e e-mails; com chamadas documentadas pela chave pública, o `verify_jwt` pode não proteger (não verificado no gateway) | sync-google-calendar:198–239 | B |
| 48 | Schema do núcleo, policies, cron e 2 colunas fora das migrations; versões repetidas; `lia_refletir_financeiro` do repo diverge do banco | §6.5 | B |
| 49 | `lia_refletir_financeiro`/`lia_adotar_orfas` sem `search_path` e com grants padrão | 20260917, 20260918 | B |
| 50 | `experiencia_adesao` repete em SQL a regra do JS, com as etapas de grupo por literal | 20261013_experiencia_adesao:11–23 | B |

---

## 11. Plataforma: fora do escopo (AD-006)

O app **não vai para a plataforma-product-ops** (decisão do Lucas, 13/10/2026,
`docs/decisions/006-app-proprio-com-o-design-system-da-plataforma.md`). Ele continua no Supabase e na
Vercel e usa o design system da plataforma como cópia dos arquivos. Por isso não se aplicam aqui o login da
plataforma, os papéis super/admin/user, o registry de módulo, o envelope `/api` e o acesso a dado pelo
n8n.

---

## 12. Documentação desatualizada

| documento | diz | realidade |
|---|---|---|
| ARCHITECTURE.md:10 | ~1.870 linhas | 3.785 |
| ARCHITECTURE.md:11 | o único outro código versionado é `tests/` | 29 arquivos em `supabase/`, 9 edge functions |
| ARCHITECTURE.md:14–23, 1117 | diagrama com uma function; "a edge function" | 9 functions |
| ARCHITECTURE.md:37 | 2 dependências de CDN | 3 (DOMPurify), nenhuma com `integrity` |
| ARCHITECTURE.md:39 | 5 jobs e 3 workflows | 7 jobs e 4 workflows |
| ARCHITECTURE.md:42 | 132 asserções | 497 |
| ARCHITECTURE.md:68, README:255 | ficha com três abas | 5 abas |
| ARCHITECTURE.md:72–76 | lista do estado global; "não há atualização otimista" | a lista não traz ~15 globais novos; `toggleParcela` muta `P` antes do reload |
| ARCHITECTURE.md:86–91 | 5 telas + Mentores + ficha | 10 telas |
| ARCHITECTURE.md:115 | 11 tabelas e 2 views | 24 tabelas e 3 views |
| ARCHITECTURE.md:429 | `lia-webhook` é a única com `verify_jwt` false | 3 functions |
| ARCHITECTURE.md:635–638 | código do `nps-forms` não versionado | versionado |
| ARCHITECTURE.md:685 | cron do analista `0 11` | `0 10` na migration |
| ARCHITECTURE.md:940–943 | capacidades sem `escreverNotas`/`verIa`; `diretoria: ["verFinanceiro"]` | as duas existem; diretoria tem `verIa` |
| ARCHITECTURE.md:953, index.html:3685 | cinco filhas em cascata | também notas, transcrições e dossiês; cobranças da Lia ficam órfãs |
| ARCHITECTURE.md:1113–1115 | alterações de banco não versionadas | 16 migrations; o núcleo de fato não está |
| README:46 | mentor registra sessões | o mentor não cria sessão |
| README:79–80 | novo mentorado: admin e diretoria | só admin |
| README:234 | Financeiro só para administrador | diretoria também vê |
| README:420–422 | não há anotações internas | aba Notas (AD-004) |
| AD-002:21 | `experiencia_adesao(p_desde)` | também `p_prazo_dias` |
| nps-forms:3–5 | cita `apps-script.gs` | o arquivo não existe; quem chama é o n8n |
| index.html:3101 | 25 pontos chamam `openMentorado` | 33 |
