/* Métricas de paridade do lado antigo (GATE-06, PAR-01…PAR-17, Apêndice A da
 * spec). Uma função por métrica, sobre uma instância de `carregarLegado`: lê o
 * HTML que o app pôs em #app, pelas âncoras de hoje, e os símbolos do script
 * quando a tela não escreve o dado (o id de uma parcela, a chave de um encontro).
 *
 * Cada função devolve `Record<chave, valor>`, com as chaves de chaves.ts:
 * ids, meses, mentor normalizado, rótulo do item. Nenhuma devolve nome, e-mail
 * ou comentário de mentorado. Uma métrica mexe no estado da tela (filtro, mês,
 * aba): cada uma roda numa instância nova.
 */
import { centavos, chaveDeNome, chaveMentor, ordenados } from "./chaves";

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", middot: "·", nbsp: " " };

/** O texto de um trecho de HTML: sem tags, com as entidades do esc() resolvidas. */
export function texto(/** @type {string} */ html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|middot|nbsp);/g, (_, e) => ENTIDADES[/** @type {keyof typeof ENTIDADES} */ (e)])
    .replace(/\s+/g, " ")
    .trim();
}

/** "R$ 1.234,50" → 1234.5 (o fmtBRL do app, com espaço sem quebra). */
export function lerReais(/** @type {string} */ valor) {
  const limpo = texto(valor).replace(/[^\d,-]/g, "").replace(",", ".");
  if (!limpo) throw new Error(`valor em reais ilegível: ${JSON.stringify(valor)}`);
  return centavos(Number(limpo));
}

/** O painel `<div class="panel detail" id="…">` até o próximo painel com id, ou "" sem ele. */
function painel(/** @type {string} */ html, /** @type {string} */ id) {
  const inicio = html.indexOf(`<div class="panel detail" id="${id}">`);
  if (inicio < 0) return "";
  const fim = html.indexOf('<div class="panel detail" id="', inicio + 1);
  return html.slice(inicio, fim < 0 ? html.length : fim);
}

/** O trecho entre `de` e `ate` (ou o fim). Falha se `de` não está: a âncora mudou. */
function trecho(/** @type {string} */ html, /** @type {string} */ de, /** @type {string | null} */ ate = null) {
  const inicio = html.indexOf(de);
  if (inicio < 0) throw new Error(`âncora ausente: ${de}`);
  const fim = ate === null ? -1 : html.indexOf(ate, inicio + de.length);
  return html.slice(inicio, fim < 0 ? html.length : fim);
}

function casar(/** @type {string} */ html, /** @type {RegExp} */ padrao, /** @type {string} */ nome) {
  const m = html.match(padrao);
  if (!m) throw new Error(`${nome}: padrão não achado`);
  return m;
}

const ddmmaaaaParaIso = (/** @type {string} */ d) => d.split("/").reverse().join("-");

/** @typedef {Awaited<ReturnType<typeof import("./legado.mjs").carregarLegado>>} Legado */

// PAR-01: os contadores do painel "Precisa de atenção" e o aviso de adesão do mentor. A chave é o
// rótulo do item, sem o parêntese do da Experiência (que leva números).
export function par01(/** @type {Legado} */ app) {
  const html = app.tela();
  /** @type {Record<string, unknown>} */
  const valores = {};
  for (const m of html.matchAll(/<div class="attn-item (?:ok)?">\s*<div class="lbl"><span class="dot"><\/span>([\s\S]*?)<\/div>\s*<div class="rowflex" style="gap:14px">\s*<span class="cnt">(\d+)<\/span>/g)) {
    valores[texto(m[1]).replace(/\s*\(.*$/, "")] = Number(m[2]);
  }
  const adesao = html.match(/Poucas respostas na Pesquisa de Experiência[\s\S]*?(\d+) resposta\(s\) para (\d+) mentorado\(s\)/);
  if (adesao) valores["Poucas respostas na Pesquisa de Experiência"] = `${adesao[1]}/${adesao[2]}`;
  return valores;
}

// PAR-02: os ids de mentorado das listas do Dashboard, na ordem da tela; a de sem subida com os dias.
export function par02(/** @type {Legado} */ app) {
  const html = app.tela();
  const ids = (/** @type {string} */ id) => [...painel(html, id).matchAll(/openMentorado\('([^']*)'/g)].map((m) => m[1]);
  return {
    orfas: ids("orfas"),
    risco: ids("risco"),
    "sem-implementacao": ids("sem-implementacao"),
    "sem-subida": [...painel(html, "sem-subida").matchAll(/openMentorado\('([^']*)'\)">[\s\S]*?<td class="num">(\d+)<\/td>/g)].map((m) => `${m[1]}:${m[2]}`),
    "nps-pend": ids("nps-pend"),
  };
}

// PAR-03: os 4 números gerais e o que cada card diz embaixo.
export function par03(/** @type {Legado} */ app) {
  const html = trecho(app.tela(), '<div class="section-label">Números gerais</div>', '<div class="section-label">');
  const ativos = casar(html, /<div class="k">Mentorados ativos<\/div><div class="v">(\d+)<\/div><div class="d">(\d+) pausado\(s\) &middot; (\d+) cancelado\(s\)/, "ativos");
  const concluidas = casar(html, /<div class="k">Sessões 1:1 concluídas<\/div><div class="v">(\d+)</, "concluídas");
  const agendadas = casar(html, /<div class="k">Agendadas<\/div><div class="v">(\d+)</, "agendadas");
  const grupo = casar(html, /<div class="k">Encontros em grupo<\/div><div class="v">(\d+)<\/div><div class="d">(\d+) presença\(s\) &middot; (\d+) agendado/, "grupo");
  return {
    ativos: Number(ativos[1]),
    pausados: Number(ativos[2]),
    cancelados: Number(ativos[3]),
    concluidas1a1: Number(concluidas[1]),
    agendadas1a1: Number(agendadas[1]),
    encontros: Number(grupo[1]),
    presencas: Number(grupo[2]),
    encontrosAgendados: Number(grupo[3]),
  };
}

// PAR-04: as próximas 8 sessões, na ordem. A 1:1 é o mentorado com data e hora; o encontro, a chave
// etapa|data|hora. A célula de data só mostra dia e mês: a data inteira sai do cellDataHora, que
// a métrica embrulha para anotar o que cada linha recebeu.
export function par04(/** @type {Legado} */ app) {
  app.avaliar(`(() => { const original = cellDataHora; cellDataHora = (d, h) => original(d, h) + "<!--dh:" + (d || "") + "|" + (h || "") + "-->"; })()`);
  app.avaliar("render()");
  const html = trecho(app.tela(), "<h3>Próximas sessões agendadas</h3>", '<div class="panel detail" id=');
  const grupos = app.avaliar("GRUPO_REG");
  const proximas = [...html.matchAll(/<tr class="click" onclick="(?:openGrupo\((\d+)\)|openMentorado\('([^']*)','sessoes'\))"><td>[\s\S]*?<!--dh:([^|]*)\|([^>]*)-->/g)].map((m) =>
    m[1] !== undefined ? `grupo|${grupos[Number(m[1])].chave}` : `1:1|${m[2]}|${m[3]}|${m[4]}`,
  );
  return { proximas };
}

// PAR-05: a progressão por faturamento: nível e total de cada mentorado que aparece.
export function par05(/** @type {Legado} */ app) {
  /** @type {Record<string, unknown>} */
  const valores = {};
  for (const m of app.tela().matchAll(/<div class="niv-row" onclick="openMentorado\('([^']*)','completo'\)">[\s\S]*?niv-badge">([^<]*)<\/span>[\s\S]*?<div class="niv-val">\s*<b>([^<]*)<\/b>/g)) {
    valores[m[1]] = { nivel: texto(m[2]), total: lerReais(m[3]) };
  }
  return valores;
}

/** A matriz do mês escolhido no Dashboard: uma entrada por mentor e a de sem mentor. */
function matrizDoMes(/** @type {string} */ html, /** @type {string} */ mes) {
  const tabela = trecho(html, "<h3 style=\"margin:0\">Sessões concluídas por mentor</h3>", "</table>");
  const etapas = [];
  for (const m of tabela.matchAll(/<th class="num" title="([^"]*)">/g)) {
    if (m[1].startsWith("Sessões 1:1")) break;
    etapas.push(texto(m[1]));
  }
  /** @type {Record<string, unknown>} */
  const valores = {};
  const numero = (/** @type {string} */ v) => (v === "·" ? 0 : Number(v));
  for (const linha of tabela.matchAll(/<tr(?: style="opacity:\.75")?><td class="mentor-chip">([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/g)) {
    const celulas = [...linha[2].matchAll(/<td class="num"(?: style="[^"]*")?(?: title="(\d+) presença\(s\) somada\(s\)")?>([^<]*)<\/td>/g)];
    const porEtapa = Object.fromEntries(etapas.map((etapa, i) => [etapa, numero(celulas[i][2])]));
    const resto = celulas.slice(etapas.length);
    const semMentor = linha[0].startsWith('<tr style="opacity:.75">');
    const nome = texto(linha[1].replace(/<span class="pill gray"[\s\S]*$/, ""));
    const contagem = { porEtapa, total1a1: numero(resto[0][2]), grupo: resto[1] ? numero(resto[1][2]) : 0 };
    valores[`${mes || "todos"}|${semMentor ? "__sem__" : chaveMentor(nome)}`] = semMentor ? contagem : { ...contagem, presencas: resto[1]?.[1] ? Number(resto[1][1]) : 0 };
  }
  return valores;
}

// PAR-06: para cada mês do seletor e "Todos", a matriz mentor × etapa.
export function par06(/** @type {Legado} */ app) {
  const meses = ["", ...[...app.tela().matchAll(/<option value="(\d{4}-\d{2})"/g)].map((m) => m[1])];
  /** @type {Record<string, unknown>} */
  let valores = {};
  for (const mes of meses) {
    app.avaliar(`mesMatriz = ${JSON.stringify(mes)}`);
    app.avaliar("render()");
    valores = { ...valores, [`${mes || "todos"}|__meses__`]: meses.length - 1, ...matrizDoMes(app.tela(), mes) };
  }
  return valores;
}

// PAR-07: os ids que cada um dos quatro avisos da matriz manda focar em Sessões, no mês padrão.
export function par07(/** @type {Legado} */ app) {
  const foco = app.avaliar("FOCO_ALERTA");
  return Object.fromEntries(["dobradas", "semData", "semMentor", "etapaDeduzida"].map((k) => [k, ordenados(foco[k])]));
}

// PAR-08: os ids da lista de Mentorados em cada filtro; o de contrato só para quem vê financeiro.
export function par08(/** @type {Legado} */ app) {
  const filtros = ["", "ativos", "pausados", "incompletos", ...(app.avaliar('pode("verFinanceiro")') ? ["contrato"] : [])];
  app.navegar("#/mentorados");
  /** @type {Record<string, unknown>} */
  const valores = {};
  for (const filtro of filtros) {
    app.avaliar(`filtro.statusFin = ${JSON.stringify(filtro)}`);
    app.avaliar("renderMentorados()");
    valores[filtro || "todos"] = ordenados([...app.tela().matchAll(/openMentorado\('([^']*)','completo'\)/g)].map((m) => m[1]));
  }
  return valores;
}

/** Embrulha o applySort para anotar a lista que cada tabela desenhou, pela chave da tabela. */
function anotarTabelas(/** @type {Legado} */ app) {
  /** @type {Record<string, any[]>} */
  const tabelas = {};
  app.avaliar("(anotar) => { const original = applySort; applySort = (...a) => { const r = original(...a); anotar(a[1], r); return r; }; }")((/** @type {string} */ chave, /** @type {any[]} */ linhas) => {
    tabelas[chave] = linhas;
  });
  return tabelas;
}

// PAR-09: Sessões sem foco: os ids de cada bloco 1:1 e as chaves dos encontros de cada categoria.
// O bloco Concluídas vai junto e fica fora da comparação (Apêndice A, OPS-09).
export function par09(/** @type {Legado} */ app) {
  const tabelas = anotarTabelas(app);
  app.navegar("#/sessoes");
  /** @type {Record<string, unknown>} */
  const valores = {};
  for (const bloco of ["aguardando", "agendadas", "concluidas", "bloqueadas"]) valores[bloco] = ordenados((tabelas[`sessoes_${bloco}`] ?? []).map((s) => s.id));
  /** @type {string[]} */
  const categorias = app.avaliar("ETAPAS_GRUPO");
  categorias.forEach((categoria, i) => {
    valores[`grupo|${categoria}`] = ordenados((tabelas[`grupo_${i}`] ?? []).map((e) => e.chave));
  });
  return valores;
}

// PAR-10: o topo da ficha de cada mentorado: parcelas pagas e total, N de M 1:1, implementação e
// plantões. A parte que a ficha não mostra fica null.
export function par10(/** @type {Legado} */ app) {
  /** @type {string[]} */
  const ids = app.avaliar("M.map(m => m.id)");
  /** @type {Record<string, unknown>} */
  const valores = {};
  for (const id of ids) {
    app.navegar(`#/mentorado/${encodeURIComponent(id)}/cadastro`);
    const resumo = texto(casar(app.tela(), /<div class="topbar"><div><h2>[\s\S]*?<\/h2>\s*<div class="sub">([\s\S]*?)<\/div>/, `ficha ${id}`)[1]);
    const parcelas = resumo.match(/(\d+)\/(\d+) parcelas pagas/);
    const trilha = resumo.match(/(\d+) de (\d+) sessões concluídas/);
    const implementacao = resumo.match(/Implementação feita em (\S+)/);
    valores[id] = {
      pagas: parcelas ? Number(parcelas[1]) : null,
      parcelas: parcelas ? Number(parcelas[2]) : null,
      concluidas: trilha ? Number(trilha[1]) : null,
      trilha: trilha ? Number(trilha[2]) : null,
      implementacao: implementacao ? implementacao[1] : null,
      plantoes: Number(casar(resumo, /(\d+) plantão\(ões\)/, `plantões ${id}`)[1]),
    };
  }
  return valores;
}

// PAR-11: Financeiro: os 3 cards, as parcelas vencidas, os 10 próximos vencimentos, o motivo de
// cada órfã e as descartadas.
export function par11(/** @type {Legado} */ app) {
  const tabelas = anotarTabelas(app);
  app.navegar("#/financeiro");
  const html = app.tela();
  const vencidas = casar(html, /<div class="k">Parcelas vencidas<\/div><div class="v">(\d+)</, "vencidas");
  const restante = casar(html, /<div class="k">Restante em aberto<\/div><div class="v">(\d+)<\/div><div class="d">\+ (\d+) pagos parcialmente/, "restante");
  const assinados = casar(html, /<div class="k">Contratos assinados<\/div><div class="v">(\d+)<span[^>]*>\/(\d+)</, "assinados");
  /** @type {any[]} */
  const parcelas = app.avaliar("P");
  const tabelaVencidas = trecho(html, "<h3>Cobranças com parcela vencida</h3>", "</div>");
  const idsVencidas = [...tabelaVencidas.matchAll(/openMentorado\('([^']*)','financeiro'\)"><td>[\s\S]*?<\/td><td class="mono">#([^<]*)<\/td>/g)].map((m) => {
    const p = parcelas.find((x) => x.mentorado_id === m[1] && String(x.numero) === m[2]);
    if (!p) throw new Error("parcela vencida sem linha em P");
    return p.id;
  });
  /** @type {[string, string][]} */
  const orfas = app.avaliar("cobrancasOrfas().map(c => [c.lia_bill_id, motivoOrfa(c)])");
  return {
    "cards.vencidas": Number(vencidas[1]),
    "cards.restanteAberto": Number(restante[1]),
    "cards.restanteParcial": Number(restante[2]),
    "cards.assinados": Number(assinados[1]),
    "cards.ativos": Number(assinados[2]),
    vencidas: ordenados(idsVencidas),
    proximos: (tabelas.fin_proxvenc ?? []).slice(0, 10).map((p) => p.id),
    ...Object.fromEntries(orfas.map(([bill, motivo]) => [`orfa|${bill}`, motivo])),
    descartadas: ordenados(app.avaliar("cobrancasDescartadas().map(c => c.lia_bill_id)")),
  };
}

// PAR-12: Rotas: para cada rota, mentorado ativo e marco, o estado no stepper, os critérios feitos
// sobre o total e, com o marco aberto, a régua e a falta.
export function par12(/** @type {Legado} */ app) {
  app.navegar("#/rotas");
  /** @type {{ id: string, slug: string }[]} */
  const rotas = app.avaliar("ROTAS.map(r => ({ id: r.id, slug: r.slug }))");
  /** @type {string[]} */
  const ativos = app.avaliar("M.filter(ehAtivo).map(m => m.id)");
  /** @type {Record<string, unknown>} */
  const valores = {};
  const FASE = { done: "feito", atual: "atual", futuro: "futuro" };
  for (const rota of rotas) {
    /** @type {string[]} */
    const marcos = app.avaliar(`MARCOS.filter(mo => mo.rota_id === ${JSON.stringify(rota.id)}).sort((a, b) => a.ordem - b.ordem).map(mo => mo.id)`);
    for (const mentorado of ativos) {
      for (const marco of marcos) {
        app.avaliar(`rotaAtual = ${JSON.stringify(rota.slug)}; rotaMentoradoId = ${JSON.stringify(mentorado)}; marcoAberto = ${JSON.stringify(marco)}; renderRotas()`);
        const passo = app
          .tela()
          .split(/(?=<div class="step (?:done|atual|futuro))/)
          .map((pedaco) => pedaco.match(/^<div class="step (done|atual|futuro) aberto/) && [pedaco, pedaco.match(/^<div class="step (done|atual|futuro)/)?.[1] ?? ""])
          .find(Boolean);
        if (!passo) throw new Error(`marco ${marco}: passo aberto não achado`);
        const progresso = passo[0].match(/<div class="step-prog"><div class="niv-bar"><i[^>]*><\/i><\/div><b>(\d+)\/(\d+)<\/b>/);
        const regua = passo[0].match(/(?:Faturamento do mês|Acumulado na rota): <b>([^<]*)<\/b>[\s\S]*?<span>(?:Falta <b>([^<]*)<\/b>|<b>Meta atingida<\/b>)<\/span>/);
        valores[`${rota.id}|${mentorado}|${marco}`] = {
          fase: FASE[/** @type {keyof typeof FASE} */ (passo[1])],
          feitos: progresso ? Number(progresso[1]) : 0,
          total: progresso ? Number(progresso[2]) : 0,
          regua: regua ? lerReais(regua[1]) : null,
          falta: regua ? (regua[2] === undefined ? 0 : lerReais(regua[2])) : null,
        };
      }
    }
  }
  return valores;
}

// PAR-13: STLSeller nos recortes Ativos e Todos: os 5 cards, a concentração (as 5 maiores fatias
// por posição e os outros), a contagem por status real e por chip e os 15 anúncios que mais
// faturam (marketplace|anúncio).
export function par13(/** @type {Legado} */ app) {
  app.navegar("#/analise");
  /** @type {Record<string, [string, string]>} */
  const statusReal = app.avaliar("STATUS_REAL");
  const rotuloParaStatus = new Map(Object.entries(statusReal).map(([status, [, rotulo]]) => [rotulo, status]));
  /** @type {string[]} */
  const chips = app.avaliar("ANALISE_FILTROS.map(f => f[0])");
  /** @type {Record<string, unknown>} */
  const valores = {};
  for (const [recorte, status] of [["ativos", "ATIVO"], ["todos", ""]]) {
    app.avaliar(`filtro.statusAnalise = ${JSON.stringify(status)}; filtro.chipAnalise = "todos"; render()`);
    const html = app.tela();
    const card = (/** @type {string} */ k) => casar(html, new RegExp(`<div class="k">${k}</div><div class="v">([^<]*)</div><div class="d">([^<]*)</div>`), k);
    const pedidos = card("Pedidos");
    const vendendo = card("Vendendo")[1].match(/(\d+) de (\d+)/);
    const plano = card("Plano STLSeller ativo");
    const planoV = plano[1].match(/(\d+) de (\d+)/);
    if (!vendendo || !planoV) throw new Error("cards do STLSeller ilegíveis");
    Object.assign(valores, {
      [`${recorte}|bruto`]: lerReais(card("Bruto vendido")[1]),
      [`${recorte}|receita`]: lerReais(card("Atribuído a anúncios")[1]),
      [`${recorte}|pedidos`]: Number(pedidos[1].replace(/\./g, "")),
      [`${recorte}|cancelados`]: Number(casar(pedidos[2], /\(([\d.]+)\)/, "cancelados")[1].replace(/\./g, "")),
      [`${recorte}|vendendo`]: `${vendendo[1]}/${vendendo[2]}`,
      [`${recorte}|plano`]: `${planoV[1]}/${planoV[2]}`,
      [`${recorte}|semConta`]: Number(casar(plano[2], /(\d+) sem conta/, "sem conta")[1]),
    });
    const fatias = [...html.matchAll(/<div class="an-conc"[\s\S]*?<\/div>/g)].flatMap((m) => [...m[0].matchAll(/title="[^"]*: ([^"]*)"/g)].map((t) => lerReais(t[1])));
    valores[`${recorte}|concentracao`] = fatias.slice(0, 5);
    valores[`${recorte}|outros`] = fatias.length === 6 ? fatias[5] : null;
    const pilulas = trecho(html, "<h3>Status real sugerido</h3>", "</div>");
    for (const m of pilulas.matchAll(/<span class="pill [a-z]+">([^<]*) &middot; (\d+)<\/span>/g)) {
      const rotulo = texto(m[1]);
      valores[`${recorte}|status|${rotuloParaStatus.get(rotulo) ?? rotulo}`] = Number(m[2]);
    }
    for (const chip of chips) {
      app.avaliar(`filtro.chipAnalise = ${JSON.stringify(chip)}; render()`);
      valores[`${recorte}|chip|${chip}`] = Number(casar(app.tela(), /Visão geral por mentorado &middot; (\d+)/, `chip ${chip}`)[1]);
    }
    // Os anúncios não levam id no HTML: a lista é a da tela, sobre as linhas do script.
    valores[`${recorte}|anuncios`] = app.avaliar(
      `linhasAnalise().filter(l => !${JSON.stringify(status)} || l.r.status_formulario === ${JSON.stringify(status)}).flatMap(l => l.prod.map(p => ({ p, l }))).sort((a, b) => (Number(b.p.faturamento) || 0) - (Number(a.p.faturamento) || 0)).slice(0, 15).map(({ p }) => p.marketplace + "|" + p.anuncio_id)`,
    );
  }
  return valores;
}

// PAR-14: NPS das sessões: média, NPS e respostas no geral e por mentor; e cada célula da tabela
// por semana e por mês, em todas as páginas.
export function par14(/** @type {Legado} */ app) {
  app.navegar("#/nps");
  /** @type {Record<string, unknown>} */
  const valores = {};
  const cards = trecho(app.tela(), '<div class="cards quiet"', '<div class="panel">');
  for (const m of cards.matchAll(/<div class="card"><div class="k">([^<]*)<\/div><div class="v">([^<]*)<\/div><div class="d">NPS ([^ ]*) · (\d+) resposta\(s\)<\/div><\/div>/g)) {
    const quem = texto(m[1]);
    valores[quem === "Média geral" ? "geral" : `mentor|${chaveMentor(quem)}`] = { media: texto(m[2]), nps: m[3], respostas: Number(m[4]) };
  }
  for (const periodo of ["semana", "mes"]) {
    for (let pagina = 1, paginas = 1; pagina <= paginas; pagina++) {
      app.avaliar(`filtro.npsPeriodo = ${JSON.stringify(periodo)}; filtro.npsPagPeriodo = ${pagina}; render()`);
      const tabela = trecho(app.tela(), `<h3 style="margin:0">Média por `, "</table>");
      paginas = Number(app.tela().match(/Página \d+ de (\d+)<\/span>[\s\S]*?<h3 style="margin:0">Respostas/)?.[1] ?? 1);
      const mentores = [...trecho(tabela, "<thead>", "</thead>").matchAll(/<th class="num">([^<]*)<\/th>/g)].slice(3).map((m) => chaveMentor(texto(m[1])));
      for (const linha of trecho(tabela, "<tbody>", "</tbody>").matchAll(/<tr><td>([^<]*)<\/td><td class="num">(\d+)<\/td><td class="num"><b>([^<]*)<\/b><\/td><td class="num">([^<]*)<\/td>([\s\S]*?)<\/tr>/g)) {
        const rotulo = texto(linha[1]);
        valores[`${periodo}|${rotulo}|todos`] = { respostas: Number(linha[2]), media: texto(linha[3]), nps: texto(linha[4]) };
        [...linha[5].matchAll(/<td class="num">([\s\S]*?)<\/td>/g)].forEach((celula, i) => {
          valores[`${periodo}|${rotulo}|${mentores[i]}`] = texto(celula[1]);
        });
      }
    }
  }
  return valores;
}

// PAR-15: Pesquisa de Experiência: NPS da mentoria, respostas e média, índice, clareza e o índice
// de cada item da grade.
export function par15(/** @type {Legado} */ app) {
  app.navegar("#/nps");
  app.avaliar('filtro.npsAba = "experiencia"; render()');
  const html = app.tela();
  if (!html.includes("<h3>Pesquisa de Experiência &middot; anônima</h3>")) return {};
  const nps = casar(html, /<div class="k">NPS da mentoria<\/div><div class="v">([^<]*)<\/div><div class="d">(\d+) resposta\(s\) · média ([^<]*)<\/div>/, "NPS da mentoria");
  /** @type {Record<string, unknown>} */
  const valores = {
    nps: nps[1],
    respostas: Number(nps[2]),
    media: texto(nps[3]),
    indice: texto(casar(html, /<div class="k">Índice de experiência<\/div><div class="v">([^<]*)</, "índice")[1]),
    clareza: texto(casar(html, /<div class="k">Clareza dos próximos passos<\/div><div class="v">([^<]*)</, "clareza")[1]),
  };
  for (const m of trecho(html, "<th>Item da grade</th>", "</table>").matchAll(/<tr><td>([^<]*)<\/td><td class="num"><span class="pill [a-z]+">(\d+)<\/span><\/td><td class="num">(\d+)<\/td><\/tr>/g)) {
    valores[`item|${texto(m[1])}`] = { indice: Number(m[2]), respostas: Number(m[3]) };
  }
  return valores;
}

// PAR-16: Análise IA: a ordem dos mentorados por risco (id, ou hash do nome quando a leitura não
// tem ficha), a contagem por risco e, para quem vê a aba Por mentor, média e NPS de cada mentor.
export function par16(/** @type {Legado} */ app) {
  app.navegar("#/ia");
  if (!app.avaliar("ANALISE")) return {};
  app.avaliar('filtro.iaAba = "mentorados"; filtro.iaSel = ""; render()');
  const html = app.tela();
  // Sem leitura por mentorado a tela não tem lista nem título: a ordem é vazia e as contagens, 0.
  const contagem = html.includes("Sem leitura por mentorado nesta rodada.")
    ? ["", "0", "0", "0", "0"]
    : casar(html, /Mentorados &middot; (\d+) · risco alto (\d+) · médio (\d+) · baixo (\d+)<\/h3>/, "contagem por risco");
  const ordem = [...html.matchAll(/onclick="abrirIa\(([^)]*)\)"/g)].map((m) => {
    const chave = String(JSON.parse(texto(m[1]))).replace(/^mentorado:/, "");
    return chave.startsWith("nome:") ? chaveDeNome(chave.slice(5)) : chave;
  });
  /** @type {Record<string, unknown>} */
  const valores = { ordem, "risco|total": Number(contagem[1]), "risco|alto": Number(contagem[2]), "risco|medio": Number(contagem[3]), "risco|baixo": Number(contagem[4]) };
  if (app.avaliar('pode("verFinanceiro")')) {
    app.avaliar('filtro.iaAba = "mentores"; filtro.iaSel = ""; render()');
    for (const m of app.tela().matchAll(/onclick="abrirIa\(([^)]*)\)"><td><a class="lk-nome">[^<]*<\/a><\/td>\s*<td class="num">([^<]*)<\/td><td class="num">([^<]*)<\/td>/g)) {
      valores[`mentor|${chaveMentor(String(JSON.parse(texto(m[1]))).replace(/^mentor:/, ""))}`] = { media: texto(m[2]), nps: texto(m[3]) };
    }
  }
  return valores;
}

// PAR-17: Mentores: por mentor da tela, a carteira, as 1:1 e os encontros em 30 dias e no total,
// as agendadas, média e NPS dos 30 dias, as calls aceitas e a última atividade.
export function par17(/** @type {Legado} */ app) {
  app.navegar("#/mentores");
  /** @type {any[]} */
  const resumos = app.avaliar(`(() => { const { reunioes } = reunioesConcluidas1a1(); return mentoresDaTela().map(n => {
    const r = resumoMentor(n, reunioes);
    return { nome: n, carteira: r.carteira.map(c => c.m.id), r1_30: r.r1_30.length, r1: r.r1.length, grupos30: r.grupos30.length, grupos: r.grupos.length,
      agenda: r.agenda.length, media30: fmtMedia(mediaNps(r.nps30)), nps30: fmtNps(scoreNps(r.nps30)), calls: r.calls, ultima: r.ultima };
  }); })()`);
  return Object.fromEntries(resumos.map(({ nome, ...r }) => [chaveMentor(nome), r]));
}

/** As 17 métricas e os papéis que veem cada uma (mapeamento §3). */
export const METRICAS = /** @type {const} */ ([
  ["PAR-01", par01, ["admin", "diretoria", "mentor"]],
  ["PAR-02", par02, ["admin", "diretoria", "mentor"]],
  ["PAR-03", par03, ["admin", "diretoria", "mentor"]],
  ["PAR-04", par04, ["admin", "diretoria", "mentor"]],
  ["PAR-05", par05, ["admin", "diretoria", "mentor"]],
  ["PAR-06", par06, ["admin", "diretoria", "mentor"]],
  ["PAR-07", par07, ["admin", "diretoria", "mentor"]],
  ["PAR-08", par08, ["admin", "diretoria", "mentor"]],
  ["PAR-09", par09, ["admin", "diretoria", "mentor"]],
  ["PAR-10", par10, ["admin", "diretoria", "mentor"]],
  ["PAR-11", par11, ["admin", "diretoria"]],
  ["PAR-12", par12, ["admin", "diretoria", "mentor"]],
  ["PAR-13", par13, ["admin", "diretoria"]],
  ["PAR-14", par14, ["admin", "diretoria"]],
  ["PAR-15", par15, ["admin", "diretoria"]],
  ["PAR-16", par16, ["admin", "diretoria", "mentor"]],
  ["PAR-17", par17, ["admin", "diretoria"]],
]);
