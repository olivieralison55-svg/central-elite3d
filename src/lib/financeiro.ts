import type { Cobranca, Parcela } from "./data/esquemas";

// Financeiro do index.html (:885, :893).

// Vencida: não paga, com vencimento antes de hoje. `hoje` vem de quem chama, lido na hora.
export const parcelaVencida = (p: Parcela, hoje: string): boolean => p.status !== "paga" && !!p.vencimento && p.vencimento < hoje;

// Cobrança que chegou da Lia e não achou dono: sem mentorado, não cancelada e não descartada.
// Sem dono ela não aparece em tela nenhuma: dinheiro recebido, invisível. Daí o alerta.
export const cobrancasOrfas = (cobrancas: readonly Cobranca[]): Cobranca[] =>
  cobrancas.filter((c) => !c.mentorado_id && c.status !== "canceled" && !c.ignorada);
