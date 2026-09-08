/* Testes do index.html. Rodar com:  node tests/testes.mjs
 *
 * Cobre o que já quebrou neste projeto antes ou o que quebraria em silêncio:
 * escape de HTML na renderização, o que cada papel vê, a separação entre sessão
 * 1:1 e sessão em grupo, e o formato de data e de moeda.
 * Sai com código 1 se algo falhar.
 */
import {carregarApp, preparar, criarRunner, escapado, semLixo, brl, XSS} from "./ambiente.mjs";

const t = criarRunner();

/* Handlers de escrita que a interface pode oferecer. Usado na varredura do
   papel diretoria e no controle negativo com admin, no fim do arquivo. */
const ESCRITA = ["salvarMentorado", "salvarSituacao", "toggleParcela", "addParcela",
  "openParcela", "salvarParcela", "delParcela", "openSessao", "salvarSessao", "delSessao",
  "openConfirmarSessao", "confirmarSessao", "openSessaoGrupo", "criarSessaoGrupo",
  "confirmarGrupo", "openMarco", "salvarMarco", "salvarCanalMentorado", "salvarFaturamento",
  "excluirFaturamento", "openNovoMentorado", "criarMentorado"];

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

  t.secao("Ficha do mentorado");
  globalThis.openMentorado("m1", "sessoes");
  const ficha = app.modal();
  t.ok("sem lixo", semLixo(ficha), ficha.slice(0, 300));
  t.ok("bloco 1:1 rotulado", ficha.includes("Sessões 1:1 com mentores"));
  t.ok("bloco de grupo com contagem", ficha.includes("Sessões em grupo &middot; 2"));
  t.ok("legenda conta só a trilha 1:1", ficha.includes("1 de 2 concluída(s)"),
    ficha.slice(ficha.indexOf("Trilha"), ficha.indexOf("Trilha") + 120));

  globalThis.openMentorado("m1", "financeiro");
  const fichaFin = app.modal();
  t.ok("ficha financeira mostra o valor da parcela em real",
    brl(fichaFin).includes("R$ 500,00"), fichaFin.slice(fichaFin.indexOf("Parcelas"), fichaFin.indexOf("Parcelas") + 250));
  t.ok("ficha financeira usa o campo de calendário no vencimento",
    fichaFin.includes('data-dp="np_venc"'));

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
  const ficha = app.modal();
  t.ok("ficha sem lixo", semLixo(ficha), ficha.slice(0, 300));
  t.ok("ficha sem bloco financeiro", !ficha.includes("Contrato e pagamento"));
  t.ok("ficha mantém a divisão de sessões",
    ficha.includes("Sessões 1:1 com mentores") && ficha.includes("Sessões em grupo"));
  t.ok("campo de data vem desabilitado", /data-dp="e_fech"[^>]*disabled/.test(ficha), "campo editável");

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
  globalThis.openMentorado("m1", "completo");
  const ficha = app.modal();
  t.ok("vê o bloco financeiro da ficha", ficha.includes("Contrato e pagamento"));
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
    saidas.push(["ficha:" + sec, app.modal()]);
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
  const fichaFin = app.modal();
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
  globalThis.openMentorado("m1", "completo");
  varrer(app.modal());
  t.ok("a varredura acha handler de escrita quando ele existe",
    achados.size >= 10, "achou so " + achados.size + ": " + [...achados].join(", "));
}

process.exit(t.fim() ? 1 : 0);
