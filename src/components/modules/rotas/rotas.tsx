"use client";

import { useState } from "react";

import CampoMoeda from "@/components/modules/comum/campo-moeda";
import { CabecalhoOrdenavel, ordemEscolhida } from "@/components/modules/comum/ordenacao";
import { BotaoNovoMentorado } from "@/components/modules/mentorados/novo-mentorado";
import { useDados, useSessao, useUi } from "@/components/shell/contexto";
import { AvisoRelacoes } from "@/components/shell/dados";
import { useEscrita } from "@/components/shell/use-escrita";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import Checkbox from "@/components/ui/checkbox";
import CollapsibleSection from "@/components/ui/collapsible-section";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import LineChart from "@/components/ui/line-chart";
import PageHeader from "@/components/ui/page-header";
import Progress from "@/components/ui/progress";
import SectionLabel from "@/components/ui/section-label";
import Select from "@/components/ui/select";
import StatCard from "@/components/ui/stat-card";
import Textarea from "@/components/ui/textarea";
import TrendChart from "@/components/ui/trend-chart";
import type { Canal, Faturamento, MarcoDef, MentoradoMarco, Relacao, Rota } from "@/lib/data/esquemas";
import { excluirFaturamento, salvarCanalMentorado, salvarFaturamento, salvarMarco } from "@/lib/data/escritas";
import { fmtD, hojeSP, mesDe } from "@/lib/datas";
import { fmtBRL, lerBRL } from "@/lib/moeda";
import { ehAtivo, nomeDe } from "@/lib/mentorados";
import { aplicarOrdem } from "@/lib/ordem";
import {
  type CamposEvolucao,
  camposDoMarco,
  canaisDaRota,
  criteriosDe,
  ehSimples,
  estadoDoMarco,
  type Fase,
  marcosDaRota,
  metaDoMarco,
  montarEvolucao,
  portoesDe,
  progressoDe,
  progressoMarco,
  reguaFaturamento,
  resumoFaturamento,
  rotaEscolhida,
  rotuloDoMes,
  rotuloDoStatus,
  serieDeMarcos,
  statusDaRota,
  textoVariacao,
  ultimosMeses,
} from "@/lib/rotas";

import CampoMes from "./campo-mes";
import EscolherMentorado, { mentoradoMostrado } from "./escolher-mentorado";

// A tela Rotas (renderRotas, index.html:2321–2606; mapeamento §3.7). As regras moram em
// src/lib/rotas.ts; aqui só se desenha o que elas devolvem. R07 a R12 são essenciais: sem uma
// delas a tela não tem o que mostrar (DATA-07).
const ESSENCIAIS: Relacao[] = ["rotas", "marcos_definicao", "mentorado_marcos", "faturamento_mensal", "canais", "mentorado_canais"];

const TABELA_FATURAMENTO = "rota_fat";
const ANOS_ANTES = 5;

const MARCA: Record<Fase, { texto: string; classe: string }> = {
  feito: { texto: "✓", classe: "bg-success-accent text-white" },
  atual: { texto: "●", classe: "bg-primary text-white" },
  futuro: { texto: "", classe: "border border-line-strong bg-background" },
};

function Bloco({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-ink">{titulo}</h4>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </div>
  );
}

function Lista({ titulo, itens, chips = false }: { titulo: string; itens: readonly string[]; chips?: boolean }) {
  if (!itens.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-ink">{titulo}</h4>
      {chips ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {itens.map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </div>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
          {itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// O painel do marco aberto (painelMarco, index.html:2252–2308). O conteúdo do Compilado das Rotas
// fica embaixo do próprio marco: o mentor lê a restrição e os apoios enquanto marca o teste de
// passagem. O que se digita e se marca é estado deste painel: marcar um critério muda só o
// contador e a barra, sem fechar nada nem perder o campo ainda não salvo (OPS-16).
function PainelMarco({ rota, marco, registro, mentoradoId, regua, porMes }: { rota: Rota; marco: MarcoDef; registro: MentoradoMarco | undefined; mentoradoId: string; regua: number; porMes: boolean }) {
  const { pode } = useSessao();
  const editar = pode("escreverRotas");
  const simples = ehSimples(rota);
  const [campos, setCampos] = useState(() => camposDoMarco(rota, registro));
  const { executar, ocupado } = useEscrita("escreverRotas", (c: CamposEvolucao) => salvarMarco(mentoradoId, marco.id, montarEvolucao(rota, marco, c)), "Evolução registrada");
  const mudar = (parcial: Partial<CamposEvolucao>) => setCampos((atual) => ({ ...atual, ...parcial }));
  const alternar = (item: string) => {
    const marcados = new Set(campos.marcados);
    if (!marcados.delete(item)) marcados.add(item);
    mudar({ marcados });
  };
  const portoes = portoesDe(marco);
  const progresso = progressoDe(criteriosDe(marco), campos.marcados);
  const meta = metaDoMarco(marco, regua);
  const id = `mk-${marco.id}`;
  return (
    <div className="space-y-4">
      {marco.subtitulo && <p className="text-sm text-ink">{marco.subtitulo}</p>}
      {meta && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-8 bg-sub-bg px-3 py-2 text-sm text-muted">
          <span>
            {porMes ? "Faturamento do mês" : "Acumulado na rota"}: <b className="text-ink">{fmtBRL(regua)}</b>
          </span>
          <span>
            Meta do marco: <b className="text-ink">{fmtBRL(meta.meta)}</b>
          </span>
          <span>{meta.falta > 0 ? <>Falta <b className="text-ink">{fmtBRL(meta.falta)}</b></> : <b className="text-ink">Meta atingida</b>}</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Bloco titulo="Restrição" texto={marco.restricao} />
        <Bloco titulo="Alavanca" texto={marco.alavanca} />
        <Bloco titulo="Pergunta-chave" texto={marco.pergunta_chave} />
      </div>
      <Lista titulo="Apoios" itens={marco.apoios} />
      <Lista titulo="Indicadores" itens={marco.indicadores} chips />
      {portoes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-ink">Teste de passagem</h4>
          {portoes.map((portao, i) => (
            <div key={i} className="space-y-1.5">
              {portao.grupo && <p className="text-xs font-semibold text-muted">{portao.grupo}</p>}
              {portao.itens.map((item) => (
                <div key={item}>
                  <Checkbox label={item} checked={campos.marcados.has(item)} disabled={!editar} onChange={() => alternar(item)} />
                </div>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Progress value={progresso.pct ?? 0} label={`${progresso.feitos} de ${progresso.total} critérios`} />
            <b className="whitespace-nowrap text-xs text-ink">{`${progresso.feitos} de ${progresso.total}`}</b>
          </div>
        </div>
      )}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-ink">Registro do mentor</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Status" htmlFor={`${id}-status`}>
            <Select id={`${id}-status`} options={statusDaRota(rota)} value={campos.status} disabled={!editar} onChange={(status) => mudar({ status })} />
          </FormField>
          <FormField label="Data de conclusão" htmlFor={`${id}-data`}>
            <Input id={`${id}-data`} type="date" value={campos.data} disabled={!editar} onChange={(e) => mudar({ data: e.target.value })} />
          </FormField>
          {!simples && (
            <>
              <FormField label="Próxima ação" htmlFor={`${id}-acao`}>
                <Input id={`${id}-acao`} value={campos.proximaAcao} placeholder="a ação concreta até a próxima sessão" disabled={!editar} onChange={(e) => mudar({ proximaAcao: e.target.value })} />
              </FormField>
              <FormField label="Bloqueios (um por linha)" htmlFor={`${id}-bloqueios`}>
                <Textarea id={`${id}-bloqueios`} minRows={2} value={campos.bloqueios} disabled={!editar} onChange={(e) => mudar({ bloqueios: e.target.value })} />
              </FormField>
            </>
          )}
        </div>
        {editar && (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" loading={ocupado} data-escrita="W09" onClick={() => void executar(campos).catch((erro: unknown) => console.error("[central-elite3d] salvar marco", erro))}>
              Salvar evolução
            </Button>
            <span className="text-xs text-muted">Os critérios pendentes e o progresso saem do teste de passagem.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Um marco no stepper (index.html:2415–2441): a marca da fase e uma linha que abre o painel. Um
// marco aberto por vez: dois painéis abertos poderiam trocar o que se digita num pelo outro
// (OPS-17), e quem manda é `marcoAberto`, do estado de tela.
function Etapa({ rota, marco, registro, aberto, aoAbrir, painel }: { rota: Rota; marco: MarcoDef; registro: MentoradoMarco | undefined; aberto: boolean; aoAbrir(id: string): void; painel: React.ReactNode }) {
  const { status, fase } = estadoDoMarco(rota, registro);
  const progresso = progressoMarco(marco, registro);
  const hint = [rotuloDoStatus(rota, status), registro?.data ? fmtD(registro.data) : "", marco.objetivo, progresso.total ? `${progresso.feitos}/${progresso.total}` : ""].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className={`mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${MARCA[fase].classe}`}>
        {MARCA[fase].texto}
      </span>
      <div className="min-w-0 flex-1 rounded-8 border border-line">
        <CollapsibleSection
          id={marco.id}
          title={marco.nome ?? ""}
          icon={marco.placa ? <Badge variant="purple">PLACA</Badge> : undefined}
          hint={hint}
          open={aberto}
          onToggle={aoAbrir}
        >
          {painel}
        </CollapsibleSection>
      </div>
    </li>
  );
}

// O canal de venda do mentorado na rota (W06), só quando a rota tem mais de um canal.
function CanalDeVenda({ rota, canais, mentoradoId, salvo, aoSalvar }: { rota: Rota; canais: Canal[]; mentoradoId: string; salvo: string; aoSalvar(canalId: string): void }) {
  const { pode } = useSessao();
  const [escolhido, setEscolhido] = useState(salvo);
  const { executar, ocupado } = useEscrita("escreverRotas", (canalId: string) => salvarCanalMentorado(mentoradoId, rota.id, canalId), "Canal de venda salvo");
  const gravar = async () => {
    if (await executar(escolhido)) aoSalvar(escolhido);
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormField label="Canal de venda deste mentorado" htmlFor="rota-canal-mentorado" className="w-64">
        <Select id="rota-canal-mentorado" options={canais.map((c) => ({ value: c.id, label: c.nome ?? "" }))} value={escolhido} onChange={setEscolhido} />
      </FormField>
      {pode("escreverRotas") && (
        <Button variant="outline" size="sm" loading={ocupado} data-escrita="W06" onClick={() => void gravar().catch((erro: unknown) => console.error("[central-elite3d] salvar canal", erro))}>
          Salvar
        </Button>
      )}
    </div>
  );
}

// "Registrar faturamento" (W07): o mês e o valor, no canal aberto.
function RegistrarFaturamento({ mentoradoId, canalId, anos }: { mentoradoId: string; canalId: string; anos: number[] }) {
  const [mes, setMes] = useState(() => hojeSP().slice(0, 7));
  const [valor, setValor] = useState("");
  const { executar, ocupado } = useEscrita("escreverRotas", (m: string, v: number | null) => salvarFaturamento(mentoradoId, m, canalId, v), "Faturamento registrado");
  return (
    <Card className="space-y-3 p-5">
      <SectionLabel as="h3">Registrar faturamento</SectionLabel>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Mês de referência" htmlFor="ft-mes-mes">
          <CampoMes id="ft-mes" value={mes} onChange={setMes} anos={anos} />
        </FormField>
        <FormField label="Valor (R$)" htmlFor="ft-valor">
          <CampoMoeda id="ft-valor" placeholder="R$ 0,00" value={valor} onChange={setValor} />
        </FormField>
        <Button loading={ocupado} data-escrita="W07" onClick={() => void executar(mes, lerBRL(valor)).catch((erro: unknown) => console.error("[central-elite3d] salvar faturamento", erro))}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}

// Os registros do canal, do mês mais recente ao mais antigo até a pessoa ordenar. Excluir pede
// confirmação num ConfirmDialog (W08; UI-05).
function RegistrosFaturamento({ registros }: { registros: Faturamento[] }) {
  const { ui } = useUi();
  const { pode } = useSessao();
  const [excluindo, setExcluindo] = useState<Faturamento | null>(null);
  const excluir = useEscrita("excluir", (id: string) => excluirFaturamento(id), "Registro excluído");
  const linhas = aplicarOrdem(registros, ordemEscolhida(ui, TABELA_FATURAMENTO) ?? { campo: "mes", direcao: "desc" }, { mes: (f) => f.mes, valor: (f) => Number(f.valor) });
  const colunas: Column<Faturamento>[] = [
    { key: "mes", header: <CabecalhoOrdenavel tabela={TABELA_FATURAMENTO} campo="mes" rotulo="Mês" />, render: (f) => rotuloDoMes(mesDe(f.mes)) },
    { key: "valor", header: <CabecalhoOrdenavel tabela={TABELA_FATURAMENTO} campo="valor" rotulo="Valor" />, align: "right", render: (f) => fmtBRL(f.valor) },
    ...(pode("excluir")
      ? [
          {
            key: "excluir",
            header: "",
            align: "right" as const,
            render: (f: Faturamento) => (
              <Button variant="ghost" size="sm" data-escrita="W08" onClick={() => setExcluindo(f)}>
                Excluir
              </Button>
            ),
          },
        ]
      : []),
  ];
  const confirmar = async () => {
    if (excluindo && (await excluir.executar(excluindo.id))) setExcluindo(null);
  };
  return (
    <Card>
      <CardHeader title="Registros" />
      {linhas.length ? <DataTable columns={colunas} rows={linhas} rowKey={(f) => f.id} /> : <EmptyState title="Nenhum registro ainda." className="m-4" />}
      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir registro"
        description={excluindo ? `Excluir o faturamento de ${rotuloDoMes(mesDe(excluindo.mes))} (${fmtBRL(excluindo.valor)})? A ação não pode ser desfeita.` : ""}
        confirmLabel="Excluir registro"
        busy={excluir.ocupado}
        onConfirm={() => void confirmar().catch((erro: unknown) => console.error("[central-elite3d] excluir faturamento", erro))}
        onClose={() => setExcluindo(null)}
      />
    </Card>
  );
}

function Faturamentos({ canal, mentoradoId, meses, anos }: { canal: Canal; mentoradoId: string; meses: string[]; anos: number[] }) {
  const { dados } = useDados();
  const { pode } = useSessao();
  const registros = dados.faturamento.filter((f) => f.mentorado_id === mentoradoId && f.canal_id === canal.id);
  const { porMes, atual, anterior, variacao } = resumoFaturamento(registros, meses);
  // O eixo e o tooltip em real cheio (R$ 1.000,00), o mesmo formato dos cards, sem abreviar para "R$ 10k".
  const pontos = meses.map((mes, i) => ({ key: mes, label: rotuloDoMes(mes), value: porMes[i], ratio: null, tooltip: `${rotuloDoMes(mes)} — ${fmtBRL(porMes[i])}` }));
  return (
    <section aria-label={`Faturamento · ${canal.nome ?? ""}`} className="space-y-4">
      <SectionLabel as="h2">{`Faturamento · ${canal.nome ?? ""}`}</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Faturamento do mês" value={fmtBRL(atual)} caption={textoVariacao(variacao)} />
        <StatCard label="Mês anterior" value={fmtBRL(anterior)} caption="referência de comparação" />
      </div>
      <Card>
        <CardHeader title={`Evolução mensal · ${nomeDe(dados.mentorados, mentoradoId)}`} />
        <div className="p-4" role="group" aria-label={`Faturamento mensal de ${nomeDe(dados.mentorados, mentoradoId)} no canal ${canal.nome ?? ""}`}>
          <TrendChart points={pontos} view="bar" ratioLabel="" hint="Faturamento do canal nos últimos 12 meses." />
        </div>
      </Card>
      {pode("escreverRotas") && <RegistrarFaturamento key={`${mentoradoId}:${canal.id}`} mentoradoId={mentoradoId} canalId={canal.id} anos={anos} />}
      <RegistrosFaturamento registros={registros} />
    </section>
  );
}

function Conteudo() {
  const { dados } = useDados();
  const { ui, mudar } = useUi();
  const [canalAtual, setCanalAtual] = useState<string | null>(null);
  const [canaisAbertos, setCanaisAbertos] = useState(false);
  const rota = rotaEscolhida(dados.rotas, ui.rotaAtual);
  if (!rota) return <EmptyState title="Nenhuma rota cadastrada." />;

  const hoje = hojeSP();
  const meses = ultimosMeses(hoje);
  const anos = Array.from({ length: ANOS_ANTES + 2 }, (_, i) => Number(hoje.slice(0, 4)) - ANOS_ANTES + i);
  const marcos = marcosDaRota(dados.marcos, rota);
  const canais = canaisDaRota(dados.canais, rota);
  const canal = canais.find((c) => c.id === canalAtual) ?? canais[0];
  const ativos = dados.mentorados.filter(ehAtivo);
  const sel = mentoradoMostrado(ativos, ui.rotaMentoradoId);
  const regua = sel ? reguaFaturamento(rota, canais, dados.faturamento, sel, meses[meses.length - 1]) : 0;
  const canalDoMentorado = dados.mentoradoCanais.find((x) => x.mentorado_id === sel && x.rota_id === rota.id);
  const registroDe = (marco: MarcoDef) => dados.mentoradoMarcos.find((x) => x.mentorado_id === sel && x.marco_id === marco.id);
  const abrir = (id: string) => mudar({ marcoAberto: ui.marcoAberto === id ? null : id });
  const series = serieDeMarcos(marcos, dados.mentoradoMarcos, rota, meses).map(({ marco, pontos }) => ({
    value: marco.id,
    label: marco.nome ?? "",
    points: pontos,
    current: pontos.reduce((soma, n) => soma + n, 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rotas"
        subtitle="Marcos, canais e faturamento por rota"
        actions={
          <>
            <div className="w-52">
              <label htmlFor="rota-atual" className="sr-only">
                Rota
              </label>
              <Select
                id="rota-atual"
                options={dados.rotas.map((r) => ({ value: r.slug ?? "", label: r.nome ?? "" }))}
                value={rota.slug ?? ""}
                onChange={(slug) => {
                  mudar({ rotaAtual: slug });
                  setCanalAtual(null);
                }}
              />
            </div>
            <BotaoNovoMentorado secundario />
          </>
        }
      />

      {canais.length > 1 && (
        <Card>
          <CollapsibleSection id="canais" title={`Canal de ${rota.nome ?? ""} · ${canal?.nome ?? "—"}`} open={canaisAbertos} onToggle={() => setCanaisAbertos((aberto) => !aberto)}>
            <div className="flex flex-wrap gap-2">
              {canais.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={c.id === canal?.id ? "primary" : "outline"}
                  onClick={() => {
                    setCanalAtual(c.id);
                    setCanaisAbertos(false);
                  }}
                >
                  {c.nome}
                </Button>
              ))}
            </div>
          </CollapsibleSection>
        </Card>
      )}

      <Card>
        <CardHeader title={`Evolução mensal de marcos · ${rota.nome ?? ""}`} />
        <section aria-label={`Linha do tempo mensal de marcos concluídos na rota ${rota.nome ?? ""}`} className="p-4">
          {marcos.length ? <LineChart ticks={meses.map((mes) => ({ key: mes, label: rotuloDoMes(mes) }))} series={series} /> : <EmptyState title="Marcos desta rota ainda não foram definidos." />}
        </section>
      </Card>

      <Card>
        <CardHeader title="Progresso por mentorado" />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <EscolherMentorado
              ativos={ativos}
              escolhidoId={sel}
              termo={ui.filtro.qRotas}
              onTermo={(qRotas) => mudar({ filtro: { ...ui.filtro, qRotas } })}
              onEscolher={(id) => mudar({ rotaMentoradoId: id, filtro: { ...ui.filtro, qRotas: "" } })}
            />
            {sel && (
              <p role="status" className="text-sm text-muted">
                Mostrando: <b className="text-ink">{nomeDe(dados.mentorados, sel)}</b>
              </p>
            )}
          </div>
          {canais.length > 1 && sel && (
            <CanalDeVenda key={`${rota.id}:${sel}`} rota={rota} canais={canais} mentoradoId={sel} salvo={canalDoMentorado?.canal_id ?? canal?.id ?? ""} aoSalvar={setCanalAtual} />
          )}
          {sel && marcos.length > 0 ? (
            <ol className="space-y-2">
              {marcos.map((marco) => (
                <Etapa
                  key={marco.id}
                  rota={rota}
                  marco={marco}
                  registro={registroDe(marco)}
                  aberto={ui.marcoAberto === marco.id}
                  aoAbrir={abrir}
                  painel={
                    <PainelMarco key={`${sel}:${marco.id}`} rota={rota} marco={marco} registro={registroDe(marco)} mentoradoId={sel} regua={regua} porMes={rota.unidade === "mes"} />
                  }
                />
              ))}
            </ol>
          ) : (
            <EmptyState title={sel ? "Marcos desta rota ainda não foram definidos." : "Nenhum mentorado ativo."} />
          )}
        </div>
      </Card>

      {canal && sel && <Faturamentos key={`${rota.id}:${canal.id}:${sel}`} canal={canal} mentoradoId={sel} meses={meses} anos={anos} />}
    </div>
  );
}

export default function Rotas() {
  return (
    <AvisoRelacoes essenciais={ESSENCIAIS}>
      <Conteudo />
    </AvisoRelacoes>
  );
}
