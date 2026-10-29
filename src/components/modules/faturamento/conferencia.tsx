"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useDados, useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Alert from "@/components/ui/alert";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import Checkbox from "@/components/ui/checkbox";
import Dialog from "@/components/ui/dialog";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/textarea";
import type { Validacao } from "@/lib/data/esquemas";
import { abrirValidacao, marcarPago, registrarEvento, salvarConferencia, validarMes } from "@/lib/data/escritas";
import { linksRelatorios } from "@/lib/data/leituras";
import { dpLabel, fmtD, fmtInstante, hojeSP } from "@/lib/datas";
import {
  bloqueiosDaValidacao,
  calendario,
  CHECKLIST_CONFERENCIA,
  cicloDePromocao,
  elegivelDasLojas,
  ESTADO_LABEL,
  ESTADO_TOM,
  estadoDe,
  faixaDe,
  faixaPorId,
  faixasOrdenadas,
  faixaVigente,
  faltaParaProxima,
  fechado,
  foraDoPrazo,
  MEET_MOTIVO_LABEL,
  montarFechamento,
  sessoesDoMes,
  sugestao,
  type Sugestao,
  valorHora,
} from "@/lib/faturamento";
import { nomeDe } from "@/lib/mentorados";
import { fmtBRL } from "@/lib/moeda";
import { semMarcador } from "@/lib/marcador";

// A conferência de um mês de um mentor (admin), e o resumo do mês que o mentor também vê.

const nomeFaixa = (id: number | null | undefined, faixas: Parameters<typeof faixaPorId>[1]) => {
  const f = faixaPorId(id, faixas);
  return f ? `${fmtBRL(f.valor_hora)}/h` : "—";
};

const TEXTO_SUGESTAO = (s: Sugestao, faixas: Parameters<typeof faixaPorId>[1]): string => {
  switch (s.tipo) {
    case "promocao":
      return `3 meses seguidos acima da faixa: promoção para ${nomeFaixa(s.faixaSeguinte, faixas)} a partir do mês seguinte, depois do Meet de promoção.`;
    case "rebaixamento":
      return `Mês abaixo do piso da faixa: reclassificação para ${nomeFaixa(s.faixaSeguinte, faixas)} nas sessões futuras, após a comunicação ao mentor.`;
    case "foraDaTabela":
      return "Elegível abaixo de R$ 10.000: fora da tabela. Decida com a operação antes de validar.";
    case "inicial":
      return "Primeiro mês do mentor: escolha a faixa inicial (cadastro inicial, com Meet).";
    default:
      return "Faixa mantida no mês seguinte.";
  }
};

// O que o mês rende: elegível, faixa, ciclo e sessões. Igual para o mentor e para o admin.
export function useResumoDoMes(mentor: string, competencia: string) {
  const { dados } = useDados();
  const v = dados.validacoes.find((x) => x.mentor === mentor && x.competencia.startsWith(competencia)) ?? null;
  const lojas = v ? dados.validacaoLojas.filter((l) => l.validacao_id === v.id) : [];
  const elegivel = v?.faturamento_elegivel !== null && v?.faturamento_elegivel !== undefined && fechado(v) ? Number(v.faturamento_elegivel) : elegivelDasLojas(lojas);
  const faixaMes = faixaDe(elegivel, dados.faixas);
  const vigente = faixaVigente(dados.validacoes, mentor, competencia, v);
  const sug = sugestao(dados.validacoes, mentor, competencia, vigente, faixaMes?.id ?? null, dados.faixas);
  const ciclo = cicloDePromocao(dados.validacoes, mentor, competencia, vigente, dados.faixas);
  const sessoes = sessoesDoMes(dados.sessoes, mentor, competencia);
  const pagas = fechado(v) ? (v?.sessoes_qtd ?? 0) : sessoes.pagas.length;
  const hora = fechado(v) ? Number(v?.valor_hora) || 0 : valorHora(faixaPorId(vigente, dados.faixas));
  return { v, lojas, elegivel, faixaMes, vigente, sug, ciclo, sessoes, pagas, hora, valor: fechado(v) ? Number(v?.valor_pagar) || 0 : hora * pagas };
}

export function ResumoDoMes({ mentor, competencia }: { mentor: string; competencia: string }) {
  const { dados } = useDados();
  const r = useResumoDoMes(mentor, competencia);
  const [aberto, setAberto] = useState(false);
  const prox = faltaParaProxima(r.elegivel, r.faixaMes, dados.faixas);
  return (
    <Card>
      <CardHeader title="Resumo do mês" />
      <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
        <dt className="text-muted">Faturamento elegível</dt>
        <dd className="font-semibold text-ink">{fmtBRL(r.elegivel)}</dd>
        <dt className="text-muted">Faixa deste mês</dt>
        <dd className="text-ink">{r.faixaMes ? `${fmtBRL(r.faixaMes.valor_hora)}/h` : "Fora da tabela"}</dd>
        <dt className="text-muted">Faixa vigente (paga neste mês)</dt>
        <dd className="text-ink">{r.vigente ? nomeFaixa(r.vigente, dados.faixas) : "A definir"}</dd>
        {prox && (
          <>
            <dt className="text-muted">Próxima faixa</dt>
            <dd className="text-ink">{`faltam ${fmtBRL(prox.falta)} para ${fmtBRL(prox.faixa.valor_hora)}/h`}</dd>
          </>
        )}
        <dt className="text-muted">Ciclo de promoção</dt>
        <dd className="flex flex-wrap gap-1">
          {r.ciclo.map((c) => (
            <Badge key={c.competencia} variant={c.acima === null ? "neutral" : c.acima ? "success" : "warning"}>
              {`${dpLabel(c.competencia, "month")} ${c.acima === null ? "?" : c.acima ? "✓" : "—"}`}
            </Badge>
          ))}
        </dd>
        <dt className="text-muted">Sessões individuais pagas</dt>
        <dd className="text-ink">
          <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setAberto(true)}>
            {`${r.pagas} × ${fmtBRL(r.hora)} = ${fmtBRL(r.valor)}`}
          </button>
        </dd>
        {r.sessoes.pendentes.length > 0 && (
          <>
            <dt className="text-muted">Aguardando confirmação</dt>
            <dd className="text-warning">{`${r.sessoes.pendentes.length} — confirme em Sessões antes do fechamento`}</dd>
          </>
        )}
        {r.sessoes.faltas.length > 0 && (
          <>
            <dt className="text-muted">Faltas do mentorado</dt>
            <dd className="text-ink">{`${r.sessoes.faltas.length} (não pagas)`}</dd>
          </>
        )}
      </dl>
      <p className="border-t border-line px-4 py-3 text-sm text-ink">{TEXTO_SUGESTAO(r.sug, dados.faixas)}</p>
      <Dialog open={aberto} onClose={() => setAberto(false)} title={`Sessões de ${mentor} · ${dpLabel(competencia, "month")}`}>
        <ul className="divide-y divide-line text-sm">
          {[...r.sessoes.pagas, ...r.sessoes.pendentes, ...r.sessoes.faltas]
            .sort((a, b) => ((a.data ?? "") < (b.data ?? "") ? -1 : 1))
            .map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2">
                <span>{`${fmtD(s.data)} · ${semMarcador(nomeDe(dados.mentorados, s.mentorado_id))} · ${s.etapa ?? ""}`}</span>
                <span className={s.status === "Concluída" ? "text-success" : s.status === "Não compareceu" ? "text-muted" : "text-warning"}>{s.status}</span>
              </li>
            ))}
        </ul>
      </Dialog>
    </Card>
  );
}

function Relatorios({ v }: { v: Validacao }) {
  const { dados } = useDados();
  const lojas = dados.validacaoLojas.filter((l) => l.validacao_id === v.id);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const caminhos = lojas.map((l) => l.arquivo_path).filter((c): c is string => !!c);
  const chave = caminhos.join("|");
  useEffect(() => {
    if (!chave) return;
    void linksRelatorios(chave.split("|")).then((r) => r.ok && setLinks(r.dados));
  }, [chave]);
  if (lojas.length === 0) return <p className="p-4 text-sm text-muted">Nenhuma loja informada.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-2">Loja</th>
            <th className="px-2 py-2">Período</th>
            <th className="px-2 py-2 text-right">Vendas</th>
            <th className="px-2 py-2 text-right">Pedidos</th>
            <th className="px-2 py-2 text-right">Deduções</th>
            <th className="px-2 py-2 text-right">Elegível</th>
            <th className="px-4 py-2">Relatório</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lojas.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-2 text-ink">{`${l.marketplace} · ${l.loja_nome}`}</td>
              <td className="px-2 py-2 text-muted">{`${fmtD(l.periodo_inicio).slice(0, 5)}–${fmtD(l.periodo_fim).slice(0, 5)}`}</td>
              <td className="px-2 py-2 text-right">{fmtBRL(l.vendas)}</td>
              <td className="px-2 py-2 text-right">{l.pedidos}</td>
              <td className="px-2 py-2 text-right">{fmtBRL(Number(l.cancelamentos) + Number(l.devolucoes) + Number(l.reembolsos))}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmtBRL(l.elegivel)}</td>
              <td className="px-4 py-2">
                {l.arquivo_path ? (
                  links.get(l.arquivo_path) ? (
                    <a className="text-primary underline-offset-2 hover:underline" href={links.get(l.arquivo_path)} target="_blank" rel="noreferrer">
                      abrir
                    </a>
                  ) : (
                    <span className="text-muted">…</span>
                  )
                ) : (
                  <span className="text-danger">sem arquivo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const log = (o: string) => (erro: unknown) => console.error(`[central-elite3d] ${o}`, erro);

function Acoes({ v, mentor, competencia }: { v: Validacao; mentor: string; competencia: string }) {
  const { dados } = useDados();
  const { usuario } = useSessao();
  const r = useResumoDoMes(mentor, competencia);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(v.checklist);
  const [dialogo, setDialogo] = useState<null | "ajuste" | "meet" | "comunicacao" | "evento">(null);
  const [texto, setTexto] = useState("");
  const [meetMotivo, setMeetMotivo] = useState(r.sug.tipo === "promocao" ? "promocao" : r.vigente === null ? "cadastro_inicial" : "divergencia");
  const [meetEm, setMeetEm] = useState("");
  const [inicial, setInicial] = useState(String(r.faixaMes?.id ?? ""));

  const salvar = useEscrita("conferirFaturamento", (campos: Parameters<typeof salvarConferencia>[1]) => salvarConferencia(v.id, campos), "Conferência salva");
  // Cada caixa marcada grava na hora, sem toast: dez cliques não viram dez avisos.
  const salvarChecklist = useEscrita("conferirFaturamento", (c: Record<string, boolean>) => salvarConferencia(v.id, { checklist: c }));
  const evento = useEscrita("conferirFaturamento", (tipo: string, detalhe: string) => registrarEvento(v.id, tipo, detalhe, usuario.id), "Registrado no histórico");
  const validar = useEscrita("conferirFaturamento", (f: Record<string, unknown>) => validarMes(v.id, f), "Mês validado");
  const pagar = useEscrita("conferirFaturamento", () => marcarPago(v.id, hojeSP()), "Pagamento registrado");

  const vigente = r.vigente ?? (inicial ? Number(inicial) : null);
  const sug = r.vigente === null && vigente !== null ? sugestao(dados.validacoes, mentor, competencia, vigente, r.faixaMes?.id ?? null, dados.faixas) : r.sug;
  const bloqueios = bloqueiosDaValidacao({ validacao: v, lojas: r.lojas.length, pendentes: r.sessoes.pendentes.length, checklist, sugestao: sug, vigente });
  const marcar = (chave: string, valor: boolean) => {
    const novo = { ...checklist, [chave]: valor };
    setChecklist(novo);
    void salvarChecklist.executar(novo).catch(log("checklist"));
  };
  const fecharDialogo = () => {
    setDialogo(null);
    setTexto("");
  };
  const exigeTexto = async (fazer: () => Promise<boolean>) => {
    if (!texto.trim()) return toast.error("Escreva o motivo");
    if (await fazer()) fecharDialogo();
  };
  const validarAgora = async () => {
    if (vigente === null || bloqueios.length) return;
    const f = montarFechamento(r.elegivel, vigente, sug, r.sessoes.pagas, dados.faixas, r.faixaMes?.id ?? null);
    await validar.executar({ ...f, checklist });
  };

  if (v.estado === "pago") return <Alert variant="success" title={`Pago em ${fmtD(v.pago_em)}`}>{`${v.sessoes_qtd} sessão(ões) × ${fmtBRL(v.valor_hora)} = ${fmtBRL(v.valor_pagar)}`}</Alert>;
  if (v.estado === "validado")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Alert variant="success" title={`Validado em ${fmtInstante(v.validado_em)}`}>{`A pagar: ${fmtBRL(v.valor_pagar)} · ${v.mudanca ? `${v.mudanca === "promocao" ? "promoção" : "rebaixamento"} para ${nomeFaixa(v.faixa_seguinte, dados.faixas)} no mês seguinte` : "faixa mantida"}`}</Alert>
        <Button loading={pagar.ocupado} data-escrita="W29" onClick={() => void pagar.executar().catch(log("pagar"))}>
          Marcar como pago
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Checklist da conferência" />
        <div className="space-y-2 p-4">
          {CHECKLIST_CONFERENCIA.map((c) => (
            <div key={c.chave}>
              <Checkbox label={c.texto} checked={!!checklist[c.chave]} onChange={(e) => marcar(c.chave, e.target.checked)} />
            </div>
          ))}
        </div>
      </Card>
      {r.vigente === null && (
        <FormField label="Faixa inicial do mentor (cadastro inicial)" htmlFor="faixa-inicial">
          <Select id="faixa-inicial" options={[{ value: "", label: "Escolha…" }, ...faixasOrdenadas(dados.faixas).map((f) => ({ value: String(f.id), label: `${fmtBRL(f.piso)}+ · ${fmtBRL(f.valor_hora)}/h` }))]} value={inicial} onChange={setInicial} />
        </FormField>
      )}
      {bloqueios.length > 0 && (
        <Alert variant="warning" title="Para validar falta">
          <ul className="list-disc pl-5">
            {bloqueios.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {v.estado === "enviado" && (
          <Button variant="outline" loading={salvar.ocupado} data-escrita="W27" onClick={() => void salvar.executar({ estado: "em_conferencia" }).catch(log("conferência"))}>
            Iniciar conferência
          </Button>
        )}
        <Button variant="outline" data-escrita="W27" onClick={() => setDialogo("ajuste")}>
          Pedir ajuste
        </Button>
        <Button variant="outline" data-escrita="W27" onClick={() => setDialogo("meet")}>
          Agendar Meet
        </Button>
        {sug.tipo === "rebaixamento" && !v.comunicado_em && (
          <Button variant="outline" data-escrita="W27" onClick={() => setDialogo("comunicacao")}>
            Registrar comunicação
          </Button>
        )}
        <Button variant="ghost" data-escrita="W30" onClick={() => setDialogo("evento")}>
          Anotar no histórico
        </Button>
        <Button loading={validar.ocupado} data-escrita="W28" onClick={() => void validarAgora().catch(log("validar"))} disabled={bloqueios.length > 0}>
          {`Validar · ${fmtBRL(valorHora(faixaPorId(vigente, dados.faixas)) * r.sessoes.pagas.length)}`}
        </Button>
      </div>

      <Dialog open={dialogo === "ajuste"} onClose={fecharDialogo} title="Pedir ajuste ao mentor">
        <div className="space-y-3">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O relatório da Loja 2 não cobre o mês inteiro" minRows={3} />
          <Button loading={salvar.ocupado} onClick={() => void exigeTexto(() => salvar.executar({ estado: "ajuste_pedido", motivo_ajuste: texto.trim() })).catch(log("ajuste"))}>
            Devolver ao mentor
          </Button>
        </div>
      </Dialog>
      <Dialog open={dialogo === "meet"} onClose={fecharDialogo} title="Agendar Meet">
        <div className="space-y-3">
          <FormField label="Motivo" htmlFor="meet-motivo">
            <Select id="meet-motivo" options={Object.entries(MEET_MOTIVO_LABEL).map(([value, label]) => ({ value, label }))} value={meetMotivo} onChange={setMeetMotivo} />
          </FormField>
          <FormField label="Quando" htmlFor="meet-em">
            <Input id="meet-em" type="datetime-local" value={meetEm} onChange={(e) => setMeetEm(e.target.value)} />
          </FormField>
          <Button
            loading={salvar.ocupado}
            onClick={() =>
              void salvar
                .executar({ estado: "meet_agendado", meet_motivo: meetMotivo, meet_em: meetEm ? new Date(meetEm).toISOString() : null })
                .then((ok) => ok && fecharDialogo())
                .catch(log("meet"))
            }
          >
            Agendar
          </Button>
        </div>
      </Dialog>
      <Dialog open={dialogo === "comunicacao"} onClose={fecharDialogo} title="Comunicação do rebaixamento">
        <div className="space-y-3">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Avisado por WhatsApp em 05/11; ciente da faixa nova" minRows={3} />
          <Button
            loading={salvar.ocupado || evento.ocupado}
            onClick={() =>
              void exigeTexto(async () => (await evento.executar("comunicacao", texto.trim())) && salvar.executar({ comunicado_em: new Date().toISOString() })).catch(log("comunicação"))
            }
          >
            Registrar
          </Button>
        </div>
      </Dialog>
      <Dialog open={dialogo === "evento"} onClose={fecharDialogo} title="Anotar no histórico">
        <div className="space-y-3">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Conferido com o painel da Shopee no Meet" minRows={3} />
          <Button loading={evento.ocupado} onClick={() => void exigeTexto(() => evento.executar("nota", texto.trim())).catch(log("histórico"))}>
            Anotar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

const TIPO_EVENTO = (tipo: string): string => {
  if (tipo.startsWith("estado:")) return ESTADO_LABEL[estadoDe({ estado: tipo.slice(7) })];
  return { comunicacao: "Comunicação", ajuste_posterior: "Ajuste posterior", nota: "Nota" }[tipo] ?? tipo;
};

export default function Conferencia({ mentor, competencia }: { mentor: string; competencia: string }) {
  const { dados } = useDados();
  const { pode } = useSessao();
  const r = useResumoDoMes(mentor, competencia);
  const v = r.v;
  const abrir = useEscrita("conferirFaturamento", () => abrirValidacao(mentor, competencia), "Conferência aberta");
  const estado = estadoDe(v);
  const fora = foraDoPrazo(v, calendario(competencia), new Date());
  const eventos = v ? dados.validacaoEventos.filter((e) => e.validacao_id === v.id) : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">{`${mentor} · ${dpLabel(competencia, "month")}`}</h2>
        <Badge variant={ESTADO_TOM[estado]}>{ESTADO_LABEL[estado]}</Badge>
        {fora && !fechado(v) && <Badge variant="danger">fora do prazo</Badge>}
        {v?.enviado_em && <span className="text-xs text-muted">{`enviado ${fmtInstante(v.enviado_em)}`}</span>}
      </div>
      {v?.estado === "ajuste_pedido" && v.motivo_ajuste && <Alert variant="warning" title="Ajuste pedido">{v.motivo_ajuste}</Alert>}
      {v?.meet_motivo && <p className="text-sm text-ink">{`Meet: ${MEET_MOTIVO_LABEL[v.meet_motivo] ?? v.meet_motivo}${v.meet_em ? ` · ${fmtInstante(v.meet_em)}` : ""}`}</p>}
      {v?.alteracao_lojas && <Alert variant="info" title="O mentor informou alteração nas lojas">{v.alteracao_lojas_obs ?? ""}</Alert>}
      {v?.obs_mentor && <p className="text-sm text-muted">{`Observação do mentor: ${v.obs_mentor}`}</p>}

      <Card>
        <CardHeader title="Lojas e relatórios" />
        {v ? <Relatorios v={v} /> : <p className="p-4 text-sm text-muted">O mentor ainda não enviou este mês.</p>}
      </Card>
      <ResumoDoMes mentor={mentor} competencia={competencia} />

      {pode("conferirFaturamento") &&
        (v ? (
          v.estado !== "rascunho" ? (
            <Acoes key={v.id} v={v} mentor={mentor} competencia={competencia} />
          ) : (
            <p className="text-sm text-muted">O mentor está preenchendo (rascunho).</p>
          )
        ) : (
          <Button variant="outline" loading={abrir.ocupado} data-escrita="W26" onClick={() => void abrir.executar().catch(log("abrir conferência"))}>
            Abrir conferência sem envio
          </Button>
        ))}

      {eventos.length > 0 && (
        <Card>
          <CardHeader title="Histórico" />
          <ul className="divide-y divide-line text-sm">
            {eventos.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="text-ink">{`${TIPO_EVENTO(e.tipo)}${e.detalhe ? ` — ${MEET_MOTIVO_LABEL[e.detalhe] ?? e.detalhe}` : ""}`}</span>
                <span className="text-xs text-muted">{fmtInstante(e.criado_em)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
