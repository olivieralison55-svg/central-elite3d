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
  })};
  globalThis.addEventListener = () => {};
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
        set papel(v){ myRole = v; myProfile = {nome:"Teste", email:"teste@exemplo.com", role:v} },
        rotas(r, mk, mm, cn, mc, f){ ROTAS=r; MARCOS=mk; MM=mm; CANAIS_DB=cn; MC=mc; FAT=f;
          rotaAtual = r[0] && r[0].slug },
        get filtro(){ return filtro },
        get GRUPO_REG(){ return GRUPO_REG },
      },
    };`)();

  return {
    mod,
    estado: mod.estado,
    escritas,
    /* HTML que uma tela ou modal produziu */
    tela: (sel = "#app") => (nodes.get(sel) ? nodes.get(sel).innerHTML : ""),
    modal: () => (nodes.get("#modalBox") ? nodes.get("#modalBox").innerHTML : ""),
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
    {id:"m1", nome:"Ana Clara",     situacao:"ativo",    data_fechamento:"2026-01-10", contrato_status:"Assinado",  entrada_status:"Pago", restante_status:"Pago"},
    {id:"m2", nome:"Bruno Dias",    situacao:"ativo",    data_fechamento:"2026-03-02", contrato_status:"Ainda não", entrada_status:"Pago", restante_status:"Ainda não"},
    {id:"m3", nome:"Diego " + XSS,  situacao:"ativo",    data_fechamento:"2025-10-01", contrato_status:"Assinado",  entrada_status:"Pago", restante_status:"Pago"},
    {id:"m4", nome:"Carla " + XSS,  situacao:"pausado",  data_fechamento:"2025-11-20", contrato_status:"Assinado",  entrada_status:"Pago", restante_status:"Pago"},
  ];
  const S = [
    // trilha 1:1
    {id:"s1", mentorado_id:"m1", etapa:"Diagnóstico de Negócio", ordem:1, status:"Concluída",              mentor:"Evaldo", data:"2026-02-01", hora:"10:00:00"},
    {id:"s2", mentorado_id:"m1", etapa:"Plano de Ação",           ordem:2, status:"Agendada",               mentor:"Evaldo", data:"2099-09-01", hora:"14:00:00"},
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
  const P = [{id:"p1", mentorado_id:"m1", numero:1, status:"aberta", vencimento:"2026-01-01", valor:500}];
  const rotas = [
    [{id:"r1", slug:"feiras", nome:"Rota das Feiras", modelo:"rico", ordem:1}],
    [{id:"mk1", rota_id:"r1", nome:"Primeira feira", ordem:1}],
    [{mentorado_id:"m1", marco_id:"mk1", status:"CONCLUIDO", data:"2026-05-01", progresso:100}],
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
  app.estado.M = M;
  app.estado.S = S;
  /* quem não vê financeiro não carrega parcelas — é o que o loadAll faz */
  app.estado.P = (papel === "admin" || papel === "diretoria") ? P : [];
  app.estado.ORFAS = [];
  app.estado.rotas(...rotas);
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
