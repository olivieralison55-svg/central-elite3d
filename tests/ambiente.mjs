/* Ambiente de teste do index.html — sem dependência externa, sem build.
 *
 * O app é um arquivo único que monta as telas por template string e innerHTML.
 * Aqui a gente extrai o <script> inline, executa num escopo controlado com
 * stubs mínimos de browser, e guarda o innerHTML atribuído a cada seletor para
 * poder inspecionar o que cada tela produziu.
 *
 * Não substitui teste em browser: nada de layout, evento real ou CSS passa por
 * aqui. O que dá para cobrir é o que já quebrou nesse projeto antes — escape de
 * HTML na renderização, o que cada papel vê, e as contagens de sessão.
 *
 * `carregarApp()` devolve uma instância nova a cada chamada: o estado do app
 * vive dentro do closure do `new Function`, então dois papéis não se contaminam.
 *
 * **Não intercale duas instâncias.** Os stubs são instalados em `globalThis`
 * (`document`, `window`, `supabase`), então a última instância criada é quem
 * passa a receber os renders — inclusive os de uma instância anterior, cujo
 * `tela()` continuaria lendo o mapa antigo e devolvendo HTML velho em silêncio.
 * Um bloco `{ ... }` por instância, sem `carregarApp()` no meio.
 */
import {readFileSync} from "node:fs";

const ARQUIVO = new URL("../index.html", import.meta.url);

/* Payload de XSS armazenado. Um valor "neutralizado" é o que não abre elemento
 * novo (`<img` cru ausente) E aparece escapado (`&lt;img` presente) — provar só
 * a ausência não distingue escape de o dado ter sido descartado no caminho. */
export const XSS = '"><img src=x onerror=alert(1)>';

/* Símbolos do app que os testes precisam alcançar. */
const EXPORTA = [
  "esc", "fmtBRL", "fmtD", "dpLabel", "dateField", "monthField",
  "agruparGrupo", "statusGrupo", "resumoStatusGrupo", "ehGrupo", "eh1a1",
  "ETAPAS", "ETAPAS_GRUPO", "ETAPA_ORD", "chartScales", "progBar",
  "sessoes1a1De", "sessoesGrupoDe", "pode", "CAPACIDADES", "PAPEL_LABEL",
  "renderDash", "renderMentorados", "renderSessoes", "renderFinanceiro", "renderRotas",
  "setView", "reunioesConcluidas1a1", "casaBusca", "buscaField", "btnNovoMentorado",
  "normalizaEmail", "msgErroMentorado", "alvoBuscaData",
  "prazoTexto", "diasAte", "parcelaDaLia", "proximaParcela",
  "cobrancasOrfas", "motivoOrfa", "cobrancasDescartadas",
  "lerEndereco", "aplicarEndereco", "irPara", "renderFicha", "render",
];

export function carregarApp() {
  /* ---- DOM stub: um objeto por seletor, para ler o innerHTML depois ---- */
  const nodes = new Map();
  const qsa = new Map();          // respostas fixas para querySelectorAll
  const mkEl = (chave) => {
    if (nodes.has(chave)) return nodes.get(chave);
    const el = {
      _chave: chave, style: {}, dataset: {}, className: "", isConnected: true,
      textContent: "", innerHTML: "", value: "", checked: false, disabled: false,
      classList: {add(){}, remove(){}, toggle(){}, contains: () => false},
      setAttribute(){}, getAttribute: () => null, focus(){}, remove(){},
      addEventListener(){}, removeEventListener(){}, appendChild(){}, dispatchEvent(){},
      querySelector: () => mkEl(chave + " *"), querySelectorAll: () => [],
      getBoundingClientRect: () => ({top:0, left:0, bottom:0, right:0, width:0, height:0}),
    };
    nodes.set(chave, el);
    return el;
  };

  /* ---- escritas no banco, capturadas em vez de enviadas ---- */
  const escritas = [];
  const tabelaFalsa = (tabela) => {
    const q = {
      select: () => q, order: () => q, eq: () => q, in: (_c, v) => { q._ids = v; return q; },
      is: () => q, single: () => q, maybeSingle: () => q,
      // O cliente real tem .range() -- paginado() em loadAll depende dele.
      range: () => q,
      insert(v) { escritas.push({tabela, op: "insert", dados: v}); return q; },
      update(v) { escritas.push({tabela, op: "update", dados: v, get ids() { return q._ids; }}); return q; },
      upsert(v) { escritas.push({tabela, op: "upsert", dados: v}); return q; },
      delete() { escritas.push({tabela, op: "delete"}); return q; },
      then: (r) => r({data: [], error: null}),
    };
    return q;
  };

  globalThis.document = {
    querySelector: (sel) => mkEl(sel),
    getElementById: (id) => mkEl("#" + id),
    querySelectorAll: (sel) => qsa.get(sel) || [],
    createElement: () => mkEl("__criado__" + nodes.size),
    documentElement: {},
    body: {appendChild(){}},
    addEventListener(){},
  };
  globalThis.getComputedStyle = () => ({getPropertyValue: () => ""});
  globalThis.Event = class { constructor(t) { this.type = t; } };
  globalThis.KeyboardEvent = globalThis.Event;
  globalThis.confirm = () => true;
  globalThis.alert = () => {};
  globalThis.setTimeout = (fn) => 0;      // o toast se esconde sozinho; não interessa
  globalThis.clearTimeout = () => {};
  globalThis.supabase = {createClient: () => ({
    auth: {
      getSession: async () => ({data: {session: null}}),
      onAuthStateChange(){}, signOut: async () => {},
    },
    from: tabelaFalsa,
    /* O app chama funcoes do banco por rpc (lia_refletir_financeiro,
       lia_adotar_orfas). Sem este stub a chamada estouraria e o teste mediria a
       falta do stub, nao o comportamento. */
    rpc: (nome, args) => { escritas.push({tabela: "rpc:" + nome, op: "rpc", dados: args}); return Promise.resolve({data: 0, error: null}); },
  })};
  /* A tela do app vive em `location.hash`: sem um stub que guarde o valor E
     avise o listener de `hashchange`, navegar num teste não desenharia nada. */
  const ouvintes = new Map();
  globalThis.addEventListener = (ev, fn) => {
    if (!ouvintes.has(ev)) ouvintes.set(ev, []);
    ouvintes.get(ev).push(fn);
  };
  let hashAtual = "";
  globalThis.location = {
    get hash() { return hashAtual; },
    set hash(v) {
      const novo = v.startsWith("#") ? v : "#" + v;
      if (novo === hashAtual) return;
      hashAtual = novo;
      (ouvintes.get("hashchange") || []).forEach((fn) => fn());
    },
  };
  globalThis.window = globalThis;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 800;

  /* ---- carrega o <script> inline do index.html ---- */
  const html = readFileSync(ARQUIVO, "utf8").replace(/\r\n/g, "\n");
  const i = html.indexOf("<script>\n/* ================= CONFIG");
  const j = html.indexOf("</script>", i);
  if (i < 0 || j < 0) throw new Error("nao localizei o <script> inline do index.html");
  /* boot() sai: dispara auth de verdade e não tem o que testar aqui. */
  const codigo = html.slice(i + "<script>".length, j).replace(/\nboot\(\);\s*$/, "\n");

  const mod = new Function(codigo + `
    ;return {
      ${EXPORTA.join(",")},
      estado: {
        get M(){ return M }, set M(v){ M = v },
        get P(){ return P }, set P(v){ P = v },
        get S(){ return S }, set S(v){ S = v },
        set ORFAS(v){ ORFAS = v },
        get COBRANCAS(){ return COBRANCAS }, set COBRANCAS(v){ COBRANCAS = v },
        set STLSELLER(v){ STLSELLER = v }, set STLSELLER_ERRO(v){ STLSELLER_ERRO = v },
        set STL_PEDIDOS(v){ STL_PEDIDOS = v }, set STL_PRODUTOS(v){ STL_PRODUTOS = v },
        set papel(v){ myRole = v; myProfile = {nome:"Teste", email:"teste@exemplo.com", role:v} },
        rotas(r, mk, mm, cn, mc, f){ ROTAS=r; MARCOS=mk; MM=mm; CANAIS_DB=cn; MC=mc; FAT=f;
          rotaAtual = r[0] && r[0].slug },
        get marcoAberto(){ return marcoAberto }, set marcoAberto(v){ marcoAberto = v },
        get filtro(){ return filtro },
        get mesMatriz(){ return mesMatriz }, set mesMatriz(v){ mesMatriz = v },
        get GRUPO_REG(){ return GRUPO_REG },
        /* O loadAll é quem libera o render em produção; aqui os dados chegam
           por atribuição direta, então o teste liga a chave. */
        set dadosProntos(v){ dadosProntos = v },
        get fichaAba(){ return fichaAba },
        get voltarPara(){ return voltarPara },
      },
    };`)();

  return {
    mod,
    estado: mod.estado,
    escritas,
    /* HTML que uma tela ou modal produziu */
    tela: (sel = "#app") => (nodes.get(sel) ? nodes.get(sel).innerHTML : ""),
    modal: () => (nodes.get("#modalBox") ? nodes.get("#modalBox").innerHTML : ""),
    /* endereço atual — a ficha e cada tela têm o seu */
    endereco: () => globalThis.location.hash,
    /* último toast exibido */
    toast: () => (nodes.get("#toast") ? nodes.get("#toast").textContent : ""),
    /* preenche um campo que o app vai ler com $("#id").value */
    preencher: (sel, valor) => { mkEl(sel).value = valor; },
    /* resposta fixa para um querySelectorAll (ex.: checkboxes marcados) */
    responder: (sel, itens) => qsa.set(sel, itens),
    limparEscritas: () => { escritas.length = 0; },
  };
}

/* ---------------------------------------------------------------------------
 * Fixtures. Cobrem de propósito: mentorado ativo, pausado, com e sem sessão,
 * nome com payload de XSS, sessão sem mentor e sem data, e dois encontros em
 * grupo — um com presenças divergentes, outro agendado no futuro.
 * Datas em 2099 são para o registro nunca "vencer" com o passar do tempo.
 * ------------------------------------------------------------------------- */
export function fixtures() {
  const M = [
    /* m1 com e-mail, m2 sem: os dois caminhos do sync convivem enquanto as
       fichas antigas não forem preenchidas. */
    {id:"m1", nome:"Ana Clara",     situacao:"ativo",    data_fechamento:"2026-01-10", contrato_status:"Assinado",  entrada_status:"Pago", restante_status:"Pago", email:"ana.clara@exemplo.com"},
    {id:"m2", nome:"Bruno Dias",    situacao:"ativo",    data_fechamento:"2026-03-02", contrato_status:"Ainda não", entrada_status:"Pago", restante_status:"Ainda não", email:"bruno@exemplo.com"},
    {id:"m3", nome:"Diego " + XSS,  situacao:"ativo",    data_fechamento:"2025-10-01", contrato_status:"Assinado",  entrada_status:"Pago", restante_status:"Pago", cadastro_incompleto:true},
    {id:"m4", nome:"Carla " + XSS,  situacao:"pausado",  data_fechamento:"2025-11-20", contrato_status:"Assinado",  entrada_status:"Pago", restante_status:"Pago"},
  ];
  const S = [
    // trilha 1:1
    {id:"s1", mentorado_id:"m1", etapa:"Diagnóstico de Negócio", ordem:1, status:"Concluída",              mentor:"Evaldo", data:"2026-02-01", hora:"10:00:00"},
    /* s2 com a etapa escolhida pelo sync: o título do evento não dizia qual
       era, e ninguém salvou a sessão para confirmar. */
    {id:"s2", mentorado_id:"m1", etapa:"Plano de Ação",           ordem:2, status:"Agendada",               mentor:"Evaldo", data:"2099-09-01", hora:"14:00:00", etapa_deduzida:true},
    {id:"s3", mentorado_id:"m2", etapa:"Diagnóstico de Negócio",  ordem:1, status:"Aguardando confirmação", mentor:null,     data:"2026-04-01", hora:"09:00:00"},
    {id:"s4", mentorado_id:"m2", etapa:"Checkup 1",               ordem:3, status:"Bloqueada",              mentor:"Luan",   data:null,         hora:null},
    {id:"s5", mentorado_id:"m4", etapa:"Plano de Ação",           ordem:2, status:"Concluída",              mentor:"Israel", data:"2025-12-05", hora:"11:00:00"},
    // encontro em grupo: 3 presenças no mesmo dia/hora, uma divergente
    {id:"g1", mentorado_id:"m1", etapa:"Plantão de Dúvida Semanal", ordem:90, status:"Concluída", mentor:"Sergio", data:"2026-08-06", hora:"19:00:00", link_gravacao:"https://exemplo.com/g1"},
    {id:"g2", mentorado_id:"m2", etapa:"Plantão de Dúvida Semanal", ordem:90, status:"Concluída", mentor:"Sergio", data:"2026-08-06", hora:"19:00:00"},
    {id:"g3", mentorado_id:"m4", etapa:"Plantão de Dúvida Semanal", ordem:90, status:"Bloqueada", mentor:"Sergio", data:"2026-08-06", hora:"19:00:00"},
    // encontro em grupo agendado
    {id:"g4", mentorado_id:"m1", etapa:"Sessão de Implementação Mensal", ordem:91, status:"Agendada", mentor:"Michelle", data:"2099-10-15", hora:"20:00:00"},
    {id:"g5", mentorado_id:"m2", etapa:"Sessão de Implementação Mensal", ordem:91, status:"Agendada", mentor:"Michelle", data:"2099-10-15", hora:"20:00:00"},
  ];
  /* p1 é manual e já venceu; p2 e p3 vieram da Lia (uma paga, uma a vencer) —
     a ficha precisa distinguir as duas origens na mesma tela. As datas de p2/p3
     são relativas a hoje para o prazo ("vence em N dias") ser testável sem o
     teste envelhecer. */
  const hoje = new Date();
  const emDias = (n) => new Date(hoje.getTime() + n * 86400000).toLocaleDateString("sv-SE");
  const P = [
    {id:"p1", mentorado_id:"m1", numero:1, status:"aberta", vencimento:"2026-01-01", valor:500, lia_bill_id:null},
    {id:"p2", mentorado_id:"m2", numero:1, status:"paga",   vencimento:emDias(-30),  valor:800, lia_bill_id:"bill_1"},
    {id:"p3", mentorado_id:"m2", numero:2, status:"aberta", vencimento:emDias(3),    valor:800, lia_bill_id:"bill_2"},
  ];
  /* Um marco com a gramática inteira do Compilado (restrição, alavanca, apoios,
     indicadores, teste de passagem em dois portões) e outro sem nada além do
     nome: o painel tem que aguentar os dois. O critério com XSS prova que o
     texto do teste de passagem passa por esc() na label e no value. */
  const rotas = [
    [{id:"r1", slug:"feiras", nome:"Rota das Feiras", modelo:"rico", ordem:1, unidade:"acumulado"}],
    [{id:"mk1", rota_id:"r1", nome:"Marco 01 — R$ 500 acumulados", objetivo:"A feira paga o dia", ordem:1,
      subtitulo:"Escolher a feira certa e montar a operação mínima.",
      restricao:"Cada feira começa do zero", alavanca:"Repetição", pergunta_chave:"O que falta?",
      apoios:["Qualificar a feira com o organizador", "Mix mínimo viável"],
      indicadores:["Ticket médio", "Conversão"],
      meta_valor:500, placa:false,
      criterios:[
        {grupo:"Portão A · Apto a vender", itens:["Tenho produto validado", "Conheço meu CMV"]},
        {grupo:"Portão B · Primeira receita", itens:["Bati R$ 500 acumulados na rota", "Registrei " + XSS]},
      ]},
     {id:"mk2", rota_id:"r1", nome:"Marco 04 — R$ 20.000 acumulados", ordem:4, meta_valor:20000, placa:true,
      criterios:[{grupo:null, itens:["Tenho calendário fechado para os próximos 3 meses"]}]}],
    [{mentorado_id:"m1", marco_id:"mk1", status:"EM_ANDAMENTO", data:"2026-05-01", progresso:50,
      criterios_ok:["Tenho produto validado", "Conheço meu CMV"], bloqueios:["Sem ponto de energia"],
      proxima_acao:"Fechar inscrição da próxima feira"}],
    [{id:"c1", rota_id:"r1", nome:"Presencial", ordem:1}],
    [{mentorado_id:"m1", rota_id:"r1", canal_id:"c1"}],
    [{id:"f1", mentorado_id:"m1", mes:"2026-07-01", canal_id:"c1", valor:10000},
     {id:"f2", mentorado_id:"m1", mes:"2026-08-01", canal_id:"c1", valor:5000}],
  ];
  return {M, S, P, rotas};
}

/* Instala as fixtures numa instância e escolhe o papel. */
export function preparar(app, papel = "admin") {
  const {M, S, P, rotas} = fixtures();
  app.estado.papel = papel;
  app.estado.dadosProntos = true; // o loadAll não roda aqui; os dados vêm abaixo
  app.estado.M = M;
  app.estado.S = S;
  /* quem não vê financeiro não carrega parcelas — é o que o loadAll faz */
  app.estado.P = (papel === "admin" || papel === "diretoria") ? P : [];
  app.estado.ORFAS = [];
  /* Duas cobrancas orfas, uma resolvivel e uma nao: o e-mail da primeira casa
     com m2 (um cadastro so), a segunda veio sem e-mail e nao tem a quem casar. */
  app.estado.COBRANCAS = [
    {lia_bill_id:"orf1", mentorado_id:null, status:"paid",    amount_cents:150000, due_date:"2026-09-20", contact_email:"bruno@exemplo.com"},
    {lia_bill_id:"orf2", mentorado_id:null, status:"overdue", amount_cents:90000,  due_date:"2026-08-10", contact_email:null},
    {lia_bill_id:"ok1",  mentorado_id:"m1", status:"paid",    amount_cents:600,    due_date:"2026-09-18", contact_email:"ana.clara@exemplo.com"},
    /* Compra de teste ja descartada: nao conta como orfa nem aparece em ficha. */
    {lia_bill_id:"desc1", mentorado_id:null, status:"paid", amount_cents:100, due_date:"2026-09-01", contact_email:"teste@exemplo.com", ignorada:true},
  ];
  /* STLSeller: m1 casa pelo e-mail do formulario, m2 pelo e-mail STLFLIX (o
     do formulario e outro). m3 e m4 nao tem registro. O titulo com XSS prova
     que o que vem do marketplace passa por esc(); o permalink javascript: prova
     que link de fora nao vira href. */
  app.estado.STLSELLER_ERRO = null;
  app.estado.STLSELLER = [
    {email:"ana.clara@exemplo.com", email_stlflix:"ana@stlflix.com", status_formulario:"ATIVO", status_real:"pago",
     plano_ativo:true, vendas_marketplace:214, loja_id:"s1", loja_nome:"Loja da Ana", loja_email:"loja@ana.com",
     lia_status_pagamento:"finished", lia_pedidos:1, lia_pedidos_finalizados:1, lia_ultimo_pedido_em:"2026-08-06T21:52:45.995+00:00",
     lia_motivo_cancelamento:null, produtos_vendidos:2, faturamento_total:"1234.50", synced_at:"2026-09-22T12:00:00Z"},
    {email:"outro@exemplo.com", email_stlflix:"bruno@exemplo.com", status_formulario:"PAUSADO", status_real:"sem_pedido_lia",
     plano_ativo:false, loja_id:null, lia_ultimo_pedido_em:null, produtos_vendidos:0, faturamento_total:"0.00", synced_at:"2026-09-22T12:00:00Z"},
    /* E-mail do formulario diferente, mas o STLFLIX acha a loja (caixa diferente
       de proposito): conta como resolvido, nao como cadastro incorreto. */
    {email:"form.eva@exemplo.com", email_stlflix:"eva@stlflix.com", nome:"Eva Sem Ficha", status_formulario:"ATIVO", status_real:"pago",
     plano_ativo:true, loja_id:"s3", loja_nome:"Loja da Eva", loja_email:"EVA@stlflix.com", produtos_vendidos:0, faturamento_total:"0.00", synced_at:"2026-09-22T12:00:00Z"},
  ];
  app.estado.STL_PEDIDOS = [
    {email:"ana.clara@exemplo.com", marketplace:"mercadolivre", pedidos:12, pedidos_vendidos:10, pedidos_cancelados:2,
     total_bruto:"1500.00", total_liquido:null, ultimo_pedido_em:"2026-09-01T10:00:00Z"},
  ];
  /* numeric chega do PostgREST como string: a ordenacao tem que converter. */
  app.estado.STL_PRODUTOS = [
    {email:"ana.clara@exemplo.com", marketplace:"mercadolivre", anuncio_id:"MLB1", titulo:"Vaso " + XSS, link:"javascript:alert(1)",
     pedidos:3, unidades:4, faturamento:"234.50", ultima_venda_em:"2026-09-01T10:00:00Z"},
    {email:"ana.clara@exemplo.com", marketplace:"shopee", anuncio_id:"SP1", titulo:"Chaveiro", link:"https://exemplo.com/p/1",
     pedidos:7, unidades:9, faturamento:"1000.00", ultima_venda_em:"2026-08-20T10:00:00Z"},
  ];
  app.estado.rotas(...rotas);
  /* Trilha de rotas já com um marco expandido: é onde vivem o teste de
     passagem e o botão de salvar, e a varredura de permissões só os enxerga
     com o painel aberto. */
  app.estado.marcoAberto = "mk1";
  return app;
}

/* ---------------------------------------------------------------------------
 * Runner mínimo.
 * ------------------------------------------------------------------------- */
export function criarRunner() {
  let falhas = 0, total = 0;
  return {
    secao: (t) => console.log("\n" + t),
    ok(nome, condicao, detalhe) {
      total++;
      if (condicao) { console.log("  ok    " + nome); return; }
      falhas++;
      console.log("  FALHA " + nome);
      if (detalhe !== undefined) console.log("        " + String(detalhe).slice(0, 300).replace(/\n/g, "\n        "));
    },
    fim() {
      console.log("\n" + (falhas ? falhas + " de " + total + " FALHARAM" : total + " testes passaram"));
      return falhas;
    },
  };
}

/* Ausência de `<img` cru mais presença de `&lt;img`: prova que passou por esc(). */
export const escapado = (s) => !s.includes("<img") && s.includes("&lt;img");
/* Buracos típicos de template string com campo faltando. */
export const semLixo = (s) => !/undefined|NaN|\[object Object\]/.test(s);
/* toLocaleString usa espaço estreito sem quebra entre "R$" e o número. */
export const brl = (s) => s.replace(/ /g, " ");
