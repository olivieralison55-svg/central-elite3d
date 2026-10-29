"use client";

import { useState } from "react";

import { AvisoRelacoes } from "@/components/shell/dados";
import { useDados, useSessao } from "@/components/shell/contexto";
import Badge from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import SegmentedControl from "@/components/ui/segmented-control";
import Select from "@/components/ui/select";
import StatCard from "@/components/ui/stat-card";
import { dpLabel, fmtD, hojeSP } from "@/lib/datas";
import {
  calendario,
  competenciaAtual,
  ESTADO_LABEL,
  ESTADO_TOM,
  estadoDe,
  foraDoPrazo,
  mesAnterior,
  passoDoDia,
  semMentorNoMes,
  sessoesDoMes,
} from "@/lib/faturamento";
import { fmtBRL } from "@/lib/moeda";

import Conferencia from "./conferencia";
import EnvioMentor from "./envio-mentor";

// /faturamento: a validação mensal do faturamento dos mentores. O mentor envia o próprio mês; o
// admin confere e fecha; a diretoria acompanha. A regra mora em src/lib/faturamento.ts.

const RELACOES = ["validacao_faturamento", "faixas_remuneracao"] as const;
const COMPLEMENTARES = ["validacao_lojas", "validacao_eventos", "mentor_lojas"] as const;
const MODOS = ["Conferência", "Lançar dados"] as const;

// O mês em processo e os cinco anteriores.
const competencias = (hoje: string) => {
  const meses = [competenciaAtual(hoje)];
  while (meses.length < 6) meses.push(mesAnterior(meses[meses.length - 1]));
  return meses;
};

function Calendario({ competencia }: { competencia: string }) {
  const cal = calendario(competencia);
  const passo = passoDoDia(cal, hojeSP());
  const dia = (d: string) => fmtD(d).slice(0, 5);
  const etapas = [
    { titulo: "D1 até 12h", texto: `Mentor envia · ${dia(cal.envio)}` },
    { titulo: "D2 e D3", texto: `Conferência · ${dia(cal.conferencia[0])} e ${dia(cal.conferencia[1])}` },
    { titulo: "Até D4", texto: `Meets e fechamento · ${dia(cal.fechamento)}` },
    { titulo: "D5", texto: `Pagamento · ${dia(cal.pagamento)}` },
  ];
  // D2 e D3 são um passo só na régua.
  const aceso = passo <= 1 ? passo : passo <= 3 ? 2 : passo - 1;
  return (
    <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {etapas.map((e, i) => (
        <li key={e.titulo} className={`border-t-4 pt-2 ${i + 1 < aceso ? "border-success" : i + 1 === aceso ? "border-warning" : "border-line"}`}>
          <p className="text-sm font-semibold text-ink">{e.titulo}</p>
          <p className="text-xs text-muted">{e.texto}</p>
        </li>
      ))}
    </ol>
  );
}

function Painel({ competencia }: { competencia: string }) {
  const { dados } = useDados();
  const cal = calendario(competencia);
  const agora = new Date();
  const linhaDe = (mentor: string) => dados.validacoes.find((v) => v.mentor === mentor && v.competencia.startsWith(competencia)) ?? null;
  // Os mentores atuais, mais quem tiver linha no mês (um mentor que saiu ainda fecha o último mês).
  const nomes = [...new Set([...dados.mentores, ...dados.validacoes.filter((v) => v.competencia.startsWith(competencia)).map((v) => v.mentor)])];
  const [sel, setSel] = useState<string>(nomes[0] ?? "");
  // O admin alterna entre conferir e lançar no lugar do mentor; o modo fica ao trocar de mentor.
  const { pode } = useSessao();
  const [modo, setModo] = useState<(typeof MODOS)[number]>("Conferência");
  const linhas = nomes.map((mentor) => {
    const v = linhaDe(mentor);
    const s = sessoesDoMes(dados.sessoes, mentor, competencia);
    return { mentor, v, estado: estadoDe(v), fora: foraDoPrazo(v, cal, agora), pagas: s.pagas.length, pendentes: s.pendentes.length };
  });
  const enviados = linhas.filter((l) => l.estado !== "aguardando" && l.estado !== "rascunho").length;
  const semMentor = semMentorNoMes(dados.sessoes, competencia).length;
  const aPagar = dados.validacoes.filter((v) => v.competencia.startsWith(competencia) && v.estado === "validado").reduce((t, v) => t + (Number(v.valor_pagar) || 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Enviados" value={`${enviados} / ${linhas.length}`} />
        <StatCard label="Ajuste pedido" value={linhas.filter((l) => l.estado === "ajuste_pedido").length} />
        <StatCard label="Fora do prazo" value={linhas.filter((l) => l.fora && l.estado !== "validado" && l.estado !== "pago").length} />
        <StatCard label="A pagar (validados)" value={fmtBRL(aPagar)} />
      </div>
      {semMentor > 0 && (
        <p className="text-sm text-warning">{`${semMentor} sessão(ões) individual(is) concluída(s) no mês sem mentor: não serão pagas a ninguém até alguém corrigir em Sessões.`}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="h-fit">
          <ul className="divide-y divide-line">
            {linhas.map((l) => (
              <li key={l.mentor}>
                <button
                  type="button"
                  onClick={() => setSel(l.mentor)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm ${sel === l.mentor ? "bg-selected" : "hover:bg-selected/60"}`}
                >
                  <span className="flex flex-col">
                    <span className="font-semibold text-ink">{l.mentor}</span>
                    <span className="text-xs text-muted">{`${l.pagas} sessão(ões)${l.pendentes ? ` · ${l.pendentes} a confirmar` : ""}`}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge variant={ESTADO_TOM[l.estado]}>{ESTADO_LABEL[l.estado]}</Badge>
                    {l.fora && l.estado !== "validado" && l.estado !== "pago" && <span className="text-xs text-danger">fora do prazo</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {sel ? (
          <div className="space-y-4">
            {pode("conferirFaturamento") && <SegmentedControl items={MODOS} value={modo} onChange={setModo} />}
            {modo === "Lançar dados" && pode("conferirFaturamento") ? (
              <EnvioMentor key={`${sel}|${competencia}|lancar`} mentor={sel} competencia={competencia} pelaOperacao />
            ) : (
              <Conferencia key={`${sel}|${competencia}`} mentor={sel} competencia={competencia} />
            )}
          </div>
        ) : (
          <EmptyState title="Escolha um mentor" />
        )}
      </div>
    </div>
  );
}

export default function Faturamento() {
  const { papel, perfil } = useSessao();
  const hoje = hojeSP();
  const meses = competencias(hoje);
  const [competencia, setCompetencia] = useState(meses[0]);
  const ehMentor = papel === "mentor";
  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Validação de faturamento"
        subtitle={ehMentor ? "Envie os relatórios das suas lojas e acompanhe o fechamento do mês" : "Envio, conferência e fechamento mensal dos mentores"}
        actions={
          <div className="w-44">
            <Select options={meses.map((m) => ({ value: m, label: `Competência ${dpLabel(m, "month")}` }))} value={competencia} onChange={setCompetencia} />
          </div>
        }
      />
      <Calendario competencia={competencia} />
      <AvisoRelacoes essenciais={[...RELACOES]} complementares={[...COMPLEMENTARES]}>
        {ehMentor ? (
          perfil.mentor_nome ? (
            <EnvioMentor key={competencia} mentor={perfil.mentor_nome} competencia={competencia} />
          ) : (
            <EmptyState title="Seu login ainda não está ligado a um mentor" description="Peça ao administrador para ligar o seu usuário ao seu nome nas sessões." />
          )
        ) : (
          <Painel competencia={competencia} />
        )}
      </AvisoRelacoes>
    </div>
  );
}
