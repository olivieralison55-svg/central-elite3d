import { casaBusca } from "./busca";
import type { Dataset, Mentorado, StlMentorado, StlProduto } from "./data/esquemas";
import { normalizaEmail } from "./mentorados";
import { aplicarOrdem, type Ordem, type ValorDeOrdem } from "./ordem";

// STLSeller do index.html (:3110–3123). Muita gente usa um endereço na mentoria e outro na loja: o
// e-mail da ficha casa primeiro com o e-mail do formulário e, se nenhum casar, com o da conta
// STLFLIX. Sem e-mail na ficha não há com o que casar.
export function stlsellerDe(registros: readonly StlMentorado[], email: string | null | undefined): StlMentorado | null {
  const alvo = normalizaEmail(email);
  if (!alvo) return null;
  return registros.find((r) => r.email === alvo) ?? registros.find((r) => normalizaEmail(r.email_stlflix) === alvo) ?? null;
}

// A tela STLSeller (renderAnalise, index.html:2554–2876). "Bruto" vem dos pedidos (já sem
// cancelados); "receita por anúncio" vem dos produtos. A cobertura é uma sobre a outra: abaixo de
// 100% é venda que não foi atribuída a anúncio nenhum.

export const MKT_ROTULO: ReadonlyMap<string, string> = new Map([
  ["mercadolivre", "Mercado Livre"],
  ["shopee", "Shopee"],
]);
export const rotuloMarketplace = (marketplace: string): string => MKT_ROTULO.get(marketplace) ?? marketplace;

// O recorte pelo status do formulário; "" é "Todos". O padrão é "Ativos".
export const ANALISE_STATUS: readonly (readonly [string, string])[] = [
  ["ATIVO", "Ativos"],
  ["PAUSADO", "Pausados"],
  ["CANCELADO", "Cancelados"],
  ["", "Todos"],
];
export const STATUS_PADRAO = "ATIVO";

export type ChipAnalise = "todos" | "vende" | "parado" | "plano" | "fora" | "email";
export const ANALISE_FILTROS: readonly (readonly [ChipAnalise, string])[] = [
  ["todos", "Todos"],
  ["vende", "Vendendo"],
  ["parado", "Sem venda"],
  ["plano", "Plano ativo"],
  ["fora", "Anúncio fora do catálogo"],
  ["email", "E-mail incorreto"],
];

export type SituacaoEmail = { ok: true; resolvidoPorStlflix?: true } | { ok: false; motivo: string };

// O e-mail do mentorado. Quando o formulário traz o e-mail STLFLIX, é ele que se tenta primeiro
// (o n8n também prefere a loja achada por ele). Só conta como resolvido se o e-mail STLFLIX de
// fato encontra a conta de seller; o resto fica marcado como não cadastrado corretamente.
export function situacaoEmail(r: StlMentorado): SituacaoEmail {
  const stl = normalizaEmail(r.email_stlflix);
  const loja = normalizaEmail(r.loja_email);
  if (stl && stl === r.email) return { ok: true };
  if (stl && loja === stl) return { ok: true, resolvidoPorStlflix: true };
  if (!stl) return { ok: false, motivo: "Formulário sem e-mail STLFLIX" };
  return { ok: false, motivo: loja ? "E-mail STLFLIX não é o da loja" : "E-mail STLFLIX não encontra conta de seller" };
}

// Por qual e-mail a loja foi achada. Quase sempre é o do formulário, e repetir o endereço na
// tabela só duplicaria a coluna ao lado. Sem loja, null.
export function lojaPor(r: StlMentorado): string | null {
  if (!r.loja_id) return null;
  const loja = normalizaEmail(r.loja_email);
  if (loja === r.email) return "e-mail do formulário";
  if (loja && loja === normalizaEmail(r.email_stlflix)) return "e-mail STLFLIX";
  return r.loja_email || "—";
}

export type Situacao = "sem-conta" | "vende" | "parado";

// Uma linha por mentorado do STLSeller, já com os números somados.
export interface LinhaAnalise {
  r: StlMentorado;
  ficha: Mentorado | null;
  situacao: Situacao;
  pedidos: number;
  cancelados: number;
  bruto: number;
  receita: number;
  ultimo: string | null;
  pctCancel: number | null;
  cobertura: number | null;
  anuncios: number;
  fora: number;
  canais: string[];
  email: SituacaoEmail;
  prod: StlProduto[];
}

type Numero = number | string | null | undefined;
const soma = <T>(itens: readonly T[], campo: (item: T) => Numero): number => itens.reduce((acc, item) => acc + (Number(campo(item)) || 0), 0);

function agruparPorEmail<T extends { email: string }>(itens: readonly T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) grupos.set(item.email, [...(grupos.get(item.email) ?? []), item]);
  return grupos;
}

export function linhasAnalise(dados: Pick<Dataset, "stlseller" | "stlPedidos" | "stlProdutos" | "mentorados">): LinhaAnalise[] {
  const pedPor = agruparPorEmail(dados.stlPedidos);
  const prodPor = agruparPorEmail(dados.stlProdutos);
  return dados.stlseller.map((r) => {
    const ped = pedPor.get(r.email) ?? [];
    const prod = prodPor.get(r.email) ?? [];
    const pedidos = soma(ped, (o) => o.pedidos);
    const cancelados = soma(ped, (o) => o.pedidos_cancelados);
    const bruto = soma(ped, (o) => o.total_bruto);
    const receita = soma(prod, (p) => p.faturamento);
    const ultimo = ped.flatMap((o) => (o.ultimo_pedido_em ? [o.ultimo_pedido_em] : [])).sort().pop() ?? null;
    const situacao: Situacao = !r.loja_id ? "sem-conta" : pedidos > 0 || prod.length > 0 ? "vende" : "parado";
    const ficha =
      dados.mentorados.find((m) => {
        const e = normalizaEmail(m.email);
        return e !== null && (e === r.email || e === normalizaEmail(r.email_stlflix));
      }) ?? null;
    return {
      r,
      ficha,
      situacao,
      pedidos,
      cancelados,
      bruto,
      receita,
      ultimo,
      pctCancel: pedidos ? cancelados / pedidos : null,
      cobertura: bruto ? receita / bruto : null,
      anuncios: prod.length,
      fora: prod.filter((p) => p.cadastrado_no_stlseller === false).length,
      canais: [...new Set(ped.map((o) => o.marketplace))].sort(),
      email: situacaoEmail(r),
      prod,
    };
  });
}

// "—" sem valor; senão a fração em porcentagem com até 1 casa, como o `pct` de hoje.
export const pct = (v: number | null): string => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export const nomeAnalise = (l: LinhaAnalise): string => l.ficha?.nome ?? (l.r.nome || l.r.email);

// O momento da última sincronização, o maior `synced_at`.
export const ultimaSync = (registros: readonly StlMentorado[]): string | null => registros.map((r) => r.synced_at).filter(Boolean).sort().pop() ?? null;

// O recorte pelo status do formulário: "" é "Todos".
export const recorteAnalise = (linhas: readonly LinhaAnalise[], status: string): LinhaAnalise[] =>
  linhas.filter((l) => !status || l.r.status_formulario === status);

export interface AgregadosAnalise {
  vendendo: number;
  bruto: number;
  receita: number;
  pedidos: number;
  cancelados: number;
  comPlano: number;
  semConta: number;
}

export function agregadosAnalise(base: readonly LinhaAnalise[]): AgregadosAnalise {
  return {
    vendendo: base.filter((l) => l.situacao === "vende").length,
    bruto: base.reduce((a, l) => a + l.bruto, 0),
    receita: base.reduce((a, l) => a + l.receita, 0),
    pedidos: base.reduce((a, l) => a + l.pedidos, 0),
    cancelados: base.reduce((a, l) => a + l.cancelados, 0),
    comPlano: base.filter((l) => l.r.plano_ativo === true).length,
    semConta: base.filter((l) => l.situacao === "sem-conta").length,
  };
}

export interface Fatia {
  nome: string;
  valor: number;
}

// A concentração: os 5 maiores do bruto e o resto, para mostrar de quem o bruto depende.
export function concentracaoAnalise(base: readonly LinhaAnalise[]): Fatia[] {
  const porBruto = base.filter((l) => l.situacao === "vende").sort((a, b) => b.bruto - a.bruto);
  const fatias = porBruto.slice(0, 5).map((l) => ({ nome: nomeAnalise(l), valor: l.bruto }));
  const resto = porBruto.slice(5).reduce((a, l) => a + l.bruto, 0);
  return resto > 0 ? [...fatias, { nome: `outros ${porBruto.length - 5}`, valor: resto }] : fatias;
}

const passaChip = (l: LinhaAnalise, chip: ChipAnalise): boolean => {
  if (chip === "vende") return l.situacao === "vende";
  if (chip === "parado") return l.situacao !== "vende";
  if (chip === "plano") return l.r.plano_ativo === true;
  if (chip === "fora") return l.fora > 0;
  if (chip === "email") return !l.email.ok;
  return true;
};

const ORDENS: Readonly<Record<string, (l: LinhaAnalise) => ValorDeOrdem>> = {
  nome: (l) => nomeAnalise(l).toLowerCase(),
  status: (l) => l.r.status_real || "",
  plano: (l) => (l.r.plano_ativo ? 1 : 0),
  pedidos: (l) => l.pedidos,
  cancel: (l) => l.pctCancel ?? -1,
  bruto: (l) => l.bruto,
  receita: (l) => l.receita,
  cobertura: (l) => l.cobertura ?? -1,
  anuncios: (l) => l.anuncios,
  fora: (l) => l.fora,
  ultimo: (l) => l.ultimo || "",
};
export const ORDEM_ANALISE: Ordem = { campo: "bruto", direcao: "desc" };

// A tabela "Visão geral": o chip, depois a busca (nome, e-mail, e-mail STLFLIX, loja) e a ordem.
// `antesDaBusca` é a base do selo da busca.
export function listaAnalise(base: readonly LinhaAnalise[], chip: ChipAnalise, busca: string, ordem: Ordem | null): { lista: LinhaAnalise[]; antesDaBusca: number } {
  const doChip = base.filter((l) => passaChip(l, chip));
  const achadas = doChip.filter((l) => casaBusca(busca, nomeAnalise(l), l.r.email, l.r.email_stlflix, l.r.loja_nome));
  return { lista: aplicarOrdem(achadas, ordem ?? ORDEM_ANALISE, ORDENS), antesDaBusca: doChip.length };
}

// Os 15 anúncios que mais faturam, com o mentorado dono.
export function topAnuncios(base: readonly LinhaAnalise[]): { p: StlProduto; l: LinhaAnalise }[] {
  return base
    .flatMap((l) => l.prod.map((p) => ({ p, l })))
    .sort((a, b) => (Number(b.p.faturamento) || 0) - (Number(a.p.faturamento) || 0))
    .slice(0, 15);
}

// Quantos mentorados há em cada status real, o maior grupo primeiro.
export function contagemStatusReal(base: readonly LinhaAnalise[]): [string, number][] {
  const contagem = new Map<string, number>();
  for (const l of base) contagem.set(l.r.status_real || "—", (contagem.get(l.r.status_real || "—") ?? 0) + 1);
  return [...contagem].sort((a, b) => b[1] - a[1]);
}

// Os grupos das listas finais: com conta de seller e nenhum pedido; sem conta; e o diagnóstico de e-mail.
export function gruposAnalise(base: readonly LinhaAnalise[]) {
  return {
    semVenda: base.filter((l) => l.situacao === "parado"),
    semConta: base.filter((l) => l.situacao === "sem-conta"),
    emailIncorreto: base.filter((l) => !l.email.ok),
    peloStlflix: base.filter((l) => l.email.ok && l.email.resolvidoPorStlflix),
  };
}
