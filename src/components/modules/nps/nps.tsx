"use client";

import { LinkFicha } from "@/components/modules/comum/celulas";
import { CabecalhoOrdenavel, ordemEscolhida } from "@/components/modules/comum/ordenacao";
import { SeloBusca } from "@/components/modules/comum/selo-busca";
import { type Ui, useDados, useUi } from "@/components/shell/contexto";
import { AvisoRelacoes } from "@/components/shell/dados";
import Badge from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import Pagination from "@/components/ui/pagination";
import SearchInput from "@/components/ui/search-input";
import SegmentedControl from "@/components/ui/segmented-control";
import Select from "@/components/ui/select";
import StatCard from "@/components/ui/stat-card";
import Tabs from "@/components/ui/tabs";
import type { ExpResposta, NpsResposta } from "@/lib/data/esquemas";
import { fmtInstante } from "@/lib/datas";
import {
  fmtMedia,
  fmtNps,
  linhaDoPeriodo,
  type LinhaPeriodo,
  mediaNps,
  mentoresDoNps,
  paginar,
  type PeriodoNps,
  periodosDoNps,
  respostasDoNps,
  resumoExperiencia,
  rotuloPeriodoNps,
  scoreNps,
  TAMANHO_PERIODOS,
  TAMANHO_RESPOSTAS,
  tomDaNota,
  tomDaResposta,
  tomDoIndice,
} from "@/lib/nps";

// A tela NPS (renderNps e painelExperiencia, index.html:2748–3008; mapeamento §3.9). As regras
// moram em src/lib/nps.ts; aqui só se desenha o que elas devolvem. Aba, período, mentor, busca e as
// duas páginas são o `filtro` do Ui, que sobrevive à troca de tela como hoje.

const TABELA = "nps";
const ABAS = [
  { value: "sessoes", label: "NPS das sessões" },
  { value: "experiencia", label: "Pesquisa de Experiência" },
];
const PERIODOS: Record<PeriodoNps, string> = { semana: "Semana", mes: "Mês" };

// GER-03: aba e período voltam as duas páginas para 1; o mentor, só a das respostas (GER-04).
type Filtro = Ui["filtro"];
const VOLTA_AS_DUAS = { npsPagPeriodo: 1, npsPagResp: 1 } as const;

const Nota = ({ nota }: { nota: number | null }) => <Badge variant={tomDaNota(nota)}>{String(nota ?? "—")}</Badge>;

function Perguntas({ r }: { r: NpsResposta }) {
  const itens = [
    r.clareza && { rotulo: "Clareza dos próximos passos", valor: r.clareza },
    r.direcionamento && { rotulo: "Direcionamento adequado", valor: r.direcionamento },
  ].filter((i): i is { rotulo: string; valor: string } => !!i);
  if (!itens.length && !r.apoio) return null;
  return (
    <div className="mt-1.5 space-y-1 text-xs text-muted">
      {itens.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5">
          {itens.map((i) => (
            <span key={i.rotulo} className="inline-flex items-center gap-1">
              {i.rotulo} <Badge variant={tomDaResposta(i.valor)}>{i.valor}</Badge>
            </span>
          ))}
        </p>
      )}
      {r.apoio && <p className="whitespace-pre-line">{`Quer mais apoio em: ${r.apoio}`}</p>}
    </div>
  );
}

function PainelSessoes() {
  const { dados } = useDados();
  const { ui, mudar } = useUi();
  const f = ui.filtro;
  const { nps, mentorados } = dados;
  if (!nps.length) return <EmptyState title="Nenhuma resposta de NPS ainda." />;

  const mentores = mentoresDoNps(nps);
  const periodo = f.npsPeriodo;
  const mudarFiltro = (parcial: Partial<Filtro>) => mudar({ filtro: { ...f, ...parcial } });
  const periodos = paginar(periodosDoNps(nps, periodo), f.npsPagPeriodo, TAMANHO_PERIODOS);
  const { lista, doMentor } = respostasDoNps(nps, mentorados, f.npsMentor, f.qNps, ordemEscolhida(ui, TABELA));
  const respostas = paginar(lista, f.npsPagResp, TAMANHO_RESPOSTAS);
  const cabecalho = (campo: string, rotulo: string) => <CabecalhoOrdenavel tabela={TABELA} campo={campo} rotulo={rotulo} />;

  const colunasPeriodo: Column<LinhaPeriodo>[] = [
    { key: "periodo", header: PERIODOS[periodo], render: (l) => rotuloPeriodoNps(l.chave, periodo) },
    { key: "respostas", header: "Respostas", align: "right", render: (l) => l.respostas },
    { key: "media", header: "Média", align: "right", render: (l) => <b>{fmtMedia(l.media)}</b> },
    { key: "nps", header: "NPS", align: "right", render: (l) => fmtNps(l.nps) },
    ...mentores.map((m) => ({
      key: `mentor:${m}`,
      header: m,
      align: "right" as const,
      render: (l: LinhaPeriodo) => {
        const dele = l.porMentor.get(m);
        return dele?.n ? (
          <>
            {fmtMedia(dele.media)} <span className="text-xs text-muted">{`(${dele.n})`}</span>
          </>
        ) : (
          "—"
        );
      },
    })),
  ];
  const linhasPeriodo = periodos.itens.map((chave) => linhaDoPeriodo(nps, periodo, chave, mentores));

  const colunasResposta: Column<NpsResposta>[] = [
    { key: "data", header: cabecalho("data", "Data"), render: (r) => fmtInstante(r.respondido_em) },
    {
      key: "nome",
      header: cabecalho("nome", "Mentorado"),
      render: (r) => {
        const ficha = mentorados.find((m) => m.id === r.mentorado_id);
        return ficha ? <LinkFicha id={ficha.id}>{ficha.nome}</LinkFicha> : r.nome_informado || "—";
      },
    },
    { key: "mentor", header: cabecalho("mentor", "Mentor"), render: (r) => r.mentor || "—" },
    { key: "nota", header: cabecalho("nota", "Nota"), align: "right", render: (r) => <Nota nota={r.nota} /> },
    {
      key: "comentario",
      header: "Comentário",
      render: (r) => (
        <div className="min-w-[260px] whitespace-pre-line">
          {r.comentario || "—"}
          <Perguntas r={r} />
        </div>
      ),
    },
  ];

  return (
    <>
      <section aria-label="Médias por mentor" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compact label="Média geral" value={fmtMedia(mediaNps(nps))} caption={`NPS ${fmtNps(scoreNps(nps))} · ${nps.length} resposta(s)`} />
        {mentores.map((m) => {
          const dele = nps.filter((r) => r.mentor === m);
          return <StatCard compact key={m} label={m} value={fmtMedia(mediaNps(dele))} caption={`NPS ${fmtNps(scoreNps(dele))} · ${dele.length} resposta(s)`} />;
        })}
      </section>

      <Card>
        <CardHeader
          title={`Média por ${periodo === "mes" ? "mês" : "semana"}`}
          actions={
            <SegmentedControl
              items={["Semana", "Mês"] as const}
              value={PERIODOS[periodo]}
              onChange={(rotulo) => mudarFiltro({ npsPeriodo: rotulo === "Mês" ? "mes" : "semana", ...VOLTA_AS_DUAS })}
            />
          }
        />
        <DataTable columns={colunasPeriodo} rows={linhasPeriodo} rowKey={(l) => l.chave} />
        {periodos.paginas > 1 && (
          <div className="p-3">
            <Pagination label="Paginação dos períodos" page={periodos.pagina} pageCount={periodos.paginas} onChange={(n) => mudarFiltro({ npsPagPeriodo: n })} />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Respostas · ${lista.length}`}
          actions={
            <SearchInput
              className="w-64"
              value={f.qNps}
              placeholder="Buscar por mentorado, mentor ou comentário"
              aria-label="Buscar por mentorado, mentor ou comentário"
              onChange={(e) => mudarFiltro({ qNps: e.target.value })}
            />
          }
        />
        <div className="space-y-3 p-4">
          <SeloBusca termo={f.qNps} n={lista.length} total={doMentor} unidade="resposta(s)" limpar={() => mudarFiltro({ qNps: "" })} />
          <div className="max-w-xs">
            <Select
              aria-label="Mentor"
              options={[{ value: "", label: "Todos os mentores" }, ...mentores.map((m) => ({ value: m, label: m }))]}
              value={f.npsMentor}
              onChange={(m) => mudarFiltro({ npsMentor: m, npsPagResp: 1 })}
            />
          </div>
        </div>
        {respostas.itens.length ? <DataTable columns={colunasResposta} rows={respostas.itens} rowKey={(r) => r.id} /> : <EmptyState className="m-4" title="Ninguém neste recorte." />}
        {respostas.paginas > 1 && (
          <div className="p-3">
            <Pagination label="Paginação das respostas" page={respostas.pagina} pageCount={respostas.paginas} onChange={(n) => mudarFiltro({ npsPagResp: n })} />
          </div>
        )}
      </Card>
    </>
  );
}

function Respostas({ experiencia }: { experiencia: ExpResposta[] }) {
  return (
    <div className="space-y-1">
      <h3 className="pt-4 text-sm font-bold text-ink">Respostas</h3>
      {experiencia.map((r) => (
        <details key={r.origem_id} className="border-t border-line py-2.5">
          <summary className="cursor-pointer text-sm">
            {fmtInstante(r.respondido_em)} · nota <Nota nota={r.nota} /> · {r.geral || "—"} · clareza: {r.clareza || "—"}
          </summary>
          {Object.entries(r.textos).map(([pergunta, texto]) => (
            <div key={pergunta} className="mt-2">
              <p className="text-xs text-muted">{pergunta}</p>
              <p className="whitespace-pre-line text-sm">{texto}</p>
            </div>
          ))}
        </details>
      ))}
    </div>
  );
}

function PainelExperiencia() {
  const { dados } = useDados();
  const { experiencia } = dados;
  if (!experiencia.length) return <EmptyState title="Nenhuma resposta ainda." />;
  const r = resumoExperiencia(experiencia);
  const colunas: Column<(typeof r.itens)[number]>[] = [
    { key: "item", header: "Item da grade", render: (i) => i.item },
    { key: "indice", header: "Índice (0–100)", align: "right", render: (i) => <Badge variant={tomDoIndice(i.indice)}>{String(Math.round(i.indice))}</Badge> },
    { key: "respostas", header: "Respostas", align: "right", render: (i) => i.respostas },
  ];
  return (
    <Card>
      <CardHeader title="Pesquisa de Experiência · anônima" />
      <div className="space-y-4 p-5">
        <section aria-label="Números da Pesquisa de Experiência" className="grid gap-4 sm:grid-cols-3">
          <StatCard compact label="NPS da mentoria" value={fmtNps(r.nps)} caption={`${r.respostas} resposta(s) · média ${fmtMedia(r.media)}`} />
          <StatCard compact label="Índice de experiência" value={r.indice ?? "—"} caption="média da grade, 0 a 100" />
          <StatCard compact label="Clareza dos próximos passos" value={`${r.clareza.pctSim}%`} caption={`Sim ${r.clareza.sim} · Parcial ${r.clareza.parcial} · Não ${r.clareza.nao}`} />
        </section>
        <DataTable columns={colunas} rows={r.itens} rowKey={(i) => i.item} />
        <Respostas experiencia={experiencia} />
      </div>
    </Card>
  );
}

export default function Nps() {
  const { ui, mudar } = useUi();
  const aba = ui.filtro.npsAba === "experiencia" ? "experiencia" : "sessoes";
  return (
    <div className="space-y-6">
      <PageHeader
        title="NPS"
        subtitle="Nota que o mentorado dá à sessão e a Pesquisa de Experiência (anônima), lidas das planilhas a cada 6 h. NPS = % de notas 9–10 menos % de notas 0–6."
      />
      <Tabs items={ABAS} value={aba} onChange={(v) => mudar({ filtro: { ...ui.filtro, npsAba: v, ...VOLTA_AS_DUAS } })} />
      {/* DATA-07: cada aba depende da sua relação; a falha de R18 não derruba a aba das sessões. */}
      {aba === "sessoes" ? (
        <AvisoRelacoes essenciais={["nps_respostas"]}>
          <PainelSessoes />
        </AvisoRelacoes>
      ) : (
        <AvisoRelacoes essenciais={["experiencia_respostas"]}>
          <PainelExperiencia />
        </AvisoRelacoes>
      )}
    </div>
  );
}
