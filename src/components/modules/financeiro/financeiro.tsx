"use client";

import { LinkFicha, StatusContrato } from "@/components/modules/comum/celulas";
import { CabecalhoOrdenavel, ordemEscolhida } from "@/components/modules/comum/ordenacao";
import { SeloBusca } from "@/components/modules/comum/selo-busca";
import { BotaoNovoMentorado } from "@/components/modules/mentorados/novo-mentorado";
import { useDados, useSessao, useUi } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Alert from "@/components/ui/alert";
import Badge, { type BadgeVariant } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import SearchInput from "@/components/ui/search-input";
import StatCard from "@/components/ui/stat-card";
import type { Cobranca, Mentorado, Parcela } from "@/lib/data/esquemas";
import { descartarCobranca, restaurarCobranca, vincularCobranca } from "@/lib/data/escritas";
import { fmtD, hojeSP } from "@/lib/datas";
import { type LinhaFinanceira, motivoOrfa, painelFinanceiro, podeVincular } from "@/lib/financeiro";
import { nomeDe } from "@/lib/mentorados";
import { fmtBRL } from "@/lib/moeda";
import { aplicarOrdem } from "@/lib/ordem";

// A tela Financeiro (renderFinanceiro, index.html:2105–2200; mapeamento §3.6). A regra mora em
// src/lib/financeiro.ts (painelFinanceiro); aqui só se desenha o que ela devolve. A busca recorta as
// tabelas de mentorado; os cards e os painéis de cobrança da Lia não têm mentorado para casar com
// ela, e esconder uma cobrança por um texto digitado seria esconder dinheiro (FIN-01).

const TABELA_SITUACAO = "fin_situacao";
const TABELA_PROXIMOS = "fin_proxvenc";
const ERRO_COBRANCAS = "lia_cobrancas";

// pillPgto (index.html:866–872): Pago, Parcial, Patrocinado e Cancelou têm rótulo e tom; o resto
// aparece cru, ou "Em aberto" quando vazio.
const TOM_PAGAMENTO: ReadonlyMap<string, [BadgeVariant, string]> = new Map([
  ["Pago", ["success", "Pago"]],
  ["Pago parcial", ["warning", "Parcial"]],
  ["Patrocinado", ["info", "Patrocinado"]],
  ["Cancelou", ["danger", "Cancelou"]],
]);

function StatusPagamento({ status }: { status: string | null | undefined }) {
  const [tom, texto] = TOM_PAGAMENTO.get(status ?? "") ?? ["neutral", status || "Em aberto"];
  return <Badge variant={tom}>{texto}</Badge>;
}

// pillCobranca (index.html:908–911): o status da Lia; fora dos quatro, o texto cru.
const TOM_COBRANCA: ReadonlyMap<string, [BadgeVariant, string]> = new Map([
  ["paid", ["success", "Paga"]],
  ["pending", ["info", "Em aberto"]],
  ["overdue", ["danger", "Atrasada"]],
  ["canceled", ["neutral", "Cancelada"]],
]);

function StatusCobranca({ status }: { status: string }) {
  const [tom, texto] = TOM_COBRANCA.get(status) ?? ["neutral", status];
  return <Badge variant={tom}>{texto}</Badge>;
}

const valorDaCobranca = (c: Cobranca) => fmtBRL((c.amount_cents || 0) / 100);

// FIN-02 e W15, W16: vincular só com exatamente um cadastro com o e-mail; descartar sempre. Cada
// botão tem a sua trava (WRITE-03).
function AcoesDaOrfa({ cobranca: c, mentorados, edita }: { cobranca: Cobranca; mentorados: readonly Mentorado[]; edita: boolean }) {
  const alvo = podeVincular(c, mentorados);
  const vincular = useEscrita("editarFinanceiro", (billId: string, mentoradoId: string) => vincularCobranca(billId, mentoradoId), `Cobrança vinculada a ${alvo?.nome ?? ""}`);
  const descartar = useEscrita("editarFinanceiro", (billId: string, dono: string | null) => descartarCobranca(billId, dono), "Cobrança descartada");
  if (!edita) return null;
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {alvo && (
        <Button
          variant="outline"
          size="sm"
          loading={vincular.ocupado}
          data-escrita="W15"
          onClick={() => void vincular.executar(c.lia_bill_id, alvo.id).catch((erro: unknown) => console.error("[central-elite3d] vincular cobrança", erro))}
        >
          {`vincular a ${alvo.nome ?? ""}`}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        loading={descartar.ocupado}
        data-escrita="W16"
        title="Compra de teste ou cobrança que não deve contar. Sai daqui e do financeiro, mas continua guardada — dá para restaurar."
        onClick={() => void descartar.executar(c.lia_bill_id, c.mentorado_id).catch((erro: unknown) => console.error("[central-elite3d] descartar cobrança", erro))}
      >
        descartar
      </Button>
    </span>
  );
}

function AcaoDaDescartada({ cobranca: c, edita }: { cobranca: Cobranca; edita: boolean }) {
  const restaurar = useEscrita("editarFinanceiro", (billId: string, dono: string | null) => restaurarCobranca(billId, dono), "Cobrança restaurada");
  if (!edita) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      loading={restaurar.ocupado}
      data-escrita="W17"
      onClick={() => void restaurar.executar(c.lia_bill_id, c.mentorado_id).catch((erro: unknown) => console.error("[central-elite3d] restaurar cobrança", erro))}
    >
      restaurar
    </Button>
  );
}

const colunasDaCobranca = (extra: Column<Cobranca>[]): Column<Cobranca>[] => [
  { key: "vencimento", header: "Vencimento", render: (c) => (c.due_date ? fmtD(c.due_date) : "—") },
  { key: "email", header: "E-mail na cobrança", render: (c) => <span className="text-muted">{c.contact_email || "—"}</span> },
  { key: "valor", header: "Valor", align: "right", render: valorDaCobranca },
  { key: "status", header: "Status", render: (c) => <StatusCobranca status={c.status} /> },
  ...extra,
];

// DATA-07: sem a leitura R05, a lista vazia seria indistinguível de "nenhuma órfã". O erro ocupa o
// lugar dos dois painéis, e o resto da tela segue.
function ErroDasCobrancas({ titulo, erro }: { titulo: string; erro: string }) {
  return (
    <Card>
      <CardHeader title={titulo} />
      <div className="p-4">
        <Alert variant="danger" title="Não foi possível carregar as cobranças da Lia">
          {`${ERRO_COBRANCAS}: ${erro}`}
        </Alert>
      </div>
    </Card>
  );
}

function PainelOrfas({ orfas, mentorados, edita }: { orfas: Cobranca[]; mentorados: readonly Mentorado[]; edita: boolean }) {
  if (!orfas.length) return null;
  const colunas = colunasDaCobranca([
    { key: "motivo", header: "Por que não casou", render: (c) => <span className="text-sm text-muted">{motivoOrfa(c, mentorados)}</span> },
    ...(edita ? [{ key: "acoes", header: "", align: "right" as const, render: (c: Cobranca) => <AcoesDaOrfa cobranca={c} mentorados={mentorados} edita /> }] : []),
  ]);
  return (
    <Card id="cobrancas-orfas">
      <CardHeader title="Cobranças da Lia sem mentorado identificado" />
      <p className="px-5 pt-3 text-sm text-muted">
        A cobrança chegou e está guardada por inteiro, mas não achou de quem é, então não aparece em ficha nenhuma. Resolvido o motivo, clique em <b>vincular</b>.
      </p>
      <DataTable columns={colunas} rows={orfas} rowKey={(c) => c.lia_bill_id} />
    </Card>
  );
}

function PainelDescartadas({ descartadas, edita }: { descartadas: Cobranca[]; edita: boolean }) {
  if (!descartadas.length) return null;
  const colunas = colunasDaCobranca(edita ? [{ key: "acao", header: "", align: "right", render: (c) => <AcaoDaDescartada cobranca={c} edita /> }] : []);
  return (
    <Card>
      <CardHeader title={`Cobranças descartadas · ${descartadas.length}`} />
      <p className="px-5 pt-3 text-sm text-muted">Marcadas como fora da conta, em geral compra de teste. Continuam guardadas e não entram em ficha nenhuma.</p>
      <DataTable columns={colunas} rows={descartadas} rowKey={(c) => c.lia_bill_id} />
    </Card>
  );
}

export default function Financeiro() {
  const { dados, erros } = useDados();
  const { pode } = useSessao();
  const { ui, mudar } = useUi();
  const busca = ui.filtro.qFin;
  const painel = painelFinanceiro(dados, busca, hojeSP());
  const { cards } = painel;
  const edita = pode("editarFinanceiro");
  const erroCobrancas = erros[ERRO_COBRANCAS];

  const ordemSituacao = ordemEscolhida(ui, TABELA_SITUACAO) ?? { campo: "nome", direcao: "asc" as const };
  const linhas = aplicarOrdem(painel.linhas, ordemSituacao, {
    nome: (l) => l.mentorado.nome,
    contrato: (l) => l.mentorado.contrato_status ?? "",
    entrada: (l) => l.mentorado.entrada_status ?? "",
    restante: (l) => l.mentorado.restante_status ?? "",
    parcelas: (l) => (l.parcelas.length ? l.pagas / l.parcelas.length : -1),
  });
  const proximos = aplicarOrdem(painel.proximos, ordemEscolhida(ui, TABELA_PROXIMOS) ?? { campo: "vence", direcao: "asc" }, {
    vence: (p) => p.vencimento,
    mentorado: (p) => nomeDe(dados.mentorados, p.mentorado_id),
  });
  const cabecalho = (tabela: string, campo: string, rotulo: string) => <CabecalhoOrdenavel tabela={tabela} campo={campo} rotulo={rotulo} />;

  const colunasVencidas: Column<{ linha: LinhaFinanceira; parcela: Parcela }>[] = [
    { key: "mentorado", header: "Mentorado", render: ({ linha }) => <LinkFicha id={linha.mentorado.id} aba="financeiro">{linha.mentorado.nome}</LinkFicha> },
    { key: "parcela", header: "Parcela", render: ({ parcela }) => `#${parcela.numero ?? ""}` },
    {
      key: "vencimento",
      header: "Venceu em",
      render: ({ parcela }) => (
        <span className="flex items-center gap-2">
          <span className="text-danger">{fmtD(parcela.vencimento)}</span>
          <Badge variant="danger">Vencida</Badge>
        </span>
      ),
    },
  ];
  const vencidas = painel.vencidas.flatMap((linha) => linha.vencidas.map((parcela) => ({ linha, parcela })));

  const colunasProximos: Column<Parcela>[] = [
    { key: "vence", header: cabecalho(TABELA_PROXIMOS, "vence", "Vence em"), render: (p) => fmtD(p.vencimento) },
    {
      key: "mentorado",
      header: cabecalho(TABELA_PROXIMOS, "mentorado", "Mentorado"),
      render: (p) => <LinkFicha id={p.mentorado_id} aba="financeiro">{nomeDe(dados.mentorados, p.mentorado_id)}</LinkFicha>,
    },
    { key: "parcela", header: "Parcela", render: (p) => `#${p.numero ?? ""}` },
  ];

  const colunasSituacao: Column<LinhaFinanceira>[] = [
    { key: "nome", header: cabecalho(TABELA_SITUACAO, "nome", "Mentorado"), render: (l) => <LinkFicha id={l.mentorado.id} aba="financeiro">{l.mentorado.nome}</LinkFicha> },
    { key: "contrato", header: cabecalho(TABELA_SITUACAO, "contrato", "Contrato"), render: (l) => <StatusContrato status={l.mentorado.contrato_status} /> },
    { key: "entrada", header: cabecalho(TABELA_SITUACAO, "entrada", "Entrada"), render: (l) => <StatusPagamento status={l.mentorado.entrada_status} /> },
    { key: "forma-entrada", header: "Forma", render: (l) => <span className="text-muted">{l.mentorado.entrada_forma_pgto || "—"}</span> },
    { key: "restante", header: cabecalho(TABELA_SITUACAO, "restante", "Restante"), render: (l) => <StatusPagamento status={l.mentorado.restante_status} /> },
    { key: "forma-restante", header: "Forma", render: (l) => <span className="text-muted">{l.mentorado.restante_forma_pgto || "—"}</span> },
    { key: "parcelas", header: cabecalho(TABELA_SITUACAO, "parcelas", "Parcelas pagas"), render: (l) => (l.parcelas.length ? `${l.pagas}/${l.parcelas.length}` : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Contratos, entradas e parcelas" actions={<BotaoNovoMentorado />} />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full max-w-sm"
          value={busca}
          placeholder="Buscar mentorado por nome…"
          aria-label="Buscar mentorado por nome"
          onChange={(e) => mudar({ filtro: { ...ui.filtro, qFin: e.target.value } })}
        />
        <SeloBusca
          termo={busca}
          n={painel.linhas.length}
          total={painel.totalLinhas}
          unidade="mentorado(s) · cards e cobranças da Lia continuam inteiros"
          limpar={() => mudar({ filtro: { ...ui.filtro, qFin: "" } })}
        />
      </div>

      <section aria-label="Números do financeiro" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Parcelas vencidas" value={cards.vencidas} caption="requerem cobrança" />
        <StatCard label="Restante em aberto" value={cards.restanteAberto} caption={`+ ${cards.restanteParcial} pagos parcialmente`} />
        <StatCard label="Contratos assinados" value={`${cards.assinados}/${cards.ativos}`} caption={`${cards.ativos - cards.assinados} pendentes`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cobranças com parcela vencida" />
          {vencidas.length ? (
            <DataTable columns={colunasVencidas} rows={vencidas} rowKey={({ parcela }) => parcela.id} />
          ) : (
            <EmptyState className="m-4" title={cards.vencidas ? `Nenhuma das ${cards.vencidas} parcelas vencidas casa com a busca.` : "Nenhuma parcela vencida."} />
          )}
        </Card>
        <Card>
          <CardHeader title="Próximos vencimentos" />
          {proximos.length ? (
            <DataTable columns={colunasProximos} rows={proximos} rowKey={(p) => p.id} />
          ) : (
            <EmptyState className="m-4" title={busca ? "Nenhum vencimento futuro para essa busca." : "Sem vencimentos futuros cadastrados."} />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={`Situação por mentorado${busca ? ` · ${painel.linhas.length} de ${painel.totalLinhas}` : ""}`} />
        {linhas.length ? (
          <DataTable columns={colunasSituacao} rows={linhas} rowKey={(l) => l.mentorado.id} />
        ) : (
          <EmptyState className="m-4" title="Nenhum mentorado ativo encontrado para essa busca." />
        )}
      </Card>

      {erroCobrancas !== undefined ? (
        <>
          <ErroDasCobrancas titulo="Cobranças da Lia sem mentorado identificado" erro={erroCobrancas} />
          <ErroDasCobrancas titulo="Cobranças descartadas" erro={erroCobrancas} />
        </>
      ) : (
        <>
          <PainelOrfas orfas={painel.orfas} mentorados={dados.mentorados} edita={edita} />
          <PainelDescartadas descartadas={painel.descartadas} edita={edita} />
        </>
      )}
    </div>
  );
}
