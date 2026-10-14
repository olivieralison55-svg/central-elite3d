// Moeda do index.html (:815–834). O campo de dinheiro é digitado à brasileira: "2000" vira
// "R$ 2.000", e ao sair do campo "R$ 2.000,00". Vírgula é o decimal; ponto no fim, ou seguido de
// só 1–2 dígitos (colado de outro lugar, "2000.50"), também vale como decimal: os pontos que a
// própria máscara põe têm sempre 3 dígitos depois. O NumberInput do DS apaga o ponto e leria
// "2000.50" como 200050 (OPS-20).

// numeric chega como número ou como texto (esquemas.ts); sem valor imprime zero, como o
// `(v||0)` de hoje.
export const fmtBRL = (valor: number | string | null | undefined): string =>
  (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// `fim` é o blur: fecha as duas casas decimais. O número que vem do banco (2000.5) também passa
// por aqui para abrir o campo já formatado.
export function mascaraBRL(bruto: number | string | null | undefined, fim = false): string {
  let s = String(bruto || "").replace(/[^\d,.]/g, "");
  if (!s.includes(",")) s = s.replace(/\.(\d{0,2})$/, ",$1");
  const i = s.indexOf(",");
  const inteiro = (i < 0 ? s : s.slice(0, i)).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  let decimais = i < 0 ? null : s.slice(i + 1).replace(/\D/g, "").slice(0, 2);
  if (!inteiro && !decimais) return "";
  if (fim) decimais = (decimais ?? "").padEnd(2, "0");
  const milhares = (inteiro || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${milhares}${decimais === null ? "" : `,${decimais}`}`;
}

// Lê o que a máscara escreveu. Vazio é null, não zero: parcela sem valor.
export function lerBRL(texto: string | null | undefined): number | null {
  const s = mascaraBRL(texto, true);
  return s ? parseFloat(s.slice(3).replace(/\./g, "").replace(",", ".")) : null;
}
