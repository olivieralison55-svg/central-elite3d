/* Testes do index.html. Rodar com:  node tests/testes.mjs
 *
 * Cobre o que já quebrou neste projeto antes ou o que quebraria em silêncio:
 * escape de HTML na renderização, o que cada papel vê, a separação entre sessão
 * 1:1 e sessão em grupo, e o formato de data e de moeda.
 * Sai com código 1 se algo falhar.
 */
import {carregarApp, preparar, criarRunner, escapado, semLixo, brl, XSS, fixtures} from "./ambiente.mjs";

const t = criarRunner();

/* Handlers de escrita que a interface pode oferecer. Usado na varredura do
   papel diretoria e no controle negativo com admin, no fim do arquivo. */
const ESCRITA = ["salvarMentorado", "salvarSituacao", "toggleParcela", "addParcela",
  "openParcela", "salvarParcela", "delParcela", "openSessao", "salvarSessao", "delSessao",
  "openConfirmarSessao", "confirmarSessao", "openSessaoGrupo", "criarSessaoGrupo",
  "confirmarGrupo", "salvarMarco", "salvarCanalMentorado", "salvarFaturamento",
  "vincularCobranca", "descartarCobranca", "restaurarCobranca",
  "excluirFaturamento", "openNovoMentorado", "criarMentorado",
  "openExcluirMentorado", "excluirMentorado"];

/* =======================================================================
 * Formatadores
 * ===================================================================== */
{
  const app = preparar(carregarApp());
  const {mod} = app;

  t.secao("Moeda e data");
  t.ok("fmtBRL(1000) = R$ 1.000,00",   brl(mod.fmtBRL(1000))  === "R$ 1.000,00",  brl(mod.fmtBRL(1000)));
  t.ok("fmtBRL(5000) = R$ 5.000,00",   brl(mod.fmtBRL(5000))  === "R$ 5.000,00",  brl(mod.fmtBRL(5000)));
  t.ok("fmtBRL(10000) = R$ 10.000,00", brl(mod.fmtBRL(10000)) === "R$ 10.000,00", brl(mod.fmtBRL(10000)));
  t.ok("fmtBRL(null) não imprime lixo", mod.fmtBRL(null) === brl(mod.fmtBRL(0)) || semLixo(mod.fmtBRL(null)), mod.fmtBRL(null));
  t.ok("fmtD monta DD/MM/AAAA", mod.fmtD("2026-08-20") === "20/08/2026", mod.fmtD("2026-08-20"));
  t.ok("fmtD sem data", mod.fmtD(null) === "—", mod.fmtD(null));

  /* O eixo do gráfico "Evolução mensal" abreviava para "R$ 10k". */
  const eixo = mod.chartScales({callback: (v) => mod.fmtBRL(v)});
  t.ok("eixo do gráfico usa moeda cheia",
    brl(eixo.y.ticks.callback(1000)) === "R$ 1.000,00", String(eixo.y.ticks.callback(1000)));
}

/* =======================================================================
 * Campo de data
 * ===================================================================== */
{
  const {mod} = preparar(carregarApp());

  t.secao("Campo de data");
  const campo = mod.dateField("s_data", "2026-08-20");
  /* O contrato que mantém todo $("#id").value funcionando sem alteração. */
  t.ok("guarda o valor num input hidden com o mesmo id",
    campo.includes('<input type="hidden" id="s_data" value="2026-08-20">'), campo);
  t.ok("mostra a data no formato da aplicação", campo.includes(">20/08/2026<"), campo);
  t.ok("tem gatilho de calendário", campo.includes('class="dp-input"') && campo.includes('data-dp="s_data"'), campo);
  t.ok("vazio mostra placeholder", mod.dateField("x", "").includes("dd/mm/aaaa"), mod.dateField("x", ""));
  t.ok("propaga disabled", mod.dateField("x", "", {disabled: true}).includes(" disabled"));
  t.ok("modo mês guarda YYYY-MM", mod.monthField("ft_mes", "2026-08").includes('value="2026-08"'));
  t.ok("modo mês rotula Mês/Ano", mod.dpLabel("2026-08", "month") === "Ago/2026", mod.dpLabel("2026-08", "month"));
  t.ok("escapa o title", mod.dateField("x", "", {title: XSS}).includes("&lt;img"));
  t.ok("escapa o style", !mod.dateField("x", "", {style: '"><b>'}).includes('"><b>'));
}

/* =======================================================================
 * Classificação e agrupamento de sessões
 * ===================================================================== */
{
  const app = preparar(carregarApp());
  const {mod} = app;
  const S = app.estado.S;

  t.secao("Sessão 1:1 x sessão em grupo");
  t.ok("plantão é grupo", mod.ehGrupo({etapa: "Plantão de Dúvida Semanal"}) === true);
  t.ok("implementação é grupo", mod.ehGrupo({etapa: "Sessão de Implementação Mensal"}) === true);
  t.ok("checkup é 1:1", mod.eh1a1({etapa: "Checkup 3"}) === true);
  t.ok("etapa desconhecida cai como 1:1", mod.eh1a1({etapa: "Checkup extra"}) === true);
  t.ok("ehGrupo tolera nulo", mod.ehGrupo(null) === false);
  /* Ordem 90+ é o que impede colisão com a numeração da trilha. */
  t.ok("ordem da trilha vai até 12", mod.ETAPA_ORD["Checkup 10"] === 12, String(mod.ETAPA_ORD["Checkup 10"]));
  t.ok("ordem de grupo começa em 90",
    mod.ETAPA_ORD["Plantão de Dúvida Semanal"] === 90 && mod.ETAPA_ORD["Sessão de Implementação Mensal"] === 91);

  t.ok("agruparGrupo de lista vazia devolve lista vazia", mod.agruparGrupo([]).length === 0);
  /* Mesma categoria em datas diferentes são encontros diferentes; e mudar a hora
   * de parte dos participantes parte o encontro em dois — não há id de encontro. */
  const duasDatas = mod.agruparGrupo([
    {etapa: "Plantão de Dúvida Semanal", data: "2026-01-07", hora: "19:00:00", status: "Concluída", mentorado_id: "m1"},
    {etapa: "Plantão de Dúvida Semanal", data: "2026-01-14", hora: "19:00:00", status: "Concluída", mentorado_id: "m1"},
  ]);
  t.ok("mesma categoria em datas diferentes são 2 encontros", duasDatas.length === 2, String(duasDatas.length));
  const horaDivergente = mod.agruparGrupo([
    {etapa: "Plantão de Dúvida Semanal", data: "2026-01-07", hora: "19:00:00", status: "Concluída", mentorado_id: "m1"},
    {etapa: "Plantão de Dúvida Semanal", data: "2026-01-07", hora: "20:00:00", status: "Concluída", mentorado_id: "m2"},
  ]);
  t.ok("hora divergente parte o encontro em dois", horaDivergente.length === 2, String(horaDivergente.length));
}

/* Agrupamento com as fixtures reais, num app separado para não sujar estado. */
{
  const app = preparar(carregarApp());
  const {mod} = app;
  const emGrupo = app.estado.S.filter(mod.ehGrupo);

  const enc = mod.agruparGrupo(emGrupo);
  t.ok("5 presenças viram 2 encontros", enc.length === 2, "encontros: " + enc.length);
  const plantao = enc.find((e) => e.etapa === "Plantão de Dúvida Semanal");
  t.ok("o plantão reúne 3 participantes", plantao.itens.length === 3, String(plantao.itens.length));
  t.ok("o encontro herda o link de quem tiver",
    plantao.link_gravacao === "https://exemplo.com/g1", String(plantao.link_gravacao));
  t.ok("status do encontro é o predominante", mod.statusGrupo(plantao) === "Concluída", mod.statusGrupo(plantao));
  t.ok("resumo pluraliza as presenças",
    mod.resumoStatusGrupo(plantao) === "2 concluídas · 1 bloqueada", mod.resumoStatusGrupo(plantao));

  /* A regra que sustenta a trilha de 12 sessões. */
  t.ok("trilha 1:1 de m1 ignora grupo", mod.sessoes1a1De("m1").length === 2, String(mod.sessoes1a1De("m1").length));
  t.ok("grupo de m1 traz os 2 registros", mod.sessoesGrupoDe("m1").length === 2, String(mod.sessoesGrupoDe("m1").length));
  t.ok("barra de progresso conta só a trilha 1:1",
    (mod.progBar("m1").match(/<i /g) || []).length === 2, mod.progBar("m1"));
}

/* =======================================================================
 * Telas — papel admin
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  t.secao("Tela de Sessões (admin)");
  mod.renderSessoes();
  const sess = app.tela();
  t.ok("renderiza sem lixo", semLixo(sess), sess.slice(0, 300));
  t.ok("tem o bloco 1:1", sess.includes("Sessões 1:1 com mentores"));
  t.ok("tem o bloco de grupo", sess.includes("Sessões em grupo"));
  t.ok("um painel por categoria",
    sess.includes("Plantão de Dúvida Semanal · 1 encontro(s)") &&
    sess.includes("Sessão de Implementação Mensal · 1 encontro(s)"));
  t.ok("contador do topo separa os tipos",
    sess.includes("2 sessões 1:1 concluídas") && sess.includes("2 encontro(s) em grupo"),
    sess.slice(sess.indexOf('class="sub"'), sess.indexOf('class="sub"') + 150));
  t.ok("tem coluna Participantes", sess.includes("Participantes"));
  t.ok("tem filtro de tipo", sess.includes("Somente 1:1 com mentores") && sess.includes("Somente em grupo"));
  /* Nao havia bloco para "Aguardando confirmacao": essas sessoes so eram
     alcancaveis pela ficha de cada mentorado, uma por uma. */
  t.ok("tem bloco de Aguardando confirmação", sess.includes("Aguardando confirmação ·"),
    sess.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));
  t.ok("a sessão aguardando confirmação aparece na tela",
    sess.slice(sess.indexOf("Aguardando confirmação ·")).includes("Bruno Dias"),
    sess.slice(sess.indexOf("Aguardando confirmação ·"), sess.indexOf("Aguardando confirmação ·") + 500));
  t.ok("admin vê o botão de registrar grupo", sess.includes("+ Sessão em grupo"));
  t.ok("escapa nome de mentorado", escapado(sess));
  /* esc() não protege dentro de onclick: `&#39;` volta a ser `'` no parse de JS.
   * Por isso encontro em grupo é referenciado por índice, nunca pela etapa. */
  t.ok("encontro em grupo é referenciado por índice", /onclick="openGrupo\(\d+\)"/.test(sess));
  t.ok("nenhum onclick recebe texto de coluna", !/onclick="openGrupo\('/.test(sess));

  t.secao("Filtro de tipo");
  app.estado.filtro.tipoSessao = "grupo";
  mod.renderSessoes();
  const so_g = app.tela();
  t.ok('"grupo" esconde o bloco 1:1',
    !so_g.includes("Sessões 1:1 com mentores") && so_g.includes("Sessões em grupo"));
  app.estado.filtro.tipoSessao = "individual";
  mod.renderSessoes();
  const so_i = app.tela();
  t.ok('"1:1" esconde o bloco de grupo',
    so_i.includes("Sessões 1:1 com mentores") &&
    !so_i.includes('<div class="section-label">Sessões em grupo</div>'));
  app.estado.filtro.tipoSessao = "";

  t.secao("Dashboard (admin)");
  /* A matriz por mentor abre no mes corrente. Estas asserções são sobre o
     histórico inteiro, então o recorte é dito de propósito. */
  app.estado.mesMatriz = "";
  mod.renderDash();
  const dash = app.tela();
  t.ok("renderiza sem lixo", semLixo(dash), dash.slice(0, 300));
  t.ok("card de 1:1 renomeado", dash.includes("Sessões 1:1 concluídas"));
  t.ok("card de grupo presente", dash.includes("Encontros em grupo"));
  /* 1 encontro concluído, 2 presenças (a terceira está bloqueada). */
  t.ok("card de grupo conta encontros, não linhas",
    dash.includes('>1</div><div class="d">2 presença(s)'),
    dash.slice(dash.indexOf("Encontros em grupo"), dash.indexOf("Encontros em grupo") + 200));
  t.ok("matriz por mentor tem coluna Grupo", dash.includes(">Grupo</th>"));
  t.ok("matriz separa 1:1 de grupo em vez de somar",
    dash.includes(">1:1</th>") && !dash.includes('<th class="num">Total</th>'));
  t.ok("próximas mostra o encontro agregado",
    dash.includes('<span class="pill blue">grupo</span> 2 participante(s)'));
  t.ok("próximas não repete o grupo por participante",
    (dash.match(/participante\(s\)/g) || []).length === 1,
    String((dash.match(/participante\(s\)/g) || []).length));
  t.ok("escapa nome de mentorado", escapado(dash));

  t.secao("Outras telas (admin)");
  mod.renderMentorados();
  t.ok("Mentorados sem lixo", semLixo(app.tela()), app.tela().slice(0, 300));
  t.ok("Mentorados escapa nome", escapado(app.tela()));
  mod.renderFinanceiro();
  const fin = app.tela();
  t.ok("Financeiro sem lixo", semLixo(fin), fin.slice(0, 300));
  /* A tela lista situação e vencimento; o valor da parcela só aparece na ficha. */
  t.ok("Financeiro cobra a parcela vencida", fin.includes("Vencida") && fin.includes("01/01/2026"));
  t.ok("Financeiro conta parcelas pagas", fin.includes("0/1"));
  mod.renderRotas();
  const rotas = app.tela();
  t.ok("Rotas sem lixo", semLixo(rotas), rotas.slice(0, 300));
  t.ok('Rotas tem o painel "Evolução mensal"', rotas.includes("Evolução mensal"));
  t.ok("Rotas mostra faturamento em real cheio", brl(rotas).includes("R$ 5.000,00"));
}

/* =======================================================================
 * Modais — papel admin
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  /* A ficha é página, não modal: sai em #app e leva o endereço junto. */
  t.secao("Ficha do mentorado");
  globalThis.openMentorado("m1", "sessoes");
  const ficha = app.tela();
  t.ok("endereço leva id e aba", app.endereco() === "#/mentorado/m1/sessoes", app.endereco());
  t.ok("sem lixo", semLixo(ficha), ficha.slice(0, 300));
  t.ok("bloco 1:1 rotulado", ficha.includes("Sessões 1:1 com mentores"));
  t.ok("bloco de grupo com contagem", ficha.includes("Sessões em grupo &middot; 2"));
  t.ok("resumo conta só a trilha 1:1", ficha.includes("1 de 2 sessões concluídas"),
    ficha.slice(ficha.indexOf("Fechamento"), ficha.indexOf("Fechamento") + 160));
  t.ok("aba financeira não vaza para a de sessões", !ficha.includes('id="e_contr"'));

  globalThis.openMentorado("m1", "financeiro");
  const fichaFin = app.tela();
  t.ok("endereço acompanha a troca de aba", app.endereco() === "#/mentorado/m1/financeiro", app.endereco());
  t.ok("ficha financeira mostra o valor da parcela em real",
    brl(fichaFin).includes("R$ 500,00"), fichaFin.slice(fichaFin.indexOf("Parcelas"), fichaFin.indexOf("Parcelas") + 250));
  t.ok("ficha financeira usa o campo de calendário no vencimento",
    fichaFin.includes('data-dp="np_venc"'));

  /* Aba cadastro é o endereço curto: /financeiro e /sessoes são os sufixos. */
  globalThis.openMentorado("m1", "completo");
  t.ok("cadastro é o endereço sem sufixo", app.endereco() === "#/mentorado/m1", app.endereco());
  t.ok("cadastro traz nome e situação",
    app.tela().includes('id="e_nome"') && app.tela().includes('id="e_situacao"'));
  t.ok("cadastro escapa o nome", semLixo(app.tela()), app.tela().slice(0, 300));

  t.secao("Ficha: aba STLSeller");
  globalThis.openMentorado("m1", "stlseller");
  const stl = app.tela();
  t.ok("endereço da aba STLSeller", app.endereco() === "#/mentorado/m1/stlseller", app.endereco());
  t.ok("aba oferecida no menu da ficha", stl.includes(">STLSeller</button>"));
  t.ok("diz de onde vêm os dados", stl.includes("Dados do STLSeller") && stl.includes("Somente leitura"));
  t.ok("sem lixo", semLixo(stl), stl.slice(0, 300));
  t.ok("título do marketplace escapado", escapado(stl), stl.slice(stl.indexOf("Vaso"), stl.indexOf("Vaso") + 120));
  t.ok("permalink javascript: não vira href", !stl.includes('href="javascript'));
  t.ok("permalink https vira link", stl.includes('href="https://exemplo.com/p/1"'));
  t.ok("faturamento em real", brl(stl).includes("R$ 1.234,50"));
  t.ok("líquido não informado vira traço, não R$ 0,00", !brl(stl).includes("R$ 0,00"),
    stl.slice(stl.indexOf("Pedidos por marketplace"), stl.indexOf("Pedidos por marketplace") + 600));
  t.ok("status real rotulado", stl.includes("pill green") && stl.includes(">Pago<"));
  t.ok("produtos ordenados por faturamento", stl.indexOf("Chaveiro") < stl.indexOf("Vaso"));
  t.ok("último pedido da Lia em horário de Brasília", stl.includes("06/08/2026, 18:52"),
    stl.slice(stl.indexOf("Último pedido"), stl.indexOf("Último pedido") + 120));
  t.ok("aba não escreve nada", !/onclick="salvar|onchange=/.test(stl.slice(stl.indexOf("stl-origem"))));

  globalThis.openMentorado("m2", "stlseller");
  const stl2 = app.tela();
  t.ok("casa pelo e-mail STLFLIX", stl2.includes("PAUSADO") && stl2.includes("Sem pedido na Lia"), stl2.slice(0, 400));
  t.ok("epoch nulo não vira 1969", !stl2.includes("1969") && semLixo(stl2));
  t.ok("sem produtos diz que não há", stl2.includes("Nenhum produto vendido."));

  globalThis.openMentorado("m3", "stlseller");
  t.ok("ficha sem e-mail explica o casamento", app.tela().includes("Esta ficha não tem e-mail"));

  app.estado.STLSELLER_ERRO = 'relation "stlseller_mentorados" does not exist';
  globalThis.openMentorado("m1", "stlseller");
  t.ok("falha de carga aparece na aba", app.tela().includes("Não foi possível carregar os dados do STLSeller"));
  app.estado.STLSELLER_ERRO = null;

  t.secao("Análise (STLSeller)");
  globalThis.location.hash = "#/analise";
  const an = app.tela();
  t.ok("tela de análise desenha", an.includes("<h2>STLSeller</h2>") && an.includes("Dados do STLSeller"), an.slice(0, 300));
  t.ok("sem lixo", semLixo(an), an.slice(0, 300));
  t.ok("recorte padrão é o de ativos", an.includes("Vendendo</div><div class=\"v\">1 de 2"), an.slice(an.indexOf("Vendendo"), an.indexOf("Vendendo") + 120));
  t.ok("bruto vem dos pedidos", brl(an).includes("R$ 1.500,00"));
  t.ok("atribuído vem dos produtos, com a cobertura", brl(an).includes("R$ 1.234,50") && an.includes("82,3% do bruto"));
  t.ok("% de cancelados sobre os pedidos", an.includes("16,7% cancelados"));
  t.ok("nome leva à aba STLSeller da ficha", an.includes("openMentorado('m1','stlseller')"));
  t.ok("anúncio do marketplace escapado", escapado(an));
  t.ok("permalink javascript: não vira href", !an.includes('href="javascript'));
  t.ok("STLFLIX que não é o da loja fica como cadastro incorreto",
    an.includes("E-mail não cadastrado corretamente &middot; 1") && an.includes("E-mail STLFLIX não é o da loja"),
    an.slice(an.indexOf("E-mail não cadastrado"), an.indexOf("E-mail não cadastrado") + 400));
  t.ok("STLFLIX que acha a loja conta como resolvido", an.includes("1 resolvido(s) pelo e-mail STLFLIX: Eva Sem Ficha"));
  globalThis.setAnalise("statusAnalise", "");
  const anTodos = app.tela();
  t.ok("recorte Todos inclui o pausado", anTodos.includes("Vendendo</div><div class=\"v\">1 de 3") && anTodos.includes("Sem conta de seller &middot; 1"),
    anTodos.slice(anTodos.indexOf("Vendendo"), anTodos.indexOf("Vendendo") + 120));
  globalThis.setAnalise("chipAnalise", "vende");
  t.ok("filtro Vendendo tira quem não vende", app.tela().includes("Visão geral por mentorado &middot; 1"));
  globalThis.setAnalise("chipAnalise", "email");
  t.ok("filtro E-mail incorreto usa a mesma regra", app.tela().includes("Visão geral por mentorado &middot; 2")
    && app.tela().includes("Formulário sem e-mail STLFLIX") === false && app.tela().includes("E-mail STLFLIX não encontra conta de seller"));
  globalThis.setAnalise("chipAnalise", "todos");
  globalThis.setAnalise("statusAnalise", "ATIVO");

  t.secao("Endereço da ficha");
  /* Link colado com aba inexistente não pode deixar a página vazia. */
  globalThis.location.hash = "#/mentorado/m1/inventada";
  t.ok("aba desconhecida cai no cadastro", app.tela().includes('id="e_nome"'),
    app.tela().slice(0, 200));
  globalThis.location.hash = "#/mentorado/nao-existe";
  t.ok("ficha inexistente explica em vez de sumir",
    app.tela().includes("Ficha não encontrada"), app.tela().slice(0, 200));
  globalThis.location.hash = "#/mentorados";
  t.ok("voltar para a lista desenha a lista", app.tela().includes("Mentorados"));
  globalThis.openMentorado("m1", "financeiro");
  t.ok("voltar da ficha aponta para a lista de origem",
    app.estado.voltarPara === "#/mentorados", app.estado.voltarPara);

  t.secao("Formulário de sessão");
  globalThis.openSessao("g1", "m1");
  const form = app.modal();
  t.ok("tem optgroup por tipo",
    form.includes('<optgroup label="Sessões 1:1 com mentores">') &&
    form.includes('<optgroup label="Sessões em grupo">'));
  /* Antes, uma etapa fora de ETAPAS não casava com nenhuma option, o browser
   * selecionava a primeira e salvar trocava a etapa em silêncio. */
  t.ok("editar sessão de grupo pré-seleciona a categoria certa",
    /<option selected>Plantão de Dúvida Semanal<\/option>/.test(form),
    form.slice(form.indexOf("optgroup"), form.indexOf("optgroup") + 400));
  t.ok("usa o campo de calendário", form.includes('data-dp="s_data"'));

  globalThis.openSessao(null, "m1");
  t.ok("nova sessão sugere a próxima etapa 1:1 livre",
    /<option selected>Checkup 1<\/option>/.test(app.modal()),
    app.modal().slice(app.modal().indexOf("optgroup"), app.modal().indexOf("optgroup") + 300));

  t.secao("Modal do encontro em grupo");
  mod.renderSessoes();
  globalThis.openGrupo(0);
  const mg = app.modal();
  t.ok("sem lixo", semLixo(mg), mg.slice(0, 300));
  t.ok("lista as presenças", mg.includes("Presenças ·") && mg.includes("Ana Clara") && mg.includes("Bruno Dias"));
  t.ok("escapa nome de participante", escapado(mg));
  t.ok("oferece confirmação em lote do que está pendente", mg.includes("Marcar 1 como concluída"));

  t.secao("Registro de encontro em grupo");
  globalThis.openSessaoGrupo();
  const ng = app.modal();
  t.ok("sem lixo", semLixo(ng), ng.slice(0, 300));
  t.ok("lista as duas categorias",
    ng.includes("Plantão de Dúvida Semanal") && ng.includes("Sessão de Implementação Mensal"));
  t.ok("tem seleção de participantes", ng.includes('class="chk-list"') && ng.includes('class="g-part"'));
  t.ok("usa o campo de calendário", ng.includes('data-dp="g_data"'));
  t.ok("escapa nome na lista", escapado(ng));
  t.ok("só oferece mentorado ativo", !ng.includes("Carla"), "pausado apareceu na lista");
}

/* =======================================================================
 * Escrita no banco: um encontro em grupo é N linhas
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");

  t.secao("criarSessaoGrupo");
  app.preencher("#g_etapa", "Plantão de Dúvida Semanal");
  app.preencher("#g_status", "Agendada");
  app.preencher("#g_mentor", "Sergio");
  app.preencher("#g_data", "2026-09-03");
  app.preencher("#g_hora", "19:00");
  app.preencher("#g_meet", "");
  app.preencher("#g_grav", "");

  app.responder(".g-part:checked", []);
  await globalThis.criarSessaoGrupo();
  t.ok("sem participante não grava nada", app.escritas.length === 0, JSON.stringify(app.escritas));
  t.ok("sem participante avisa", app.toast().includes("ao menos um participante"), app.toast());

  app.responder(".g-part:checked", [{value: "m1"}, {value: "m2"}, {value: "m3"}]);
  await globalThis.criarSessaoGrupo();
  const ins = app.escritas.find((e) => e.op === "insert" && e.tabela === "sessoes");
  t.ok("grava uma linha por participante", ins && ins.dados.length === 3,
    ins ? "linhas: " + ins.dados.length : "nenhum insert");
  t.ok("uma linha por mentorado, sem repetir",
    ins && new Set(ins.dados.map((d) => d.mentorado_id)).size === 3);
  t.ok("todas com a mesma etapa e ordem 90",
    ins && ins.dados.every((d) => d.etapa === "Plantão de Dúvida Semanal" && d.ordem === 90),
    ins && JSON.stringify(ins.dados[0]));
  t.ok("todas com a mesma data, hora e mentor",
    ins && ins.dados.every((d) => d.data === "2026-09-03" && d.hora === "19:00" && d.mentor === "Sergio"));
}

/* =======================================================================
 * confirmarGrupo exige o mentor
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;
  mod.renderSessoes();
  globalThis.openGrupo(0);
  app.limparEscritas();

  t.secao("confirmarGrupo");
  app.preencher("#gc_mentor", "");
  await globalThis.confirmarGrupo();
  t.ok("sem mentor não grava", app.escritas.length === 0, JSON.stringify(app.escritas));
  t.ok("sem mentor avisa", app.toast().includes("quem atendeu"), app.toast());

  app.preencher("#gc_mentor", "Sergio");
  await globalThis.confirmarGrupo();
  const upd = app.escritas.find((e) => e.op === "update" && e.tabela === "sessoes");
  t.ok("grava status e mentor",
    upd && upd.dados.status === "Concluída" && upd.dados.mentor === "Sergio", JSON.stringify(upd && upd.dados));
  t.ok("só toca o que estava pendente", upd && upd.ids && upd.ids.length === 1, JSON.stringify(upd && upd.ids));
}

/* =======================================================================
 * Telas — papel mentor
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "mentor");
  const {mod} = app;

  t.secao("Papel mentor");
  mod.renderSessoes();
  const sess = app.tela();
  t.ok("Sessões sem lixo", semLixo(sess), sess.slice(0, 300));
  t.ok("vê os dois blocos", sess.includes("Sessões 1:1 com mentores") && sess.includes("Sessões em grupo"));
  /* RLS só dá INSERT em sessoes para admin: o botão não deve existir. */
  t.ok("não vê registrar sessão em grupo", !sess.includes("+ Sessão em grupo"), "botão apareceu");
  t.ok("tem o filtro de tipo", sess.includes("Somente em grupo"));

  mod.renderDash();
  const dash = app.tela();
  t.ok("Dashboard sem lixo", semLixo(dash), dash.slice(0, 300));
  t.ok("sem alerta de parcelas", !dash.includes("Parcelas vencidas em aberto"));
  t.ok("sem alerta de contratos", !dash.includes("Contratos pendentes de assinatura"));
  t.ok("card de grupo presente", dash.includes("Encontros em grupo"));

  globalThis.openMentorado("m1", "completo");
  const ficha = app.tela();
  t.ok("ficha sem lixo", semLixo(ficha), ficha.slice(0, 300));
  t.ok("ficha sem bloco financeiro", !ficha.includes("Contrato e pagamento"));
  /* Sem verFinanceiro a aba financeira nem é oferecida. */
  t.ok("sem aba financeira", !ficha.includes(">Financeiro</button>"), ficha.slice(0, 300));
  t.ok("campo de data vem desabilitado", /data-dp="e_fech"[^>]*disabled/.test(ficha), "campo editável");
  globalThis.openMentorado("m1", "sessoes");
  t.ok("ficha mantém a divisão de sessões",
    app.tela().includes("Sessões 1:1 com mentores") && app.tela().includes("Sessões em grupo"));

  /* O endereço é público: quem manda um link do financeiro para um mentor não
     pode abrir para ele o que a tela esconde. */
  globalThis.location.hash = "#/mentorado/m1/financeiro";
  t.ok("link da aba financeira cai nas sessões",
    app.tela().includes("Sessões 1:1 com mentores") && !app.tela().includes('id="e_contr"'),
    app.tela().slice(0, 200));
  t.ok("mentor não recebe a aba STLSeller", !app.tela().includes(">STLSeller</button>"));
  globalThis.location.hash = "#/analise";
  t.ok("link da análise não abre para mentor", app.endereco() === "#/dash" && !app.tela().includes("<h2>STLSeller</h2>"), app.endereco());
  globalThis.location.hash = "#/mentorado/m1/stlseller";
  t.ok("link da aba STLSeller cai nas sessões",
    app.tela().includes("Sessões 1:1 com mentores") && !app.tela().includes("Dados do STLSeller"),
    app.tela().slice(0, 200));
  globalThis.location.hash = "#/financeiro";
  t.ok("link da tela financeira volta para o dashboard",
    app.endereco() === "#/dash", app.endereco());

  /* Mentor tem UPDATE em sessoes, então confirma — igual à confirmação individual. */
  mod.renderSessoes();
  globalThis.openGrupo(0);
  t.ok("pode confirmar o encontro em lote", app.modal().includes("Confirmar o encontro"));
}

/* =======================================================================
 * Telas — papel diretoria (lê tudo, escreve nada)
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "diretoria");
  const {mod} = app;

  t.secao("Papel diretoria — capacidades");
  t.ok("só tem verFinanceiro",
    JSON.stringify(mod.CAPACIDADES.diretoria) === '["verFinanceiro"]',
    JSON.stringify(mod.CAPACIDADES.diretoria));
  t.ok("vê financeiro", mod.pode("verFinanceiro") === true);
  ["criarMentorado", "editarMentorado", "editarFinanceiro", "escreverSessao",
   "criarSessao", "escreverRotas", "excluir"].forEach((cap) => {
    t.ok("não pode " + cap, mod.pode(cap) === false);
  });
  t.ok("rótulo próprio na barra lateral", mod.PAPEL_LABEL.diretoria === "Diretoria", mod.PAPEL_LABEL.diretoria);

  t.secao("Papel diretoria — o que vê");
  mod.renderFinanceiro();
  const fin = app.tela();
  t.ok("abre a tela Financeiro", semLixo(fin) && fin.includes("Contratos, entradas e parcelas"), fin.slice(0, 200));
  mod.renderMentorados();
  t.ok("vê a coluna Contrato", app.tela().includes("Contrato"), "coluna ausente");
  mod.renderDash();
  const dash = app.tela();
  t.ok("vê os alertas financeiros",
    dash.includes("Parcelas vencidas em aberto") && dash.includes("Contratos pendentes de assinatura"));
  globalThis.openMentorado("m1", "financeiro");
  const ficha = app.tela();
  t.ok("vê o bloco financeiro da ficha", ficha.includes("Contrato"));
  t.ok("vê o valor da parcela", brl(ficha).includes("R$ 500,00"));

  t.secao("Papel diretoria — não escreve");
  /* Varredura: nenhuma tela ou modal pode oferecer handler de escrita.
   * É o teste que pega botão novo esquecido — mais durável que checar um a um. */
  const saidas = [];
  for (const render of ["renderDash", "renderMentorados", "renderSessoes", "renderFinanceiro", "renderRotas"]) {
    mod[render]();
    saidas.push([render, app.tela()]);
  }
  mod.renderSessoes();                       // repovoa GRUPO_REG
  globalThis.openGrupo(0);
  saidas.push(["openGrupo", app.modal()]);
  for (const sec of ["completo", "sessoes", "financeiro"]) {
    globalThis.openMentorado("m1", sec);
    saidas.push(["ficha:" + sec, app.tela()]);
  }

  let vazamentos = [];
  for (const [nome, html] of saidas) {
    for (const fn of ESCRITA) {
      if (html.includes(fn + "(")) vazamentos.push(nome + " → " + fn);
    }
  }
  t.ok("nenhum handler de escrita em nenhuma tela ou modal",
    vazamentos.length === 0, vazamentos.join("; "));

  /* Alguns pontos específicos que não são botão e passam batido fácil. */
  globalThis.openMentorado("m1", "financeiro");
  const fichaFin = app.tela();
  t.ok("azulejo da parcela não tem onclick", !fichaFin.includes("toggleParcela"));
  t.ok("sem lápis de editar parcela", !fichaFin.includes("parc-edit"));
  t.ok("sem adicionar parcela", !fichaFin.includes("+ Adicionar parcela"));
  t.ok("sem salvar alterações", !fichaFin.includes("Salvar alterações"));
  mod.renderRotas();
  const rotas = app.tela();
  t.ok('sem botão "Marcar" na trilha', !rotas.includes(">Marcar<"));
  t.ok("sem formulário de registrar faturamento", !rotas.includes("Registrar faturamento"));
  t.ok("mas vê o gráfico e os registros", rotas.includes("Evolução mensal") && rotas.includes("Registros"));
  mod.renderSessoes();
  t.ok("sem registrar sessão em grupo", !app.tela().includes("+ Sessão em grupo"));
  mod.renderDash();
  t.ok("sem criar mentorado", !app.tela().includes("+ Novo mentorado"));
}

/* =======================================================================
 * Matriz de sessões por mentor: a base do fechamento
 *
 * Conta reunião, não linha. Uma reunião chega gravada duas vezes quando o
 * título do evento no Google nomeia uma etapa diferente da que já estava na
 * trilha: o sync procura a linha existente por etapa, não acha, e insere outra.
 * Em produção isso já inflou a contagem de quatro mentores.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  app.estado.S = [
    /* Uma reunião, duas linhas: o sync chamou de "Plano de Ação" o que a trilha
       registrou como "Checkup 5". Mesmo mentorado, data, hora e mentor. */
    {id:"d1", mentorado_id:"m1", etapa:"Plano de Ação", ordem:2, status:"Concluída", mentor:"Evaldo", data:"2026-07-16", hora:"14:00:00", google_event_id:"ev1"},
    {id:"d2", mentorado_id:"m1", etapa:"Checkup 5",     ordem:7, status:"Concluída", mentor:"Evaldo", data:"2026-07-16", hora:"14:00:00", google_event_id:null},
    // Mesmo dia e mentor, horas diferentes: são duas reuniões, não uma.
    {id:"d3", mentorado_id:"m2", etapa:"Checkup 1", ordem:3, status:"Concluída", mentor:"Luan", data:"2026-07-20", hora:"10:00:00"},
    {id:"d4", mentorado_id:"m2", etapa:"Checkup 2", ordem:4, status:"Concluída", mentor:"Luan", data:"2026-07-20", hora:"15:00:00"},
    // Duas grafias do mesmo mentor: não podem virar duas linhas na tabela.
    {id:"d5", mentorado_id:"m3", etapa:"Checkup 1", ordem:3, status:"Concluída", mentor:" Sérgio ", data:"2026-07-21", hora:"09:00:00"},
    {id:"d6", mentorado_id:"m3", etapa:"Checkup 2", ordem:4, status:"Concluída", mentor:"Sergio",   data:"2026-07-22", hora:"09:00:00"},
    // Agosto: fica fora quando o recorte é julho.
    {id:"d7", mentorado_id:"m2", etapa:"Checkup 3", ordem:5, status:"Concluída", mentor:"Luan", data:"2026-08-04", hora:"10:00:00"},
    // Concluída sem data: não entra em mês nenhum.
    {id:"d8", mentorado_id:"m1", etapa:"Checkup 6", ordem:8, status:"Concluída", mentor:"Luan", data:null, hora:null},
  ];

  const painel = (html) => {
    const i = html.indexOf("Sessões concluídas por mentor");
    return html.slice(i, html.indexOf("</table>", i));
  };
  const linhaDe = (html, mentor) =>
    (painel(html).match(/<tr>.*?<\/tr>/g) || []).find(r => r.includes(">" + mentor + "<")) || "";
  const celulas = (html, mentor) =>
    [...linhaDe(html, mentor).matchAll(/<td class="num"[^>]*>([^<]*)<\/td>/g)].map(m => m[1]);
  const total1a1 = (html, mentor) => {
    const m = linhaDe(html, mentor).match(/--green\);font-weight:700">([^<]*)</);
    return m ? m[1] : null;
  };

  t.secao("Matriz por mentor — conta reunião, não linha");
  app.estado.mesMatriz = "2026-07";
  mod.renderDash();
  const jul = app.tela();
  t.ok("renderiza sem lixo", semLixo(jul), jul.slice(0, 200));
  /* Colunas de julho: Plano, C1, C2, C3, C5, C6 — e o total 1:1 no fim. */
  t.ok("reunião gravada em duas etapas conta uma vez",
    total1a1(jul, "Evaldo") === "1", "Evaldo: " + JSON.stringify(celulas(jul, "Evaldo")));
  t.ok("ao colapsar fica a etapa registrada na mão, não a do título do evento",
    celulas(jul, "Evaldo").join(",") === "·,·,·,·,1,·,1", JSON.stringify(celulas(jul, "Evaldo")));
  t.ok("mesmo dia em horas diferentes são duas reuniões",
    total1a1(jul, "Luan") === "2", "Luan: " + JSON.stringify(celulas(jul, "Luan")));
  t.ok("duas grafias do mesmo mentor viram uma linha só",
    total1a1(jul, "Sergio") === "2" && !painel(jul).includes("Sérgio"),
    "Sergio: " + JSON.stringify(celulas(jul, "Sergio")));
  t.ok("avisa a reunião contada em duas etapas",
    jul.includes("1 reunião(ões) gravada(s) em duas etapas"));
  t.ok("avisa a concluída sem data, que não entra em mês nenhum",
    jul.includes("1 sessão(ões) concluída(s) sem data"));

  t.secao("Filtro de mês da matriz");
  app.estado.mesMatriz = "2026-08";
  mod.renderDash();
  const ago = app.tela();
  t.ok("agosto conta só o que é de agosto",
    total1a1(ago, "Luan") === "1" && !linhaDe(ago, "Evaldo"),
    "Luan: " + JSON.stringify(celulas(ago, "Luan")));
  t.ok("o mês selecionado fica marcado no seletor",
    ago.includes('<option value="2026-08" selected>'));

  app.estado.mesMatriz = "";
  mod.renderDash();
  const tudo = app.tela();
  t.ok('"todos os meses" soma os meses e a sessão sem data',
    total1a1(tudo, "Luan") === "4", "Luan: " + JSON.stringify(celulas(tudo, "Luan")));
  t.ok("sem recorte não avisa sobre sessão sem data",
    !tudo.includes("sem data — fora de qualquer mês"));
  t.secao("Mês padrão da matriz");
  /* O padrão é o mês corrente, mas ele costuma estar vazio no começo do mês —
     e uma tabela vazia na abertura do dashboard é lida como defeito. */
  app.estado.mesMatriz = null;
  mod.renderDash();
  const padrao = app.tela();
  t.ok("sem escolha, abre no mês mais recente que tem sessão",
    padrao.includes('<option value="2026-08" selected>'),
    (padrao.match(/<option value="[^"]*" selected>/) || ["nenhum"])[0]);

  app.estado.mesMatriz = null;
  app.estado.S = [{id:"z1", mentorado_id:"m1", etapa:"Checkup 1", ordem:3,
                   status:"Concluída", mentor:"Luan", data:null, hora:null}];
  mod.renderDash();
  t.ok("sem nenhum mês com data, cai em todos os meses e ainda conta",
    app.tela().includes('<option value="" selected>'), app.tela().slice(0,120));

  t.ok("mês sem sessão nenhuma não finge que a tabela existe",
    (() => { app.estado.mesMatriz = "2026-07";
             app.estado.S = [];
             mod.renderDash();
             return app.tela().includes("Nenhuma sessão concluída"); })());

  /* Mentor fora das três listas: o nome é exibido como veio, só com o espaço
     normalizado. Um erro de escape na normalização corromperia justamente este
     caso — quem está nas listas é salvo pelo nome canônico e esconderia o bug. */
  app.estado.mesMatriz = "2026-07";
  app.estado.S = [
    {id:"v1", mentorado_id:"m1", etapa:"Checkup 1", ordem:3, status:"Concluída", mentor:"Vanessa Sousa",       data:"2026-07-02", hora:"10:00:00"},
    {id:"v2", mentorado_id:"m2", etapa:"Checkup 2", ordem:4, status:"Concluída", mentor:"  Vanessa   Sousa ", data:"2026-07-03", hora:"10:00:00"},
  ];
  mod.renderDash();
  const desconhecido = app.tela();
  t.ok("mentor fora das listas aparece com o nome intacto",
    total1a1(desconhecido, "Vanessa Sousa") === "2",
    painel(desconhecido).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 200));
}

/* =======================================================================
 * Alerta do dashboard leva direto nas linhas
 *
 * "conferir" mandava para a tela de Sessões inteira e deixava a pessoa
 * procurar a linha errada no meio de tudo — sem saber nem quais eram.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  app.estado.S = [
    /* O par: uma reunião, duas linhas (mesmo mentorado, data, hora e mentor). */
    {id:"x1", mentorado_id:"m1", etapa:"Plano de Ação", ordem:2, status:"Concluída", mentor:"Evaldo", data:"2026-07-16", hora:"14:00:00", google_event_id:"ev1"},
    {id:"x2", mentorado_id:"m1", etapa:"Checkup 5",     ordem:7, status:"Concluída", mentor:"Evaldo", data:"2026-07-16", hora:"14:00:00"},
    // Concluída sem data: alerta próprio.
    {id:"x3", mentorado_id:"m2", etapa:"Checkup 1", ordem:3, status:"Concluída", mentor:"Luan", data:null, hora:null},
    // Aguardando confirmação sem mentor: alerta próprio.
    {id:"x4", mentorado_id:"m2", etapa:"Checkup 2", ordem:4, status:"Aguardando confirmação", mentor:null, data:"2026-07-20", hora:"10:00:00"},
    // Nada de errado: não pode aparecer em nenhum dos recortes.
    {id:"x5", mentorado_id:"m3", etapa:"Checkup 1", ordem:3, status:"Concluída", mentor:"Sergio", data:"2026-07-22", hora:"09:00:00"},
  ];
  /* O alerta de "sem data" só existe com um mês selecionado: sem recorte, uma
     sessão sem data continua entrando na conta e não há o que avisar. */
  app.estado.mesMatriz = "2026-07";
  mod.renderDash();
  const dash = app.tela();

  t.secao("Links dos alertas");
  t.ok("alerta de dobradas foca em vez de só trocar de tela",
    dash.includes(`onclick="focarSessoes('dobradas')"`) &&
    !dash.includes(`duas etapas — contei uma vez cada</div><a onclick="setView('sessoes')"`));
  t.ok("alerta de sem data foca", dash.includes(`onclick="focarSessoes('semData')"`));
  t.ok("alerta de sem mentor foca", dash.includes(`onclick="focarSessoes('semMentor')"`));

  t.secao("Foco nas reuniões dobradas");
  globalThis.focarSessoes("dobradas");
  const dob = app.tela();
  t.ok("abre a tela de Sessões", dob.includes("<h2>Sessões</h2>"), dob.slice(0, 120));
  t.ok("renderiza sem lixo", semLixo(dob), dob.slice(0, 200));
  t.ok("explica o que a pessoa está vendo",
    dob.includes("Reuniões gravadas em duas etapas") && dob.includes("mostrar todas as sessões"));
  /* As DUAS linhas do par: sem as duas lado a lado não há como decidir qual
     etapa está errada. */
  t.ok("mostra as duas linhas do par",
    dob.includes(">Plano de Ação") && dob.includes(">Checkup 5"),
    dob.slice(dob.indexOf("Concluídas"), dob.indexOf("Concluídas") + 400));
  t.ok("esconde o que o alerta não aponta",
    !dob.includes("Diego") && !dob.includes("Checkup 1<"),
    dob.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));
  t.ok("diz qual das duas foi contada",
    dob.includes(">contada</span>") && dob.includes(">ignorada · mesma reunião</span>"));
  t.ok("destaca as linhas apontadas", (dob.match(/<tr class="click alvo"/g) || []).length === 2,
    String((dob.match(/<tr class="click alvo"/g) || []).length));
  t.ok("não corta em 30 sob foco", dob.includes("<h3>Concluídas ·") && !dob.includes("últimas 30"));

  t.secao("Sair do foco");
  globalThis.limparFoco();
  const tudo = app.tela();
  t.ok("volta a mostrar tudo",
    !tudo.includes("mostrar todas as sessões") && tudo.includes("Checkup 1"));
  t.ok("o marcador continua na linha mesmo sem foco",
    tudo.includes(">ignorada · mesma reunião</span>"));
  t.ok("sem foco o corte de 30 volta", tudo.includes("últimas 30"));

  globalThis.focarSessoes("dobradas");
  mod.setView("dash");
  mod.setView("sessoes");
  t.ok("trocar de tela descarta o foco",
    !app.tela().includes("mostrar todas as sessões"), app.tela().slice(0, 200));

  t.secao("Foco nos outros dois alertas");
  globalThis.focarSessoes("semData");
  const sd = app.tela();
  t.ok("sem data mostra só a linha sem data",
    sd.includes(">sem data</span>") && !sd.includes(">Plano de Ação"),
    sd.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 250));
  globalThis.focarSessoes("semMentor");
  const sm = app.tela();
  t.ok("sem mentor mostra só a aguardando sem mentor",
    sm.includes(">sem mentor</span>") && sm.includes("Aguardando"),
    sm.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 250));

  /* Um filtro ativo esconderia a linha que o alerta aponta e a tela abriria
     vazia sem explicar por quê. */
  app.estado.filtro.mentor = "Sergio";
  globalThis.focarSessoes("dobradas");
  t.ok("focar zera os filtros que esconderiam o alvo",
    app.estado.filtro.mentor === "" && app.tela().includes(">contada</span>"),
    "filtro.mentor=" + JSON.stringify(app.estado.filtro.mentor));
}

/* =======================================================================
 * Controle negativo da varredura acima.
 *
 * "Nao achei handler de escrita" so vale se o detector souber achar quando
 * ele existe. Com admin as mesmas telas devem estar cheias deles.
 *
 * Bloco separado de proposito: as instancias compartilham globalThis.document,
 * entao a ultima criada passa a receber os renders. Nao intercale duas.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const achados = new Set();
  const varrer = (html) => { for (const fn of ESCRITA) if (html.includes(fn + "(")) achados.add(fn); };

  t.secao("Controle negativo (admin)");
  for (const render of ["renderDash", "renderMentorados", "renderSessoes", "renderFinanceiro", "renderRotas"]) {
    app.mod[render]();
    varrer(app.tela());
  }
  for (const aba of ["cadastro", "financeiro", "sessoes"]) {
    globalThis.openMentorado("m1", aba);
    varrer(app.tela());
  }
  t.ok("a varredura acha handler de escrita quando ele existe",
    achados.size >= 10, "achou so " + achados.size + ": " + [...achados].join(", "));
}

/* =======================================================================
 * Busca por mentorado e botão de criar mentorado.
 *
 * A busca existe em todas as telas que listam mentorado, e em todas ela recorta
 * só as listas: os cards e os alertas continuam contando a operação inteira —
 * um total que encolhe ao digitar deixa de ser total. O botão de criar aparece
 * nas cinco telas, sempre atrás da mesma permissão.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod, estado} = app;
  const limpar = () => { estado.filtro.q = estado.filtro.qDash = estado.filtro.qSessoes = estado.filtro.qFin = estado.filtro.qRotas = ""; };

  t.secao("Comparação da busca");
  t.ok("ignora caixa", mod.casaBusca("ana", "Ana Clara"));
  t.ok("ignora acento nos dois lados", mod.casaBusca("jose", "José Antônio") && mod.casaBusca("josé", "Jose Antonio"));
  t.ok("casa por partes fora de ordem", mod.casaBusca("silva ana", "Ana Paula da Silva"));
  t.ok("termo vazio não filtra nada", mod.casaBusca("", "qualquer"));
  t.ok("não casa quem não tem o termo", !mod.casaBusca("bruno", "Ana Clara"));

  t.secao("Botão de criar mentorado em todas as telas");
  for (const render of ["renderDash", "renderMentorados", "renderSessoes", "renderFinanceiro", "renderRotas"]) {
    mod[render]();
    t.ok(render + " oferece criar mentorado", app.tela().includes("openNovoMentorado()"),
      app.tela().slice(0, 200));
  }

  t.secao("Caixa de busca em todas as telas");
  const CAIXAS = {renderDash: "busca_qDash", renderMentorados: "busca_q", renderSessoes: "busca_qSessoes",
    renderFinanceiro: "busca_qFin", renderRotas: "busca_qRotas"};
  for (const [render, id] of Object.entries(CAIXAS)) {
    mod[render]();
    t.ok(render + " tem caixa de busca", app.tela().includes(`id="${id}"`), app.tela().slice(0, 200));
  }

  t.secao("Busca recorta a tela de Mentorados");
  limpar();
  estado.filtro.q = "bruno";
  mod.renderMentorados();
  t.ok("mostra quem casa", app.tela().includes("Bruno Dias"));
  t.ok("esconde quem não casa", !app.tela().includes("Ana Clara"));
  t.ok("devolve o texto digitado para a caixa", app.tela().includes('value="bruno"'));

  t.secao("Busca recorta a tela de Sessões");
  limpar();
  mod.renderSessoes();
  const subSemBusca = app.tela().match(/<div class="sub">([^<]*)<\/div>/)[1];
  estado.filtro.qSessoes = "bruno";
  mod.renderSessoes();
  const sessBusca = app.tela();
  t.ok("mantém a linha 1:1 de quem casa", sessBusca.includes("Bruno Dias"));
  t.ok("esconde a linha 1:1 de quem não casa",
    !sessBusca.slice(sessBusca.indexOf("Sessões 1:1 com mentores")).includes("Ana Clara"));
  /* O encontro em grupo aparece agregado: filtrar linha a linha faria a coluna
     "Participantes" contar 1 e mentir sobre quem esteve na sala. */
  t.ok("encontro em grupo com o participante continua com todos",
    sessBusca.includes("<td class=\"num\">3</td>"),
    sessBusca.slice(sessBusca.indexOf("Plantão"), sessBusca.indexOf("Plantão") + 400));
  t.ok("os totais do topo não encolhem",
    sessBusca.includes(`<div class="sub">${subSemBusca}</div>`), subSemBusca);
  estado.filtro.qSessoes = "michelle";
  mod.renderSessoes();
  t.ok("busca por mentor acha o encontro em grupo dele",
    app.tela().includes("Sessão de Implementação Mensal · 1 encontro(s)"),
    app.tela().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 250));

  t.secao("Busca recorta o Financeiro");
  limpar();
  estado.filtro.qFin = "bruno";
  mod.renderFinanceiro();
  const finBusca = app.tela();
  t.ok("situação por mentorado mostra só quem casa",
    finBusca.includes("Bruno Dias") && !finBusca.includes("Ana Clara"), finBusca.slice(0, 200));
  /* A parcela vencida é da Ana: sai da tabela, mas o card continua contando 1 —
     cobrança que some do total ao digitar um nome vira cobrança esquecida. */
  t.ok("card de vencidas continua no total da operação",
    finBusca.includes('<div class="k">Parcelas vencidas</div><div class="v">1</div>'),
    finBusca.slice(finBusca.indexOf("Parcelas vencidas"), finBusca.indexOf("Parcelas vencidas") + 160));
  t.ok("explica que a busca escondeu a cobrança",
    finBusca.includes("casa com a busca"),
    finBusca.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));

  t.secao("Busca recorta o Dashboard");
  limpar();
  estado.filtro.qDash = "bruno";
  mod.renderDash();
  const dashBusca = app.tela();
  t.ok("cards continuam no total da operação", dashBusca.includes("3</div><div class=\"d\">1 pausado(s)"),
    dashBusca.slice(dashBusca.indexOf("Mentorados ativos"), dashBusca.indexOf("Mentorados ativos") + 200));
  t.ok("próximas sessões escondem quem não casa",
    !dashBusca.slice(dashBusca.indexOf("Próximas sessões")).includes("Ana Clara"),
    dashBusca.slice(dashBusca.indexOf("Próximas sessões"), dashBusca.indexOf("Próximas sessões") + 400));

  t.secao("Busca recorta o seletor de Rotas");
  limpar();
  estado.filtro.qRotas = "bruno";
  mod.renderRotas();
  const rotBusca = app.tela();
  const seletor = rotBusca.slice(rotBusca.indexOf('id="rotaSelMentorado"'), rotBusca.indexOf('id="rotaSelMentorado"') + 400);
  t.ok("seletor lista só quem casa", seletor.includes("Bruno Dias") && !seletor.includes("Ana Clara"), seletor);
  estado.filtro.qRotas = "zzz";
  mod.renderRotas();
  t.ok("busca sem resultado avisa em vez de abrir a ficha de outro",
    app.tela().includes("Nenhum mentorado encontrado") || app.tela().includes("nenhum mentorado encontrado"),
    app.tela().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));
  t.ok("busca sem resultado não deixa lixo na tela", semLixo(app.tela()), app.tela().slice(0, 300));
  limpar();

  t.secao("Busca na lista de participantes do encontro em grupo");
  globalThis.openSessaoGrupo();
  const modalGrupo = app.modal();
  t.ok("tem caixa de busca", modalGrupo.includes('id="g_busca"'), modalGrupo.slice(0, 200));
  /* A busca esconde por atributo, sem re-render: e o `data-nome` que ela le, e
     as marcacoes ja feitas continuam no DOM. */
  t.ok("cada participante carrega o nome para a busca ler",
    (modalGrupo.match(/class="chk" data-nome=/g) || []).length === 3,
    String((modalGrupo.match(/class="chk" data-nome=/g) || []).length));
  t.ok("escapa o nome no atributo da busca", escapado(modalGrupo));

  const lAna = {dataset: {nome: "Ana Clara"}, hidden: false};
  const lBruno = {dataset: {nome: "Bruno Dias"}, hidden: false};
  const cAna = {checked: false, closest: () => lAna};
  const cBruno = {checked: false, closest: () => lBruno};
  app.responder("#g_lista .chk", [lAna, lBruno]);
  app.responder(".g-part", [cAna, cBruno]);

  globalThis.filtrarParticipantes("bruno");
  t.ok("esconde quem não casa", lAna.hidden === true && lBruno.hidden === false);
  globalThis.marcarTodosGrupo(true);
  t.ok("selecionar alcança só quem a busca deixou visível",
    cAna.checked === false && cBruno.checked === true);
  /* Marcação escondida sobrando entraria no encontro sem ninguém ver. */
  cAna.checked = true;
  globalThis.marcarTodosGrupo(false);
  t.ok("limpar alcança inclusive quem a busca escondeu",
    cAna.checked === false && cBruno.checked === false);
  globalThis.filtrarParticipantes("");
  t.ok("busca vazia devolve todo mundo", lAna.hidden === false && lBruno.hidden === false);
}

/* =======================================================================
 * Exclusão de mentorado.
 *
 * As cinco filhas são ON DELETE CASCADE, então apagar a ficha apaga o histórico
 * — inclusive sessões concluídas que entram no fechamento dos mentores. O que
 * estes testes protegem é o caminho até o delete: quem vê o botão, o que o
 * diálogo diz que vai sumir, e que sem o nome digitado nada é enviado ao banco.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  t.secao("Exclusão de mentorado (admin)");
  globalThis.openMentorado("m1", "completo");
  const ficha = app.tela();
  t.ok("a aba de cadastro oferece excluir", ficha.includes("openExcluirMentorado('m1')"), ficha.slice(0, 200));
  /* Cancelar é quase sempre o que a pessoa quer; a ficha precisa dizer isso
     antes, não depois do banco apagar. */
  t.ok("aponta cancelar como alternativa", ficha.includes("Cancelado</b> na situação acima"),
    ficha.slice(ficha.indexOf("Excluir mentorado"), ficha.indexOf("Excluir mentorado") + 400));
  t.ok("conta o que some junto", ficha.includes("4 sessões") && ficha.includes("1 parcela"),
    ficha.slice(ficha.indexOf("Apaga a ficha"), ficha.indexOf("Apaga a ficha") + 300));
  /* Recorte parcial não é lugar de apagar: quem abriu pelo alerta de sessões
     está ali para conferir uma linha. */
  globalThis.openMentorado("m1", "sessoes");
  t.ok("a aba de sessões não oferece excluir", !app.tela().includes("openExcluirMentorado"));

  t.secao("Confirmação de exclusão");
  globalThis.openExcluirMentorado("m1");
  const dialogo = app.modal();
  t.ok("nomeia o que vai embora", dialogo.includes("4 sessões") && dialogo.includes("1 parcela"),
    dialogo.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));
  t.ok("avisa que o fechamento dos mentores muda", dialogo.includes("saem da contagem dos mentores"),
    dialogo.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));
  t.ok("o botão nasce desabilitado", /id="del_botao" disabled/.test(dialogo), dialogo.slice(0, 200));
  t.ok("pede o nome digitado", dialogo.includes('id="del_confirma"'));
  t.ok("renderiza sem lixo", semLixo(dialogo), dialogo.slice(0, 300));

  app.limparEscritas();
  app.preencher("#del_confirma", "outra pessoa");
  await globalThis.excluirMentorado("m1");
  t.ok("nome errado não envia nada ao banco", app.escritas.length === 0,
    JSON.stringify(app.escritas));
  t.ok("nome errado explica o que falta", app.toast().includes("Digite o nome"), app.toast());

  /* Sem acento e sem caixa passa: a confirmação prova intenção, não ortografia. */
  app.preencher("#del_confirma", "  ana   clara ");
  await globalThis.excluirMentorado("m1");
  t.ok("nome certo manda o delete de mentorados",
    app.escritas.some(e => e.tabela === "mentorados" && e.op === "delete"),
    JSON.stringify(app.escritas));
  /* O stub responde como o PostgREST responde quando o RLS filtra tudo: sem
     erro e sem linhas. Dizer "excluído" aí seria mentira. */
  t.ok("zero linhas apagadas vira aviso, não sucesso",
    app.toast().includes("Nada foi excluído"), app.toast());
}

{
  const app = preparar(carregarApp(), "diretoria");
  t.secao("Exclusão de mentorado (diretoria)");
  globalThis.openMentorado("m1", "completo");
  t.ok("diretoria não vê o botão de excluir", !app.tela().includes("openExcluirMentorado"),
    app.tela().slice(0, 200));
}

/* =======================================================================
 * Cobrança órfã — dinheiro que chegou sem dono
 *
 * É a única falha silenciosa da integração: a cobrança existe inteira no banco,
 * mas como toda a tela mostra dinheiro a partir da ficha de alguém, sem dono
 * ela não aparece em lugar nenhum. O alerta e o painel existem para isso.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod, estado} = app;

  t.secao("Alerta no dashboard");
  mod.renderDash();
  const dash = app.tela();
  t.ok("conta só as órfãs", dash.includes("Cobranças da Lia sem mentorado identificado"),
    dash.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 500));
  t.ok("a vinculada não entra na conta", mod.cobrancasOrfas().length === 2,
    String(mod.cobrancasOrfas().length));

  t.secao("Painel no Financeiro");
  mod.renderFinanceiro();
  const fin = app.tela();
  /* O painel não imprime o id da cobrança — as linhas se distinguem pelo valor
     e pelo status, que é o que quem olha precisa ver. */
  t.ok("lista as duas", brl(fin).includes("R$ 1.500,00") && brl(fin).includes("R$ 900,00"),
    fin.slice(fin.indexOf("cobrancas-orfas"), fin.indexOf("cobrancas-orfas") + 700));
  t.ok("distingue paga de atrasada", fin.includes(">Paga<") && fin.includes(">Atrasada<"));
  t.ok("explica o motivo de cada uma",
    fin.includes("o cadastro existe") && fin.includes("veio sem e-mail"));
  t.ok("oferece vincular quando há um só cadastro", fin.includes("vincularCobranca('orf1','m2')"));
  t.ok("não oferece vincular sem e-mail", !fin.includes("vincularCobranca('orf2'"));
  t.ok("sem lixo", semLixo(fin), fin.slice(0, 300));

  t.secao("Motivo de cada caso");
  t.ok("sem e-mail", mod.motivoOrfa({contact_email: null}) === "a cobrança veio sem e-mail");
  t.ok("um cadastro", mod.motivoOrfa({contact_email: "bruno@exemplo.com"}).includes("o cadastro existe"));
  t.ok("nenhum cadastro",
    mod.motivoOrfa({contact_email: "ninguem@exemplo.com"}) === "nenhum cadastro com esse e-mail");

  t.secao("A busca não esconde dinheiro");
  /* A busca recorta a lista de mentorados; órfã não tem mentorado para casar,
     então some da tela por acidente se entrar no filtro. */
  estado.filtro.qFin = "zzz";
  mod.renderFinanceiro();
  t.ok("órfã continua visível durante a busca", app.tela().includes("orf1"));
  estado.filtro.qFin = "";

  t.secao("Descartar compra de teste");
  /* A equipe testa compra na Lia e esses webhooks chegam iguais aos de venda
     real. Sem descarte, o alerta ficaria ligado para sempre; e apagar a linha
     não resolveria — o próximo webhook da mesma fatura a recriaria. */
  t.ok("toda órfã oferece descartar", (fin.match(/descartarCobranca\(/g) || []).length === 2,
    String((fin.match(/descartarCobranca\(/g) || []).length));
  t.ok("a descartada não conta como órfã", !mod.cobrancasOrfas().some(c => c.lia_bill_id === "desc1"));
  t.ok("mas continua listada à parte", fin.includes("Cobranças descartadas · 1"));
  t.ok("e oferece restaurar", fin.includes("restaurarCobranca('desc1')"));
  t.ok("descartada fica no painel de baixo, não entre as sem dono",
    fin.indexOf("teste@exemplo.com") > fin.indexOf("Cobranças descartadas"));

  /* ------------------------------------------------------------------
     Daqui para baixo só ações de escrita, e elas vão por último de
     propósito: toda uma delas termina em `loadAll()`, que no ambiente de
     teste responde vazio e ZERA M, P e COBRANCAS. Qualquer asserção de
     tela depois disso mediria uma tela em branco, não o comportamento.
     ------------------------------------------------------------------ */
  t.secao("Descartar e restaurar gravam");
  app.limparEscritas();
  await globalThis.descartarCobranca("orf2");
  const marcou = app.escritas.find(e => e.tabela === "lia_cobrancas");
  t.ok("marca em vez de apagar", marcou && marcou.op === "update" && marcou.dados.ignorada === true,
    JSON.stringify(marcou));
  t.ok("órfã sem dono não mexe em financeiro de ninguém",
    !app.escritas.some(e => e.tabela === "rpc:lia_refletir_financeiro"),
    JSON.stringify(app.escritas.map(e => e.tabela)));

  app.limparEscritas();
  await globalThis.restaurarCobranca("desc1");
  const restaurou = app.escritas.find(e => e.tabela === "lia_cobrancas");
  t.ok("restaurar desmarca", restaurou && restaurou.dados.ignorada === false, JSON.stringify(restaurou));

  t.secao("Vincular");
  app.limparEscritas();
  await globalThis.vincularCobranca("orf1", "m2");
  const upd = app.escritas.find(e => e.tabela === "lia_cobrancas");
  t.ok("grava o dono na cobrança", upd && upd.dados.mentorado_id === "m2", JSON.stringify(upd));
  const rpc = app.escritas.find(e => e.tabela === "rpc:lia_refletir_financeiro");
  t.ok("e refaz o financeiro pela função do banco", rpc && rpc.dados.p_mentorado === "m2",
    JSON.stringify(app.escritas.map(e => e.tabela)));

  t.secao("Adoção ao salvar a ficha");
  app.estado.M = fixtures().M;   // loadAll zerou; a ficha precisa existir de novo
  globalThis.openMentorado("m2", "completo");
  app.limparEscritas();
  app.preencher("#e_nome", "Bruno Dias");
  app.preencher("#e_email", "bruno@exemplo.com");
  await globalThis.salvarMentorado("m2");
  const adocao = app.escritas.find(e => e.tabela === "rpc:lia_adotar_orfas");
  t.ok("salvar procura órfãs daquele e-mail", adocao && adocao.dados.p_mentorado === "m2",
    JSON.stringify(app.escritas.map(e => e.tabela)));
}

/* Quem não vê financeiro não vê cobrança nenhuma. */
{
  const app = preparar(carregarApp(), "mentor");
  t.secao("Cobranças órfãs (mentor)");
  app.mod.renderDash();
  t.ok("nem o alerta aparece", !app.tela().includes("Cobranças da Lia sem mentorado"));
}

/* =======================================================================
 * Ficha criada pela Lia
 *
 * Quem paga na Lia sem ter ficha aqui ganha uma, com nome e e-mail e mais
 * nada. Uma ficha pela metade no meio das outras 58 se perde — a marca e o
 * alerta existem para ela ser cobrada.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod, estado} = app;

  t.secao("Alerta no dashboard");
  mod.renderDash();
  const dash = app.tela();
  t.ok("conta as incompletas", dash.includes("Mentorados criados pela Lia, sem cadastro completo"),
    dash.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 400));
  t.ok("o link já leva filtrado", dash.includes("filtro.statusFin='incompletos'"));
  t.ok("sem lixo", semLixo(dash), dash.slice(0, 300));

  t.secao("Marca na lista");
  estado.filtro.statusFin = "";
  mod.renderMentorados();
  const lista = app.tela();
  t.ok("a linha vem marcada", lista.includes("cadastro incompleto"));
  t.ok("explica o que falta", lista.includes("Falta contrato, ciclo, mentor e datas"));
  t.ok("escapa o nome mesmo marcado", escapado(lista));

  t.secao("Filtro de cadastro incompleto");
  estado.filtro.statusFin = "incompletos";
  mod.renderMentorados();
  const so = app.tela();
  t.ok("mostra só quem está incompleto", so.includes("Diego") && !so.includes("Ana Clara"),
    so.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));
  estado.filtro.statusFin = "";

  t.secao("Salvar completa o cadastro");
  /* Salvar a ficha é o ato de alguém responder pelo cadastro — é o que tira a
     marca. Num recorte parcial não houve revisão nenhuma, então não zera. */
  globalThis.openMentorado("m3", "completo");
  app.limparEscritas();
  app.preencher("#e_nome", "Diego Completo");
  await globalThis.salvarMentorado("m3");
  const salvo = app.escritas.find(e => e.tabela === "mentorados" && e.op === "update");
  t.ok("zera a marca", salvo && salvo.dados.cadastro_incompleto === false, JSON.stringify(salvo && salvo.dados));

  /* O que garante que o recorte financeiro não zere a marca é o campo de nome
     não estar na tela: sem ele, `val("#e_nome")` volta undefined e o bloco
     inteiro é pulado. Testo a ausência do campo, não o salvamento — o stub de
     DOM guarda um elemento por seletor, então lá `#e_nome` "existe" mesmo numa
     aba que não o desenha, e o salvamento não distinguiria os dois casos. */
  globalThis.openMentorado("m3", "financeiro");
  t.ok("aba financeira não traz o campo de nome",
    !app.tela().includes('id="e_nome"'), app.tela().slice(0, 200));
}

/* =======================================================================
 * Parcelas vindas da Lia
 *
 * A Lia é a fonte das parcelas de quem tem cobrança lá. Duas coisas importam na
 * tela: o prazo da próxima (a pergunta que se faz olhando a ficha) e o fato de
 * a linha não ser editável — editar aqui seria perder a alteração no próximo
 * webhook, calado.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  t.secao("Prazo da próxima parcela");
  globalThis.openMentorado("m2", "financeiro");
  const ficha = app.tela();
  t.ok("o cabeçalho anuncia a próxima", ficha.includes("vence em 3 dias"),
    ficha.slice(ficha.indexOf("Parcelas"), ficha.indexOf("Parcelas") + 260));
  t.ok("conta quantas foram pagas", ficha.includes("1/2 pagas"));
  t.ok("sem lixo", semLixo(ficha), ficha.slice(0, 300));

  t.secao("Linha da Lia não é editável");
  t.ok("avisa de onde vem", ficha.includes("vêm da Lia e se atualizam sozinhas"));
  t.ok("sem lápis de editar", !ficha.includes("openParcela"));
  t.ok("sem alternar paga/aberta", !ficha.includes("toggleParcela"));
  t.ok("sem adicionar parcela", !ficha.includes("+ Adicionar parcela"));

  t.secao("Parcela manual continua editável");
  globalThis.openMentorado("m1", "financeiro");
  const manual = app.tela();
  t.ok("tem lápis", manual.includes("openParcela"));
  t.ok("alterna paga/aberta", manual.includes("toggleParcela"));
  t.ok("oferece adicionar", manual.includes("+ Adicionar parcela"));
  t.ok("não mostra o aviso da Lia", !manual.includes("vêm da Lia"));

  t.secao("Texto do prazo");
  const hoje = new Date();
  const dia = (n) => new Date(hoje.getTime() + n * 86400000).toLocaleDateString("sv-SE");
  t.ok("hoje",        mod.prazoTexto(dia(0))  === "vence hoje",      mod.prazoTexto(dia(0)));
  t.ok("amanhã",      mod.prazoTexto(dia(1))  === "vence amanhã",    mod.prazoTexto(dia(1)));
  t.ok("em 3 dias",   mod.prazoTexto(dia(3))  === "vence em 3 dias", mod.prazoTexto(dia(3)));
  t.ok("ontem",       mod.prazoTexto(dia(-1)) === "venceu ontem",    mod.prazoTexto(dia(-1)));
  t.ok("há 5 dias",   mod.prazoTexto(dia(-5)) === "venceu há 5 dias", mod.prazoTexto(dia(-5)));
  t.ok("sem data não inventa prazo", mod.prazoTexto(null) === "");
}

/* =======================================================================
 * Etapa deduzida pelo sync
 *
 * Quando o título do evento não diz a etapa, o sync escolhe pela trilha. Acerta
 * na maioria e erra quando a ordem é pulada — e a etapa alimenta a matriz que
 * fecha o mês dos mentores. Palpite não confirmado não pode passar por certeza.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod} = app;

  t.secao("Marca na tela de Sessões");
  mod.renderSessoes();
  const sess = app.tela();
  t.ok("a linha vem marcada", sess.includes("etapa deduzida"), sess.slice(0, 300));
  t.ok("explica o que fazer",
    sess.includes("o sync deduziu pela trilha") && sess.includes("salve para confirmar"));
  t.ok("sem lixo", semLixo(sess), sess.slice(0, 300));

  t.secao("Alerta no dashboard");
  mod.renderDash();
  const dash = app.tela();
  t.ok("conta as pendentes", dash.includes("1 sessão(ões) com etapa escolhida pelo sync"),
    dash.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 400));
  t.ok("leva direto nas linhas", dash.includes("focarSessoes('etapaDeduzida')"));

  t.secao("Salvar confirma a etapa");
  /* Salvar pelo formulário é o ato de alguém olhar a etapa e responder por ela:
     é o que tira a marca, confirmando ou corrigindo. */
  app.limparEscritas();
  app.preencher("#s_etapa", "Checkup 5");
  app.preencher("#s_status", "Concluída");
  app.preencher("#s_mentor", "Luan");
  app.preencher("#s_data", "2026-09-17");
  await globalThis.salvarSessao("s2", "m1");
  const gravada = app.escritas.find(e => e.tabela === "sessoes" && e.op === "update");
  t.ok("zera a marca ao salvar", gravada && gravada.dados.etapa_deduzida === false,
    JSON.stringify(gravada && gravada.dados));
  t.ok("e grava a etapa escolhida pela pessoa",
    gravada && gravada.dados.etapa === "Checkup 5" && gravada.dados.ordem === 7,
    JSON.stringify(gravada && gravada.dados));
}

/* =======================================================================
 * Busca por data em Sessões
 *
 * A caixa varria só mentorado, etapa e mentor — digitar a data da linha que
 * estava na tela não devolvia nada. Data é o eixo principal dessa tela.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod, estado} = app;

  t.secao("Formatos aceitos");
  /* s1: Ana Clara, Diagnóstico, 01/02/2026 às 10:00. */
  const casos = [
    ["como a tela mostra",        "01/02"],
    ["com o ano",                 "01/02/2026"],
    ["o mês inteiro",             "02/2026"],
    ["como o banco guarda",       "2026-02-01"],
    ["a hora",                    "10:00"],
  ];
  for (const [rotulo, termo] of casos) {
    estado.filtro.qSessoes = termo;
    mod.renderSessoes();
    t.ok(rotulo + " (" + termo + ")", app.tela().includes("Ana Clara"),
      app.tela().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 200));
  }

  t.secao("A busca continua recortando");
  estado.filtro.qSessoes = "01/02/2026";
  mod.renderSessoes();
  const so1 = app.tela();
  t.ok("quem é de outra data fica de fora", !so1.includes("Bruno Dias"), so1.slice(0, 300));
  t.ok("sem lixo", semLixo(so1), so1.slice(0, 300));

  estado.filtro.qSessoes = "31/12/2099";
  mod.renderSessoes();
  t.ok("data sem sessão não inventa resultado", !app.tela().includes("Ana Clara"));

  /* Continua valendo o que já funcionava: nome, etapa e mentor. */
  estado.filtro.qSessoes = "evaldo";
  mod.renderSessoes();
  t.ok("busca por mentor não regrediu", app.tela().includes("Ana Clara"));

  t.secao("Encontro em grupo também casa por data");
  /* g1..g3: Plantão de Dúvida Semanal em 06/08/2026, 19:00. */
  estado.filtro.qSessoes = "06/08/2026";
  mod.renderSessoes();
  t.ok("o plantão aparece pela data", app.tela().includes("Plantão de Dúvida Semanal"),
    app.tela().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300));

  t.secao("Sessão sem data");
  /* s4: Checkup 1 do Bruno, data nula — não pode casar com busca de data
     nenhuma, e muito menos derrubar a busca com erro. */
  estado.filtro.qSessoes = "01/02";
  mod.renderSessoes();
  t.ok("linha sem data não entra por acaso", !app.tela().includes("Checkup 1"));
  t.ok("alvo de data nula é vazio", mod.alvoBuscaData(null, null) === "");

  estado.filtro.qSessoes = "";
  t.ok("a caixa anuncia a data no placeholder",
    (mod.renderSessoes(), app.tela()).includes("mentor ou data"));
}

/* =======================================================================
 * E-mail do mentorado
 *
 * É a chave que o sync usa para casar o evento do Calendar com a ficha, e o
 * único do banco é em lower(). Gravar com espaço ou caixa alta passaria no
 * único e mesmo assim não casaria com o convidado do evento.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");

  t.secao("E-mail na ficha");
  globalThis.openMentorado("m1", "completo");
  const ficha = app.tela();
  t.ok("o campo existe", ficha.includes('id="e_email"'), ficha.slice(0, 200));
  t.ok("traz o e-mail salvo", ficha.includes('value="ana.clara@exemplo.com"'));
  t.ok("explica para que serve", ficha.includes("o nome no título do convite não importa"));
  t.ok("sem lixo", semLixo(ficha), ficha.slice(0, 300));

  /* m4 é quem segue sem e-mail nas fixtures — m2 ganhou o dele para a cobrança
     órfã ter com quem casar. */
  globalThis.openMentorado("m4", "completo");
  t.ok("ficha sem e-mail avisa que o sync ainda depende do título",
    app.tela().includes("ainda depende do nome escrito no título"));

  t.secao("Normalização ao salvar");
  globalThis.openMentorado("m1", "completo");
  app.limparEscritas();
  app.preencher("#e_nome", "Ana Clara");
  app.preencher("#e_email", "  Ana.Clara@Exemplo.COM  ");
  await globalThis.salvarMentorado("m1");
  const upd = app.escritas.find(e => e.tabela === "mentorados" && e.op === "update");
  t.ok("grava em minúsculas e sem espaço",
    upd && upd.dados.email === "ana.clara@exemplo.com", JSON.stringify(upd && upd.dados));

  globalThis.openMentorado("m1", "completo");
  app.limparEscritas();
  app.preencher("#e_nome", "Ana Clara");
  app.preencher("#e_email", "   ");
  await globalThis.salvarMentorado("m1");
  const limpo = app.escritas.find(e => e.tabela === "mentorados" && e.op === "update");
  t.ok("campo esvaziado vira null, não string vazia",
    limpo && limpo.dados.email === null, JSON.stringify(limpo && limpo.dados));

  t.secao("E-mail no cadastro novo");
  globalThis.openNovoMentorado();
  const novo = app.modal();
  t.ok("o campo existe", novo.includes('id="n_email"'), novo.slice(0, 200));
  app.limparEscritas();
  app.preencher("#n_nome", "  Bruno Novo  ");
  app.preencher("#n_email", "BRUNO@Exemplo.com");
  await globalThis.criarMentorado();
  const ins = app.escritas.find(e => e.tabela === "mentorados" && e.op === "insert");
  t.ok("cria já normalizado", ins && ins.dados.email === "bruno@exemplo.com", JSON.stringify(ins && ins.dados));

  t.secao("Colisão de e-mail");
  /* O único devolve a mensagem crua do Postgres; quem cadastra não entende. */
  t.ok("a mensagem do único vira explicação",
    app.mod.msgErroMentorado({message: 'duplicate key value violates unique constraint "mentorados_email_unico"'})
      .includes("já está em outro mentorado"));
  t.ok("erro de outra natureza passa inteiro",
    app.mod.msgErroMentorado({message: "permission denied for table mentorados"})
      === "permission denied for table mentorados");
}

/* Quem não edita mentorado vê o e-mail e não mexe nele. */
{
  const app = preparar(carregarApp(), "mentor");
  t.secao("E-mail do mentorado (mentor)");
  globalThis.openMentorado("m1", "completo");
  const ficha = app.tela();
  t.ok("vê o campo travado", ficha.includes('id="e_email"') && /id="e_email"[^>]*disabled/.test(ficha),
    ficha.slice(ficha.indexOf('id="e_email"') - 60, ficha.indexOf('id="e_email"') + 200));
  t.ok("sem salvar alterações", !ficha.includes("Salvar alterações"));
}

/* =======================================================================
 * Marco expansível — o teste de passagem do Compilado das Rotas
 *
 * O painel substituiu o modal "Marcar". O que importa: o conteúdo do marco
 * aparece junto do teste de passagem, o progresso sai do que está marcado (não
 * de um campo digitado à parte), e o que é salvo é o TEXTO do critério.
 * ===================================================================== */
{
  const app = preparar(carregarApp(), "admin");
  const {mod, estado} = app;

  t.secao("Trilha fechada");
  estado.marcoAberto = null;
  mod.renderRotas();
  const fechada = app.tela();
  t.ok("sem lixo", semLixo(fechada), fechada.slice(0, 300));
  t.ok("cada marco é um botão que expande", (fechada.match(/onclick="toggleMarco\(/g) || []).length === 2);
  t.ok("marco de placa se anuncia na linha", fechada.includes("PLACA"));
  t.ok("contador de critérios na linha fechada", fechada.includes("2/4"), fechada.slice(0, 400));
  t.ok("painel só aparece aberto", !fechada.includes("Teste de passagem"));

  t.secao("Marco aberto");
  estado.marcoAberto = "mk1";
  mod.renderRotas();
  const aberta = app.tela();
  t.ok("sem lixo", semLixo(aberta), aberta.slice(0, 300));
  t.ok("traz a restrição", aberta.includes("Cada feira começa do zero"));
  t.ok("traz a alavanca", aberta.includes("Repetição"));
  t.ok("traz a pergunta-chave", aberta.includes("Pergunta-chave"));
  t.ok("lista os apoios", aberta.includes("Qualificar a feira com o organizador"));
  t.ok("lista os indicadores", aberta.includes("Ticket médio"));
  t.ok("nomeia os dois portões",
    aberta.includes("Portão A · Apto a vender") && aberta.includes("Portão B · Primeira receita"));
  t.ok("critério já batido vem marcado",
    aberta.includes('value="Tenho produto validado" checked'), aberta.slice(aberta.indexOf("mk-crits"), aberta.indexOf("mk-crits") + 400));
  t.ok("critério pendente vem desmarcado",
    aberta.includes('value="Bati R$ 500 acumulados na rota" onchange'));
  t.ok("texto do critério passa por esc()", escapado(aberta));
  t.ok("progresso conta o que está marcado", aberta.includes(">2 de 4<"));
  t.ok("o registro do mentor vem junto",
    aberta.includes("Próxima ação") && aberta.includes("Fechar inscrição da próxima feira"));
  t.ok("oferece salvar a evolução", aberta.includes("salvarMarco('mk1','m1')"));
  /* Só um painel por vez: dois abertos duplicariam os ids mk_status/mk_data. */
  t.ok("um painel de cada vez", (aberta.match(/id="mk_status"/g) || []).length === 1);

  t.secao("Régua de valores da rota");
  /* Fixture: R$ 10.000 + R$ 5.000 no canal da rota, unidade acumulado. */
  t.ok("soma o acumulado da rota, não do mês", brl(aberta).includes("R$ 15.000,00"));
  t.ok("meta batida não pede mais nada", aberta.includes("Meta atingida"));
  estado.marcoAberto = "mk2";
  mod.renderRotas();
  const falta = app.tela();
  t.ok("meta não batida mostra quanto falta",
    falta.includes("Falta") && brl(falta).includes("R$ 5.000,00"), brl(falta).slice(falta.indexOf("mk-meta"), falta.indexOf("mk-meta") + 300));

  t.secao("Salvar evolução");
  app.limparEscritas();
  app.responder(".mk-crit", [
    {value: "Tenho produto validado",           checked: true},
    {value: "Conheço meu CMV",                  checked: true},
    {value: "Bati R$ 500 acumulados na rota",   checked: true},
    {value: "Registrei o quarto critério",      checked: false},
  ]);
  app.preencher("#mk_status", "EM_ANDAMENTO");
  app.preencher("#mk_data", "2026-09-16");
  app.preencher("#mk_acao", "  Fechar a inscrição  ");
  app.preencher("#mk_bloq", "Sem ponto de energia\n\n  Falta banner  ");
  await globalThis.salvarMarco("mk1", "m1");
  const gravado = app.escritas.find(e => e.tabela === "mentorado_marcos");
  t.ok("manda o upsert para mentorado_marcos", !!gravado, JSON.stringify(app.escritas));
  const d = gravado && gravado.dados;
  t.ok("salva o TEXTO dos critérios marcados",
    d && d.criterios_ok.length === 3 && d.criterios_ok.includes("Conheço meu CMV"), JSON.stringify(d));
  t.ok("o pendente vira criterios_pendentes",
    d && d.criterios_pendentes.length === 1 && d.criterios_pendentes[0] === "Registrei o quarto critério", JSON.stringify(d));
  t.ok("progresso é derivado, não digitado", d && d.progresso === 75, d && String(d.progresso));
  t.ok("próxima ação sai sem espaço sobrando", d && d.proxima_acao === "Fechar a inscrição", d && JSON.stringify(d.proxima_acao));
  t.ok("bloqueios em linhas, sem linha vazia",
    d && d.bloqueios.length === 2 && d.bloqueios[1] === "Falta banner", JSON.stringify(d && d.bloqueios));
  t.ok("guarda status e data", d && d.status === "EM_ANDAMENTO" && d.data === "2026-09-16", JSON.stringify(d));
}

/* Quem não escreve em rotas lê a trilha inteira, mas não mexe nela. */
{
  const app = preparar(carregarApp(), "diretoria");
  t.secao("Marco expansível (diretoria)");
  app.mod.renderRotas();
  const tela = app.tela();
  t.ok("vê o conteúdo do marco", tela.includes("Teste de passagem") && tela.includes("Qualificar a feira com o organizador"));
  t.ok("os critérios vêm travados", tela.includes('class="mk-crit"') && tela.includes(" disabled onchange"));
  t.ok("sem salvar evolução", !tela.includes("Salvar evolução"));
  t.ok("sem lixo", semLixo(tela), tela.slice(0, 300));
}

process.exit(t.fim() ? 1 : 0);
