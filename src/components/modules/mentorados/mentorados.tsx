"use client";

import { LinkFicha, SituacaoMentorado, StatusContrato } from "@/components/modules/comum/celulas";
import { SeloBusca } from "@/components/modules/comum/selo-busca";
import { type Ui, useDados, useSessao, useUi } from "@/components/shell/contexto";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import SearchInput from "@/components/ui/search-input";
import SegmentedControl from "@/components/ui/segmented-control";
import SegmentedProgress from "@/components/ui/segmented-progress";
import SortHeader from "@/components/ui/sort-header";
import type { Mentorado } from "@/lib/data/esquemas";
import { fmtD } from "@/lib/datas";
import { ehAtivo, filtrarMentorados } from "@/lib/mentorados";
import { alternarOrdem, aplicarOrdem, type Ordem } from "@/lib/ordem";
import { concluidas1a1De, trilhaDe } from "@/lib/sessoes";

// A tela Mentorados (renderMentorados, index.html:1803–1850, mapeamento §3.2). Filtro e busca
// vêm de src/lib/mentorados.ts; a ordem, de src/lib/ordem.ts. O mentor lê a view sem colunas
// financeiras: a coluna Contrato e o filtro de contrato pendente são de quem vê financeiro.

// [`filtro.statusFin`, rótulo]: o SegmentedControl mostra o rótulo e grava a chave.
const FILTROS: readonly [string, string][] = [
  ["", "Todos"],
  ["ativos", "Somente ativos"],
  ["pausados", "Somente pausados"],
  ["incompletos", "Cadastro incompleto"],
  ["contrato", "Contrato pendente"],
];

const TABELA = "mentorados";
// Antes do primeiro clique, a ordem padrão da tabela, sem seta no cabeçalho.
const PADRAO: Ordem = { campo: "nome", direcao: "asc" };

export default function Mentorados() {
  const { dados } = useDados();
  const { pode } = useSessao();
  const { ui, mudar } = useUi();
  const verFinanceiro = pode("verFinanceiro");
  const { q, statusFin } = ui.filtro;
  const filtrar = (campos: Partial<Ui["filtro"]>) => mudar({ filtro: { ...ui.filtro, ...campos } });

  const { lista, antesDaBusca } = filtrarMentorados(dados.mentorados, statusFin, q);
  const escolhida = ui.sortState[TABELA];
  const ordem: Ordem | null = escolhida ? { campo: escolhida.coluna, direcao: escolhida.direcao } : null;
  const linhas = aplicarOrdem(lista, ordem ?? PADRAO, {
    nome: (m) => m.nome,
    fechamento: (m) => m.data_fechamento ?? "",
    contrato: (m) => m.contrato_status ?? "",
    sessoes: (m) => concluidas1a1De(dados.sessoes, m.id),
  });
  const cabecalho = (campo: string, rotulo: string) => (
    <SortHeader
      label={rotulo}
      direction={ordem?.campo === campo ? ordem.direcao : null}
      onToggle={() => {
        const nova = alternarOrdem(ordem, campo);
        mudar({ sortState: { ...ui.sortState, [TABELA]: { coluna: nova.campo, direcao: nova.direcao } } });
      }}
    />
  );
  // Não ativo aparece com opacidade reduzida. O DataTable não tem classe de linha: cada célula apaga.
  const celula = (m: Mentorado, conteudo: React.ReactNode) => <span className={ehAtivo(m) ? undefined : "opacity-60"}>{conteudo}</span>;

  const colunas: Column<Mentorado>[] = [
    {
      key: "nome",
      header: cabecalho("nome", "Mentorado"),
      render: (m) =>
        celula(
          m,
          <span className="flex flex-wrap items-center gap-2">
            <LinkFicha id={m.id}>{m.nome}</LinkFicha>
            <SituacaoMentorado mentorado={m} />
            {m.cadastro_incompleto && (
              <span title="Ficha criada por um pagamento na Lia. Falta contrato, ciclo, mentor e datas — abra e salve para completar.">
                <Badge variant="warning">cadastro incompleto</Badge>
              </span>
            )}
          </span>,
        ),
    },
    { key: "fechamento", header: cabecalho("fechamento", "Fechamento"), render: (m) => celula(m, fmtD(m.data_fechamento)) },
    ...(verFinanceiro ? [{ key: "contrato", header: cabecalho("contrato", "Contrato"), render: (m: Mentorado) => celula(m, <StatusContrato status={m.contrato_status} />) }] : []),
    {
      key: "sessoes",
      header: cabecalho("sessoes", "Sessões"),
      render: (m) => {
        const trilha = trilhaDe(dados.sessoes, m.id);
        return celula(
          m,
          trilha.length ? (
            <SegmentedProgress segments={trilha} label={`${concluidas1a1De(dados.sessoes, m.id)} de ${trilha.length} sessões 1:1 concluídas`} />
          ) : (
            <Badge>0 sessões</Badge>
          ),
        );
      },
    },
  ];
  const filtros = FILTROS.filter(([chave]) => chave !== "contrato" || verFinanceiro);
  const rotuloDoFiltro = filtros.find(([chave]) => chave === statusFin)?.[1] ?? "Todos";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mentorados"
        subtitle={`${linhas.length} de ${dados.mentorados.length} registro(s) · dados financeiros ficam em Financeiro`}
        actions={pode("criarMentorado") && <Button data-escrita="W14">+ Novo mentorado</Button>}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full max-w-sm"
          value={q}
          placeholder="Buscar mentorado por nome…"
          aria-label="Buscar mentorado por nome"
          onChange={(e) => filtrar({ q: e.target.value })}
        />
        <SegmentedControl
          items={filtros.map(([, rotulo]) => rotulo)}
          value={rotuloDoFiltro}
          onChange={(rotulo) => filtrar({ statusFin: filtros.find(([, r]) => r === rotulo)?.[0] ?? "" })}
        />
        <SeloBusca termo={q} n={lista.length} total={antesDaBusca} unidade="mentorado(s)" limpar={() => filtrar({ q: "" })} />
      </div>
      {linhas.length ? (
        <DataTable columns={colunas} rows={linhas} rowKey={(m) => m.id} />
      ) : (
        <EmptyState title="Nenhum mentorado encontrado com esses filtros." />
      )}
    </div>
  );
}
