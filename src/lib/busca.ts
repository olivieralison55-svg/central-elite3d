// Busca do index.html (:823–829, :1234–1245, :3703). Toda tela que lista mentorado tem a mesma
// caixa, com o mesmo comportamento: sem acento, sem caixa e por partes. "ana silva" acha "Ana
// Paula da Silva", e "jose" acha "José".

type Campo = string | number | null | undefined;

export const normBusca = (valor: Campo): string =>
  (valor == null ? "" : String(valor)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Cada parte do termo precisa aparecer em algum dos campos. Termo vazio não filtra.
export function casaBusca(termo: Campo, ...campos: Campo[]): boolean {
  const t = normBusca(termo).trim();
  if (!t) return true;
  const alvo = campos.map(normBusca).join(" ");
  return t.split(/\s+/).every((parte) => alvo.includes(parte));
}

// As formas em que uma data é digitada na busca: a tela mostra 17/09, mas também se digita
// 17/09/2026, 09/2026 para o mês inteiro e, vindo de outro sistema, 2026-09-17. A hora entra
// junto porque a coluna a exibe. Sem data, nada: a linha não casa com busca de data nenhuma.
export function alvoBuscaData(data: string | null | undefined, hora?: string | null): string {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return `${data} ${dia}/${mes}/${ano} ${dia}/${mes} ${mes}/${ano}${hora ? ` ${hora.slice(0, 5)}` : ""}`;
}

// O nome digitado para confirmar a exclusão: sem caixa, sem acento e sem espaço sobrando. A
// confirmação prova intenção, não cobra ortografia.
export const chaveNome = (valor: string | null | undefined): string => normBusca(valor).replace(/\s+/g, " ").trim();
