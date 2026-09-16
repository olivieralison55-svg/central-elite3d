-- Rotas Elite 3D — régua única de marcos
--
-- Substitui o catálogo de marcos pelo "Compilado das Rotas Elite 3D":
-- três rotas, seis marcos cada, mesmos valores (500 / 2k / 10k / 20k / 50k / 100k).
-- A unidade muda por rota: Marketplace mede o MÊS, Feiras e B2B medem o ACUMULADO.
--
-- O catálogo antigo (4 marcos de Feiras + 8 de Marketplaces) sai junto com o
-- progresso registrado nele — não há como remapear "Marco 1 — Antes da Feira"
-- para "R$ 500 acumulados" sem inventar dado.

begin;

/* ---------- 1. Colunas do conteúdo do marco ---------- */

alter table rotas
  add column if not exists unidade text not null default 'acumulado'
    check (unidade in ('mes', 'acumulado'));

comment on column rotas.unidade is
  'mes = o marco olha o faturamento do mês corrente (Marketplace); acumulado = soma da rota inteira (Feiras, B2B).';

alter table marcos_definicao
  add column if not exists subtitulo      text,
  add column if not exists restricao      text,
  add column if not exists alavanca       text,
  add column if not exists pergunta_chave text,
  add column if not exists apoios         text[] not null default '{}',
  add column if not exists indicadores    text[] not null default '{}',
  add column if not exists criterios      jsonb  not null default '[]'::jsonb,
  add column if not exists meta_valor     numeric,
  add column if not exists placa          boolean not null default false;

comment on column marcos_definicao.criterios is
  'Teste de passagem. Lista de portões: [{"grupo": null|texto, "itens": [...]}]. '
  'Só o Marco 01 de Marketplace tem dois portões; os outros marcos têm um, com grupo null.';
comment on column marcos_definicao.placa is
  'Placa entra a partir do Marco 03 nas três rotas. No Marketplace é conquista '
  'registrada, não status corrente: mês seguinte pior não revoga.';

/* ---------- 2. Critérios marcados por mentorado ---------- */
-- Guarda o TEXTO do critério, não o índice: reordenar ou reescrever o catálogo
-- não pode transformar "tenho embalagem" em "conheço meu CMV".

alter table mentorado_marcos
  add column if not exists criterios_ok text[] not null default '{}';

/* ---------- 3. Rotas ---------- */

update rotas set nome = 'Marketplace',     unidade = 'mes',        ordem = 1 where slug = 'marketplaces';
update rotas set nome = 'Feiras e Lives',  unidade = 'acumulado',  ordem = 2 where slug = 'feiras';
update rotas set nome = 'B2B / Varejo',    unidade = 'acumulado',  ordem = 3 where slug = 'b2b_varejo';

update rotas set modelo = 'rico' where slug in ('marketplaces', 'feiras', 'b2b_varejo');

/* ---------- 4. Catálogo antigo ---------- */

delete from marcos_definicao
 where rota_id in (select id from rotas where slug in ('marketplaces', 'feiras', 'b2b_varejo'));

/* ---------- 5. Rota Marketplace — 6 marcos, faturamento do mês ---------- */
-- Gramática própria: APOIO → PERGUNTA-CHAVE → TESTE DE PASSAGEM → INDICADORES.
-- Restrição e alavanca ficam nulas de propósito: o mapa de origem não as declara.

insert into marcos_definicao
  (rota_id, ordem, nome, objetivo, subtitulo, pergunta_chave, apoios, indicadores, criterios, meta_valor, placa)
select r.id, v.ordem, v.nome, v.objetivo, v.subtitulo, v.pergunta_chave, v.apoios, v.indicadores, v.criterios, v.meta_valor, v.placa
from rotas r, (values
  (1,
   'Marco 01 — R$ 500 no mês',
   'A primeira venda paga o anúncio',
   'Único marco com dois portões: o primeiro fecha a estrutura, o segundo cobra resultado.',
   'O que falta para este mentorado estar apto a vender? Em seguida: o que precisa ser executado para gerar a primeira venda?',
   array[
     'Diagnóstico inicial e PHD (paixão, habilidade, demanda)',
     'Pesquisa de mercado, análise de concorrentes, seleção e validação física da peça',
     'CMV e precificação',
     'Estrutura de canal (Shopee/ML, fiscal, logística)',
     'Anúncio pronto (fotos, vídeos, títulos, descrições)',
     'Otimização de anúncio (foto principal, título)',
     'Oferta, preço, cupons e promoções',
     'ADS'],
   array['Quantidade de vendas', 'Faturamento', 'Produto vendido'],
   '[{"grupo":"Portão A · Apto a vender","itens":[
       "Tenho produto validado",
       "Conheço meu CMV",
       "Tenho preço definido",
       "Tenho capacidade de produção",
       "Tenho embalagem",
       "Tenho canal de venda ativo",
       "Tenho estrutura fiscal aplicável ao meu caso",
       "Tenho pelo menos um anúncio ativo e apto a receber pedidos"]},
     {"grupo":"Portão B · Primeira receita","itens":[
       "Bati R$ 500 de faturamento no mês",
       "Registrei pelo menos 1 venda",
       "Sei qual produto vendeu",
       "Sei qual foi o faturamento dessa venda",
       "Sei o que mudou no anúncio antes da venda acontecer"]}]'::jsonb,
   500, false),

  (2,
   'Marco 02 — R$ 2.000 no mês',
   NULL,
   'Sai da venda isolada e entra em vitrine com mais de um produto girando.',
   'Qual ação pode acelerar as vendas até os R$ 2 mil no mês?',
   array[
     'Ampliar a vitrine (novos produtos, variações, kits)',
     'Melhorar o que já existe (anúncios, preço)',
     'Reputação e posicionamento (avaliações, ranqueamento)',
     'Aceleradores (ADS, cupons, promoções)'],
   array['Faturamento do mês', 'Quantidade de vendas', 'Produtos vendidos', 'Ticket médio'],
   '[{"grupo":null,"itens":[
       "Bati R$ 2.000 de faturamento no mês",
       "Tenho mais de um produto com venda registrada",
       "Sei meu ticket médio",
       "Tenho avaliações no canal"]}]'::jsonb,
   2000, false),

  (3,
   'Marco 03 — R$ 10.000 no mês',
   NULL,
   'Identifica os campeões, replica o que vence e para de depender de pico isolado.',
   'O que já está funcionando e pode ser ampliado?',
   array[
     'Identificar os produtos de maior potencial',
     'Otimização contínua (melhoria de anúncio, reprecificação, ranqueamento)',
     'Ampliação do que funciona (variações, kits, novos produtos)',
     'Replicação de vencedores em novos anúncios',
     'Aumento da capacidade produtiva',
     'ADS'],
   array['Faturamento do mês', 'Pedidos', 'Ticket médio', 'Produtos mais vendidos',
         'Quantidade de produtos com vendas', 'Capacidade produtiva'],
   '[{"grupo":null,"itens":[
       "Bati R$ 10.000 de faturamento no mês",
       "Sei quais são meus produtos de maior potencial",
       "Tenho pedidos distribuídos ao longo do mês, não concentrados em um pico",
       "Acompanho ticket médio e número de pedidos mês a mês",
       "Repliquei pelo menos um produto vencedor em nova variação ou kit",
       "Aumentei a quantidade de produtos com vendas em relação ao Marco 02",
       "Minha capacidade produtiva suporta o volume atual"]}]'::jsonb,
   10000, true),

  (4,
   'Marco 04 — R$ 20.000 no mês',
   NULL,
   'Duplica estratégia validada em outros produtos e organiza a produção.',
   'Qual é a forma mais direta de ampliar o que já funciona?',
   array[
     'Duplicação de estratégias vencedoras (kits, variações)',
     'Expansão de portfólio',
     'Produção (novos equipamentos quando necessário, organização)',
     'Performance comercial (ADS, ranqueamento, reprecificação)'],
   array['Faturamento do mês', 'Pedidos', 'Produtos responsáveis pelo faturamento',
         'Ticket médio', 'Capacidade produtiva'],
   '[{"grupo":null,"itens":[
       "Bati R$ 20.000 de faturamento no mês",
       "Sei quais produtos respondem pela maior parte do faturamento",
       "A produção acompanha os pedidos sem atraso de envio",
       "Dupliquei pelo menos uma estratégia validada em outro produto",
       "Ampliei o portfólio em relação ao Marco 03"]}]'::jsonb,
   20000, true),

  (5,
   'Marco 05 — R$ 50.000 no mês',
   NULL,
   'Primeira pessoa na operação e rotina documentada.',
   'Qual ação tem maior potencial para levar a operação ao próximo patamar?',
   array[
     'Catálogo em escala (ampliação, novos produtos, novos anúncios)',
     'Capacidade e organização operacional',
     'Primeira equipe',
     'Novos canais quando aplicável',
     'ADS'],
   array['Faturamento do mês', 'Pedidos', 'Produtos mais vendidos', 'Ticket médio', 'Capacidade produtiva'],
   '[{"grupo":null,"itens":[
       "Bati R$ 50.000 de faturamento no mês",
       "Tenho pelo menos uma pessoa além de mim na operação",
       "Existe rotina operacional documentada, não improviso diário",
       "A capacidade produtiva foi dimensionada para o volume atual"]}]'::jsonb,
   50000, true),

  (6,
   'Marco 06 — R$ 100.000 no mês',
   NULL,
   NULL,
   'Qual é o próximo movimento necessário para continuar crescendo?',
   array[
     'Expansão de portfólio e replicação de vencedores',
     'Aumento de capacidade e organização da operação',
     'Estruturação de equipe',
     'Novos canais',
     'ADS'],
   array['Faturamento do mês', 'Pedidos', 'Ticket médio', 'Produtos mais vendidos',
         'Quantidade de produtos ativos', 'Capacidade produtiva'],
   '[{"grupo":null,"itens":[
       "Bati R$ 100.000 de faturamento no mês",
       "Opero mais de um canal de venda",
       "Tenho equipe estruturada com funções definidas",
       "A operação roda sem depender da minha presença em todas as etapas"]}]'::jsonb,
   100000, true)
) as v(ordem, nome, objetivo, subtitulo, pergunta_chave, apoios, indicadores, criterios, meta_valor, placa)
where r.slug = 'marketplaces';

-- A alavanca do Marco 06 é a única declarada na rota Marketplace.
update marcos_definicao m
   set alavanca = 'Multiplicação de canais, portfólio e time'
  from rotas r
 where m.rota_id = r.id and r.slug = 'marketplaces' and m.ordem = 6;

/* ---------- 6. Rota Feiras e Lives — 6 marcos, acumulado ---------- */

insert into marcos_definicao
  (rota_id, ordem, nome, objetivo, subtitulo, restricao, alavanca, apoios, criterios, meta_valor, placa)
select r.id, v.ordem, v.nome, v.objetivo, v.subtitulo, v.restricao, v.alavanca, v.apoios, v.criterios, v.meta_valor, v.placa
from rotas r, (values
  (1,
   'Marco 01 — R$ 500 acumulados',
   'A feira paga o dia',
   'Escolher a feira certa e montar a operação mínima. O critério não é faturar alto: é o dia fechar no positivo.',
   NULL, NULL,
   array[
     'Encontrar as feiras da região',
     'Qualificar a feira com o organizador',
     'Ler o público antes de imprimir',
     'Cruzar público × produto',
     'Fazer a conta antes de dizer sim',
     'Mix mínimo viável (isca, médio, premium)',
     'Precificar sem se enganar',
     'Estrutura básica da banca',
     'Estrutura para feira ao ar livre',
     'Meios de pagamento',
     'Embalagem funcional',
     'Chegada e operação mínima',
     'Fechar os números do dia'],
   '[{"grupo":null,"itens":[
       "Bati R$ 500 acumulados na rota",
       "Fiz pelo menos 1 feira com data marcada e inscrição paga",
       "O lucro real do dia ficou acima de zero",
       "Sei descrever o público da feira escolhida em uma frase",
       "Tenho produtos nas três faixas de preço",
       "Sei o custo real e o preço de venda de cada peça",
       "Conferi a licença comercial de todos os modelos",
       "Registrei faturamento, custo, lucro, ticket médio e conversão do dia"]}]'::jsonb,
   500, false),

  (2,
   'Marco 02 — R$ 2.000 acumulados',
   NULL, NULL,
   'Cada feira começa do zero, tudo no improviso',
   'Repetição — transformar a feira em processo replicável',
   array[
     'Planejar a produção (impressora como fábrica)',
     'Ensaio de montagem em casa',
     'Registro do dia',
     'Desmontagem',
     'Analisar o que aconteceu',
     'Ajustar o catálogo',
     'Regra do UM ajuste por feira'],
   '[{"grupo":null,"itens":[
       "Bati R$ 2.000 acumulados na rota",
       "Fiz pelo menos 3 feiras",
       "A 3ª feira deu lucro",
       "Tenho a lista dos campeões e dos encalhados",
       "Tenho a foto do layout aprovado e a lista de carga escrita",
       "Montei a banca sem improviso na última feira",
       "Escolhi UM ajuste testado por rodada e sei o efeito de cada um"]}]'::jsonb,
   2000, false),

  (3,
   'Marco 03 — R$ 10.000 acumulados',
   NULL,
   'Deixa de depender de achar feira e passa a ter agenda.',
   NULL, NULL,
   array[
     'Relacionamento com organizadores',
     'Calendário de feiras dos próximos 3 meses',
     'Divulgação antes da feira (7 dias, 3 dias, 1 dia, no dia)'],
   '[{"grupo":null,"itens":[
       "Bati R$ 10.000 acumulados na rota",
       "Tenho calendário fechado para os próximos 3 meses",
       "Tenho pelo menos 2 organizadores ativos no meu WhatsApp",
       "Fiz o aquecimento completo de 3 postagens em toda feira do período",
       "Sei o lucro por dia de cada feira que frequento",
       "Já testei pelo menos 2 tipos diferentes de feira"]}]'::jsonb,
   10000, true),

  (4,
   'Marco 04 — R$ 20.000 acumulados',
   NULL, NULL,
   'O público passa e não para, ou para e leva uma peça só',
   'Conversão e ticket médio na mesma feira, sem aumentar o número de feiras',
   array[
     'Energia e iluminação',
     'Identidade visual e comunicação',
     'Embalagem de marca',
     'Layout que vende (regra dos 3 segundos)',
     'Demonstração',
     'Aumentar o ticket médio (combos, kits, desconto progressivo)',
     'Fechamento'],
   '[{"grupo":null,"itens":[
       "Bati R$ 20.000 acumulados na rota",
       "Meu ticket médio atual é maior que o do Marco 02, com número registrado",
       "Minha conversão atual é maior que a do Marco 02, com número registrado",
       "Tenho banner, placas de preço e identidade visual alinhada às redes",
       "Resolvi iluminação com ou sem ponto de energia na feira",
       "Ofereci combo em toda venda da última feira",
       "Coloquei peça na mão de cliente pelo menos 10 vezes por feira"]}]'::jsonb,
   20000, true),

  (5,
   'Marco 05 — R$ 50.000 acumulados',
   NULL, NULL,
   'Só fatura no fim de semana em que tem feira',
   'Vender entre as feiras, para quem já comprou',
   array[
     'Captura de contato',
     'Pós-venda em até 48h',
     'Conteúdo pós-feira',
     'Lives de venda com dia e horário fixos',
     'Marketplace como canal paralelo'],
   '[{"grupo":null,"itens":[
       "Bati R$ 50.000 acumulados na rota",
       "Sei qual percentual do meu faturamento veio de fora da feira",
       "Tenho base de contatos ativa e segmentada",
       "Respondo 100% dos contatos capturados em até 48 horas",
       "Fiz pelo menos 4 lives com dia e horário fixos",
       "Tenho recompra registrada de clientes que vieram da feira"]}]'::jsonb,
   50000, true),

  (6,
   'Marco 06 — R$ 100.000 acumulados',
   NULL, NULL,
   'Teto físico — uma banca, um par de mãos, um fim de semana',
   'Multiplicação — faturar sem estar presente em todos os pontos de venda',
   array[
     'Segunda banca e equipe',
     'Capacidade produtiva',
     'Feiras e eventos maiores',
     'Lives recorrentes em agenda',
     'Revenda e novos canais',
     'Gestão do negócio (CNPJ, DRE, pró-labore, reinvestimento)'],
   '[{"grupo":null,"itens":[
       "Bati R$ 100.000 acumulados na rota",
       "Faturei em um ponto de venda sem estar presente nele",
       "Tenho processo documentado e alguém treinado nele",
       "Minha capacidade de produção suporta o calendário sem apagar incêndio",
       "Tenho DRE mensal simples e pró-labore definido",
       "Opero pelo menos 2 canais além da feira presencial"]}]'::jsonb,
   100000, true)
) as v(ordem, nome, objetivo, subtitulo, restricao, alavanca, apoios, criterios, meta_valor, placa)
where r.slug = 'feiras';

/* ---------- 7. Rota B2B / Varejo — 6 marcos, acumulado ---------- */
-- Gramática completa: RESTRIÇÃO / ALAVANCA / APOIO / TESTE DE PASSAGEM.

insert into marcos_definicao
  (rota_id, ordem, nome, objetivo, restricao, alavanca, apoios, criterios, meta_valor, placa)
select r.id, v.ordem, v.nome, v.objetivo, v.restricao, v.alavanca, v.apoios, v.criterios, v.meta_valor, v.placa
from rotas r, (values
  (1,
   'Marco 01 — R$ 500 acumulados',
   'O primeiro pedido paga as amostras',
   'Não sabe o que o lojista compra · não tem amostra na mão · nicho escolhido por gosto, não por demanda',
   'Primeira experiência em loja de conhecido → sondagem em 4 lojas do mesmo perfil → nicho por demanda repetida → adequação 4P → primeira visita e primeira venda',
   array[
     'Roteiro das 3 perguntas',
     'Ficha de olhar clínico',
     'Registro via STLSELLER ou persona manual',
     'Planilha custo variável × capacidade produtiva',
     'Catálogo digital',
     'Maleta sem marca de terceiros'],
   '[{"grupo":null,"itens":[
       "Bati R$ 500 acumulados na rota",
       "1º pedido faturado e pago",
       "A receita cobre o custo das amostras",
       "Consignação proibida neste marco"]}]'::jsonb,
   500, false),

  (2,
   'Marco 02 — R$ 2.000 acumulados',
   NULL,
   'A primeira venda saiu de relacionamento, não de método',
   'Repetir a visita em lojas frias, com o trio montado (UAU, High Fit, Penetração)',
   array[
     'Janela de visita (terça e quarta, após as 10h, primeira quinzena)',
     'Script de objeção sem mexer no preço',
     'Filtro de viabilidade de R$ 1.500/mês por impressora',
     'Lista do que evitar'],
   '[{"grupo":null,"itens":[
       "Bati R$ 2.000 acumulados na rota",
       "Tenho 3 lojas compradoras sem vínculo pessoal",
       "Markup 3x confirmado no realizado"]}]'::jsonb,
   2000, false),

  (3,
   'Marco 03 — R$ 10.000 acumulados',
   NULL,
   'Vende uma vez por loja; faturamento depende de prospectar do zero toda semana',
   'Fidelização — visitas regulares, reposição planejada, troca por desempenho',
   array[
     'Controle de giro por SKU × loja',
     'Calendário de reposição',
     'Política de troca escrita',
     'Brinde periódico'],
   '[{"grupo":null,"itens":[
       "Bati R$ 10.000 acumulados na rota",
       "Tenho 3 lojas na 2ª compra sem prospecção nova no período"]}]'::jsonb,
   10000, true),

  (4,
   'Marco 04 — R$ 20.000 acumulados',
   NULL,
   'Carteira pequena e concentrada',
   'Prospecção co-relacionada com case de sucesso · loja como laboratório (consignação controlada liberada a partir daqui)',
   array[
     'Kit de case (foto da exposição, número de giro, depoimento)',
     'Matriz produto × perfil de loja',
     'Teste de preço por região'],
   '[{"grupo":null,"itens":[
       "Bati R$ 20.000 acumulados na rota",
       "Nenhuma loja acima de 30% do faturamento do mês"]}]'::jsonb,
   20000, true),

  (5,
   'Marco 05 — R$ 50.000 acumulados',
   NULL,
   'Teto de produção e entrega — o pedido existe e não sai',
   'Fila de produção · estoque de reposição dos SKUs de giro · logística e frete · nota fiscal e prazo de pagamento',
   array[
     'Plano de capacidade por impressora',
     'Tabela de frete',
     'Política de prazo e inadimplência'],
   '[{"grupo":null,"itens":[
       "Bati R$ 50.000 acumulados na rota",
       "Prazo de entrega cumprido em todos os pedidos do mês",
       "Capacidade declarada em peças/mês"]}]'::jsonb,
   50000, true),

  (6,
   'Marco 06 — R$ 100.000 acumulados',
   NULL,
   'Teto de tempo do fundador na rua',
   'Exclusividade territorial contratada · representantes comerciais',
   array[
     'Contrato de exclusividade com contrapartida (valor maior, quantidade maior, frequência pré-determinada, pedido anual, cor ou tamanho exclusivo)',
     'Tabela de comissão'],
   '[{"grupo":null,"itens":[
       "Bati R$ 100.000 acumulados na rota",
       "Parte relevante do volume entra via representante, sem visita do fundador"]}]'::jsonb,
   100000, true)
) as v(ordem, nome, objetivo, restricao, alavanca, apoios, criterios, meta_valor, placa)
where r.slug = 'b2b_varejo';

commit;
