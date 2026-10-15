// O nome do mentorado no banco carrega, às vezes, um emoji de situação na frente ("🟢 Guilherme",
// "⚠️Sávio"). A regra separa esse emoji do nome: as telas desenham um ícone no lugar (NomeMentorado)
// e a busca e a ordenação olham só o nome.

export type Marcador = "ok" | "atencao" | "risco" | "alerta" | "concluido";

// Os emojis que a equipe usa, sem o seletor de variação (U+FE0F).
export const MARCADORES: ReadonlyMap<string, Marcador> = new Map([
  ["🟢", "ok"],
  ["🟡", "atencao"],
  ["🟠", "atencao"],
  ["🔴", "risco"],
  ["⚠", "alerta"],
  ["✅", "concluido"],
]);

// Um emoji (com variação, tom de pele ou ZWJ) no começo, mais o espaço que vem depois dele.
const EMOJI_INICIAL = /^\s*(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*)\s*/u;

export function separarMarcador(nome: string | null | undefined): { marcador: Marcador | null; nome: string } {
  const texto = nome ?? "";
  const achou = EMOJI_INICIAL.exec(texto);
  if (!achou) return { marcador: null, nome: texto };
  return { marcador: MARCADORES.get(achou[1].replaceAll("️", "")) ?? null, nome: texto.slice(achou[0].length) };
}

// O nome sem o emoji: para busca, ordenação, aria-label e título.
export const semMarcador = (nome: string | null | undefined): string => separarMarcador(nome).nome;
