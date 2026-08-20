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
| Marcar progresso na trilha (Rotas) | ✅ | ❌ | ✅ |
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
- **Sessões concluídas por mentor** — uma matriz de mentor × etapa da trilha,
  mais uma coluna **Grupo** com os encontros coletivos que a pessoa conduziu
  (só aparece quando existe algum). Serve para ver carga e distribuição. Quem saiu do projeto aparece marcado como *fora do
  projeto* e continua contando no histórico. Sessões concluídas sem mentor
  identificado aparecem numa linha própria em vez de desaparecer da conta.
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

### Sessões

A agenda, dividida em dois grupos.

**Sessões 1:1 com mentores** são os encontros individuais da trilha: o
Diagnóstico, o Plano de Ação e os Checkups. Vêm em três blocos — **Agendadas**,
**Concluídas** (últimas 30) e **Bloqueadas**. Cada linha traz data e hora,
mentorado, etapa, mentor, status e os links disponíveis (meet, gravação,
anotações). Se um link estiver salvo em formato inválido, ele aparece com um
asterisco e não é clicável.

**Sessões em grupo** são os encontros coletivos, num painel por categoria:
**Plantão de Dúvida Semanal** e **Sessão de Implementação Mensal**. Aqui cada
linha é o encontro inteiro, não um participante — mostra data, mentor, quantos
participantes e o status predominante. Clicar abre a lista de presenças, onde se
ajusta participante por participante ou se confirma o encontro todo de uma vez.
Confirmar em lote exige informar quem atendeu, mesma regra da confirmação
individual.

No topo, dois filtros: por tipo (só 1:1, só grupo, ou ambos) e por mentor, este
último com a opção *— sem mentor —* para achar sessões que ninguém assumiu.

O administrador registra um encontro coletivo em **+ Sessão em grupo**: escolhe
a categoria, data, hora, mentor e links, e marca quem participou.

### Rotas

O acompanhamento qualitativo, para além de "a sessão aconteceu".

Escolha a rota no topo e o mentorado no seletor. A trilha de marcos aparece em
sequência, com o marco atual destacado. O botão **Marcar** abre o registro do
marco, onde se anota status, data, progresso em %, critérios pendentes,
bloqueios e a próxima ação.

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

### Ficha do mentorado

Abre ao clicar em qualquer mentorado, em qualquer tela. Ela se adapta à origem:
vindo de Sessões mostra só a trilha; vindo de Financeiro mostra só contrato,
pagamentos e parcelas; das outras telas mostra tudo.

É onde se registra sessão, se marca parcela como paga, se troca a situação para
pausado ou cancelado, e onde ficam os links de Drive, mapa mental e grupo de
WhatsApp.

A trilha 1:1 e os encontros em grupo do mentorado ficam em blocos separados. A
contagem de *"N de 12 concluídas"* no topo da ficha considera só a trilha.

### Campos de data

Todo campo de data do sistema abre um calendário ao clique, em qualquer ponto do
campo — não só num ícone. Dá para andar mês a mês pelas setas, clicar no título
para escolher o mês numa grade e pular de ano, ou navegar pelo teclado. **Hoje**
preenche com a data de hoje e **Limpar** esvazia o campo. A data aparece sempre
como DD/MM/AAAA.

---

## Os alertas e o que fazer com cada um

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
atualiza as sessões. Ele identifica a etapa pelo título do evento (precisa
conter *Diagnóstico*, *Plano de Ação* ou *Checkup N*), o mentorado pelo nome no
título, e o mentor pelo e-mail de quem foi convidado. Sessões cuja data já
passou viram *Aguardando confirmação* sozinhas.

Duas coisas importantes decorrem disso:

- **O título do evento no Google Agenda importa.** Se não der para identificar a
  etapa e o mentorado, o evento é ignorado e a sessão não aparece aqui.
- **Quem é convidado importa.** O mentor é identificado por e-mail. Convidar
  apenas quem vai atender — se CS ou observadores entrarem como convidados, a
  sessão pode ser creditada a quem só acompanhou.

**Manual, feito pela equipe:** cadastro do mentorado, contrato, entrada,
restante, parcelas, situação (pausado/cancelado), links, marcos da trilha,
canal de venda, faturamento mensal, a confirmação de quem atendeu cada sessão,
e **todo encontro em grupo**. O sync só cria sessão quando identifica etapa *e*
mentorado no título do evento, e as categorias coletivas não estão no
reconhecedor — plantão e implementação nunca chegam por ele.

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
