"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import CampoMoeda from "@/components/modules/comum/campo-moeda";
import { useDados } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Alert from "@/components/ui/alert";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import Checkbox from "@/components/ui/checkbox";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/textarea";
import type { ValidacaoLoja } from "@/lib/data/esquemas";
import { enviarRelatorio, type LojaDoMes, salvarEnvio } from "@/lib/data/escritas";
import { fmtInstante } from "@/lib/datas";
import { calendario, ESTADO_LABEL, ESTADO_TOM, estadoDe, foraDoPrazo, mentorEdita } from "@/lib/faturamento";
import { fmtBRL, lerBRL, mascaraBRL } from "@/lib/moeda";

import { ResumoDoMes } from "./conferencia";

// O envio do mentor: uma linha por loja, com o relatório oficial anexado, e o elegível somado na
// hora. Salvar guarda o rascunho; enviar entrega à operação, e daí o mentor só mexe se ela pedir
// ajuste (o banco confere).

const MARKETPLACES = ["Shopee", "Mercado Livre", "Outro"];
const TIPOS_RELATORIO = ".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv";
const LIMITE = 20 * 1024 * 1024;

interface LojaForm {
  loja_id: string | null;
  marketplace: string;
  loja_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  vendas: string;
  pedidos: string;
  cancelamentos: string;
  devolucoes: string;
  reembolsos: string;
  arquivo_path: string | null;
  arquivo_nome: string | null;
}

const fimDoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};

const vazia = (competencia: string, base?: Partial<LojaForm>): LojaForm => ({
  loja_id: null,
  marketplace: "Shopee",
  loja_nome: "",
  periodo_inicio: `${competencia}-01`,
  periodo_fim: fimDoMes(competencia),
  vendas: "",
  pedidos: "",
  cancelamentos: "",
  devolucoes: "",
  reembolsos: "",
  arquivo_path: null,
  arquivo_nome: null,
  ...base,
});

const daLinha = (l: ValidacaoLoja): LojaForm => ({
  loja_id: l.loja_id,
  marketplace: l.marketplace,
  loja_nome: l.loja_nome,
  periodo_inicio: l.periodo_inicio,
  periodo_fim: l.periodo_fim,
  vendas: mascaraBRL(l.vendas, true),
  pedidos: String(l.pedidos),
  cancelamentos: mascaraBRL(l.cancelamentos, true),
  devolucoes: mascaraBRL(l.devolucoes, true),
  reembolsos: mascaraBRL(l.reembolsos, true),
  arquivo_path: l.arquivo_path,
  arquivo_nome: l.arquivo_path ? l.arquivo_path.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "") : null,
});

const valor = (texto: string) => lerBRL(texto) ?? 0;
const elegivelDe = (l: LojaForm) => valor(l.vendas) - valor(l.cancelamentos) - valor(l.devolucoes) - valor(l.reembolsos);

export default function EnvioMentor({ mentor, competencia }: { mentor: string; competencia: string }) {
  const { dados } = useDados();
  const v = dados.validacoes.find((x) => x.mentor === mentor && x.competencia.startsWith(competencia)) ?? null;
  const cadastradas = dados.mentorLojas.filter((l) => l.mentor === mentor && l.ativa);
  const [lojas, setLojas] = useState<LojaForm[]>(() => {
    const salvas = v ? dados.validacaoLojas.filter((l) => l.validacao_id === v.id) : [];
    if (salvas.length) return salvas.map(daLinha);
    if (cadastradas.length) return cadastradas.map((c) => vazia(competencia, { loja_id: c.id, marketplace: c.marketplace, loja_nome: c.nome }));
    return [vazia(competencia)];
  });
  const [alteracao, setAlteracao] = useState(!!v?.alteracao_lojas);
  const [alteracaoObs, setAlteracaoObs] = useState(v?.alteracao_lojas_obs ?? "");
  const [obs, setObs] = useState(v?.obs_mentor ?? "");
  const [subindo, setSubindo] = useState<number | null>(null);

  const edita = mentorEdita(v);
  const estado = estadoDe(v);
  const cal = calendario(competencia);
  const fora = foraDoPrazo(v, cal, new Date());
  const total = lojas.reduce((t, l) => t + elegivelDe(l), 0);

  const gravar = useEscrita("enviarFaturamento", (enviar: boolean, lista: LojaDoMes[]) =>
    salvarEnvio(mentor, competencia, { alteracao_lojas: alteracao, alteracao_lojas_obs: alteracaoObs, obs_mentor: obs, lojas: lista }, enviar),
  );
  const mudar = (i: number, campo: keyof LojaForm, valorNovo: string | null) => setLojas((ls) => ls.map((l, k) => (k === i ? { ...l, [campo]: valorNovo } : l)));

  const anexar = async (i: number, arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > LIMITE) return toast.error("O arquivo passa de 20 MB");
    setSubindo(i);
    try {
      const r = await enviarRelatorio(mentor, competencia, arquivo);
      if (!r.ok || !r.caminho) return toast.error("erro" in r ? r.erro : "O relatório não foi enviado");
      setLojas((ls) => ls.map((l, k) => (k === i ? { ...l, arquivo_path: r.caminho!, arquivo_nome: arquivo.name } : l)));
      toast.success("Relatório anexado. Salve para não perder.");
    } finally {
      setSubindo(null);
    }
  };

  const enviarOuSalvar = async (enviar: boolean) => {
    const problemas: string[] = [];
    lojas.forEach((l, i) => {
      if (!l.loja_nome.trim()) problemas.push(`Loja ${i + 1}: informe o nome`);
      if (enviar && !l.arquivo_path) problemas.push(`Loja ${i + 1}: anexe o relatório oficial`);
      if (l.periodo_fim < l.periodo_inicio) problemas.push(`Loja ${i + 1}: período invertido`);
      if (enviar && elegivelDe(l) < 0) problemas.push(`Loja ${i + 1}: deduções maiores que as vendas`);
    });
    if (enviar && alteracao && !alteracaoObs.trim()) problemas.push("Descreva a alteração nas lojas");
    if (problemas.length) return toast.error(problemas.join(" · "));
    const lista: LojaDoMes[] = lojas.map((l) => ({
      loja_id: l.loja_id,
      marketplace: l.marketplace,
      loja_nome: l.loja_nome.trim(),
      periodo_inicio: l.periodo_inicio,
      periodo_fim: l.periodo_fim,
      vendas: valor(l.vendas),
      pedidos: Number(l.pedidos) || 0,
      cancelamentos: valor(l.cancelamentos),
      devolucoes: valor(l.devolucoes),
      reembolsos: valor(l.reembolsos),
      arquivo_path: l.arquivo_path,
    }));
    if (await gravar.executar(enviar, lista)) toast.success(enviar ? "Enviado para conferência" : "Rascunho salvo");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ESTADO_TOM[estado]}>{ESTADO_LABEL[estado]}</Badge>
        {v?.enviado_em ? (
          <span className="text-sm text-muted">{`enviado ${fmtInstante(v.enviado_em)}${fora ? " · fora do prazo" : ""}`}</span>
        ) : (
          <span className={`text-sm ${fora ? "text-danger" : "text-muted"}`}>{`prazo: ${fmtInstante(cal.prazoEnvio)}${fora ? " · já passou, envie assim mesmo" : ""}`}</span>
        )}
      </div>
      {v?.estado === "ajuste_pedido" && <Alert variant="warning" title="A operação pediu ajuste">{v.motivo_ajuste ?? ""}</Alert>}
      {!edita && <Alert variant="info" title="Este mês está com a operação">Se precisar corrigir algo, peça ao responsável que devolva com um pedido de ajuste.</Alert>}

      {lojas.map((l, i) => (
        <Card key={i}>
          <CardHeader
            title={`Loja ${i + 1}${l.loja_nome ? ` · ${l.loja_nome}` : ""}`}
            actions={
              edita && lojas.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setLojas((ls) => ls.filter((_, k) => k !== i))}>
                  Remover
                </Button>
              ) : undefined
            }
          />
          <fieldset disabled={!edita} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Marketplace" htmlFor={`mk-${i}`}>
              <Select id={`mk-${i}`} options={MARKETPLACES.map((m) => ({ value: m, label: m }))} value={l.marketplace} onChange={(x) => mudar(i, "marketplace", x)} />
            </FormField>
            <FormField label="Nome da loja" htmlFor={`nome-${i}`} className="lg:col-span-3">
              <Input id={`nome-${i}`} value={l.loja_nome} onChange={(e) => mudar(i, "loja_nome", e.target.value)} placeholder="Minha Loja 3D" />
            </FormField>
            <FormField label="Período de" htmlFor={`ini-${i}`}>
              <Input id={`ini-${i}`} type="date" value={l.periodo_inicio} onChange={(e) => mudar(i, "periodo_inicio", e.target.value)} />
            </FormField>
            <FormField label="até" htmlFor={`fim-${i}`}>
              <Input id={`fim-${i}`} type="date" value={l.periodo_fim} onChange={(e) => mudar(i, "periodo_fim", e.target.value)} />
            </FormField>
            <FormField label="Vendas no mês" htmlFor={`vendas-${i}`}>
              <CampoMoeda id={`vendas-${i}`} value={l.vendas} onChange={(x) => mudar(i, "vendas", x)} placeholder="R$ 0,00" />
            </FormField>
            <FormField label="Pedidos" htmlFor={`pedidos-${i}`}>
              <Input id={`pedidos-${i}`} inputMode="numeric" value={l.pedidos} onChange={(e) => mudar(i, "pedidos", e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </FormField>
            <FormField label="Cancelamentos" htmlFor={`canc-${i}`}>
              <CampoMoeda id={`canc-${i}`} value={l.cancelamentos} onChange={(x) => mudar(i, "cancelamentos", x)} placeholder="R$ 0,00" />
            </FormField>
            <FormField label="Devoluções" htmlFor={`dev-${i}`}>
              <CampoMoeda id={`dev-${i}`} value={l.devolucoes} onChange={(x) => mudar(i, "devolucoes", x)} placeholder="R$ 0,00" />
            </FormField>
            <FormField label="Reembolsos" htmlFor={`reemb-${i}`}>
              <CampoMoeda id={`reemb-${i}`} value={l.reembolsos} onChange={(x) => mudar(i, "reembolsos", x)} placeholder="R$ 0,00" />
            </FormField>
            <FormField label="Elegível da loja">
              <p className="pt-2 text-sm font-semibold text-ink">{fmtBRL(elegivelDe(l))}</p>
            </FormField>
            <FormField label="Relatório oficial exportado da loja" htmlFor={`arq-${i}`} hint="PDF, imagem ou planilha, até 20 MB" className="sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input id={`arq-${i}`} type="file" accept={TIPOS_RELATORIO} className="max-w-xs py-1" onChange={(e) => void anexar(i, e.target.files?.[0]).catch((erro: unknown) => console.error("[central-elite3d] relatório", erro))} />
                {subindo === i ? <span className="text-sm text-muted">enviando…</span> : l.arquivo_nome && <span className="text-sm text-success">{`anexado: ${l.arquivo_nome}`}</span>}
              </div>
            </FormField>
          </fieldset>
        </Card>
      ))}

      {edita && (
        <Button variant="outline" onClick={() => setLojas((ls) => [...ls, vazia(competencia)])}>
          + Adicionar loja
        </Button>
      )}

      <Card>
        <fieldset disabled={!edita} className="space-y-3 p-4">
          <p className="text-sm text-ink">
            Faturamento elegível consolidado: <span className="font-semibold">{fmtBRL(total)}</span>
            <span className="text-muted"> — some cada pedido uma vez só, mesmo que apareça em mais de um relatório.</span>
          </p>
          <Checkbox label="Houve alteração nas lojas cadastradas ou ajuste relevante nos dados" checked={alteracao} onChange={(e) => setAlteracao(e.target.checked)} />
          {alteracao && <Textarea value={alteracaoObs} onChange={(e) => setAlteracaoObs(e.target.value)} placeholder="Abri uma loja nova no Mercado Livre em 12/10" minRows={2} />}
          <FormField label="Observação para a conferência (opcional)" htmlFor="obs-mentor">
            <Textarea id="obs-mentor" value={obs} onChange={(e) => setObs(e.target.value)} minRows={2} />
          </FormField>
        </fieldset>
        {edita && (
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            <Button variant="outline" loading={gravar.ocupado} data-escrita="W24" onClick={() => void enviarOuSalvar(false).catch((erro: unknown) => console.error("[central-elite3d] rascunho", erro))}>
              Salvar rascunho
            </Button>
            <Button loading={gravar.ocupado} data-escrita="W24" onClick={() => void enviarOuSalvar(true).catch((erro: unknown) => console.error("[central-elite3d] envio", erro))}>
              Enviar para conferência
            </Button>
          </div>
        )}
      </Card>

      <ResumoDoMes mentor={mentor} competencia={competencia} />
    </div>
  );
}
