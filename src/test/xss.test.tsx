import type { ComponentProps, ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_INICIAL, type Ui } from "@/components/shell/contexto";
import Dashboard from "@/components/modules/dashboard/dashboard";
import Ficha from "@/components/modules/ficha/ficha";
import { ConfirmarSessaoForm, SessaoDialogo } from "@/components/modules/ficha/aba-sessoes";
import { ParcelaForm } from "@/components/modules/ficha/aba-financeiro";
import Financeiro from "@/components/modules/financeiro/financeiro";
import Ia from "@/components/modules/ia/ia";
import Mentorados from "@/components/modules/mentorados/mentorados";
import { NovoMentoradoForm } from "@/components/modules/mentorados/novo-mentorado";
import Mentores from "@/components/modules/mentores/mentores";
import Nps from "@/components/modules/nps/nps";
import { PainelDeEscolha } from "@/components/modules/rotas/escolher-mentorado";
import Rotas from "@/components/modules/rotas/rotas";
import { DetalheEncontro, RegistrarEncontroForm } from "@/components/modules/sessoes/grupo";
import Sessoes from "@/components/modules/sessoes/sessoes";
import Stlseller from "@/components/modules/stlseller/stlseller";
import type { Dataset } from "@/lib/data/esquemas";
import { ABAS_FICHA } from "@/lib/endereco";
import type { Papel } from "@/lib/papeis";
import { agruparGrupo } from "@/lib/sessoes";
import { datasetDeTeste, XSS } from "@/test/fixtures";
import { renderTela } from "@/test/render";

// TEST-02 e SEC-05: toda tela, a ficha nas 5 abas e os corpos de modal com o nome de mentorado
// `<img src=x onerror=alert(1)>` (e o XSS de tests/ambiente.mjs:31 nos textos do banco, do modelo e
// do marketplace). Escapado é `&lt;img` presente e `<img src=x` ausente; os links `javascript:` e
// `data:` dos fixtures nunca viram `href`.

// Sem DOM, o setState depois do render no servidor não muda nada: o falso guarda o estado entre
// renders. A chave é o useId da chamada, que segue a posição do componente na árvore: um modal que
// monta no meio da tela não desloca o estado dos componentes depois dele, como deslocaria a ordem.
const estado = vi.hoisted(() => ({ valores: new Map<string, unknown>() }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (inicial: unknown) => {
      const id = react.useId();
      if (!estado.valores.has(id)) estado.valores.set(id, typeof inicial === "function" ? (inicial as () => unknown)() : inicial);
      const definir = (valor: unknown) => {
        estado.valores.set(id, typeof valor === "function" ? (valor as (anterior: unknown) => unknown)(estado.valores.get(id)) : valor);
      };
      return [estado.valores.get(id), definir];
    },
  };
});
// O Button anota o onClick e desenha o de verdade: a varredura clica em cada um para abrir os modais.
const cliques = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      const onClick = props.onClick;
      if (onClick) cliques.push(() => onClick(EVENTO as never));
      return createElement(original.default, props);
    },
  };
});
// O Dialog devolve null sem `document`: aberto, o falso desenha título, corpo e rodapé.
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; title?: ReactNode; children: ReactNode; footer?: ReactNode }) =>
      props.open ? createElement("dialog-falso", null, createElement("h2", null, props.title), props.children, props.footer) : null,
  };
});
// Nenhuma escrita sai: a porta responde com uma promessa que nunca termina.
vi.mock("@/lib/data/escritas", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/data/escritas")>();
  return Object.fromEntries(Object.entries(original).map(([nome, valor]) => [nome, typeof valor === "function" ? () => new Promise(() => undefined) : valor]));
});
vi.mock("@/lib/data/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/auth")>()),
  usuarioDaSessao: () => new Promise(() => undefined),
}));
vi.mock("react-hot-toast", () => ({ default: { error: () => undefined, success: () => undefined } }));

const EVENTO = { preventDefault: () => undefined, stopPropagation: () => undefined, target: { value: "" }, currentTarget: { value: "" } };

// Os links ruins que o banco e o marketplace podem trazer.
const RUINS = ["javascript:alert(1)", "data:text/html,oi", "JavaScript:alert(2)", "data:image/svg+xml,x"];

// Os fixtures com o nome do critério em todo mentorado, XSS nos textos que as telas mostram e um link
// ruim em cada coluna de link de SEC-05.
function dadosXss(): Dataset {
  const d = datasetDeTeste();
  d.mentorados = d.mentorados.map((m) => ({ ...m, nome: `${m.nome} <img src=x onerror=alert(1)>` }));
  Object.assign(d.mentorados[0], { link_drive: RUINS[0], link_mapa_mental: RUINS[1], link_whatsapp: RUINS[2] });
  Object.assign(d.mentorados[3], { link_drive: RUINS[3], link_mapa_mental: RUINS[0], link_whatsapp: RUINS[1] });
  d.sessoes = d.sessoes.map((s) => ({ ...s, link_meet: RUINS[0], link_gravacao: RUINS[1], link_anotacoes: RUINS[2] }));
  d.stlProdutos[1] = { ...d.stlProdutos[1], link: RUINS[1], titulo: "Chaveiro " + XSS };
  d.stlseller = d.stlseller.map((s) => ({ ...s, nome: `${s.nome ?? "Loja"} ${XSS}`, loja_nome: `${s.loja_nome ?? "Loja"} ${XSS}` }));
  d.cobrancas.push({ lia_bill_id: "orf3", mentorado_id: null, status: "overdue", amount_cents: 1000, due_date: "2026-08-11", contact_email: `x${XSS}@exemplo.com`, ignorada: false });
  d.canais = d.canais.map((c) => ({ ...c, nome: `${c.nome} ${XSS}` }));
  d.mentoradoMarcos = d.mentoradoMarcos.map((mm) => ({ ...mm, bloqueios: [`Bloqueio ${XSS}`], proxima_acao: `Ação ${XSS}` }));
  d.nps = d.nps.map((n) => ({ ...n, comentario: `Comentário ${XSS}` }));
  // Um mentor fora da lista, como o banco pode trazer, e um registro do STLSeller em cada status do filtro.
  d.sessoes.push({ ...d.sessoes[0], id: "s9", mentorado_id: "m3", status: "Concluída", mentor: "Zeca " + XSS, data: "2026-09-30", ordem: 3, etapa: "Checkup 1" });
  d.stlseller.push({ ...d.stlseller[1], email: "cancelado@exemplo.com", email_stlflix: null, status_formulario: "CANCELADO" });
  return d;
}

// O HTML de cada render passa no critério; as falhas saem com a tela e o clique que as produziu.
function confere(rotulo: string, html: string) {
  expect(html, `${rotulo}: escapado`).toContain("&lt;img");
  expect(html, `${rotulo}: elemento cru`).not.toContain("<img src=x");
  expect(html, `${rotulo}: href perigoso`).not.toMatch(/href="\s*(?:javascript|data):/i);
}

function render(el: ReactElement, papel: Papel, dados: Dataset, manter = false, ui: Partial<Ui> = {}): string {
  cliques.length = 0;
  if (!manter) estado.valores.clear();
  return renderTela(el, { papel, dados, ui });
}

// A tela de cara, e de novo depois de cada clique de botão: é assim que os modais abrem.
// Devolve os HTMLs, para quem quiser conferir mais.
function varrer(rotulo: string, el: ReactElement, papel: Papel, ui: Partial<Ui> = {}): string[] {
  const dados = dadosXss();
  const inicial = render(el, papel, dados, false, ui);
  confere(`${rotulo} ${papel}`, inicial);
  const total = cliques.length;
  const htmls = [inicial];
  for (let i = 0; i < total; i++) {
    render(el, papel, dados, false, ui);
    cliques[i]();
    const html = render(el, papel, dados, true, ui);
    confere(`${rotulo} ${papel} clique ${i}`, html);
    htmls.push(html);
  }
  return htmls;
}

const TODOS: Papel[] = ["admin", "diretoria", "mentor"];
// As telas de verFinanceiro: o mentor não entra (NAV-04).
const COM_FINANCEIRO: Papel[] = ["admin", "diretoria"];

describe("varredura de XSS (TEST-02, SEC-05)", () => {
  beforeEach(() => {
    estado.valores.clear();
  });

  const TELAS: Array<[string, ReactElement, Papel[], Array<Partial<Ui>>?]> = [
    ["Dashboard", <Dashboard key="d" modo="completo" />, TODOS],
    ["Acompanhamento", <Dashboard key="a" modo="acompanhamento" />, TODOS],
    ["Mentorados", <Mentorados key="m" />, TODOS],
    ["Sessões", <Sessoes key="s" />, TODOS],
    ["Rotas", <Rotas key="r" />, TODOS],
    // A visão geral e o detalhe de um mentor, escolhido pelo filtro da casca.
    ["Mentores", <Mentores key="mt" />, COM_FINANCEIRO, [{}, { filtro: { ...UI_INICIAL.filtro, mentorSel: "Evaldo" } }, { filtro: { ...UI_INICIAL.filtro, mentorSel: "Zeca " + XSS } }]],
    ["STLSeller", <Stlseller key="st" />, COM_FINANCEIRO],
    ["NPS", <Nps key="n" />, COM_FINANCEIRO],
    ["Análise IA", <Ia key="i" />, ["admin", "diretoria"]],
    ["Financeiro", <Financeiro key="f" />, COM_FINANCEIRO],
  ];
  for (const [rotulo, el, papeis, uis = [{}]] of TELAS) {
    it(`${rotulo}: o nome e os textos de fora aparecem escapados, em cada papel e depois de cada clique`, () => {
      for (const papel of papeis) for (const ui of uis) expect(varrer(rotulo, el, papel, ui).length, `${rotulo} ${papel}`).toBeGreaterThan(0);
    });
  }

  it("Ficha: as 5 abas, de cada mentorado com o nome do critério, depois de cada clique", () => {
    const abas = ABAS_FICHA.filter((a) => ["cadastro", "financeiro", "sessoes", "notas", "stlseller"].includes(a));
    expect(abas).toHaveLength(5);
    for (const id of ["m1", "m4"]) for (const aba of abas) varrer(`Ficha ${id} ${aba}`, <Ficha id={id} aba={aba} />, "admin");
    for (const aba of abas) varrer(`Ficha m1 ${aba}`, <Ficha id="m1" aba={aba} />, "mentor");
  });

  it("corpos de modal abertos por um clique: excluir mentorado, editar parcela, sessão, encontro em grupo e novo mentorado", () => {
    const abertos = [
      ...varrer("Ficha cadastro", <Ficha id="m1" aba="cadastro" />, "admin"),
      ...varrer("Ficha financeiro", <Ficha id="m1" aba="financeiro" />, "admin"),
      ...varrer("Ficha sessoes", <Ficha id="m1" aba="sessoes" />, "admin"),
      ...varrer("Sessões", <Sessoes />, "admin"),
    ].filter((html) => html.includes("<dialog-falso>"));
    const titulos = abertos.map((html) => html.match(/<dialog-falso><h2>([^<]*)/)?.[1] ?? "");
    expect(titulos).toContain("Excluir mentorado");
    expect(titulos.some((t) => t.startsWith("Parcela #1 · Ana Clara &lt;img"))).toBe(true);
    expect(titulos.some((t) => t.startsWith("Editar sessão · Ana Clara &lt;img"))).toBe(true);
    expect(titulos).toContain("Plantão de Dúvida Semanal");
    expect(titulos).toContain("Novo mentorado");
    for (const html of abertos) expect(html.slice(html.indexOf("<dialog-falso>"))).not.toContain("<img src=x");
  });

  it("corpos de modal que precisam de dois cliques: presença do encontro, confirmar sessão, parcela, escolha de mentorado e registro em grupo", () => {
    const dados = dadosXss();
    const [plantao] = agruparGrupo(dados.sessoes);
    const s1 = dados.sessoes[0];
    const corpos: Array<[string, ReactElement]> = [
      ["DetalheEncontro", <DetalheEncontro key="e" encontro={plantao} aoConfirmar={() => undefined} />],
      ["SessaoDialogo", <SessaoDialogo key="sd" alvo={{ sessao: s1, mentoradoId: "m1" }} onClose={() => undefined} />],
      ["ConfirmarSessaoForm", <ConfirmarSessaoForm key="c" sessao={s1} aoTerminar={() => undefined} />],
      ["ParcelaForm", <ParcelaForm key="p" parcela={dados.parcelas[0]} aoTerminar={() => undefined} />],
      ["PainelDeEscolha", <PainelDeEscolha key="pe" ativos={dados.mentorados} escolhidoId="m3" termo="" onTermo={() => undefined} onEscolher={() => undefined} fechar={() => undefined} />],
      ["RegistrarEncontroForm", <RegistrarEncontroForm key="r" aoRegistrar={() => undefined} />],
      ["NovoMentoradoForm", <NovoMentoradoForm key="n" aoCriar={() => undefined} />],
    ];
    // Os que não mostram dado do banco (parcela e novo mentorado) só não podem abrir elemento.
    const semDado = ["ParcelaForm", "NovoMentoradoForm"];
    for (const [rotulo, el] of corpos) {
      const html = render(el, "admin", dados);
      if (semDado.includes(rotulo)) expect(html, rotulo).not.toContain("<img src=x");
      else confere(rotulo, html);
    }
  });

  it("SEC-05: cada link ruim dos fixtures chega à tela como texto e nunca como href", () => {
    const htmls = [
      ...varrer("Ficha cadastro m1", <Ficha id="m1" aba="cadastro" />, "admin"),
      ...varrer("Ficha cadastro m4", <Ficha id="m4" aba="cadastro" />, "admin"),
      ...varrer("Sessões", <Sessoes />, "admin"),
      ...varrer("STLSeller", <Stlseller />, "admin"),
    ].join("\n");
    for (const ruim of RUINS) expect(htmls, ruim).toContain(ruim);
    expect(htmls).not.toMatch(/href="\s*(?:javascript|data):/i);
  });
});
