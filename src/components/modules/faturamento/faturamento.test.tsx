import { describe, expect, it, vi } from "vitest";

import type { Dataset, FaixaRemuneracao, Sessao, Validacao } from "@/lib/data/esquemas";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Conferencia from "./conferencia";
import EnvioMentor from "./envio-mentor";
import Faturamento from "./faturamento";

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
// Sem rede no teste: os links assinados nunca chegam.
vi.mock("@/lib/data/leituras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/leituras")>()),
  linksRelatorios: () => new Promise(() => {}),
}));

const FAIXAS: FaixaRemuneracao[] = [
  { id: 1, piso: "10000.00", teto: "20000.00", valor_hora: "75.00" },
  { id: 2, piso: "20000.01", teto: "50000.00", valor_hora: "100.00" },
  { id: 3, piso: "50000.01", teto: null, valor_hora: "200.00" },
];

const BASE_V: Validacao = {
  id: "v1",
  mentor: "Luan",
  competencia: "2026-10-01",
  estado: "em_conferencia",
  enviado_em: "2026-11-03T12:00:00Z",
  alteracao_lojas: false,
  alteracao_lojas_obs: null,
  obs_mentor: null,
  checklist: {},
  motivo_ajuste: null,
  meet_motivo: null,
  meet_em: null,
  obs_admin: null,
  faturamento_elegivel: null,
  faixa_do_mes: null,
  faixa_vigente: 2,
  faixa_seguinte: null,
  mudanca: null,
  comunicado_em: null,
  sessoes_ids: null,
  sessoes_qtd: null,
  valor_hora: null,
  valor_pagar: null,
  validado_em: null,
  pago_em: null,
};

function dados(v: Partial<Validacao> = {}): Dataset {
  const d = datasetDeTeste();
  const sessao = d.sessoes[0];
  const outubro: Sessao[] = [
    { ...sessao, id: "o1", mentor: "Luan", status: "Concluída", data: "2026-10-05", hora: "10:00:00" },
    { ...sessao, id: "o2", mentorado_id: "m2", mentor: "Luan", status: "Concluída", data: "2026-10-12", hora: "10:00:00" },
    { ...sessao, id: "o3", mentorado_id: "m4", mentor: "Luan", status: "Não compareceu", data: "2026-10-19", hora: "10:00:00" },
  ];
  return {
    ...d,
    sessoes: [...d.sessoes, ...outubro],
    faixas: FAIXAS,
    validacoes: [{ ...BASE_V, ...v }],
    validacaoLojas: [
      {
        id: "vl1",
        validacao_id: "v1",
        loja_id: null,
        marketplace: "Shopee",
        loja_nome: "Loja <b>1</b>",
        periodo_inicio: "2026-10-01",
        periodo_fim: "2026-10-31",
        vendas: "26810.00",
        pedidos: 120,
        cancelamentos: "500.00",
        devolucoes: "0.00",
        reembolsos: "0.00",
        elegivel: "26310.00",
        arquivo_path: "Luan/2026-10/x-relatorio.pdf",
      },
    ],
  };
}

describe("validação de faturamento", () => {
  it("admin: lojas, resumo com 2 sessões pagas (a falta fica fora) e as ações da conferência", () => {
    const html = renderTela(<Conferencia mentor="Luan" competencia="2026-10" />, { papel: "admin", dados: dados() });
    expect(html).toContain("Shopee · Loja &lt;b&gt;1&lt;/b&gt;");
    expect(html).toMatch(/R\$\s26\.310,00/);
    expect(html).toMatch(/2 × R\$\s100,00 = R\$\s200,00/);
    expect(html).toContain("Faltas do mentorado");
    expect(html).toContain('data-escrita="W28"');
    expect(html).toContain("item(ns) do checklist sem marcar");
  });

  it("diretoria: vê o mês e nenhuma ação", () => {
    const html = renderTela(<Conferencia mentor="Luan" competencia="2026-10" />, { papel: "diretoria", dados: dados() });
    expect(html).toContain("Resumo do mês");
    expect(html).not.toContain("data-escrita");
  });

  it("mês validado mostra o fechamento gravado, não a conta de agora", () => {
    const html = renderTela(<Conferencia mentor="Luan" competencia="2026-10" />, {
      papel: "admin",
      dados: dados({ estado: "validado", faturamento_elegivel: "26310", sessoes_qtd: 5, valor_hora: "100", valor_pagar: "500", validado_em: "2026-11-06T13:00:00Z" }),
    });
    expect(html).toMatch(/5 × R\$\s100,00 = R\$\s500,00/);
    expect(html).toContain("Marcar como pago");
  });

  it("mentor: o envio fica travado enquanto o mês está com a operação", () => {
    const html = renderTela(<EnvioMentor mentor="Luan" competencia="2026-10" />, { papel: "mentor", dados: dados() });
    expect(html).toContain("Este mês está com a operação");
    expect(html).not.toContain("Enviar para conferência");
  });

  it("mentor: com ajuste pedido, o motivo aparece e o envio volta a abrir", () => {
    const html = renderTela(<EnvioMentor mentor="Luan" competencia="2026-10" />, { papel: "mentor", dados: dados({ estado: "ajuste_pedido", motivo_ajuste: "Falta o relatório do ML" }) });
    expect(html).toContain("Falta o relatório do ML");
    expect(html).toContain("Enviar para conferência");
  });

  it("admin lançando pelo mentor: edita o mês já com a operação, sem reenviar", () => {
    const html = renderTela(<EnvioMentor mentor="Luan" competencia="2026-10" pelaOperacao />, { papel: "admin", dados: dados() });
    expect(html).toContain("Lançando pelo mentor Luan");
    expect(html).toContain("Salvar alterações");
    expect(html).not.toContain("Enviar para conferência");
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
  });

  it("admin lançando pelo mentor que não enviou: pode salvar e enviar", () => {
    const d = { ...dados(), validacoes: [], validacaoLojas: [] };
    const html = renderTela(<EnvioMentor mentor="Luan" competencia="2026-10" pelaOperacao />, { papel: "admin", dados: d });
    expect(html).toContain("Salvar rascunho");
    expect(html).toContain("Enviar para conferência");
  });

  it("admin lançando pelo mentor: mês validado fica travado", () => {
    const html = renderTela(<EnvioMentor mentor="Luan" competencia="2026-10" pelaOperacao />, { papel: "admin", dados: dados({ estado: "validado" }) });
    expect(html).toContain("Mês fechado");
    expect(html).not.toContain('data-escrita="W24"');
  });

  it("admin vê a troca entre conferir e lançar dados", () => {
    const html = renderTela(<Faturamento />, { papel: "admin", dados: dados() });
    expect(html).toContain("Lançar dados");
  });

  it("mentor sem login ligado a um nome de mentor vê o aviso", () => {
    const html = renderTela(<Faturamento />, { papel: "mentor", dados: dados() });
    expect(html).toContain("Seu login ainda não está ligado a um mentor");
  });
});
