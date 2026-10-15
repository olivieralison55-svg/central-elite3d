import { casaBusca } from "./busca";
import type { Cobranca, Dataset, Mentorado, Parcela } from "./data/esquemas";
import { ehAtivo, nomeDe } from "./mentorados";
import { aplicarOrdem, type Ordem } from "./ordem";

// Financeiro do index.html (:885–934, :2105–2200; mapeamento §3.6).

// Vencida: não paga, com vencimento antes de hoje. `hoje` vem de quem chama, lido na hora.
export const parcelaVencida = (p: Parcela, hoje: string): boolean => p.status !== "paga" && !!p.vencimento && p.vencimento < hoje;

// Cobrança que chegou da Lia e não achou dono: sem mentorado, não cancelada e não descartada.
// Sem dono ela não aparece em tela nenhuma: dinheiro recebido, invisível. Daí o alerta.
export const cobrancasOrfas = (cobrancas: readonly Cobranca[]): Cobranca[] =>
  cobrancas.filter((c) => !c.mentorado_id && c.status !== "canceled" && !c.ignorada);

// Compra de teste na Lia chega igual a venda real. Descartada, a cobrança sai do alerta e do
// financeiro, mas continua guardada, e o descarte volta com um clique.
export const cobrancasDescartadas = (cobrancas: readonly Cobranca[]): Cobranca[] => cobrancas.filter((c) => !!c.ignorada);

// Os cadastros com o e-mail da cobrança, comparado em minúsculas e sem trim, como hoje
// (mapeamento §10, item 32).
function cadastrosDoEmail(c: Pick<Cobranca, "contact_email">, mentorados: readonly Mentorado[]): Mentorado[] {
  const email = c.contact_email?.toLowerCase();
  return email ? mentorados.filter((m) => (m.email ?? "").toLowerCase() === email) : [];
}

// FIN-03: por que a cobrança não casou, derivado na hora: o motivo muda quando o cadastro muda, e um
// motivo gravado envelheceria sozinho.
export function motivoOrfa(c: Pick<Cobranca, "contact_email">, mentorados: readonly Mentorado[]): string {
  if (!c.contact_email) return "a cobrança veio sem e-mail";
  const quantos = cadastrosDoEmail(c, mentorados).length;
  if (quantos > 1) return "esse e-mail está em mais de um cadastro";
  if (quantos === 1) return "o cadastro existe — clique em vincular";
  return "nenhum cadastro com esse e-mail";
}

// FIN-02: o mentorado a quem vincular, só quando existe exatamente um com aquele e-mail. Com zero
// não há a quem; com dois, escolher seria adivinhar.
export function podeVincular(c: Pick<Cobranca, "contact_email">, mentorados: readonly Mentorado[]): Mentorado | null {
  const alvos = cadastrosDoEmail(c, mentorados);
  return alvos.length === 1 ? alvos[0] : null;
}

// FIN-05: parcela que veio da Lia. Ela manda, e a tela não deixa editar à mão: a alteração feita
// aqui sumiria no próximo webhook, calada.
export const parcelaDaLia = (p: Pick<Parcela, "lia_bill_id">): boolean => !!p.lia_bill_id;

// FIN-05: com qualquer parcela do mentorado vinda da Lia, a ficha não oferece "Adicionar parcela".
export const aceitaParcelaManual = (parcelas: readonly Parcela[]): boolean => !parcelas.some(parcelaDaLia);

const POR_VENCIMENTO: Ordem = { campo: "vencimento", direcao: "asc" };
const VENCIMENTO = { vencimento: (p: Parcela) => p.vencimento };

// A próxima em aberto, por vencimento: a pergunta que se faz olhando a ficha.
export function proximaParcela(parcelas: readonly Parcela[]): Parcela | null {
  return aplicarOrdem(
    parcelas.filter((p) => p.status !== "paga" && p.vencimento),
    POR_VENCIMENTO,
    VENCIMENTO,
  )[0] ?? null;
}

// A linha de um mentorado ativo na tela Financeiro.
export interface LinhaFinanceira {
  mentorado: Mentorado;
  parcelas: Parcela[];
  pagas: number;
  vencidas: Parcela[];
}

export interface PainelFinanceiro {
  // FIN-01: os cards somam a operação inteira. Cobrança vencida que sumisse do card ao digitar um
  // nome viraria uma cobrança esquecida.
  cards: { vencidas: number; restanteAberto: number; restanteParcial: number; assinados: number; ativos: number };
  linhas: LinhaFinanceira[]; // situação por mentorado ativo, recortada pela busca
  totalLinhas: number; // antes da busca, para o "N de M"
  vencidas: LinhaFinanceira[]; // quem tem parcela vencida, recortado pela busca
  proximos: Parcela[]; // os 10 próximos vencimentos, recortados pela busca
  // FIN-01: órfãs e descartadas não têm mentorado para casar com a busca. Esconder uma delas por
  // causa de um texto digitado seria esconder dinheiro.
  orfas: Cobranca[];
  descartadas: Cobranca[];
}

const PROXIMOS = 10;

// O que a tela Financeiro mostra (renderFinanceiro, :2105–2200). A busca recorta só as tabelas de
// mentorado. Os próximos são os 10 de vencimento mais perto, em aberto, a partir de hoje.
export function painelFinanceiro(dados: Pick<Dataset, "mentorados" | "parcelas" | "cobrancas">, busca: string, hoje: string): PainelFinanceiro {
  const ativos = dados.mentorados.filter(ehAtivo);
  const todas = ativos.map((m) => {
    const parcelas = dados.parcelas.filter((p) => p.mentorado_id === m.id);
    return { mentorado: m, parcelas, pagas: parcelas.filter((p) => p.status === "paga").length, vencidas: parcelas.filter((p) => parcelaVencida(p, hoje)) };
  });
  const casa = (l: LinhaFinanceira) => casaBusca(busca, l.mentorado.nome);
  const futuras = dados.parcelas.filter(
    (p) =>
      p.status !== "paga" &&
      !!p.vencimento &&
      p.vencimento >= hoje &&
      ehAtivo(dados.mentorados.find((m) => m.id === p.mentorado_id)) &&
      casaBusca(busca, nomeDe(dados.mentorados, p.mentorado_id)),
  );
  return {
    cards: {
      vencidas: todas.reduce((n, l) => n + l.vencidas.length, 0),
      restanteAberto: ativos.filter((m) => m.restante_status === "Ainda não").length,
      restanteParcial: ativos.filter((m) => m.restante_status === "Pago parcial").length,
      assinados: ativos.filter((m) => m.contrato_status === "Assinado").length,
      ativos: ativos.length,
    },
    linhas: todas.filter(casa),
    totalLinhas: todas.length,
    vencidas: todas.filter((l) => l.vencidas.length > 0 && casa(l)),
    proximos: aplicarOrdem(futuras, POR_VENCIMENTO, VENCIMENTO).slice(0, PROXIMOS),
    orfas: cobrancasOrfas(dados.cobrancas),
    descartadas: cobrancasDescartadas(dados.cobrancas),
  };
}
