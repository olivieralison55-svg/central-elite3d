"use client";

import { useState } from "react";

import { LinkExterno, LinkFicha } from "@/components/modules/comum/celulas";
import { CabecalhoOrdenavel, ordemEscolhida } from "@/components/modules/comum/ordenacao";
import { SeloBusca } from "@/components/modules/comum/selo-busca";
import { numOuTraco, brlOuTraco, STATUS_REAL } from "@/components/modules/ficha/aba-stlseller";
import { useDados, useUi } from "@/components/shell/contexto";
import { AvisoRelacoes } from "@/components/shell/dados";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import SearchInput from "@/components/ui/search-input";
import StatCard from "@/components/ui/stat-card";
import { fmtInstante } from "@/lib/datas";
import { fmtBRL } from "@/lib/moeda";
import {
  agregadosAnalise,
  ANALISE_FILTROS,
  ANALISE_STATUS,
  type ChipAnalise,
  concentracaoAnalise,
  contagemStatusReal,
  gruposAnalise,
  type LinhaAnalise,
  linhasAnalise,
  listaAnalise,
  lojaPor,
  nomeAnalise,
  pct,
  recorteAnalise,
  rotuloMarketplace,
  STATUS_PADRAO,
  topAnuncios,
  ultimaSync,
} from "@/lib/stlseller";

// A tela STLSeller (renderAnalise, index.html:2607–2876; mapeamento §3.8). As regras moram em
// src/lib/stlseller.ts; aqui só se desenha o que elas devolvem. O recorte de status e o chip são
// estado da tela: a decisão do Ui (design, "Estado de interface") só guarda a busca (qAnalise).

const TABELA = "analise";
// DATA-07: R14–R16 são as relações da tela; a falha de qualquer uma troca a tela pelo erro.
const ESSENCIAIS = ["stlseller_mentorados", "stlseller_pedidos_marketplace", "stlseller_produtos_vendidos"] as const;
// Do maior para o menor, cada fatia mais clara que a anterior; o resto, apagado.
const PESO_DAS_FATIAS = [100, 78, 58, 40, 26];
const corDaFatia = (i: number, ultima: boolean, outros: boolean) =>
  outros && ultima ? "var(--line-strong)" : `color-mix(in srgb, var(--primary) ${PESO_DAS_FATIAS[i] ?? 26}%, transparent)`;

const Nome = ({ l }: { l: LinhaAnalise }) => <LinkFicha id={l.ficha?.id ?? null} aba="stlseller">{nomeAnalise(l)}</LinkFicha>;

function Etiquetas({ linhas }: { linhas: LinhaAnalise[] }) {
  if (!linhas.length) return <EmptyState className="m-4" title="Ninguém neste recorte." />;
  return (
    <div className="flex flex-wrap gap-2 p-4">
      {linhas.map((l) => (
        <Badge key={l.r.email}>
          <Nome l={l} />
          {l.r.loja_nome ? ` · ${l.r.loja_nome}` : ""}
        </Badge>
      ))}
    </div>
  );
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={titulo} />
      {dica && <p className="px-5 pt-3 text-sm text-muted">{dica}</p>}
      {children}
    </Card>
  );
}

function Concentracao({ base, bruto }: { base: LinhaAnalise[]; bruto: number }) {
  const fatias = concentracaoAnalise(base);
  if (!fatias.length) return null;
  const temOutros = fatias.length > 5;
  return (
    <Card>
      <CardHeader title="Concentração do bruto" />
      <div className="space-y-3 p-5">
        <div role="img" aria-label="Participação de cada mentorado no bruto vendido" className="flex h-3 overflow-hidden rounded-full bg-selected">
          {fatias.map((f, i) => (
            <span
              key={f.nome}
              title={`${f.nome}: ${fmtBRL(f.valor)}`}
              style={{ width: `${bruto ? (f.valor / bruto) * 100 : 0}%`, background: corDaFatia(i, i === fatias.length - 1, temOutros) }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {fatias.map((f, i) => (
            <span key={f.nome} className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full" style={{ background: corDaFatia(i, i === fatias.length - 1, temOutros) }} />
              {f.nome} <b className="font-semibold text-ink">{pct(bruto ? f.valor / bruto : null)}</b>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function Stlseller() {
  const { dados } = useDados();
  const { ui, mudar } = useUi();
  const [status, setStatus] = useState(STATUS_PADRAO);
  const [chip, setChip] = useState<ChipAnalise>("todos");
  const busca = ui.filtro.qAnalise;
  const linhas = linhasAnalise(dados);
  const base = recorteAnalise(linhas, status);
  const agregados = agregadosAnalise(base);
  const { lista, antesDaBusca } = listaAnalise(base, chip, busca, ordemEscolhida(ui, TABELA));
  const grupos = gruposAnalise(base);
  const sync = ultimaSync(dados.stlseller);
  const rotuloStatus = ANALISE_STATUS.find(([v]) => v === status)?.[1] ?? "Todos";
  const cabecalho = (campo: string, rotulo: string) => <CabecalhoOrdenavel tabela={TABELA} campo={campo} rotulo={rotulo} />;
  const vende = (l: LinhaAnalise) => l.situacao === "vende";

  const colunas: Column<LinhaAnalise>[] = [
    {
      key: "nome",
      header: cabecalho("nome", "Mentorado"),
      render: (l) => (
        <span className="flex flex-col">
          <Nome l={l} />
          <span className="text-xs text-muted">{l.r.loja_nome || l.r.email}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: cabecalho("status", "Status real"),
      render: (l) => {
        const [tom, rotulo] = STATUS_REAL.get(l.r.status_real ?? "") ?? ["neutral", l.r.status_real || "—"];
        return <Badge variant={tom}>{rotulo}</Badge>;
      },
    },
    {
      key: "plano",
      header: cabecalho("plano", "Plano"),
      render: (l) =>
        l.situacao === "sem-conta" ? <Badge variant="warning">sem conta</Badge> : l.r.plano_ativo ? <Badge variant="success">ativo</Badge> : <Badge>inativo</Badge>,
    },
    { key: "canais", header: "Canais", render: (l) => l.canais.map(rotuloMarketplace).join(", ") || "—" },
    { key: "pedidos", header: cabecalho("pedidos", "Pedidos"), align: "right", render: (l) => (vende(l) ? l.pedidos.toLocaleString("pt-BR") : "—") },
    { key: "cancel", header: cabecalho("cancel", "% cancel."), align: "right", render: (l) => (vende(l) ? pct(l.pctCancel) : "—") },
    { key: "bruto", header: cabecalho("bruto", "Bruto"), align: "right", render: (l) => (vende(l) ? fmtBRL(l.bruto) : "—") },
    { key: "receita", header: cabecalho("receita", "Por anúncio"), align: "right", render: (l) => (vende(l) ? fmtBRL(l.receita) : "—") },
    { key: "cobertura", header: cabecalho("cobertura", "Cobertura"), align: "right", render: (l) => (vende(l) ? pct(l.cobertura) : "—") },
    { key: "anuncios", header: cabecalho("anuncios", "Anúncios"), align: "right", render: (l) => (vende(l) ? l.anuncios : "—") },
    { key: "fora", header: cabecalho("fora", "Fora do catálogo"), align: "right", render: (l) => l.fora || "—" },
    { key: "ultimo", header: cabecalho("ultimo", "Último pedido"), render: (l) => (l.ultimo ? fmtInstante(l.ultimo) : "—") },
  ];

  const top = topAnuncios(base);
  const colunasTop: Column<(typeof top)[number]>[] = [
    {
      key: "anuncio",
      header: "Anúncio",
      render: ({ p }) => (
        <span>
          {p.titulo || p.anuncio_id} {p.link && <LinkExterno url={p.link} rotulo="anúncio" />}
          {p.cadastrado_no_stlseller === false && <Badge variant="warning" className="ml-1">fora do catálogo</Badge>}
        </span>
      ),
    },
    { key: "mentorado", header: "Mentorado", render: ({ l }) => <Nome l={l} /> },
    { key: "marketplace", header: "Marketplace", render: ({ p }) => rotuloMarketplace(p.marketplace) },
    { key: "pedidos", header: "Pedidos", align: "right", render: ({ p }) => numOuTraco(p.pedidos) },
    { key: "unidades", header: "Unidades", align: "right", render: ({ p }) => numOuTraco(p.unidades) },
    { key: "faturamento", header: "Faturamento", align: "right", render: ({ p }) => brlOuTraco(p.faturamento) },
  ];

  const colunasEmail: Column<LinhaAnalise>[] = [
    { key: "nome", header: "Mentorado", render: (l) => <Nome l={l} /> },
    { key: "motivo", header: "Motivo", render: (l) => <Badge variant="warning">{l.email.ok ? "" : l.email.motivo}</Badge> },
    { key: "email", header: "E-mail do formulário", render: (l) => l.r.email },
    { key: "stlflix", header: "E-mail STLFLIX", render: (l) => l.r.email_stlflix || "—" },
    { key: "loja", header: "Loja encontrada por", render: (l) => lojaPor(l.r) ?? <Badge>sem loja</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="STLSeller"
        subtitle={
          <>
            Como os mentorados vendem nos marketplaces. <Badge variant="info">Dados do STLSeller</Badge>
            {sync ? ` atualizado em ${fmtInstante(sync)}` : ""}
          </>
        }
      />
      <AvisoRelacoes essenciais={[...ESSENCIAIS]}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status do formulário">
          {ANALISE_STATUS.map(([valor, rotulo]) => (
            <Button key={valor || "todos"} size="sm" variant={valor === status ? "primary" : "outline"} aria-pressed={valor === status} onClick={() => setStatus(valor)}>
              {`${rotulo} · ${recorteAnalise(linhas, valor).length}`}
            </Button>
          ))}
        </div>

        <section aria-label="Números do STLSeller" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard compact label="Bruto vendido" value={fmtBRL(agregados.bruto)} caption="pedidos pagos, enviados e entregues" />
          <StatCard compact label="Atribuído a anúncios" value={fmtBRL(agregados.receita)} caption={`${pct(agregados.bruto ? agregados.receita / agregados.bruto : null)} do bruto`} />
          <StatCard
            compact
            label="Pedidos"
            value={agregados.pedidos.toLocaleString("pt-BR")}
            caption={`${pct(agregados.pedidos ? agregados.cancelados / agregados.pedidos : null)} cancelados (${agregados.cancelados.toLocaleString("pt-BR")})`}
          />
          <StatCard compact label="Vendendo" value={`${agregados.vendendo} de ${base.length}`} caption={rotuloStatus.toLowerCase()} />
          <StatCard compact label="Plano STLSeller ativo" value={`${agregados.comPlano} de ${base.length}`} caption={`${agregados.semConta} sem conta de seller`} />
        </section>

        <Concentracao base={base} bruto={agregados.bruto} />

        <Secao titulo="Status real sugerido" dica="Cruzamento do formulário com os pedidos na Lia, feito pela view do STLSeller.">
          <div className="flex flex-wrap gap-2 p-4">
            {contagemStatusReal(base).map(([chave, n]) => {
              const [tom, rotulo] = STATUS_REAL.get(chave) ?? ["neutral", chave];
              return <Badge key={chave} variant={tom}>{`${rotulo} · ${n}`}</Badge>;
            })}
          </div>
        </Secao>

        <Card>
          <CardHeader
            title={`Visão geral por mentorado · ${lista.length}`}
            actions={
              <SearchInput
                className="w-64"
                value={busca}
                placeholder="Buscar por nome, loja ou e-mail"
                aria-label="Buscar por nome, loja ou e-mail"
                onChange={(e) => mudar({ filtro: { ...ui.filtro, qAnalise: e.target.value } })}
              />
            }
          />
          <div className="space-y-3 p-4">
            <SeloBusca termo={busca} n={lista.length} total={antesDaBusca} unidade="mentorado(s) neste recorte" limpar={() => mudar({ filtro: { ...ui.filtro, qAnalise: "" } })} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Recorte da tabela">
              {ANALISE_FILTROS.map(([valor, rotulo]) => (
                <Button key={valor} size="sm" variant={valor === chip ? "primary" : "outline"} aria-pressed={valor === chip} onClick={() => setChip(valor)}>
                  {rotulo}
                </Button>
              ))}
            </div>
          </div>
          {lista.length ? <DataTable columns={colunas} rows={lista} rowKey={(l) => l.r.email} /> : <EmptyState className="m-4" title="Ninguém neste recorte." />}
        </Card>

        <Secao titulo="Os 15 anúncios que mais faturam">
          {top.length ? <DataTable columns={colunasTop} rows={top} rowKey={({ p }) => `${p.email}|${p.marketplace}|${p.anuncio_id}`} /> : <EmptyState className="m-4" title="Nenhum anúncio com venda." />}
        </Secao>

        <Secao titulo={`Ainda sem nenhuma venda · ${grupos.semVenda.length}`} dica="Têm conta de seller, mas nenhum pedido registrado.">
          <Etiquetas linhas={grupos.semVenda} />
        </Secao>
        <Secao titulo={`Sem conta de seller · ${grupos.semConta.length}`} dica="Sem cadastro no STLSeller, não dá para acompanhar venda nenhuma.">
          <Etiquetas linhas={grupos.semConta} />
        </Secao>
        <Secao
          titulo={`E-mail não cadastrado corretamente · ${grupos.emailIncorreto.length}`}
          dica={`Quando o formulário traz o e-mail STLFLIX, ele é usado primeiro para achar a loja. Ficam aqui os que não têm e-mail STLFLIX ou cujo e-mail STLFLIX não leva à conta de seller: corrija o cadastro na origem.${
            grupos.peloStlflix.length ? ` ${grupos.peloStlflix.length} resolvido(s) pelo e-mail STLFLIX: ${grupos.peloStlflix.map(nomeAnalise).join(", ")}.` : ""
          }`}
        >
          {grupos.emailIncorreto.length ? <DataTable columns={colunasEmail} rows={grupos.emailIncorreto} rowKey={(l) => l.r.email} /> : <EmptyState className="m-4" title="Ninguém neste recorte." />}
        </Secao>
      </AvisoRelacoes>
    </div>
  );
}
