import { type Dataset, ESQUEMAS } from "@/lib/data/esquemas";
import { datasetDeTeste } from "@/test/fixtures";

// Os fixtures do harness antigo (tests/ambiente.mjs:193–340, portados em src/test/fixtures.ts) no
// formato do snapshot do G0.2: `relacoes` por nome de relação, R01–R22, como o snapshot.mjs grava.
// Vêm de src/test/fixtures.ts, e não do tests/ambiente.mjs, porque o tests/ sai na T83 e os testes
// da paridade continuam depois dela.

export type Relacoes = Record<string, Record<string, unknown>[]>;

const BASICAS = Object.keys(ESQUEMAS.mentorados_basic.shape);

export function relacoesDe(d: Dataset): Relacoes {
  const recorte = d.analise ? [{ gerado_em: d.analise.gerado_em, modelo: d.analise.modelo, respostas: d.analise.respostas, alertas: d.analise.alertas, mentorados: d.analise.mentorados }] : [];
  return {
    mentorados: d.mentorados,
    mentorados_basic: d.mentorados.map((m) => Object.fromEntries(BASICAS.map((c) => [c, (m as Record<string, unknown>)[c] ?? null]))),
    parcelas: d.parcelas,
    lia_cobrancas: d.cobrancas,
    sessoes: d.sessoes,
    rotas: d.rotas,
    marcos_definicao: d.marcos,
    mentorado_marcos: d.mentoradoMarcos,
    faturamento_mensal: d.faturamento,
    canais: d.canais,
    mentorado_canais: d.mentoradoCanais,
    sessoes_orfas: d.orfas,
    stlseller_mentorados: d.stlseller,
    stlseller_pedidos_marketplace: d.stlPedidos,
    stlseller_produtos_vendidos: d.stlProdutos,
    nps_respostas: d.nps,
    experiencia_respostas: d.experiencia,
    nps_analises: d.analise ? [d.analise] : [],
    experiencia_adesao: d.adesao ? [d.adesao] : [],
    analise_ia_mentor: recorte,
    transcricoes: d.transcricoes,
    mentores_ativos: d.mentores.map((nome) => ({ nome })),
  };
}

export const relacoesDeTeste = (): Relacoes => relacoesDe(datasetDeTeste());
