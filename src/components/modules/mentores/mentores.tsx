"use client";

import { LinkFicha } from "@/components/modules/comum/celulas";
import { Nota } from "@/components/modules/comum/nota-nps";
import { useDados, useUi } from "@/components/shell/contexto";
import { AvisoRelacoes } from "@/components/shell/dados";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import type { NpsResposta } from "@/lib/data/esquemas";
import { fmtD, fmtInstante, hojeSP } from "@/lib/datas";
import { contrasDe, pautaDe, prosDe } from "@/lib/ia";
import {
  type AtividadeMes,
  atividadePorMes,
  ehMentorAtual,
  mentoresDaTela,
  resumoDoMentor,
  type ResumoMentor,
  resumosDosMentores,
  ultimaNotaDe,
  ultimasRespostas,
  visaoMentores,
} from "@/lib/mentores";
import { fmtMedia, fmtNps, mediaNps, rotuloPeriodoNps, scoreNps } from "@/lib/nps";

// A tela Mentores (renderMentores, index.html:3009–3081; mapeamento §3.11). As regras moram em
// src/lib/mentores.ts. Só leitura, e só para quem vê o NPS (a casca guarda a rota): a tela mostra
// nota e a leitura da IA. DATA-07: as relações dela são complementares (R17, R19, R22); a falha de
// uma vira aviso e o resto renderiza.

const COMPLEMENTARES = ["nps_respostas", "nps_analises", "transcricoes"] as const;

const BotaoDoMentor = ({ nome, onClick }: { nome: string; onClick(): void }) => (
  <Button variant="link" size="sm" onClick={onClick}>
    {nome}
  </Button>
);

const Contagem = ({ no30, total }: { no30: number; total: number }) => (
  <>
    {no30} <span className="text-xs text-muted">{`/ ${total}`}</span>
  </>
);

function Visao({ resumos, hoje, escolher }: { resumos: ResumoMentor[]; hoje: string; escolher(nome: string): void }) {
  const { dados } = useDados();
  const v = visaoMentores(resumos, dados.nps, hoje);
  const colunas: Column<ResumoMentor>[] = [
    {
      key: "mentor",
      header: "Mentor",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <BotaoDoMentor nome={r.nome} onClick={() => escolher(r.nome)} />
          {!ehMentorAtual(r.nome) && <Badge>histórico</Badge>}
        </span>
      ),
    },
    { key: "carteira", header: "Carteira", align: "right", render: (r) => r.carteira.length },
    { key: "r1", header: "1:1 (30d / total)", align: "right", render: (r) => <Contagem no30={r.r1_30.length} total={r.r1.length} /> },
    { key: "grupo", header: "Grupo (30d / total)", align: "right", render: (r) => <Contagem no30={r.grupos30.length} total={r.grupos.length} /> },
    { key: "agenda", header: "Agendadas", align: "right", render: (r) => r.agenda.length },
    {
      key: "media",
      header: "Média NPS",
      align: "right",
      render: (r) =>
        r.nps.length ? (
          <>
            {fmtMedia(mediaNps(r.nps))} <span className="text-xs text-muted">{`(${r.nps.length})`}</span>
          </>
        ) : (
          "—"
        ),
    },
    { key: "nps", header: "NPS", align: "right", render: (r) => fmtNps(scoreNps(r.nps)) },
    { key: "calls", header: "Calls transcritas", align: "right", render: (r) => r.calls || "—" },
    { key: "ultima", header: "Última atividade", render: (r) => fmtD(r.ultima) },
  ];
  const t = v.totais;
  return (
    <>
      <section aria-label="Números dos mentores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compact label="Sessões 1:1 · 30 dias" value={t.r1_30} caption={`${t.r1} no total`} />
        <StatCard compact label="Encontros em grupo · 30 dias" value={t.grupos30} caption={`${t.grupos} no total`} />
        <StatCard compact label="Agendadas" value={t.agenda} caption="de hoje em diante" />
        <StatCard compact label="NPS · 30 dias" value={fmtMedia(v.nps30.media)} caption={`NPS ${fmtNps(v.nps30.nps)}`} />
      </section>
      <Card>
        <CardHeader title={`Mentores · ${v.ativos.length}`} />
        {v.ativos.length ? <DataTable columns={colunas} rows={v.ativos} rowKey={(r) => r.nome} /> : <EmptyState className="m-4" title="Nenhum mentor com atividade." />}
      </Card>
      {v.historico.length > 0 && (
        <Card>
          <CardHeader title={`Histórico · ${v.historico.length}`} />
          <p className="px-5 pt-3 text-sm text-muted">Fora da lista atual e sem sessão nos últimos 30 dias nem agenda.</p>
          <DataTable columns={colunas} rows={v.historico} rowKey={(r) => r.nome} />
        </Card>
      )}
    </>
  );
}

function Leitura({ r }: { r: ResumoMentor }) {
  const l = r.leitura;
  if (!l) return <EmptyState title="Sem leitura da Análise IA para este mentor na última rodada." />;
  const lista = (titulo: string, tom: "success" | "danger", itens: readonly string[]) => (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm">
        <Badge variant={tom}>{titulo}</Badge> {itens.length}
      </p>
      {itens.length ? (
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {itens.map((t, i) => (
            <li key={`${i}:${t}`}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Nada nos dados desta rodada.</p>
      )}
    </div>
  );
  const pauta = pautaDe(l);
  return (
    <div className="space-y-4 p-5">
      <p className="text-sm">{l.leitura}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {lista("Prós", "success", prosDe(l))}
        {lista("Contras", "danger", contrasDe(l))}
      </div>
      {pauta.length > 0 && <p className="text-xs text-muted">{`Pauta: ${pauta.join(" · ")}`}</p>}
    </div>
  );
}

function Detalhe({ r, hoje }: { r: ResumoMentor; hoje: string }) {
  const { dados } = useDados();
  const nomeDe = (id: string) => dados.mentorados.find((m) => m.id === id)?.nome || "—";
  const colunasMes: Column<AtividadeMes>[] = [
    { key: "mes", header: "Mês", render: (a) => rotuloPeriodoNps(a.mes, "mes") },
    { key: "r1", header: "1:1", align: "right", render: (a) => a.r1 },
    { key: "grupos", header: "Encontros em grupo", align: "right", render: (a) => a.grupos },
    { key: "respostas", header: "Respostas NPS", align: "right", render: (a) => a.respostas },
    { key: "media", header: "Média NPS", align: "right", render: (a) => fmtMedia(a.media) },
  ];
  const colunasCarteira: Column<ResumoMentor["carteira"][number]>[] = [
    { key: "nome", header: "Mentorado", render: ({ m }) => <LinkFicha id={m.id}>{m.nome}</LinkFicha> },
    { key: "ultima", header: "Última sessão 1:1", render: ({ ultima }) => fmtD(ultima.data) },
    { key: "etapa", header: "Etapa", render: ({ ultima }) => ultima.etapa || "—" },
    {
      key: "nota",
      header: "Última nota",
      align: "right",
      render: ({ m }) => {
        const n = ultimaNotaDe(r, m.id);
        return n ? <Nota nota={n.nota} /> : "—";
      },
    },
  ];
  const colunasAgenda: Column<ResumoMentor["agenda"][number]>[] = [
    { key: "data", header: "Data", render: (s) => fmtD(s.data) },
    { key: "hora", header: "Hora", render: (s) => s.hora || "—" },
    { key: "mentorado", header: "Mentorado", render: (s) => <LinkFicha id={s.mentorado_id}>{s.mentorado_id ? nomeDe(s.mentorado_id) : "—"}</LinkFicha> },
    { key: "etapa", header: "Etapa", render: (s) => s.etapa || "—" },
  ];
  const respostas = ultimasRespostas(r);
  const quem = (x: NpsResposta) => dados.mentorados.find((m) => m.id === x.mentorado_id)?.nome || x.nome_informado || "—";
  return (
    <>
      <section aria-label="Números do mentor" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard compact label="Carteira ativa" value={r.carteira.length} caption="mentorados" />
        <StatCard compact label="1:1 · 30 dias" value={r.r1_30.length} caption={`${r.r1.length} no total`} />
        <StatCard compact label="Grupo · 30 dias" value={r.grupos30.length} caption={`${r.grupos.length} no total`} />
        <StatCard
          compact
          label="Média NPS"
          value={fmtMedia(mediaNps(r.nps))}
          caption={`NPS ${fmtNps(scoreNps(r.nps))} · ${r.nps.length} resposta(s) · 30d ${fmtMedia(mediaNps(r.nps30))}`}
        />
        <StatCard compact label="Calls transcritas" value={r.calls} caption="aceitas no dossiê" />
      </section>
      <Card>
        <CardHeader title="Leitura da Análise IA" />
        <Leitura r={r} />
      </Card>
      <Card>
        <CardHeader title="Atividade por mês" />
        <DataTable columns={colunasMes} rows={atividadePorMes(r, hoje)} rowKey={(a) => a.mes} />
      </Card>
      <Card>
        <CardHeader title={`Carteira · ${r.carteira.length}`} />
        <p className="px-5 pt-3 text-sm text-muted">Mais tempo sem sessão primeiro.</p>
        {r.carteira.length ? <DataTable columns={colunasCarteira} rows={r.carteira} rowKey={({ m }) => m.id} /> : <EmptyState className="m-4" title="Nenhum mentorado ativo com a última sessão 1:1 com este mentor." />}
      </Card>
      <Card>
        <CardHeader title={`Agenda · ${r.agenda.length}`} />
        {r.agenda.length ? <DataTable columns={colunasAgenda} rows={r.agenda} rowKey={(s) => s.id} /> : <EmptyState className="m-4" title="Nada agendado." />}
      </Card>
      <Card>
        <CardHeader title="Últimas respostas de NPS" />
        {respostas.length ? (
          <ul>
            {respostas.map((x) => (
              <li key={x.id} className="border-t border-line px-5 py-3 text-sm first:border-t-0">
                <p className="flex flex-wrap items-center gap-2">
                  {fmtInstante(x.respondido_em)} · <Nota nota={x.nota} />
                  <span className="text-xs text-muted">{quem(x)}</span>
                </p>
                {x.comentario && <p className="mt-1 whitespace-pre-line">{x.comentario}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="m-4" title="Sem respostas." />
        )}
      </Card>
    </>
  );
}

export default function Mentores() {
  const { dados } = useDados();
  const { ui, mudar } = useUi();
  const hoje = hojeSP();
  const nomes = mentoresDaTela(dados.sessoes);
  const sel = nomes.includes(ui.filtro.mentorSel) ? ui.filtro.mentorSel : "";
  const escolher = (mentorSel: string) => mudar({ filtro: { ...ui.filtro, mentorSel } });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mentores"
        subtitle="Carteira, sessões, encontros em grupo, agenda, NPS e leitura da Análise IA de cada mentor. 1:1 conta reunião (a mesma regra da matriz do dashboard); carteira = mentorados ativos cuja última sessão 1:1 concluída foi com o mentor."
      />
      <AvisoRelacoes complementares={[...COMPLEMENTARES]}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mentor">
          {["", ...nomes].map((nome) => (
            <Button key={nome || "geral"} size="sm" variant={nome === sel ? "primary" : "outline"} aria-pressed={nome === sel} onClick={() => escolher(nome)}>
              {nome || "Visão geral"}
            </Button>
          ))}
        </div>
        {sel ? <Detalhe r={resumoDoMentor(dados, hoje, sel)} hoje={hoje} /> : <Visao resumos={resumosDosMentores(dados, hoje)} hoje={hoje} escolher={escolher} />}
      </AvisoRelacoes>
    </div>
  );
}
