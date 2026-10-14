import { normBusca } from "./busca";

// Ordenação de tabela do index.html (:1198–1230). O estado de cada tabela é a ordem que a pessoa
// escolheu, ou null enquanto ela não clicou: aí vale a ordem padrão da tabela, e o cabeçalho não
// mostra direção, como o `sortArrow` de hoje.

export type Direcao = "asc" | "desc";

export interface Ordem {
  campo: string;
  direcao: Direcao;
}

export type ValorDeOrdem = string | number | null | undefined;

// O clique no cabeçalho: a mesma coluna alterna asc e desc; outra coluna começa em asc.
export function alternarOrdem(atual: Ordem | null, campo: string): Ordem {
  if (atual?.campo === campo) return { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" };
  return { campo, direcao: "asc" };
}

// Texto compara sem caixa e sem acento; número, como número; data "AAAA-MM-DD", como texto.
const chave = (valor: string | number) => (typeof valor === "number" ? valor : normBusca(valor));

// Uma cópia da lista na ordem do campo. Valor nulo fica no fim nas duas direções. O desc inverte
// a lista crescente, como o applySort de hoje, então o empate também sai invertido. Campo sem
// getter devolve a lista como veio.
export function aplicarOrdem<T>(
  lista: readonly T[],
  ordem: Ordem,
  getters: Readonly<Partial<Record<string, (item: T) => ValorDeOrdem>>>,
): T[] {
  const getter = getters[ordem.campo];
  if (!getter) return [...lista];
  const comValor: { item: T; chave: string | number }[] = [];
  const semValor: T[] = [];
  for (const item of lista) {
    const valor = getter(item);
    if (valor == null) semValor.push(item);
    else comValor.push({ item, chave: chave(valor) });
  }
  comValor.sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
  if (ordem.direcao === "desc") comValor.reverse();
  return [...comValor.map(({ item }) => item), ...semValor];
}
