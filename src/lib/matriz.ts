import { chaveNome } from "./busca";
import { ordemDaEtapa } from "./constantes";
import type { Sessao } from "./data/esquemas";
import { mesDe } from "./datas";
import { agruparGrupo, eh1a1, type Encontro, ehGrupo } from "./sessoes";

// A matriz mentor × etapa do Dashboard, a base do fechamento dos mentores (index.html:1445–1470,
// :1537–1601), e os quatro avisos do rodapé dela, que levam às linhas em Sessões (:1419–1438).

// Uma reunião pode estar gravada duas vezes: o sync procura a linha manual por `etapa` e insere
// outra quando o título do evento nomeia etapa diferente da que está na trilha. Mesmo mentorado,
// data, hora e mentor (como gravado) é a mesma reunião (OPS-02). Sessões também marca essas
// linhas: a regra mora aqui para as duas telas não divergirem.
export interface Reunioes {
  reunioes: Sessao[];
  dobradas: { itens: Sessao[]; escolhida: Sessao }[];
  contadas: ReadonlySet<string>;
}

// Fica a linha registrada à mão (`google_event_id` nulo): a etapa dela foi escolhida por uma
// pessoa olhando a trilha. Empate desfeito pelo menor id, para a escolha não variar.
const escolher = (itens: Sessao[]): Sessao =>
  [...itens].sort((a, b) => Number(!!a.google_event_id) - Number(!!b.google_event_id) || (a.id < b.id ? -1 : 1))[0];

export function reunioesConcluidas1a1(sessoes: readonly Sessao[]): Reunioes {
  const porSlot = new Map<string, Sessao[]>();
  for (const s of sessoes) {
    if (!eh1a1(s) || s.status !== "Concluída") continue;
    // Sem data não dá para afirmar que é a mesma reunião: cada uma fica sozinha.
    const chave = s.data ? `${s.mentorado_id}|${s.data}|${s.hora ?? ""}|${s.mentor ?? ""}` : `sem-data|${s.id}`;
    porSlot.set(chave, [...(porSlot.get(chave) ?? []), s]);
  }
  const slots = [...porSlot.values()];
  const reunioes = slots.map(escolher);
  return {
    reunioes,
    dobradas: slots.filter((itens) => itens.length > 1).map((itens) => ({ itens, escolhida: escolher(itens) })),
    contadas: new Set(reunioes.map((s) => s.id)),
  };
}

// As marcas por linha de Sessões (index.html:1888–1903), do mesmo helper que conta a matriz: as duas
// telas não divergem. Uma marca por linha, a primeira que casa, com ou sem foco.
export interface Marca {
  rotulo: string;
  tom: "success" | "warning" | "info";
  dica: string;
}

const CONTADA: Marca = { rotulo: "contada", tom: "success", dica: "Das linhas desta mesma reunião, é esta que entra na contagem do mentor" };
const IGNORADA: Marca = {
  rotulo: "ignorada · mesma reunião",
  tom: "warning",
  dica: "Mesma reunião (mesmo mentorado, data, hora e mentor) de outra linha já contada — esta ficou fora para não contar em dobro",
};
const SEM_DATA: Marca = { rotulo: "sem data", tom: "warning", dica: "Concluída sem data não entra em nenhum mês do fechamento" };
const SEM_MENTOR: Marca = { rotulo: "sem mentor", tom: "warning", dica: "Sem mentor na linha, a sessão não será creditada a ninguém" };
// Palpite do sync não confirmado não pode passar por certeza: a marca fica até alguém salvar a sessão.
const ETAPA_DEDUZIDA: Marca = {
  rotulo: "etapa deduzida",
  tom: "info",
  dica: "O título do evento não dizia a etapa; o sync deduziu pela trilha. Abra a sessão e salve para confirmar ou corrigir.",
};

export function marcadorDeLinhas(sessoes: readonly Sessao[]): (s: Sessao) => Marca | null {
  const { dobradas, contadas } = reunioesConcluidas1a1(sessoes);
  const emDobro = new Set(dobradas.flatMap((d) => d.itens.map((s) => s.id)));
  return (s) => {
    if (emDobro.has(s.id)) return contadas.has(s.id) ? CONTADA : IGNORADA;
    if (s.status === "Concluída" && !s.data) return SEM_DATA;
    if (s.status === "Aguardando confirmação" && !s.mentor) return SEM_MENTOR;
    if (s.etapa_deduzida) return ETAPA_DEDUZIDA;
    return null;
  };
}

// `sessoes.mentor` é texto livre. Para agrupar, a chave sem acento, sem caixa e com os espaços
// colapsados; para exibir, a grafia do cadastro, ou o nome como veio, com o espaço normalizado
// (OPS-03).
const nomeMentor = (canonico: ReadonlyMap<string, string>, mentor: string | null): string => canonico.get(chaveNome(mentor)) ?? (mentor ?? "").replace(/\s+/g, " ").trim();
const temMentor = (x: { mentor: string | null }) => chaveNome(x.mentor) !== "";

export type ChaveAviso = "dobradas" | "semData" | "semMentor" | "etapaDeduzida";

// 1:1 e grupo em colunas separadas: um encontro com 30 inscritos vale um, não 30.
export interface Contagem {
  porEtapa: number[];
  total1a1: number;
  grupo: number;
  presencas: number;
}

export interface LinhaMatriz extends Contagem {
  mentor: string;
  foraDoProjeto: boolean;
}

export interface Matriz {
  mes: string; // "" = todos os meses
  meses: string[]; // as opções do seletor, da mais recente para a mais antiga
  etapas: string[]; // as colunas: as etapas de todas as 1:1, de qualquer status
  linhas: LinhaMatriz[];
  semMentor: Contagem | null; // "Sem mentor identificado", no fim
  temGrupo: boolean;
  avisos: Record<ChaveAviso, number>;
  focos: Record<ChaveAviso, string[]>; // os ids que cada aviso aponta em Sessões (NAV-10)
}

const unicos = <T,>(lista: T[]): T[] => [...new Set(lista)];

// `mesEscolhido` null é o padrão de OPS-04: o mês corrente se tiver reunião, senão o mais
// recente com reunião, senão "Todos". Mês que o seletor não oferece também cai em "Todos".
export function matrizMentores(sessoes: readonly Sessao[], mesEscolhido: string | null, hoje: string, cadastrados: readonly string[]): Matriz {
  const canonico = new Map(cadastrados.map((mentor) => [chaveNome(mentor), mentor]));
  const nomeDe = (mentor: string | null) => nomeMentor(canonico, mentor);
  const { reunioes, dobradas } = reunioesConcluidas1a1(sessoes);
  const grupoConcluido = sessoes.filter((s) => ehGrupo(s) && s.status === "Concluída");
  const mesAtual = hoje.slice(0, 7);
  const comReuniao = unicos([...reunioes, ...grupoConcluido].filter((s) => s.data).map((s) => mesDe(s.data)))
    .sort()
    .reverse();
  const meses = unicos([mesAtual, ...comReuniao]).sort().reverse();
  const pedido = mesEscolhido ?? (comReuniao.includes(mesAtual) ? mesAtual : (comReuniao[0] ?? ""));
  const mes = meses.includes(pedido) ? pedido : "";
  const noMes = (x: { data: string | null }) => !mes || mesDe(x.data) === mes;

  const reunioesMes = reunioes.filter(noMes);
  const grupoMes = agruparGrupo(grupoConcluido.filter(noMes));
  const etapas = unicos(sessoes.filter(eh1a1).map((s) => s.etapa ?? "")).sort((a, b) => ordemDaEtapa(a) - ordemDaEtapa(b));
  const contar = (minhas: Sessao[], encontros: Encontro[]): Contagem => ({
    porEtapa: etapas.map((etapa) => minhas.filter((s) => (s.etapa ?? "") === etapa).length),
    total1a1: minhas.length,
    grupo: encontros.length,
    presencas: encontros.reduce((n, e) => n + e.itens.length, 0),
  });

  // Quem aparece sai dos próprios dados: ninguém some da contagem ao sair do projeto.
  const linhas = unicos([...reunioesMes, ...grupoMes].filter(temMentor).map((x) => nomeDe(x.mentor)))
    .map((mentor) => ({
      mentor,
      foraDoProjeto: !cadastrados.includes(mentor),
      ...contar(
        reunioesMes.filter((s) => nomeDe(s.mentor) === mentor),
        grupoMes.filter((e) => nomeDe(e.mentor) === mentor),
      ),
    }))
    .sort((a, b) => b.total1a1 - a.total1a1 || b.grupo - a.grupo);
  const reunioesSemMentor = reunioesMes.filter((s) => !temMentor(s));
  const grupoSemMentor = grupoMes.filter((e) => !temMentor(e));

  // Nas dobradas vão as duas linhas do par: para decidir qual etapa está errada é preciso ver as
  // duas lado a lado. Etapa deduzida vale enquanto ninguém salvar a sessão, concluída ou não.
  const dobradasMes = dobradas.filter((d) => noMes(d.escolhida));
  const semData = reunioes.filter((s) => !s.data).map((s) => s.id);
  const focos: Record<ChaveAviso, string[]> = {
    dobradas: dobradasMes.flatMap((d) => d.itens.map((s) => s.id)),
    semData,
    semMentor: sessoes.filter((s) => !s.mentor && s.status === "Aguardando confirmação").map((s) => s.id),
    etapaDeduzida: sessoes.filter((s) => s.etapa_deduzida).map((s) => s.id),
  };
  return {
    mes,
    meses,
    etapas,
    linhas,
    semMentor: reunioesSemMentor.length + grupoSemMentor.length > 0 ? contar(reunioesSemMentor, grupoSemMentor) : null,
    temGrupo: grupoMes.length > 0,
    // Concluída sem data só é aviso com um mês escolhido: em "Todos" ela entra na conta.
    avisos: { dobradas: dobradasMes.length, semData: mes ? semData.length : 0, semMentor: focos.semMentor.length, etapaDeduzida: focos.etapaDeduzida.length },
    focos,
  };
}

// O que cada aviso explica no topo de Sessões. O foco é escolhido pelo nome do aviso, nunca por
// um id vindo da tela (index.html:1419–1438).
export const AVISOS: Record<ChaveAviso, { titulo: string; dica: string }> = {
  dobradas: {
    titulo: "Reuniões gravadas em duas etapas",
    dica: "Cada par abaixo é a mesma reunião — mesmo mentorado, data, hora e mentor — gravada em duas etapas. Contei uma vez cada, na linha marcada como contada. Para resolver: corrija a etapa errada ou apague a linha sobrando, pela ficha do mentorado.",
  },
  semData: {
    titulo: "Sessões concluídas sem data",
    dica: "Sessão concluída sem data não entra em mês nenhum, então fica fora de todo fechamento mensal. Preencha a data pela ficha do mentorado.",
  },
  semMentor: {
    titulo: "Aguardando confirmação sem mentor definido",
    dica: "Sem mentor na linha, a sessão não é creditada a ninguém quando for concluída — cai em Sem mentor identificado. Defina o mentor pela ficha do mentorado.",
  },
  etapaDeduzida: {
    titulo: "Etapa escolhida pelo sync, ainda sem confirmação",
    dica: "O título do evento no Google Agenda não dizia a etapa, então o sync usou a primeira da trilha ainda livre para esse mentorado. Costuma acertar e erra quando a ordem é pulada ou repetida — e a etapa alimenta a matriz que fecha o mês dos mentores. Abra a sessão pela ficha do mentorado e salve: confirmando ou corrigindo, a marca sai.",
  },
};

export const focoDoAviso = (matriz: Matriz, chave: ChaveAviso): { ids: string[]; titulo: string; dica: string } => ({
  ids: matriz.focos[chave],
  ...AVISOS[chave],
});
