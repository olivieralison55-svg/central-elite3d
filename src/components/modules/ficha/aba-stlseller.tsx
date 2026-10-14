"use client";

import type { ReactNode } from "react";

import { LinkExterno } from "@/components/modules/comum/celulas";
import { useDados } from "@/components/shell/contexto";
import Alert from "@/components/ui/alert";
import Badge, { type BadgeVariant } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import DataTable, { type Column } from "@/components/ui/data-table";
import DescriptionList from "@/components/ui/description-list";
import EmptyState from "@/components/ui/empty-state";
import SectionLabel from "@/components/ui/section-label";
import StatCard from "@/components/ui/stat-card";
import type { Mentorado, StlPedido, StlProduto } from "@/lib/data/esquemas";
import { fmtInstante } from "@/lib/datas";
import { normalizaEmail } from "@/lib/mentorados";
import { fmtBRL } from "@/lib/moeda";
import { stlsellerDe } from "@/lib/stlseller";

// A aba STLSeller da ficha (abaStlseller, index.html:3140–3187): o que o STLSeller e o formulário da
// mentoria sabem da pessoa, lidos no BigQuery pelo n8n e gravados nas tabelas stlseller_* pelo sync.
// Somente leitura: nada aqui escreve, e o que diverge da ficha se corrige na origem.

const STATUS_REAL: ReadonlyMap<string, [BadgeVariant, string]> = new Map([
  ["pago", ["success", "Pago"]],
  ["pendente", ["warning", "Pagamento pendente"]],
  ["inadimplente_ou_cancelado", ["danger", "Inadimplente ou cancelado"]],
  ["sem_pedido_lia", ["neutral", "Sem pedido na Lia"]],
]);
const PAGTO_LIA: ReadonlyMap<string, string> = new Map([
  ["finished", "Finalizado"],
  ["canceled", "Cancelado"],
  ["initiated", "Iniciado"],
]);
const MAX_PRODUTOS = 50;

type Numero = number | string | null | undefined;
// Nulo é "o marketplace não informou" (o Mercado Livre não manda o líquido), não zero.
const informado = (valor: Numero): valor is number | string => valor !== null && valor !== undefined && valor !== "";
const numOuTraco = (valor: Numero) => (informado(valor) ? Number(valor).toLocaleString("pt-BR") : "—");
const brlOuTraco = (valor: Numero) => (informado(valor) ? fmtBRL(valor) : "—");

const PEDIDOS: Column<StlPedido>[] = [
  { key: "marketplace", header: "Marketplace", render: (o) => o.marketplace },
  { key: "pedidos", header: "Pedidos", align: "right", render: (o) => numOuTraco(o.pedidos) },
  { key: "vendidos", header: "Vendidos", align: "right", render: (o) => numOuTraco(o.pedidos_vendidos) },
  { key: "cancelados", header: "Cancelados", align: "right", render: (o) => numOuTraco(o.pedidos_cancelados) },
  { key: "bruto", header: "Bruto", align: "right", render: (o) => brlOuTraco(o.total_bruto) },
  { key: "liquido", header: "Líquido", align: "right", render: (o) => brlOuTraco(o.total_liquido) },
  { key: "ultimo", header: "Último pedido", render: (o) => fmtInstante(o.ultimo_pedido_em) },
];

// O link do anúncio vem do marketplace: só http(s) vira href (SEC-05).
const PRODUTOS: Column<StlProduto>[] = [
  {
    key: "produto",
    header: "Produto",
    render: (p) => (
      <span>
        {p.titulo || p.anuncio_id || "—"} {p.link && <LinkExterno url={p.link} rotulo="anúncio" />}
      </span>
    ),
  },
  { key: "marketplace", header: "Marketplace", render: (p) => p.marketplace },
  { key: "pedidos", header: "Pedidos", align: "right", render: (p) => numOuTraco(p.pedidos) },
  { key: "unidades", header: "Unidades", align: "right", render: (p) => numOuTraco(p.unidades) },
  { key: "faturamento", header: "Faturamento", align: "right", render: (p) => brlOuTraco(p.faturamento) },
  { key: "ultima", header: "Última venda", render: (p) => fmtInstante(p.ultima_venda_em) },
];

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-line pt-4">
      <SectionLabel as="h3">{titulo}</SectionLabel>
      {children}
    </section>
  );
}

export default function AbaStlseller({ mentorado: m }: { mentorado: Mentorado }) {
  const { dados, erros, recarregar } = useDados();
  const r = stlsellerDe(dados.stlseller, m.email);
  const origem = (
    <Alert variant="info" title="Dados do STLSeller">
      {`Vêm do STLSeller e do formulário da mentoria, via BigQuery. Somente leitura: o que estiver errado se corrige lá, não aqui.${r ? ` Atualizado em ${fmtInstante(r.synced_at)}.` : ""}`}
    </Alert>
  );
  // DATA-07: R14–R16 são as relações desta aba. A falha delas aparece só aqui; a ficha segue.
  const erro = erros.stlseller_mentorados ?? erros.stlseller_pedidos_marketplace ?? erros.stlseller_produtos_vendidos;
  const email = normalizaEmail(m.email);
  const semDados = (aviso: ReactNode) => (
    <div className="space-y-4">
      {origem}
      {aviso}
    </div>
  );
  if (erro) {
    return semDados(<EmptyState title="Não foi possível carregar os dados do STLSeller" description={erro} action={<Button onClick={() => void recarregar()}>Tentar de novo</Button>} />);
  }
  if (!email) return semDados(<EmptyState title="Esta ficha não tem e-mail. O STLSeller é casado pelo e-mail — preencha na aba Cadastro." />);
  if (!r) return semDados(<EmptyState title={`Nenhum registro no STLSeller para ${email}.`} />);
  const [tom, rotulo] = STATUS_REAL.get(r.status_real ?? "") ?? ["neutral", r.status_real || "—"];
  const pedidos = dados.stlPedidos.filter((o) => o.email === r.email);
  const produtos = dados.stlProdutos.filter((p) => p.email === r.email).sort((a, b) => (Number(b.faturamento) || 0) - (Number(a.faturamento) || 0));
  return (
    <div className="space-y-4">
      {origem}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compact label="Status no formulário" value={r.status_formulario || "—"} caption="formulário da mentoria" />
        <StatCard compact label="Status real sugerido" value={<Badge variant={tom}>{rotulo}</Badge>} caption="cruzamento com a Lia" />
        <StatCard
          compact
          label="Plano STLSeller"
          value={r.plano_ativo === true ? "Ativo" : r.plano_ativo === false ? "Inativo" : "—"}
          caption={r.loja_id ? "loja cadastrada" : "sem loja cadastrada"}
        />
        <StatCard compact label="Faturamento em marketplaces" value={fmtBRL(r.faturamento_total)} caption={`${numOuTraco(r.produtos_vendidos)} produto(s) vendido(s)`} />
      </div>
      <Bloco titulo="Loja no STLSeller">
        <DescriptionList
          items={[
            { term: "Loja", value: r.loja_nome || "—" },
            { term: "E-mail da loja", value: r.loja_email || "—" },
            { term: "E-mail STLFLIX", value: r.email_stlflix || "—" },
            { term: "Vendas em marketplaces", value: numOuTraco(r.vendas_marketplace) },
          ]}
        />
      </Bloco>
      <Bloco titulo="Pagamento na Lia, segundo o STLSeller">
        <DescriptionList
          items={[
            { term: "Status", value: PAGTO_LIA.get(r.lia_status_pagamento ?? "") ?? (r.lia_status_pagamento || "—") },
            { term: "Pedidos finalizados", value: `${numOuTraco(r.lia_pedidos_finalizados)} de ${numOuTraco(r.lia_pedidos)}` },
            { term: "Último pedido", value: fmtInstante(r.lia_ultimo_pedido_em) },
            { term: "Motivo do cancelamento", value: r.lia_motivo_cancelamento || "—" },
          ]}
        />
      </Bloco>
      <Bloco titulo={`Pedidos por marketplace${pedidos.length ? ` · ${pedidos.length}` : ""}`}>
        {pedidos.length ? <DataTable columns={PEDIDOS} rows={pedidos} rowKey={(o) => o.marketplace} /> : <EmptyState title="Nenhum pedido em marketplace." />}
      </Bloco>
      <Bloco titulo={`Produtos vendidos${produtos.length ? ` · ${produtos.length}` : ""}`}>
        {produtos.length ? (
          <>
            <DataTable columns={PRODUTOS} rows={produtos.slice(0, MAX_PRODUTOS)} rowKey={(p) => `${p.marketplace}|${p.anuncio_id}`} />
            {produtos.length > MAX_PRODUTOS && <p className="text-xs text-muted">{`Mostrando os ${MAX_PRODUTOS} de maior faturamento, de ${produtos.length}.`}</p>}
          </>
        ) : (
          <EmptyState title="Nenhum produto vendido." />
        )}
      </Bloco>
    </div>
  );
}
