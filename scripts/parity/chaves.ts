import { createHash } from "node:crypto";

// As chaves que os dois lados da paridade usam (design componente 10): estáveis, e sem nome nem
// e-mail de mentorado. O relatório imprime a chave, então o que identifica uma pessoa entra como
// id, ou como hash quando a linha não tem id (a leitura da IA de alguém sem ficha).

// O mentor como a matriz agrupa (index.html:1541): sem acento, espaços colapsados, minúsculas.
export const chaveMentor = (mentor: string | null | undefined): string =>
  (mentor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const chaveDeNome = (nome: string): string => `nome#${createHash("sha256").update(nome).digest("hex").slice(0, 12)}`;

// Dinheiro com 2 casas: o app antigo mostra centavos, e a soma em ponto flutuante não pode virar
// divergência na 15ª casa.
export const centavos = (valor: number | null): number | null => (valor === null ? null : Math.round(valor * 100) / 100);

export const ordenados = (lista: readonly string[]): string[] => [...lista].sort();

// Uma métrica: chave estável → valor JSON.
export type Valores = Record<string, unknown>;
