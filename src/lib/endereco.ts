import { type Papel, pode } from "./papeis";

// O endereço de cada tela, porte do roteador de hash de hoje (index.html:1344–1400). Os nomes
// ficam: o caminho `/sessoes` é o hash `#/sessoes` sem o `#`.

export const TELAS = ["dash", "acompanhamento", "mentorados", "sessoes", "rotas", "mentores", "analise", "nps", "ia", "financeiro"] as const;
export type Tela = (typeof TELAS)[number];

export const ABAS_FICHA = ["cadastro", "financeiro", "sessoes", "notas", "stlseller"] as const;
export type Aba = (typeof ABAS_FICHA)[number];

export type Endereco = { tela: Tela } | { tela: "mentorado"; id: string; aba: Aba };

// Telas e abas que carregam dinheiro ou status de pagamento: fechadas por papel.
const TELAS_FINANCEIRAS: ReadonlySet<string> = new Set(["financeiro", "analise", "nps", "mentores"]);
const ABAS_FINANCEIRAS: ReadonlySet<string> = new Set(["financeiro", "stlseller"]);

const ehTela = (valor: string): valor is Tela => TELAS.some((tela) => tela === valor);

// `completo` e `basico` (os `secao` de hoje) e qualquer outra viram `cadastro`.
const abaDe = (valor: string | undefined): Aba => ABAS_FICHA.find((aba) => aba === valor) ?? "cadastro";

// O `lerEndereco` de hoje: decodifica cada segmento e casa tela ou ficha. Devolve null para
// forma desconhecida e para codificação inválida, que hoje lançaria.
function lerSegmentos(segmentos: readonly string[]): Endereco | null {
  let partes: string[];
  try {
    partes = segmentos.filter(Boolean).map((segmento) => decodeURIComponent(segmento));
  } catch (erro) {
    if (!(erro instanceof URIError)) throw erro;
    return null;
  }
  const [a, b, c] = partes;
  if (a === "mentorado" && b) return { tela: "mentorado", id: b, aba: abaDe(c) };
  if (a !== undefined && ehTela(a)) return { tela: a };
  return null;
}

// NAV-01 e NAV-03: os segmentos do pathname, ainda codificados. `/`, desconhecido ou
// codificação inválida dão o Dashboard.
export function lerCaminho(segmentos: readonly string[]): Endereco {
  return lerSegmentos(segmentos) ?? { tela: "dash" };
}

// NAV-02 e SEC-01: o caminho do link antigo `#/…`, montado só a partir de uma tela de TELAS ou
// de `mentorado/<id>[/<aba>]`. Nada do hash é copiado para o caminho: `#//evil.example` viraria
// um endereço de outra origem (THREAT-01). null quando o hash não casa nenhuma das formas.
export function caminhoDoHash(hash: string): string | null {
  const endereco = lerSegmentos(hash.replace(/^#\/?/, "").split("/"));
  if (!endereco) return null;
  if (endereco.tela !== "mentorado") return `/${endereco.tela}`;
  const ficha = `/mentorado/${encodeURIComponent(endereco.id)}`;
  return endereco.aba === "cadastro" ? ficha : `${ficha}/${endereco.aba}`;
}

// NAV-04: link colado não abre o que o menu esconde.
export function telaPermitida(tela: Endereco["tela"], papel: Papel): boolean {
  if (tela === "ia") return pode(papel, "verIa");
  if (TELAS_FINANCEIRAS.has(tela)) return pode(papel, "verFinanceiro");
  return true;
}

// NAV-05: a aba que a ficha mostra. Quem não vê financeiro fica em `sessoes`, sem reescrever a URL.
export function abaVisivel(aba: string | undefined, papel: Papel): Aba {
  const pedida = abaDe(aba);
  return ABAS_FINANCEIRAS.has(pedida) && !pode(papel, "verFinanceiro") ? "sessoes" : pedida;
}
