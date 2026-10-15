"use client";

import type { ReactNode } from "react";

import { LinkFicha } from "@/components/modules/comum/celulas";
import { Nota, Perguntas } from "@/components/modules/comum/nota-nps";
import { useDados, useSessao, useUi } from "@/components/shell/contexto";
import { AvisoRelacoes } from "@/components/shell/dados";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import Tabs from "@/components/ui/tabs";
import type { Analise, Mentorado, NpsResposta, Relacao } from "@/lib/data/esquemas";
import { fmtInstante } from "@/lib/datas";
import {
  abaIaEfetiva,
  abasIa,
  alertasPorSeveridade,
  chaveMentorado,
  chaveSelecaoMentor,
  chaveSelecaoMentorado,
  contagemRisco,
  contrasDe,
  type LeituraMentor,
  type LeituraMentorado,
  leiturasPorMentor,
  leiturasPorMentorado,
  npsDoMentor,
  npsDoMentorado,
  numerosDoMentor,
  pautaDe,
  prosDe,
  riscoDe,
  severidadeDe,
  sinaisDe,
} from "@/lib/ia";
import { fmtMedia, fmtNps } from "@/lib/nps";

// A tela Análise IA (renderIa, index.html:2766–2918; mapeamento §3.10). As regras moram em
// src/lib/ia.ts. Os três papéis entram: admin e diretoria leem a análise inteira (R19); o mentor
// lê pela rpc `analise_ia_mentor()` (R21), que vem sem resumo e sem leitura por mentor, e não vê a
// aba Por mentor nem as respostas de NPS (GER-05, AD-005). Os números dos cards vêm do NPS
// carregado, não do modelo; o texto vem do modelo, e tudo isso é escapado pelo React.

const SEM_ANALISE = "Nenhuma análise ainda. O analista roda todo dia às 8h, só quando chegou resposta nova.";

function Alertas({ analise }: { analise: Analise }) {
  const alertas = alertasPorSeveridade(analise.alertas);
  return (
    <div className="space-y-4">
      {analise.resumo != null && (
        <Card>
          <CardHeader title="Resumo" />
          <p className="whitespace-pre-line p-5 text-sm">{analise.resumo}</p>
        </Card>
      )}
      <Card>
        <CardHeader title={`Alertas · ${alertas.length}`} />
        {alertas.length ? (
          <ul>
            {alertas.map((a, i) => {
              const { tom, rotulo } = severidadeDe(a.severidade);
              const quem = [a.mentor && `Mentor: ${a.mentor}`, a.mentorado && `Mentorado: ${a.mentorado}`].filter(Boolean).join(" · ");
              return (
                <li key={`${i}:${a.titulo}`} className="space-y-1.5 border-t border-line px-5 py-4 text-sm first:border-t-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge variant={tom}>{rotulo}</Badge> <b>{a.titulo}</b>
                    <span className="text-xs text-muted">{`${a.tipo}${quem ? ` · ${quem}` : ""}`}</span>
                  </p>
                  <p>{a.detalhe}</p>
                  <p className="whitespace-pre-line text-xs text-muted">{`Evidência: ${a.evidencia}`}</p>
                  <p>
                    <b>Ação sugerida:</b> {a.acao_sugerida}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState className="m-4" title="Nenhum alerta nesta rodada." />
        )}
      </Card>
    </div>
  );
}

function Coluna({ titulo, tom, itens }: { titulo: string; tom: "success" | "danger"; itens: readonly string[] }) {
  return (
    <Card>
      <CardHeader
        title={
          <>
            <Badge variant={tom}>{titulo}</Badge> {itens.length}
          </>
        }
      />
      {itens.length ? (
        <ul className="list-disc space-y-1.5 py-4 pl-9 pr-5 text-sm">
          {itens.map((t, i) => (
            <li key={`${i}:${t}`}>{t}</li>
          ))}
        </ul>
      ) : (
        <EmptyState className="m-4" title="Nada nos dados desta rodada." />
      )}
    </Card>
  );
}

// A tela única de uma pessoa: a leitura, os prós e contras e a pauta para a conversa; e, só para
// quem vê NPS (admin e diretoria), as respostas dela (GER-05).
function TelaPessoa({
  nome,
  sub,
  leitura,
  l,
  respostas,
  mentorados,
  extra,
  voltar,
}: {
  nome: ReactNode;
  sub: ReactNode;
  leitura: string;
  l: Pick<LeituraMentor, "pros" | "contras" | "pontos_fortes" | "pontos_de_atencao"> & { sinais?: readonly string[]; pauta?: readonly string[] };
  respostas: NpsResposta[] | null;
  mentorados: readonly Mentorado[];
  extra?: ReactNode;
  voltar(): void;
}) {
  const sinais = sinaisDe(l);
  const pauta = pautaDe(l);
  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" onClick={voltar}>
          ← Voltar à lista
        </Button>
      </div>
      <Card>
        <div className="space-y-3 p-5">
          <h2 className="text-lg font-bold text-ink">{nome}</h2>
          <p className="text-xs text-muted">{sub}</p>
          <p className="text-sm">{leitura}</p>
          {sinais.length > 0 && <p className="text-xs text-muted">{`Sinais: ${sinais.join(" · ")}`}</p>}
          {extra}
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Coluna titulo="Prós" tom="success" itens={prosDe(l)} />
        <Coluna titulo="Contras" tom="danger" itens={contrasDe(l)} />
      </div>
      {pauta.length > 0 && (
        <Card>
          <CardHeader title="Pauta para a conversa" />
          <ol className="list-decimal space-y-1.5 py-4 pl-9 pr-5 text-sm">
            {pauta.map((t, i) => (
              <li key={`${i}:${t}`}>{t}</li>
            ))}
          </ol>
        </Card>
      )}
      {respostas && (
        <Card>
          <CardHeader title={`Respostas de NPS · ${respostas.length}`} />
          {respostas.length ? (
            <ul>
              {respostas.map((r) => (
                <li key={r.id} className="border-t border-line px-5 py-3 text-sm first:border-t-0">
                  <p className="flex flex-wrap items-center gap-2">
                    {fmtInstante(r.respondido_em)} · <Nota nota={r.nota} />
                    <span className="text-xs text-muted">{`${r.mentor || "—"} · ${mentorados.find((m) => m.id === r.mentorado_id)?.nome || r.nome_informado || "—"}`}</span>
                  </p>
                  {r.comentario && <p className="mt-1 whitespace-pre-line">{r.comentario}</p>}
                  <Perguntas r={r} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="m-4" title="Sem respostas na base." />
          )}
        </Card>
      )}
    </div>
  );
}

const BotaoDeLinha = ({ onClick, children }: { onClick(): void; children: ReactNode }) => (
  <Button variant="link" size="sm" onClick={onClick}>
    {children}
  </Button>
);

function PorMentor({ analise, nps, mentorados, sel, escolher }: { analise: Analise; nps: NpsResposta[]; mentorados: readonly Mentorado[]; sel: string; escolher(chave: string): void }) {
  const leituras = leiturasPorMentor(analise);
  if (!leituras.length) return <EmptyState title="Sem leitura por mentor nesta rodada." />;
  const escolhida = leituras.find((l) => chaveSelecaoMentor(l.mentor) === sel);
  if (escolhida) {
    const n = numerosDoMentor(nps, escolhida.mentor);
    return (
      <TelaPessoa
        nome={escolhida.mentor}
        sub={`Mentor · média ${n.respostas ? fmtMedia(n.media) : "—"} · NPS ${fmtNps(n.nps)} · ${n.respostas} resposta(s)`}
        leitura={escolhida.leitura}
        l={escolhida}
        respostas={npsDoMentor(nps, escolhida.mentor)}
        mentorados={mentorados}
        voltar={() => escolher("")}
      />
    );
  }
  const colunas: Column<LeituraMentor>[] = [
    { key: "mentor", header: "Mentor", render: (l) => <BotaoDeLinha onClick={() => escolher(chaveSelecaoMentor(l.mentor))}>{l.mentor}</BotaoDeLinha> },
    { key: "media", header: "Média", align: "right", render: (l) => fmtMedia(numerosDoMentor(nps, l.mentor).media) },
    { key: "nps", header: "NPS", align: "right", render: (l) => fmtNps(numerosDoMentor(nps, l.mentor).nps) },
    { key: "pros", header: "Prós", align: "right", render: (l) => prosDe(l).length },
    { key: "contras", header: "Contras", align: "right", render: (l) => contrasDe(l).length },
  ];
  return (
    <Card>
      <CardHeader title={`Mentores · ${leituras.length}`} />
      <DataTable columns={colunas} rows={leituras} rowKey={(l) => l.mentor} />
    </Card>
  );
}

function PorMentorado({
  analise,
  nps,
  mentorados,
  completa,
  sel,
  escolher,
}: {
  analise: Analise;
  nps: NpsResposta[];
  mentorados: readonly Mentorado[];
  completa: boolean;
  sel: string;
  escolher(chave: string): void;
}) {
  const leituras = leiturasPorMentorado(analise);
  if (!leituras.length) return <EmptyState title="Sem leitura por mentorado nesta rodada." />;
  const ficha = (l: LeituraMentorado) => (l.mentorado_id ? mentorados.find((m) => m.id === l.mentorado_id) : undefined);
  const escolhida = leituras.find((l) => chaveSelecaoMentorado(l) === sel);
  if (escolhida) {
    const f = ficha(escolhida);
    const { tom, rotulo } = riscoDe(escolhida.risco);
    return (
      <TelaPessoa
        nome={f ? <LinkFicha id={f.id}>{f.nome}</LinkFicha> : escolhida.mentorado}
        sub={
          <>
            {`Mentorado · mentor ${escolhida.mentor} · risco `}
            <Badge variant={tom}>{rotulo}</Badge>
          </>
        }
        leitura={escolhida.leitura}
        l={escolhida}
        respostas={completa ? npsDoMentorado(nps, escolhida) : null}
        mentorados={mentorados}
        extra={escolhida.acao_sugerida ? <p className="text-sm"><b>Próximo passo:</b> {escolhida.acao_sugerida}</p> : null}
        voltar={() => escolher("")}
      />
    );
  }
  const risco = contagemRisco(leituras);
  const colunas: Column<LeituraMentorado>[] = [
    { key: "nome", header: "Mentorado", render: (l) => <BotaoDeLinha onClick={() => escolher(chaveSelecaoMentorado(l))}>{ficha(l)?.nome ?? l.mentorado}</BotaoDeLinha> },
    { key: "mentor", header: "Mentor", render: (l) => l.mentor },
    {
      key: "nota",
      header: "Última nota",
      align: "right",
      render: (l) => {
        const dele = npsDoMentorado(nps, l);
        return dele.length ? (
          <>
            <Nota nota={dele[0].nota} /> <span className="text-xs text-muted">{`(${dele.length})`}</span>
          </>
        ) : (
          "—"
        );
      },
    },
    { key: "risco", header: "Risco", render: (l) => <Badge variant={riscoDe(l.risco).tom}>{riscoDe(l.risco).rotulo}</Badge> },
    { key: "pros", header: "Prós", align: "right", render: (l) => prosDe(l).length },
    { key: "contras", header: "Contras", align: "right", render: (l) => contrasDe(l).length },
  ];
  return (
    <Card>
      <CardHeader title={`Mentorados · ${leituras.length} · risco alto ${risco.alto} · médio ${risco.medio} · baixo ${risco.baixo}`} />
      <DataTable columns={colunas} rows={leituras} rowKey={(l) => chaveMentorado(l)} />
    </Card>
  );
}

function Corpo({ completa }: { completa: boolean }) {
  const { dados } = useDados();
  const { ui, mudar } = useUi();
  const { analise, nps, mentorados } = dados;
  if (!analise) return <EmptyState title={SEM_ANALISE} />;
  const aba = abaIaEfetiva(ui.filtro.iaAba, completa);
  const escolher = (iaSel: string) => mudar({ filtro: { ...ui.filtro, iaSel } });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[...abasIa(completa)]} value={aba} onChange={(v) => mudar({ filtro: { ...ui.filtro, iaAba: v, iaSel: "" } })} />
        <span className="text-xs text-muted">{`${fmtInstante(analise.gerado_em)} · ${analise.respostas} resposta(s) lidas · ${analise.modelo}`}</span>
      </div>
      {!completa && <p className="text-xs text-muted">Visão dos mentores: alertas sobre mentorados e sobre a mentoria, e a leitura de cada mentorado.</p>}
      {aba === "mentores" ? (
        <PorMentor analise={analise} nps={nps} mentorados={mentorados} sel={ui.filtro.iaSel} escolher={escolher} />
      ) : aba === "mentorados" ? (
        <PorMentorado analise={analise} nps={nps} mentorados={mentorados} completa={completa} sel={ui.filtro.iaSel} escolher={escolher} />
      ) : (
        <Alertas analise={analise} />
      )}
    </>
  );
}

export default function Ia() {
  const { pode } = useSessao();
  // Sem verFinanceiro é o recorte do mentor. DATA-07: cada recorte depende da sua relação (R19 ou
  // R21); as médias e o NPS vêm de R17, complementar, e a falha de R18 não é desta tela.
  const completa = pode("verFinanceiro");
  const essenciais: Relacao[] = [completa ? "nps_analises" : "analise_ia_mentor"];
  const complementares: Relacao[] = completa ? ["nps_respostas"] : [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Análise IA"
        subtitle={`Leitura do Claude sobre o NPS das sessões e a Pesquisa de Experiência. Roda todo dia às 8h, só quando chegou resposta nova.${completa ? "" : " Você vê o recorte dos mentores: sem o resumo, sem a leitura por mentor e sem as respostas de NPS."}`}
      />
      <AvisoRelacoes essenciais={essenciais} complementares={complementares}>
        <Corpo completa={completa} />
      </AvisoRelacoes>
    </div>
  );
}
