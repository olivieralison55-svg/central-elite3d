"use client";

import { useState } from "react";

import { DataHora, LinkFicha, LinksSessao, StatusSessao } from "@/components/modules/comum/celulas";
import { CabecalhoOrdenavel, ordemEscolhida } from "@/components/modules/comum/ordenacao";
import { SeloBusca } from "@/components/modules/comum/selo-busca";
import { BotaoNovoMentorado } from "@/components/modules/mentorados/novo-mentorado";
import { type Ui, useDados, useSessao, useUi } from "@/components/shell/contexto";
import Alert from "@/components/ui/alert";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import SearchInput from "@/components/ui/search-input";
import SectionLabel from "@/components/ui/section-label";
import SegmentedControl from "@/components/ui/segmented-control";
import Select from "@/components/ui/select";
import { ordemDaEtapa, TODOS_MENTORES } from "@/lib/constantes";
import type { Sessao } from "@/lib/data/esquemas";
import { fmtD } from "@/lib/datas";
import { marcadorDeLinhas } from "@/lib/matriz";
import { nomeDe } from "@/lib/mentorados";
import { aplicarOrdem } from "@/lib/ordem";
import { blocos1a1, type Encontro, recortarSessoes, statusGrupo } from "@/lib/sessoes";

import { BotaoSessaoGrupo, EncontroGrupo } from "./grupo";

// A tela Sessões (renderSessoes, index.html:1856–1985, mapeamento §3.3): as 1:1 em blocos por
// status e os encontros em grupo por categoria. Recortes, blocos e marcas vêm de src/lib/sessoes.ts
// e src/lib/matriz.ts; aqui só se desenha.

// [`filtro.tipoSessao`, rótulo]
const TIPOS: readonly [string, string][] = [
  ["", "Todos os tipos"],
  ["individual", "Somente 1:1 com mentores"],
  ["grupo", "Somente em grupo"],
];
const MENTORES = [{ value: "", label: "Todos os mentores" }, ...TODOS_MENTORES.map((m) => ({ value: m, label: m })), { value: "__sem__", label: "— sem mentor —" }];

export default function Sessoes() {
  const { dados } = useDados();
  const { pode } = useSessao();
  const { ui, mudar } = useUi();
  const { foco, filtro } = ui;
  const filtrar = (campos: Partial<Ui["filtro"]>) => mudar({ filtro: { ...filtro, ...campos } });
  const nome = (id: string | null) => nomeDe(dados.mentorados, id);
  const recorte = recortarSessoes(dados.sessoes, { focoIds: foco?.ids ?? null, mentor: filtro.mentor, tipo: filtro.tipoSessao, busca: filtro.qSessoes }, nome);
  const marca = marcadorDeLinhas(dados.sessoes);
  const podeCriar = pode("criarSessao");
  const [encontroAberto, setEncontroAberto] = useState<Encontro | null>(null);

  const colunas1a1 = (tabela: string): Column<Sessao>[] => [
    { key: "data", header: <CabecalhoOrdenavel tabela={tabela} campo="data" rotulo="Data" />, render: (s) => <DataHora data={s.data} hora={s.hora} /> },
    {
      key: "mentorado",
      header: <CabecalhoOrdenavel tabela={tabela} campo="mentorado" rotulo="Mentorado" />,
      render: (s) => (
        <LinkFicha id={s.mentorado_id} aba="sessoes">
          {nome(s.mentorado_id)}
        </LinkFicha>
      ),
    },
    {
      key: "etapa",
      header: <CabecalhoOrdenavel tabela={tabela} campo="etapa" rotulo="Etapa" />,
      render: (s) => {
        const m = marca(s);
        return (
          <span className="flex flex-wrap items-center gap-2">
            {s.etapa}
            {m && (
              <span title={m.dica}>
                <Badge variant={m.tom}>{m.rotulo}</Badge>
              </span>
            )}
          </span>
        );
      },
    },
    { key: "mentor", header: <CabecalhoOrdenavel tabela={tabela} campo="mentor" rotulo="Mentor" />, render: (s) => s.mentor || "—" },
    { key: "status", header: "Status", render: (s) => <StatusSessao status={s.status} /> },
    { key: "links", header: "Links", render: (s) => <LinksSessao links={s} /> },
  ];
  const colunasGrupo = (tabela: string): Column<Encontro>[] => [
    {
      key: "data",
      header: <CabecalhoOrdenavel tabela={tabela} campo="data" rotulo="Data" />,
      // O encontro abre pelo botão da primeira célula, com o objeto dele, nunca por texto de coluna.
      render: (e) => (
        <Button variant="link" size="sm" aria-label={`Abrir o encontro ${e.etapa ?? ""} de ${fmtD(e.data)}`} onClick={() => setEncontroAberto(e)}>
          <DataHora data={e.data} hora={e.hora} />
        </Button>
      ),
    },
    { key: "mentor", header: <CabecalhoOrdenavel tabela={tabela} campo="mentor" rotulo="Mentor" />, render: (e) => e.mentor || "—" },
    { key: "participantes", header: <CabecalhoOrdenavel tabela={tabela} campo="participantes" rotulo="Participantes" />, align: "right", render: (e) => e.itens.length },
    { key: "status", header: "Status", render: (e) => <StatusSessao status={statusGrupo(e)} /> },
    { key: "links", header: "Links", render: (e) => <LinksSessao links={e} /> },
  ];
  const rotuloTipo = TIPOS.find(([chave]) => chave === filtro.tipoSessao)?.[1] ?? "Todos os tipos";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessões"
        subtitle={`${recorte.totais.concluidas1a1} sessões 1:1 concluídas · ${recorte.totais.agendadas1a1} agendadas · ${recorte.totais.encontros} encontro(s) em grupo`}
        actions={
          <>
            <BotaoSessaoGrupo />
            <BotaoNovoMentorado secundario={podeCriar} />
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full max-w-sm"
          value={filtro.qSessoes}
          placeholder="Buscar por mentorado, etapa, mentor ou data…"
          aria-label="Buscar por mentorado, etapa, mentor ou data"
          onChange={(e) => filtrar({ qSessoes: e.target.value })}
        />
        <SegmentedControl
          items={TIPOS.map(([, rotulo]) => rotulo)}
          value={rotuloTipo}
          onChange={(rotulo) => filtrar({ tipoSessao: TIPOS.find(([, r]) => r === rotulo)?.[0] ?? "" })}
        />
        <span className="w-48">
          <label htmlFor="sessoes-mentor" className="sr-only">
            Mentor
          </label>
          <Select id="sessoes-mentor" options={MENTORES} value={filtro.mentor} onChange={(mentor) => filtrar({ mentor })} />
        </span>
        <SeloBusca termo={filtro.qSessoes} n={recorte.selo.n} total={recorte.selo.total} unidade="sessão(ões) e encontro(s)" limpar={() => filtrar({ qSessoes: "" })} />
      </div>
      {foco && (
        <Alert
          variant="info"
          title={`${foco.titulo} · ${recorte.linhas.length} linha(s)`}
          action={
            <Button variant="link" size="sm" onClick={() => mudar({ foco: null })}>
              mostrar todas as sessões
            </Button>
          }
        >
          {foco.dica}
        </Alert>
      )}
      {foco && !recorte.linhas.length && (
        <EmptyState title="Nada a conferir aqui — as linhas apontadas pelo alerta já foram resolvidas. Volte ao dashboard para recarregar a contagem." />
      )}
      {recorte.mostraIndividuais && (
        <section aria-label="Sessões 1:1 com mentores" className="space-y-3">
          <SectionLabel as="h2">Sessões 1:1 com mentores</SectionLabel>
          {blocos1a1(recorte.individuais, foco !== null).map((bloco) => {
            const tabela = `sessoes_${bloco.chave}`;
            const linhas = aplicarOrdem(bloco.itens, ordemEscolhida(ui, tabela) ?? { campo: "data", direcao: bloco.chave === "concluidas" ? "desc" : "asc" }, {
              data: (s) => s.data ?? "",
              mentorado: (s) => nome(s.mentorado_id),
              etapa: (s) => ordemDaEtapa(s.etapa ?? ""),
              mentor: (s) => s.mentor ?? "",
            });
            return (
              <Section key={bloco.chave} title={bloco.titulo} count={linhas.length}>
                {linhas.length ? <DataTable columns={colunas1a1(tabela)} rows={linhas} rowKey={(s) => s.id} /> : <EmptyState title="Nada por aqui." />}
              </Section>
            );
          })}
        </section>
      )}
      {recorte.mostraGrupo && (
        <section aria-label="Sessões em grupo" className="space-y-3">
          <SectionLabel as="h2">Sessões em grupo</SectionLabel>
          {recorte.grupos.map(({ categoria, encontros }, i) => {
            const tabela = `grupo_${i}`;
            const linhas = aplicarOrdem(encontros, ordemEscolhida(ui, tabela) ?? { campo: "data", direcao: "desc" }, {
              data: (e) => e.data ?? "",
              mentor: (e) => e.mentor ?? "",
              participantes: (e) => e.itens.length,
            });
            return (
              <Section key={categoria} title={`${categoria} · ${linhas.length} encontro(s)`}>
                {linhas.length ? (
                  <DataTable columns={colunasGrupo(tabela)} rows={linhas} rowKey={(e) => e.chave} />
                ) : (
                  <EmptyState title={`Nenhum encontro registrado${podeCriar ? ' — use "+ Sessão em grupo"' : ""}.`} />
                )}
              </Section>
            );
          })}
        </section>
      )}
      <EncontroGrupo encontro={encontroAberto} onClose={() => setEncontroAberto(null)} />
    </div>
  );
}
