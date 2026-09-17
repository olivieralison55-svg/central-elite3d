# Central de Controle · Elite 3D

Ferramenta interna para acompanhar o programa de mentoria: quem está sendo
mentorado, em que ponto da trilha cada um está, quais sessões aconteceram,
o que está parado e o que precisa de cobrança.

**Endereço:** https://central-elite3d.vercel.app

> Esta é uma ferramenta **de uso interno da equipe**. Os mentorados não têm
> acesso, não têm login e não veem nada daqui. Tudo que está registrado sobre
> eles foi colocado pela equipe ou trazido automaticamente do Google Agenda.

---

## Entrando

Acesse o endereço acima e entre com o e-mail e a senha que o administrador
cadastrou para você. Não existe "criar conta" nem "esqueci minha senha" — se
precisar de acesso ou de uma nova senha, fale com o administrador.

Ao pedir um acesso novo, **diga qual perfil a pessoa deve ter**. Todo login
recém-criado entra como Mentor por padrão, e mudar isso é um ajuste manual no
banco — se ninguém avisar, a pessoa fica com o acesso errado sem que apareça
nenhum aviso na tela.

Se aparecer *"Perfil não encontrado. Contate o admin"*, significa que o login
existe mas o cadastro interno não foi criado. Também é caso de falar com o
administrador.

---

## Os três tipos de acesso

**Administrador**, **Diretoria** e **Mentor**. Seu tipo aparece no canto
inferior esquerdo, embaixo do seu nome.

| | Administrador | Diretoria | Mentor |
|---|---|---|---|
| Dashboard, Mentorados, Sessões, Rotas | ✅ | ✅ | ✅ |
| Aba **Financeiro** | ✅ | ✅ | ❌ não aparece |
| Contrato, entrada, restante e parcelas | ✅ vê e edita | ✅ só vê | ❌ não vê |
| Faturamento do mentorado | ✅ | ✅ só vê | ✅ vê e registra |
| Criar mentorado | ✅ | ❌ | ❌ |
| Editar dados do mentorado (nome, datas, links) | ✅ | ❌ | ❌ |
| Registrar e editar sessões | ✅ | ❌ | ✅ |
| Registrar evolução na trilha (Rotas) | ✅ | ❌ | ✅ |
| Excluir sessão, parcela ou faturamento | ✅ | ❌ | ❌ |

**Diretoria vê tudo e não altera nada.** É leitura em todas as telas, incluindo
o Financeiro completo, sem nenhum botão de salvar, excluir ou confirmar. Não é
só a interface que esconde: o banco não autoriza escrita nenhuma para esse
perfil, então não há como alterar dado por acidente.

**Atendimento (CS) usa o perfil de Administrador** — não existe um tipo separado
para CS. Quem está no CS tem os mesmos acessos de quem administra.

Todos os perfis veem **todos** os mentorados do programa, não apenas os que
atendem. Isso é uma limitação atual conhecida — veja *Limitações* no fim.

---

## As telas

Duas coisas se repetem em todas elas:

- **Caixa de busca por mentorado.** Toda tela que lista mentorado tem a sua, no
  topo, e o texto digitado vale só naquela tela — buscar um nome em Sessões não
  recorta o Financeiro. A comparação ignora maiúsculas e acentos e aceita partes
  fora de ordem: *silva ana* acha "Ana Paula da Silva", *jose* acha "José".
  A busca recorta **as listas**, nunca os cards e alertas do topo: um total que
  encolhesse ao digitar deixaria de ser o total da operação.

  Em **Sessões** a caixa também aceita **data e hora**, nos formatos que se
  costuma digitar: `17/09` como a tela mostra, `17/09/2026` com o ano, `09/2026`
  para varrer o mês inteiro, `2026-09-17` como o banco guarda, e `14:00` pela
  hora. Vale para sessão 1:1 e para encontro em grupo. Nas outras telas a busca
  continua sendo só por nome.
- **Botão + Novo mentorado.** Presente nas cinco telas, para quem tem permissão
  de criar (administrador e diretoria). Nas telas que já têm uma ação própria —
  Sessões, com o encontro em grupo — ele aparece como botão secundário.

### Dashboard

É a tela inicial e responde "como está o programa hoje".

O bloco do topo é o mais importante: **"Precisa de atenção agora"**. Ele lista
apenas o que exige ação, com a contagem ao lado e um link *ver* que leva direto
aos casos. Quando não há nada pendente, o título vira **"Tudo em ordem"**.

Abaixo dele:

- **Números gerais** — mentorados ativos (com pausados e cancelados ao lado),
  sessões 1:1 concluídas, quantas estão agendadas, e os encontros em grupo —
  contados como encontros, com o total de presenças ao lado. Sessão 1:1 e sessão
  em grupo nunca são somadas.
- **Progressão por faturamento** — mentorados ordenados pelo faturamento
  acumulado que foi registrado, com faixa (Iniciante, Bronze, Prata, Ouro,
  Platina, Diamante) e quanto falta para a próxima. Só aparece quem tem
  faturamento registrado; ninguém é estimado ou inventado.
- **Sessões concluídas por mentor** — uma matriz de mentor × etapa da trilha.
  É a tabela usada no fechamento dos mentores, e é a única do dashboard com
  **filtro de mês** próprio: abre no mês corrente e, se ele ainda não tem
  nenhuma sessão concluída, no mês mais recente que tem — nunca vazia por
  padrão. *Todos os meses* devolve o histórico acumulado.

  Os totais ficam em **duas colunas separadas, nunca somadas**: **1:1** conta
  sessões individuais e **Grupo** conta *encontros coletivos conduzidos* — não
  presenças (o número de presenças está no title da célula). Somar as duas
  misturaria unidades: um plantão com 30 inscritos entraria com peso 1, igual a
  uma sessão individual.

  A contagem é por **reunião, não por linha do banco**. Quando o mesmo
  mentorado tem duas sessões concluídas na mesma data, hora e mentor, é uma
  reunião gravada duas vezes (ver *Encontro em grupo é N linhas* no
  ARCHITECTURE) e entra uma vez só; a tabela avisa quantas colapsou. Duas
  grafias do mesmo mentor viram uma linha só, não duas.

  Quem saiu do projeto aparece marcado como *fora do projeto* e continua
  contando no histórico. Sessões concluídas sem mentor identificado aparecem
  numa linha própria em vez de desaparecer da conta, e sessões concluídas sem
  data são avisadas à parte — elas não entram em mês nenhum.
- **Próximas sessões agendadas** — as 8 mais próximas, 1:1 e em grupo juntas.
  Um encontro coletivo ocupa uma linha só, com a etiqueta *grupo* no lugar do
  nome. Nunca mostra data passada.
- **Sessões sem evento no Google Agenda** — ver *Alertas* abaixo.
- **Mentorados sem sessão há +30 dias** — ver *Alertas* abaixo.

Clicar em qualquer linha abre a ficha do mentorado.

### Mentorados

A lista de todos os registros. Busca por nome e filtro por *Somente ativos*,
*Somente pausados* ou *Contrato pendente* (este último só para administrador).

A coluna **Sessões** é uma barra de progresso: cada tracinho é uma sessão da
trilha — verde concluída, azul agendada, vermelho bloqueada, cinza não iniciada.
Passe o mouse para ver a etapa e o status. Só a trilha 1:1 entra nessa barra;
encontros em grupo não contam como avanço da trilha.

Quem está pausado ou cancelado aparece esmaecido, com uma etiqueta ao lado.
Clique em qualquer coluna do cabeçalho para ordenar.

Na ficha, logo abaixo do nome, fica o campo **E-mail no Google Agenda**. É o
e-mail com que o mentorado entra como convidado nas reuniões — preenchê-lo faz o
sync casar a sessão por ele, e aí o título do convite não precisa mais trazer o
nome da pessoa. Um e-mail só pode estar em um mentorado: se já estiver em outro,
o sistema avisa em vez de salvar, porque dois cadastros com o mesmo endereço
fariam o sync descartar o evento em vez de escolher um.

### Sessões

A agenda, dividida em dois grupos.

**Sessões 1:1 com mentores** são os encontros individuais da trilha: o
Diagnóstico, o Plano de Ação e os Checkups. Vêm em quatro blocos —
**Aguardando confirmação**, **Agendadas**, **Concluídas** (últimas 30) e
**Bloqueadas**. Cada linha traz data e hora, mentorado, etapa, mentor, status e
os links disponíveis (meet, gravação, anotações). Se um link estiver salvo em
formato inválido, ele aparece com um asterisco e não é clicável.

*Aguardando confirmação* vem primeiro porque é o único bloco que pede ação:
cada sessão confirmada ali entra no fechamento do mês.

Algumas linhas trazem uma etiqueta ao lado da etapa, apontando o que precisa de
correção:

| Etiqueta | O que significa |
|---|---|
| **contada** | Das linhas desta mesma reunião, é esta que entra na contagem do mentor. |
| **ignorada · mesma reunião** | Mesmo mentorado, data, hora e mentor de outra linha já contada. Ficou fora para não contar em dobro — corrija a etapa errada ou apague a linha sobrando. |
| **sem data** | Concluída sem data não entra em nenhum mês do fechamento. |
| **sem mentor** | Aguardando confirmação sem mentor na linha: quando for concluída, não será creditada a ninguém. |
| **etapa deduzida** | O título do evento não dizia a etapa e o sync escolheu pela trilha. Abra a sessão e **salve** — confirmando ou corrigindo — para a marca sair. |

**Sessões em grupo** são os encontros coletivos, num painel por categoria:
**Plantão de Dúvida Semanal** e **Sessão de Implementação Mensal**. Aqui cada
linha é o encontro inteiro, não um participante — mostra data, mentor, quantos
participantes e o status predominante. Clicar abre a lista de presenças, onde se
ajusta participante por participante ou se confirma o encontro todo de uma vez.
Confirmar em lote exige informar quem atendeu, mesma regra da confirmação
individual.

No topo, três controles: a busca (por mentorado, etapa, mentor ou data), o filtro por
tipo (só 1:1, só grupo, ou ambos) e o filtro por mentor, este último com a opção
*— sem mentor —* para achar sessões que ninguém assumiu. Nos blocos de grupo a
busca é aplicada ao encontro inteiro, não à linha de cada participante: procurar
por alguém traz o encontro dele com todos os participantes, porque a coluna
*Participantes* precisa continuar dizendo quem esteve na sala.

O administrador registra um encontro coletivo em **+ Sessão em grupo**: escolhe
a categoria, data, hora, mentor e links, e marca quem participou. A lista de
participantes tem busca própria — **Selecionar todos** passa a alcançar só quem
está visível, enquanto **Limpar seleção** continua limpando todos, para não
sobrar ninguém marcado fora da vista.

### Rotas

O acompanhamento qualitativo, para além de "a sessão aconteceu".

Escolha a rota no topo e o mentorado no seletor — a caixa ao lado dele recorta a
lista quando são muitos, e se o mentorado aberto sai da busca a tela passa para o
primeiro que casa, para o seletor e a trilha nunca falarem de pessoas diferentes.
A trilha de marcos aparece em sequência, com o marco atual destacado. São os
seis marcos da rota no *Compilado das Rotas Elite 3D* — R$ 500, 2.000, 10.000,
20.000, 50.000 e 100.000, com placa a partir do terceiro. O que muda entre
rotas é a unidade: **Marketplace mede o faturamento do mês; Feiras e Lives e
B2B / Varejo medem o acumulado da rota.**

Clique no marco para expandir. Dentro vêm a restrição, a alavanca, a
pergunta-chave, os apoios e os indicadores daquele marco, o faturamento do
mentorado na rota comparado com a meta, e o **teste de passagem**: a lista de
critérios para marcar um a um — o Marco 01 de Marketplace tem dois portões, um
de estrutura e um de receita. O progresso e os critérios pendentes saem do que
está marcado, sem campo à parte. Abaixo da lista ficam status, data de
conclusão, próxima ação e bloqueios, e o botão **Salvar evolução**. Um marco
fica aberto por vez.

Mais abaixo, na mesma tela: o **canal de venda** do mentorado e o
**faturamento mensal** — total do mês, comparação com o mês anterior, gráfico
de evolução e o formulário para registrar um novo mês. Excluir um registro de
faturamento é só para administrador.

### Financeiro — só administrador

Três indicadores no topo: parcelas vencidas, quantos estão com o restante em
aberto e quantos contratos foram assinados.

Depois, **Cobranças com parcela vencida** e **Próximos vencimentos** (os 10
mais próximos). No fim, a **Situação por mentorado**: contrato, entrada e forma,
restante e forma, e parcelas pagas.

A busca do topo recorta as três tabelas. Os indicadores continuam contando a
operação inteira: quando a busca esconde uma cobrança vencida, a tabela diz
quantas ficaram de fora em vez de aparecer vazia — cobrança que some ao digitar
um nome vira cobrança esquecida.

### Ficha do mentorado

Abre ao clicar em qualquer mentorado, em qualquer tela. Ela se adapta à origem:
vindo de Sessões mostra só a trilha; vindo de Financeiro mostra só contrato,
pagamentos e parcelas; das outras telas mostra tudo.

É onde se registra sessão, se marca parcela como paga, se troca a situação para
pausado ou cancelado, e onde ficam os links de Drive, mapa mental e grupo de
WhatsApp.

A trilha 1:1 e os encontros em grupo do mentorado ficam em blocos separados. A
contagem de *"N de 12 concluídas"* no topo da ficha considera só a trilha.

No fim da ficha completa, só para administrador, fica **Excluir mentorado**.
Apagar a ficha apaga junto tudo que está pendurado nela — sessões, parcelas,
marcos de rota e registros de faturamento — e as sessões concluídas que saírem
levam embora a contagem que o fechamento dos mentores usa. Por isso a confirmação
lista o que vai sumir e pede o **nome do mentorado digitado**; não é um clique.
Na maioria dos casos o que se quer é *Cancelado* na situação: o histórico fica de
pé e a pessoa sai das listas de ativos. Exclua quando o registro nunca deveria ter
existido — duplicata, teste, cadastro errado.

### Campos de data

Todo campo de data do sistema abre um calendário ao clique, em qualquer ponto do
campo — não só num ícone. Dá para andar mês a mês pelas setas, clicar no título
para escolher o mês numa grade e pular de ano, ou navegar pelo teclado. **Hoje**
preenche com a data de hoje e **Limpar** esvazia o campo. A data aparece sempre
como DD/MM/AAAA.

---

## Os alertas e o que fazer com cada um

Clicar em **conferir** ou **ver** num alerta não abre a tela inteira: abre a
tela de Sessões mostrando **só as linhas que aquele alerta contou**, com um
painel no topo explicando o problema e o que fazer, e as linhas destacadas. Os
filtros de tipo e mentor são zerados, senão poderiam esconder justamente o que o
alerta aponta. *Mostrar todas as sessões* sai do recorte, e trocar de tela
também.

Nas reuniões gravadas em duas etapas, o recorte traz **as duas linhas do par** —
sem ver as duas lado a lado não há como decidir qual etapa está errada.

| Alerta | O que significa | O que fazer |
|---|---|---|
| **Mentorados sem sessão há +30 dias** | Passou mais de um mês sem sessão concluída e não há nada agendado. Quem nunca concluiu nenhuma sessão é medido pela data de fechamento do contrato, e aparece marcado como **Nunca começou** — esse é o caso mais grave. | Falar com o mentor e com o mentorado. Agendar. |
| **Sessões aguardando confirmação** | A data da sessão já passou e ninguém confirmou se ela aconteceu. | Abrir a sessão e usar **Confirmar**. É obrigatório informar quem atendeu — sem isso a sessão não entra na conta do mentor. |
| **Sessões sem evento no Google Agenda** | O evento foi apagado, renomeado ou saiu da janela de sincronização. Esses registros **pararam de receber atualização automática**. | Conferir manualmente. Se o encontro aconteceu, confirmar na mão. |
| **Contratos pendentes de assinatura** (admin) | Mentorado ativo cujo contrato não está como *Assinado*. | Cobrar a assinatura. |
| **Parcelas vencidas em aberto** (admin) | Parcela com vencimento passado e não marcada como paga. | Cobrar, e marcar como paga na ficha. |

---

## O que é automático e o que é manual

**Automático, a cada 15 minutos:** o sistema lê o Google Agenda e cria ou
atualiza as sessões. Sessões cuja data já passou viram *Aguardando confirmação*
sozinhas.

Para o evento ser reconhecido, ele precisa dizer **quem** e **qual etapa**:

- **Quem** — pelo **e-mail do mentorado na lista de convidados**, batendo com o
  campo *E-mail no Google Agenda* da ficha dele. É o caminho recomendado.
  Enquanto a ficha estiver sem e-mail, o sistema cai no antigo: procurar o
  **nome do mentorado escrito no título**.
- **Qual etapa** — pelo **título**, quando ele contém *Diagnóstico*, *Plano de
  Ação* ou *Checkup N*. Quando não contém, e **só** quando o mentorado veio pelo
  e-mail do convidado, o sistema **deduz**: usa a primeira etapa da trilha ainda
  livre para aquela pessoa — a primeira que não está concluída nem já presa a
  outro evento da agenda.

Ou seja: **com o e-mail preenchido na ficha, o título fica livre de verdade.**
`teste`, `Mentoria` ou um título vazio de sentido viram sessão do mesmo jeito.
Sem o e-mail, o título continua tendo que trazer o nome da pessoa **e** a etapa.

**A dedução é um palpite, e a aplicação trata como tal.** Ela acerta quando a
trilha anda na ordem e erra quando vocês pulam ou repetem etapa. Como a etapa
alimenta a matriz que fecha o mês dos mentores, a sessão nasce com a etiqueta
**etapa deduzida**, aparece no alerta do dashboard e só perde a marca quando
alguém abre a sessão e salva — confirmando ou corrigindo. Se o título disser a
etapa, nada disso acontece: título vence dedução, sempre.

Duas coisas importantes decorrem disso:

- **Se não der para identificar o mentorado, o evento é ignorado** e a sessão
  não aparece aqui — de propósito, para não atribuir a pessoa errada. É o que
  mantém compromisso pessoal e reunião interna fora da trilha.
- **Quem é convidado importa.** O mentor também é identificado por e-mail.
  Convidar apenas quem vai atender — se CS ou observadores entrarem como
  convidados, a sessão pode ser creditada a quem só acompanhou.

### Pagamentos vindos da Lia

A Lia é o gestor de pagamentos. Quando um pagamento muda lá — parcela paga,
vencida, cancelada — ela avisa a Central na hora, e a ficha do mentorado se
atualiza sozinha. **Nada vai no sentido contrário:** cobrança se cria e se
cancela na Lia, aqui ela só aparece.

Na ficha, em **Parcelas**, isso vira o que interessa no dia a dia: quantas foram
pagas, o valor de cada uma e **quanto falta para a próxima vencer** — *"#3 vence
em 3 dias"*, no próprio título da seção.

Quem tem cobrança na Lia tem as parcelas **vindas dela**, e elas não são
editáveis aqui: editar à mão seria perder a alteração no webhook seguinte, sem
aviso. A ficha diz isso na tela. Quem não tem cobrança na Lia segue com as
parcelas preenchidas à mão, como sempre.

O vínculo entre a cobrança e o mentorado é o **e-mail** — o mesmo campo que o
Google Agenda usa. Cobrança de um e-mail que não está em ficha nenhuma fica
guardada sem dono e é adotada assim que o cadastro aparecer; nada se perde.

Duas coisas a Lia **não** decide: *Patrocinado* e *Cancelou*. São situações que
alguém definiu e que não existem como cobrança, então ficam intocadas.

**Manual, feito pela equipe:** cadastro do mentorado, contrato, entrada,
restante, parcelas, situação (pausado/cancelado), links, marcos da trilha,
canal de venda, faturamento mensal, a confirmação de quem atendeu cada sessão,
e **todo encontro em grupo**. O sync só cria sessão quando identifica etapa *e*
mentorado, e as categorias coletivas não estão no reconhecedor de título —
plantão e implementação nunca chegam por ele.

---

## Limitações conhecidas

Coisas que a ferramenta **não** faz hoje, para você não procurar em vão:

- **Não há filtro "meus mentorados".** Todo mentor vê todos. O sistema ainda não
  liga o nome do mentor na sessão à conta de quem faz login.
- **Não há campo de observações, anotações internas ou follow-up.** Não existe
  onde registrar o que foi conversado, por que alguém pausou, ou o que ficou
  combinado para a próxima semana.
- **Não há histórico de alterações.** Não é possível saber quem mudou um dado,
  quando, nem qual era o valor anterior.
- **Não há turma, programa ou período.** Não dá para comparar grupos.
- **Não há relatório exportável.** O que existe são as telas.
- **A lista de mentores é fixa no código.** Incluir ou remover mentor exige
  alteração técnica, não é configurável na tela.
- **Não há tela para definir o perfil de acesso.** Todo login novo nasce como
  Mentor, e trocar para Administrador ou Diretoria é intervenção manual no
  banco. Enquanto não trocarem, a pessoa vê o que um mentor vê.
- **Valores das parcelas estão vazios.** A estrutura existe, mas o valor e o
  vencimento não vêm sendo preenchidos — então indicadores de inadimplência em
  reais não são confiáveis.
- **Encontro em grupo não é um registro único.** Ele existe como uma presença
  por participante, e a tela reagrupa por categoria + data + hora. Na prática:
  mudar a data, a hora ou o mentor de um encontro já registrado exige editar
  cada participante, e alterar só parte deles parte o encontro em dois.
- **O gráfico de faturamento está quase sem dados.** A tela existe e a
  formatação em real está correta, mas o faturamento mensal quase não vem sendo
  registrado — hoje o gráfico não mostra praticamente nada. Mesmo caso das
  parcelas acima: é origem de dado, não tela.

---

## Detalhes técnicos

Estão em [ARCHITECTURE.md](ARCHITECTURE.md): modelo de dados, permissões,
automações, decisões de projeto e pontos de atenção para quem for mexer no
código.
