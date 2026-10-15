import { casaBusca } from "./busca";
import { INICIO_COBRANCA_NPS, META_ADESAO_EXP, NIVEIS, PRAZO_RESPOSTA_DIAS } from "./constantes";
import type { Dataset, Faturamento, MarcoDef, Mentorado, Rota, Sessao, SessaoOrfa } from "./data/esquemas";
import { diaSP } from "./datas";
import { cobrancasOrfas, parcelaVencida } from "./financeiro";
import { ehAtivo, nomeDe, situacaoDe } from "./mentorados";
import { type Papel, pode } from "./papeis";
import { agruparGrupo, eh1a1, type Encontro, ehGrupo, implementacaoDe, plantoesDe, sessoes1a1De } from "./sessoes";

// O Dashboard e o Acompanhamento do index.html (renderDash, :1474–1800), menos a matriz
// (src/lib/matriz.ts): o painel "Precisa de atenção", os números gerais, a progressão por
// faturamento, as próximas 8 sessões e as listas que os itens do painel apontam. Os contadores
// são o total da operação e ignoram a busca; só as listas de mentorado recortam (OPS-01, OPS-10).

const DIA_MS = 86_400_000;
const diasDesde = (hoje: string, ref: string) => (Date.parse(hoje) - Date.parse(ref)) / DIA_MS;

// Gamificação: a faixa vem do faturamento acumulado real. A barra trunca e para em 99%: cheia
// só quando o nível realmente sobe.
export interface Nivel {
  atual: { nome: string; min: number };
  proximo: { nome: string; min: number } | null;
  pct: number;
  total: number;
}

export function nivelDe(total: number): Nivel {
  const i = NIVEIS.findIndex((n) => total >= n.min);
  const indice = i < 0 ? NIVEIS.length - 1 : i;
  const atual = NIVEIS[indice];
  const proximo = indice > 0 ? NIVEIS[indice - 1] : null;
  const pct = proximo ? Math.min(99, Math.floor(((total - atual.min) / (proximo.min - atual.min)) * 100)) : 100;
  return { atual, proximo, pct, total };
}

export const faturamentoAcumulado = (faturamento: readonly Faturamento[], mentoradoId: string): number =>
  faturamento.filter((f) => f.mentorado_id === mentoradoId).reduce((soma, f) => soma + (Number(f.valor) || 0), 0);

export type ChaveAtencao =
  | "contratos"
  | "vencidas"
  | "incompletos"
  | "semSessao"
  | "semSubida"
  | "semImplementacao"
  | "aguardando"
  | "orfas"
  | "cobrancas"
  | "npsSessao"
  | "npsExperiencia";

// Para onde o "ver" do item leva: outra tela (Mentorados já filtrada, no caso dos criados pela
// Lia) ou a lista do próprio Dashboard.
export type LinkAtencao = { caminho: string; statusFin?: string } | { ancora: string } | null;

export interface ItemAtencao {
  chave: ChaveAtencao;
  rotulo: string;
  contagem: number;
  link: LinkAtencao;
}

export interface Lista<T> {
  total: number; // o total da operação, sem a busca
  itens: T[]; // o que a busca deixou
}

export interface Risco {
  mentorado: Mentorado;
  ultima: string | null; // a última 1:1 concluída; null = nunca começou
}

export interface Subida {
  mentorado: Mentorado;
  ref: string; // a data da última subida, ou o fechamento de quem nunca subiu
  dias: number;
  subiu: boolean;
  marco: MarcoDef | null;
  rota: Rota | null;
}

export interface Proxima {
  chave: string;
  data: string;
  hora: string | null;
  etapa: string | null;
  mentor: string | null;
  quem: string;
  mentoradoId: string | null; // a 1:1 leva à ficha
  encontro: Encontro | null; // o encontro em grupo, agregado
}

export interface Painel {
  atencao: ItemAtencao[];
  adesao: { respostas: number; total: number; pct: number } | null;
  ativos: number;
  ativosNaBusca: number;
  numeros: {
    ativos: number;
    pausados: number;
    cancelados: number;
    concluidas1a1: number; // por linha, como hoje (a matriz conta reunião)
    agendadas1a1: number;
    encontros: number;
    presencas: number;
    encontrosAgendados: number;
  };
  progressao: { mentorado: Mentorado; nivel: Nivel }[];
  proximas: Proxima[];
  listas: {
    orfas: Lista<SessaoOrfa>;
    risco: Lista<Risco>;
    semImplementacao: Lista<{ mentorado: Mentorado; plantoes: number }>;
    semSubida: Lista<Subida>;
    npsPend: Lista<{ mentorado: Mentorado; sessao: Sessao }>;
  };
}

// Quem tem 1:1 agendada, de qualquer data, não está parado. Para os outros a régua é a última
// 1:1 concluída; quem nunca concluiu nenhuma é medido pelo fechamento (OPS-05).
function semSessao30(dados: Dataset, ativos: Mentorado[], hoje: string): Risco[] {
  return ativos.flatMap((mentorado) => {
    const sessoes = sessoes1a1De(dados.sessoes, mentorado.id);
    if (sessoes.some((s) => s.status === "Agendada")) return [];
    const ultima = sessoes.flatMap((s) => (s.status === "Concluída" && s.data ? [s.data] : [])).sort().pop() ?? null;
    const ref = ultima ?? mentorado.data_fechamento;
    return ref && diasDesde(hoje, ref) > 30 ? [{ mentorado, ultima }] : [];
  });
}

// Sem subir de marco: todo ativo com contrato assinado, retroativo. Subida é marco CONCLUIDO (rota
// rica) ou "passou" (rota simples), na data do marco ou no `updated_at`. Quem nunca subiu conta do
// fechamento.
function semSubida30(dados: Dataset, ativos: Mentorado[], hoje: string): Subida[] {
  return ativos
    .filter((m) => m.contrato_status === "Assinado")
    .flatMap((mentorado) => {
      const subida =
        dados.mentoradoMarcos
          .filter((x) => x.mentorado_id === mentorado.id && (x.status === "CONCLUIDO" || x.status === "passou"))
          .map((x) => ({ x, quando: (x.data || x.updated_at || "").slice(0, 10) }))
          .filter((o) => o.quando)
          .sort((a, b) => (a.quando < b.quando ? -1 : 1))
          .pop() ?? null;
      const ref = subida?.quando ?? mentorado.data_fechamento;
      if (!ref) return [];
      const dias = Math.floor(diasDesde(hoje, ref));
      if (dias <= 30) return [];
      const marco = (subida && dados.marcos.find((d) => d.id === subida.x.marco_id)) || null;
      const rota = (marco && dados.rotas.find((r) => r.id === marco.rota_id)) || null;
      return [{ mentorado, ref, dias, subiu: subida !== null, marco, rota }];
    })
    .sort((a, b) => b.dias - a.dias);
}

// As pesquisas desde INICIO_COBRANCA_NPS, de sessão realizada há PRAZO_RESPOSTA_DIAS ou mais. A da
// sessão está pendente sem resposta vinculada à ficha do dia da sessão em diante; a de Experiência
// é anônima: só o totalizador, nunca o nome de quem falta.
function pesquisas(dados: Dataset, ativos: Mentorado[], hoje: string) {
  const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) - PRAZO_RESPOSTA_DIAS * DIA_MS).toISOString().slice(0, 10);
  const noPeriodo = (s: Sessao) => s.status === "Concluída" && !!s.data && s.data >= INICIO_COBRANCA_NPS && s.data <= limite;
  const pendentes = ativos.flatMap((mentorado) => {
    const sessao = sessoes1a1De(dados.sessoes, mentorado.id)
      .filter(noPeriodo)
      .sort((a, b) => ((a.data ?? "") < (b.data ?? "") ? -1 : 1))
      .pop();
    if (!sessao?.data) return [];
    const dia = sessao.data;
    const respondeu = dados.nps.some((r) => r.mentorado_id === mentorado.id && r.respondido_em !== null && diaSP(r.respondido_em) >= dia);
    return respondeu ? [] : [{ mentorado, sessao }];
  });
  const comSessao = ativos.filter((m) => sessoes1a1De(dados.sessoes, m.id).some(noPeriodo)).length;
  const respostas = dados.experiencia.filter((r) => diaSP(r.respondido_em) >= INICIO_COBRANCA_NPS).length;
  return { pendentes, comSessao, respostas };
}

// As 1:1 e os encontros agendados de hoje em diante (cinto de segurança: nada preso em "Agendada"
// no passado), por data e hora. No encontro o alvo da busca leva os participantes: a coluna mostra
// só "N participante(s)".
function proximas(dados: Dataset, hoje: string, busca: string): Proxima[] {
  const agendada = (s: Sessao) => s.status === "Agendada" && !!s.data && s.data >= hoje;
  const nome = (id: string | null) => nomeDe(dados.mentorados, id);
  const individuais = dados.sessoes.filter((s) => eh1a1(s) && agendada(s));
  const encontros = agruparGrupo(dados.sessoes.filter((s) => ehGrupo(s) && agendada(s)));
  return [
    ...individuais.map((s) => ({
      item: { chave: s.id, data: s.data ?? "", hora: s.hora, etapa: s.etapa, mentor: s.mentor, quem: nome(s.mentorado_id), mentoradoId: s.mentorado_id, encontro: null },
      alvo: `${nome(s.mentorado_id)} ${s.etapa ?? ""} ${s.mentor ?? ""}`,
    })),
    ...encontros.map((e) => ({
      item: { chave: e.chave, data: e.data ?? "", hora: e.hora, etapa: e.etapa, mentor: e.mentor, quem: `${e.itens.length} participante(s)`, mentoradoId: null, encontro: e },
      alvo: `${e.itens.map((s) => nome(s.mentorado_id)).join(" ")} ${e.etapa ?? ""} ${e.mentor ?? ""}`,
    })),
  ]
    .filter((p) => casaBusca(busca, p.alvo))
    .map((p) => p.item)
    .sort((a, b) => (a.data + (a.hora || "99") < b.data + (b.hora || "99") ? -1 : 1))
    .slice(0, 8);
}

// A adesão da Pesquisa de Experiência, só para o mentor, que não vê o totalizador: o número
// agregado quando fica abaixo da meta, com denominador > 0 (GER-08, AD-002).
function avisoAdesao(dados: Dataset, verFinanceiro: boolean): Painel["adesao"] {
  if (verFinanceiro || !dados.adesao) return null;
  const total = Number(dados.adesao.mentorados_com_sessao);
  const respostas = Number(dados.adesao.respostas);
  if (!total || respostas / total >= META_ADESAO_EXP) return null;
  return { respostas, total, pct: Math.round((100 * respostas) / total) };
}

export function painel(dados: Dataset, papel: Papel, hoje: string, busca: string): Painel {
  const verFin = pode(papel, "verFinanceiro");
  const { mentorados, sessoes } = dados;
  const ativos = mentorados.filter(ehAtivo);
  const casa = (m: Mentorado) => casaBusca(busca, m.nome);
  const individuais = sessoes.filter(eh1a1);
  const grupo = sessoes.filter(ehGrupo);

  const vencidas = dados.parcelas.filter((p) => parcelaVencida(p, hoje) && ehAtivo(mentorados.find((m) => m.id === p.mentorado_id)));
  const incompletos = mentorados.filter((m) => m.cadastro_incompleto && situacaoDe(m) !== "cancelado");
  const risco = semSessao30(dados, ativos, hoje);
  const semSubida = semSubida30(dados, ativos, hoje);
  const semImplementacao = ativos.filter((m) => !implementacaoDe(sessoes, m.id));
  const aguardando = sessoes.filter((s) => s.status === "Aguardando confirmação").length;
  const orfasLia = cobrancasOrfas(dados.cobrancas).length;
  const nps = pesquisas(dados, ativos, hoje);
  const npsExperiencia = Math.max(0, nps.comSessao - nps.respostas);

  const itens: (ItemAtencao | false)[] = [
    verFin && { chave: "contratos", rotulo: "Contratos pendentes de assinatura", contagem: ativos.filter((m) => m.contrato_status !== "Assinado").length, link: null },
    verFin && { chave: "vencidas", rotulo: "Parcelas vencidas em aberto", contagem: vencidas.length, link: { caminho: "/financeiro" } },
    { chave: "incompletos", rotulo: "Mentorados criados pela Lia, sem cadastro completo", contagem: incompletos.length, link: { caminho: "/mentorados", statusFin: "incompletos" } },
    { chave: "semSessao", rotulo: "Mentorados sem sessão há +30 dias", contagem: risco.length, link: { ancora: "risco" } },
    { chave: "semSubida", rotulo: "Mentorados sem subir de marco há +30 dias", contagem: semSubida.length, link: { ancora: "sem-subida" } },
    { chave: "semImplementacao", rotulo: "Mentorados que ainda não fizeram a sessão de implementação", contagem: semImplementacao.length, link: { ancora: "sem-implementacao" } },
    aguardando > 0 && { chave: "aguardando", rotulo: "Sessões aguardando confirmação", contagem: aguardando, link: { caminho: "/sessoes" } },
    dados.orfas.length > 0 && { chave: "orfas", rotulo: "Sessões sem evento no Google Agenda", contagem: dados.orfas.length, link: { ancora: "orfas" } },
    verFin && orfasLia > 0 && { chave: "cobrancas", rotulo: "Cobranças da Lia sem mentorado identificado", contagem: orfasLia, link: { caminho: "/financeiro" } },
    verFin && { chave: "npsSessao", rotulo: "Pesquisa de satisfação da sessão não respondida", contagem: nps.pendentes.length, link: { ancora: "nps-pend" } },
    verFin && {
      chave: "npsExperiencia",
      rotulo: `Pesquisa de Experiência não respondida (anônima: ${nps.respostas} resposta(s) de ${nps.comSessao} mentorado(s) com sessão)`,
      contagem: npsExperiencia,
      link: null,
    },
  ];

  return {
    atencao: itens.filter((item): item is ItemAtencao => item !== false),
    adesao: avisoAdesao(dados, verFin),
    ativos: ativos.length,
    ativosNaBusca: ativos.filter(casa).length,
    numeros: {
      ativos: ativos.length,
      pausados: mentorados.filter((m) => situacaoDe(m) === "pausado").length,
      cancelados: mentorados.filter((m) => situacaoDe(m) === "cancelado").length,
      concluidas1a1: individuais.filter((s) => s.status === "Concluída").length,
      agendadas1a1: individuais.filter((s) => s.status === "Agendada").length,
      encontros: agruparGrupo(grupo.filter((s) => s.status === "Concluída")).length,
      presencas: grupo.filter((s) => s.status === "Concluída").length,
      encontrosAgendados: agruparGrupo(grupo.filter((s) => s.status === "Agendada")).length,
    },
    progressao: ativos
      .map((mentorado) => ({ mentorado, nivel: nivelDe(faturamentoAcumulado(dados.faturamento, mentorado.id)) }))
      .filter((x) => x.nivel.total > 0 && casa(x.mentorado))
      .sort((a, b) => b.nivel.total - a.nivel.total),
    proximas: proximas(dados, hoje, busca),
    listas: {
      orfas: {
        total: dados.orfas.length,
        itens: dados.orfas
          .filter((o) => casaBusca(busca, o.mentorado_nome, o.etapa, o.mentor))
          .sort((a, b) => ((a.data ?? "") < (b.data ?? "") ? -1 : 1)),
      },
      risco: { total: risco.length, itens: risco.filter((r) => casa(r.mentorado)) },
      semImplementacao: {
        total: semImplementacao.length,
        itens: semImplementacao.filter(casa).map((mentorado) => ({ mentorado, plantoes: plantoesDe(sessoes, mentorado) })),
      },
      semSubida: { total: semSubida.length, itens: semSubida.filter((x) => casa(x.mentorado)) },
      npsPend: { total: nps.pendentes.length, itens: nps.pendentes.filter((x) => casa(x.mentorado)) },
    },
  };
}
