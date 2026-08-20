/* Testes do index.html. Rodar com:  node tests/testes.mjs
 *
 * Cobre o que já quebrou neste projeto antes ou o que quebraria em silêncio:
 * escape de HTML na renderização, o que cada papel vê, a separação entre sessão
 * 1:1 e sessão em grupo, e o formato de data e de moeda.
 * Sai com código 1 se algo falhar.
 */
import {carregarApp, preparar, criarRunner, escapado, semLixo, brl, XSS} from "./ambiente.mjs";

const t = criarRunner();

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
  mod.renderDash();
  const dash = app.tela();
  t.ok("renderiza sem lixo", semLixo(dash), dash.slice(0, 300));
  t.ok("card de 1:1 renomeado", dash.includes("Sessões 1:1 concluídas"));
  t.ok("card de grupo presente", dash.includes("Encontros em grupo"));
  /* 1 encontro concluído, 2 presenças (a terceira está bloqueada). */
  t.ok("card de grupo conta encontros, não linhas",
    dash.includes('>1</div><div class="d">2 presença(s)'),
    dash.slice(dash.indexOf("Encontros em grupo"), dash.indexOf("Encontros em grupo") + 200));
  t.ok("matriz por mentor tem coluna Grupo", dash.includes('title="Encontros em grupo">Grupo<'));
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

process.exit(t.fim() ? 1 : 0);
