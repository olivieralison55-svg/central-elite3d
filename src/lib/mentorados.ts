import type { Mentorado } from "./data/esquemas";

// Mentorados do index.html (:811, :937–938).

// A situação: ativo, pausado ou cancelado. Registro sem `situacao` cai no booleano antigo; sem
// registro, "ativo", como hoje (uma parcela de mentorado que não veio na carga conta como ativa).
export const situacaoDe = (m: Pick<Mentorado, "situacao" | "cancelado"> | undefined): string =>
  m?.situacao || (m?.cancelado ? "cancelado" : "ativo");

export const ehAtivo = (m: Pick<Mentorado, "situacao" | "cancelado"> | undefined): boolean => situacaoDe(m) === "ativo";

// O nome do mentorado de uma linha; sem cadastro (ou sem nome), "—".
export const nomeDe = (mentorados: readonly Mentorado[], id: string | null): string => mentorados.find((m) => m.id === id)?.nome || "—";
