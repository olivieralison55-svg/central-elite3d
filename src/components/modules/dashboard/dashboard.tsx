"use client";

import { CircleCheck, MessageCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { DataHora, LinkFicha, StatusSessao } from "@/components/modules/comum/celulas";
import { SeloBusca } from "@/components/modules/comum/selo-busca";
import { BotaoNovoMentorado } from "@/components/modules/mentorados/novo-mentorado";
import { EncontroGrupo } from "@/components/modules/sessoes/grupo";
import { type Ui, useDados, useNavegar, useSessao, useUi } from "@/components/shell/contexto";
import { AvisoRelacoes } from "@/components/shell/dados";
import Alert from "@/components/ui/alert";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import Progress from "@/components/ui/progress";
import SearchInput from "@/components/ui/search-input";
import SectionLabel from "@/components/ui/section-label";
import Select from "@/components/ui/select";
import StatCard from "@/components/ui/stat-card";
import { INICIO_COBRANCA_NPS, LINK_PESQUISA_EXP, META_ADESAO_EXP, NIVEIS } from "@/lib/constantes";
import type { Dataset, Relacao } from "@/lib/data/esquemas";
import { fmtD, hojeSP } from "@/lib/datas";
import { linkWhatsapp } from "@/lib/links";
import { type ChaveAviso, type Contagem, focoDoAviso, type Matriz, matrizMentores } from "@/lib/matriz";
import { fmtBRL } from "@/lib/moeda";
import { type ItemAtencao, type Painel, painel, type Proxima } from "@/lib/painel";
import { type Encontro, ETAPA_IMPLEMENTACAO } from "@/lib/sessoes";

// Dashboard e Acompanhamento (index.html:1474–1800, mapeamento §3.1). As regras moram em
// src/lib/painel.ts e src/lib/matriz.ts; aqui só se desenha o que elas devolvem. O Acompanhamento
// é o mesmo cálculo mostrando só o painel de atenção e as listas que ele aponta: os dois nunca
// discordam.

// DATA-07: o que falta nessas relações vira aviso no topo, e o resto da tela continua.
const COMPLEMENTARES: Relacao[] = [
  "lia_cobrancas",
  "mentorado_marcos",
  "faturamento_mensal",
  "sessoes_orfas",
  "nps_respostas",
  "experiencia_respostas",
  "experiencia_adesao",
];

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
// O cabeçalho da matriz abrevia a etapa; o nome inteiro fica no title.
const abreviar = (etapa: string) => etapa.replace("Diagnóstico de Negócio", "Diag.").replace("Plano de Ação", "Plano").replace("Checkup ", "C");
const ponto = (n: number) => n || "·";

// Os rodapés da matriz que levam às linhas em Sessões (NAV-10).
const AVISOS_MATRIZ: { chave: ChaveAviso; rotulo: (n: number) => string; acao: string }[] = [
  { chave: "dobradas", rotulo: (n) => `${n} reunião(ões) gravada(s) em duas etapas — contei uma vez cada`, acao: "conferir" },
  { chave: "semData", rotulo: (n) => `${n} sessão(ões) concluída(s) sem data — fora de qualquer mês`, acao: "conferir" },
  { chave: "semMentor", rotulo: (n) => `${n} sessão(ões) aguardando confirmação sem mentor definido`, acao: "ver" },
  { chave: "etapaDeduzida", rotulo: (n) => `${n} sessão(ões) com etapa escolhida pelo sync, sem confirmação`, acao: "conferir" },
];

function PainelAtencao({ itens, ir }: { itens: ItemAtencao[]; ir(item: ItemAtencao): void }) {
  const temAtencao = itens.some((i) => i.contagem > 0);
  return (
    <section aria-label="Precisa de atenção">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              {temAtencao ? <TriangleAlert size={16} className="text-warning" /> : <CircleCheck size={16} className="text-success" />}
              {temAtencao ? "Precisa de atenção agora" : "Tudo em ordem"}
            </span>
          }
        />
        <ul className="divide-y divide-line">
          {itens.map((item) => (
            <li key={item.chave} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className={item.contagem ? "text-ink" : "text-muted"}>{item.rotulo}</span>
              <span className="flex items-center gap-4">
                <span className={`font-bold ${item.contagem ? "text-ink" : "text-muted"}`}>{item.contagem}</span>
                {item.contagem > 0 && item.link && "ancora" in item.link && (
                  <a href={`#${item.link.ancora}`} aria-label={`Ver: ${item.rotulo}`} className="text-xs font-semibold text-primary hover:underline">
                    ver
                  </a>
                )}
                {item.contagem > 0 && item.link && "caminho" in item.link && (
                  <Button variant="link" size="sm" aria-label={`Ver: ${item.rotulo}`} onClick={() => ir(item)}>
                    ver
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function Numeros({ numeros }: { numeros: Painel["numeros"] }) {
  return (
    <section aria-label="Números gerais" className="space-y-3">
      <SectionLabel as="h2">Números gerais</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mentorados ativos" value={numeros.ativos} caption={`${numeros.pausados} pausado(s) · ${numeros.cancelados} cancelado(s)`} />
        <StatCard label="Sessões 1:1 concluídas" value={numeros.concluidas1a1} caption="no total" />
        <StatCard label="Agendadas" value={numeros.agendadas1a1} caption="próximas sessões 1:1" />
        <StatCard label="Encontros em grupo" value={numeros.encontros} caption={`${numeros.presencas} presença(s) · ${numeros.encontrosAgendados} agendado(s)`} />
      </div>
    </section>
  );
}

function Progressao({ progressao }: { progressao: Painel["progressao"] }) {
  if (!progressao.length) return null;
  return (
    <section aria-label="Progressão por faturamento" className="space-y-3">
      <SectionLabel as="h2">Progressão por faturamento</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {[...NIVEIS].reverse().map((n) => (
          <Badge key={n.nome}>{`${n.nome}${n.min > 0 ? ` · ${n.min >= 1000 ? `${n.min / 1000}k` : n.min}` : ""}`}</Badge>
        ))}
      </div>
      <Card className="divide-y divide-line">
        {progressao.map(({ mentorado, nivel }) => (
          <div key={mentorado.id} className="grid items-center gap-3 px-5 py-3 text-sm md:grid-cols-[1fr_1fr_auto]">
            <span className="flex items-center gap-2">
              <LinkFicha id={mentorado.id}>{mentorado.nome}</LinkFicha>
              <Badge variant="success">{nivel.atual.nome}</Badge>
            </span>
            <Progress value={nivel.pct} tone="success" label={`${nivel.pct}% rumo a ${nivel.proximo ? nivel.proximo.nome : "nível máximo"}`} />
            <span className="text-right">
              <span className="block font-bold text-ink">{fmtBRL(nivel.total)}</span>
              <span className="text-xs text-muted">
                {nivel.proximo ? `faltam ${fmtBRL(nivel.proximo.min - nivel.total)} para ${nivel.proximo.nome}` : "nível máximo atingido"}
              </span>
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

type LinhaMatriz = Contagem & { mentor: string; foraDoProjeto: boolean; semMentor: boolean };

function TabelaMatriz({ matriz, mudarMes, focar }: { matriz: Matriz; mudarMes(mes: string): void; focar(chave: ChaveAviso): void }) {
  const linhas: LinhaMatriz[] = [
    ...matriz.linhas.map((l) => ({ ...l, semMentor: false })),
    ...(matriz.semMentor ? [{ ...matriz.semMentor, mentor: "Sem mentor identificado", foraDoProjeto: false, semMentor: true }] : []),
  ];
  const colunas: Column<LinhaMatriz>[] = [
    {
      key: "mentor",
      header: "Mentor",
      render: (l) => (
        <span className={l.semMentor ? "text-muted" : "font-medium text-ink"}>
          {l.mentor}
          {l.foraDoProjeto && (
            <Badge variant="neutral" className="ml-2">
              fora do projeto
            </Badge>
          )}
        </span>
      ),
    },
    ...matriz.etapas.map((etapa, i): Column<LinhaMatriz> => ({
      key: `etapa-${i}`,
      header: <span title={etapa}>{abreviar(etapa)}</span>,
      align: "right",
      render: (l) => ponto(l.porEtapa[i]),
    })),
    {
      key: "total1a1",
      header: <span title="Sessões 1:1 concluídas, contadas por reunião">1:1</span>,
      align: "right",
      render: (l) => <span className={`font-bold ${l.semMentor ? "text-warning" : "text-success"}`}>{ponto(l.total1a1)}</span>,
    },
    ...(matriz.temGrupo
      ? [
          {
            key: "grupo",
            header: <span title="Encontros em grupo realizados — não presenças">Grupo</span>,
            align: "right" as const,
            render: (l: LinhaMatriz) => <span title={`${l.presencas} presença(s) somada(s)`}>{ponto(l.grupo)}</span>,
          },
        ]
      : []),
  ];
  const opcoes = [{ value: "", label: "Todos os meses" }, ...matriz.meses.map((mes) => ({ value: mes, label: rotuloMes(mes) }))];
  return (
    <Card>
      <CardHeader
        title="Sessões concluídas por mentor"
        actions={
          <span className="w-44">
            <label htmlFor="mes-matriz" className="sr-only">
              Mês da matriz
            </label>
            <Select id="mes-matriz" options={opcoes} value={matriz.mes} onChange={mudarMes} />
          </span>
        }
      />
      <div className="space-y-3 p-5">
        {linhas.length ? (
          <DataTable columns={colunas} rows={linhas} rowKey={(l) => (l.semMentor ? "" : l.mentor)} />
        ) : (
          <EmptyState title={`Nenhuma sessão concluída ${matriz.mes ? "neste mês" : "registrada"}.`} />
        )}
        {AVISOS_MATRIZ.filter((a) => matriz.avisos[a.chave] > 0).map((a) => (
          <div key={a.chave} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-ink">{a.rotulo(matriz.avisos[a.chave])}</span>
            <Button variant="link" size="sm" data-aviso={a.chave} onClick={() => focar(a.chave)}>
              {a.acao}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Proximas({ proximas, busca, abrirEncontro }: { proximas: Proxima[]; busca: string; abrirEncontro(encontro: Encontro): void }) {
  const colunas: Column<Proxima>[] = [
    {
      key: "data",
      header: "Data",
      render: (p) => {
        const { encontro } = p;
        if (!encontro) return <DataHora data={p.data} hora={p.hora} />;
        return (
          <Button variant="link" size="sm" aria-label={`Abrir o encontro ${encontro.etapa ?? ""} de ${fmtD(encontro.data)}`} onClick={() => abrirEncontro(encontro)}>
            <DataHora data={p.data} hora={p.hora} />
          </Button>
        );
      },
    },
    {
      key: "quem",
      header: "Mentorado",
      render: (p) =>
        p.encontro ? (
          <span className="flex items-center gap-2">
            <Badge variant="info">grupo</Badge>
            {p.quem}
          </span>
        ) : (
          <LinkFicha id={p.mentoradoId} aba="sessoes">
            {p.quem}
          </LinkFicha>
        ),
    },
    { key: "etapa", header: "Etapa", render: (p) => p.etapa },
    { key: "mentor", header: "Mentor", render: (p) => p.mentor || "—" },
  ];
  return (
    <Card>
      <CardHeader title="Próximas sessões agendadas" />
      <div className="p-5">
        {proximas.length ? (
          <DataTable columns={colunas} rows={proximas} rowKey={(p) => p.chave} />
        ) : (
          <EmptyState title={busca.trim() ? "Nenhuma sessão agendada para essa busca." : "Nenhuma sessão agendada. Agende pela ficha do mentorado."} />
        )}
      </div>
    </Card>
  );
}

// Uma lista apontada por um item do painel: aparece só quando o total da operação passa de 0.
function ListaAtencao<T>({
  id,
  titulo,
  dica,
  total,
  vazio,
  colunas,
  itens,
  chave,
}: {
  id: string;
  titulo: string;
  dica?: string;
  total: number;
  vazio: string;
  colunas: Column<T>[];
  itens: T[];
  chave(item: T): string;
}) {
  if (total === 0) return null;
  return (
    <Card id={id}>
      <CardHeader title={titulo} />
      <div className="space-y-3 p-5">
        {dica && <p className="text-xs text-muted">{dica}</p>}
        {itens.length ? <DataTable columns={colunas} rows={itens} rowKey={chave} /> : <EmptyState title={vazio} />}
      </div>
    </Card>
  );
}

function Listas({ listas }: { listas: Painel["listas"] }) {
  const { orfas, risco, semImplementacao, semSubida, npsPend } = listas;
  return (
    <>
      <ListaAtencao
        id="orfas"
        titulo="Sessões sem evento no Google Agenda"
        dica="O evento foi apagado, renomeado ou saiu da janela de sincronização. Estes registros pararam de receber atualização e precisam de conferência manual."
        total={orfas.total}
        vazio={`Nenhuma das ${orfas.total} sessões sem evento casa com a busca.`}
        itens={orfas.itens}
        chave={(o) => o.id}
        colunas={[
          { key: "data", header: "Data", render: (o) => <DataHora data={o.data} hora={o.hora} /> },
          { key: "mentorado", header: "Mentorado", render: (o) => <LinkFicha id={o.mentorado_id} aba="sessoes">{o.mentorado_nome}</LinkFicha> },
          { key: "etapa", header: "Etapa", render: (o) => o.etapa },
          { key: "mentor", header: "Mentor", render: (o) => o.mentor || <Badge variant="warning">sem mentor</Badge> },
          { key: "status", header: "Status", render: (o) => <StatusSessao status={o.status} /> },
        ]}
      />
      <ListaAtencao
        id="risco"
        titulo="Mentorados sem sessão há +30 dias"
        total={risco.total}
        vazio={`Nenhum dos ${risco.total} mentorados sem sessão casa com a busca.`}
        itens={risco.itens}
        chave={(r) => r.mentorado.id}
        colunas={[
          { key: "mentorado", header: "Mentorado", render: (r) => <LinkFicha id={r.mentorado.id} aba="sessoes">{r.mentorado.nome}</LinkFicha> },
          { key: "ultima", header: "Última sessão", render: (r) => (r.ultima ? fmtD(r.ultima) : `nunca · fechou ${fmtD(r.mentorado.data_fechamento)}`) },
          {
            key: "acao",
            header: "",
            // Contatar abre a conversa no wa.me com o número do Canal WhatsApp; sem número, fica o selo (AD-012).
            render: (r) => {
              if (!r.ultima) return <Badge variant="danger">Nunca começou</Badge>;
              const whatsapp = linkWhatsapp(r.mentorado.link_whatsapp);
              if (!whatsapp) return <Badge variant="warning">Contatar</Badge>;
              return (
                <Button variant="outline" size="sm" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} />
                  Contatar<span className="sr-only"> no WhatsApp</span>
                </Button>
              );
            },
          },
        ]}
      />
      <ListaAtencao
        id="sem-implementacao"
        titulo={`Sem sessão de implementação · ${semImplementacao.total}`}
        dica={`Todo mentorado tem direito a uma. Conta a presença concluída em ${ETAPA_IMPLEMENTACAO}.`}
        total={semImplementacao.total}
        vazio={`Nenhum dos ${semImplementacao.total} mentorados sem implementação casa com a busca.`}
        itens={semImplementacao.itens}
        chave={(x) => x.mentorado.id}
        colunas={[
          { key: "mentorado", header: "Mentorado", render: (x) => <LinkFicha id={x.mentorado.id} aba="sessoes">{x.mentorado.nome}</LinkFicha> },
          { key: "fechamento", header: "Fechamento", render: (x) => fmtD(x.mentorado.data_fechamento) },
          { key: "plantoes", header: "Plantões de dúvida", align: "right", render: (x) => x.plantoes },
        ]}
      />
      <ListaAtencao
        id="sem-subida"
        titulo={`Sem subir de marco há +30 dias · ${semSubida.total}`}
        dica="Contrato assinado. Conta da última subida de marco; quem nunca subiu, do fechamento."
        total={semSubida.total}
        vazio={`Nenhum dos ${semSubida.total} mentorados sem subir de marco casa com a busca.`}
        itens={semSubida.itens}
        chave={(x) => x.mentorado.id}
        colunas={[
          { key: "mentorado", header: "Mentorado", render: (x) => <LinkFicha id={x.mentorado.id}>{x.mentorado.nome}</LinkFicha> },
          {
            key: "subida",
            header: "Última subida",
            render: (x) =>
              x.subiu ? `${x.marco?.nome ?? "marco"}${x.rota ? ` · ${x.rota.nome}` : ""} · ${fmtD(x.ref)}` : `nunca · fechou ${fmtD(x.ref)}`,
          },
          { key: "dias", header: "Dias", align: "right", render: (x) => x.dias },
          { key: "estado", header: "", render: (x) => (x.subiu ? <Badge variant="warning">Travou</Badge> : <Badge variant="danger">Nunca subiu</Badge>) },
        ]}
      />
      <ListaAtencao
        id="nps-pend"
        titulo={`Pesquisa de satisfação pendente · ${npsPend.total}`}
        dica={`Última sessão 1:1 concluída desde ${fmtD(INICIO_COBRANCA_NPS)}, há 2+ dias, sem resposta do mentorado.`}
        total={npsPend.total}
        vazio={`Nenhum dos ${npsPend.total} mentorados com pesquisa pendente casa com a busca.`}
        itens={npsPend.itens}
        chave={(x) => x.mentorado.id}
        colunas={[
          { key: "mentorado", header: "Mentorado", render: (x) => <LinkFicha id={x.mentorado.id} aba="sessoes">{x.mentorado.nome}</LinkFicha> },
          { key: "data", header: "Última sessão", render: (x) => fmtD(x.sessao.data) },
          { key: "etapa", header: "Etapa", render: (x) => x.sessao.etapa },
          { key: "mentor", header: "Mentor", render: (x) => x.sessao.mentor },
        ]}
      />
    </>
  );
}

// Números gerais, progressão e o detalhe analítico: só no Dashboard.
function Detalhe({
  resumo,
  sessoes,
  hoje,
  busca,
  abrirEncontro,
}: {
  resumo: Painel;
  sessoes: Dataset["sessoes"];
  hoje: string;
  busca: string;
  abrirEncontro(encontro: Encontro): void;
}) {
  const { ui, mudar } = useUi();
  const { ir } = useNavegar();
  const { dados } = useDados();
  const matriz = matrizMentores(sessoes, ui.mesMatriz, hoje, dados.mentores);
  // NAV-10: o aviso leva às linhas dele. Tipo e mentor zeram: um filtro ativo esconderia justamente
  // o que o aviso aponta, e a tela abriria vazia sem explicar por quê.
  const focar = (chave: ChaveAviso) => {
    mudar({ foco: focoDoAviso(matriz, chave), filtro: { ...ui.filtro, tipoSessao: "", mentor: "" } });
    ir("/sessoes");
  };
  return (
    <>
      <Numeros numeros={resumo.numeros} />
      <Progressao progressao={resumo.progressao} />
      <section aria-label="Detalhe analítico" className="space-y-3">
        <SectionLabel as="h2">Detalhe analítico</SectionLabel>
        <div className="grid gap-4 xl:grid-cols-2">
          <TabelaMatriz matriz={matriz} mudarMes={(mes) => mudar({ mesMatriz: mes })} focar={focar} />
          <Proximas proximas={resumo.proximas} busca={busca} abrirEncontro={abrirEncontro} />
        </div>
      </section>
    </>
  );
}

function Conteudo({ modo }: { modo: "completo" | "acompanhamento" }) {
  const { dados } = useDados();
  const { papel } = useSessao();
  const { ui, mudar } = useUi();
  const { ir } = useNavegar();
  const hoje = hojeSP();
  const busca = ui.filtro.qDash;
  const resumo = painel(dados, papel, hoje, busca);
  const acompanhamento = modo === "acompanhamento";
  const filtrar = (campos: Partial<Ui["filtro"]>) => mudar({ filtro: { ...ui.filtro, ...campos } });
  // O encontro em grupo das próximas abre no detalhe dele, com o objeto, nunca por texto de coluna.
  const [encontroAberto, setEncontroAberto] = useState<Encontro | null>(null);

  // O "ver" de um item que leva a outra tela; o dos criados pela Lia já abre Mentorados filtrada.
  const verItem = (item: ItemAtencao) => {
    if (!item.link || !("caminho" in item.link)) return;
    if (item.link.statusFin) filtrar({ statusFin: item.link.statusFin });
    ir(item.link.caminho);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={acompanhamento ? "Acompanhamento" : "Dashboard"}
        subtitle={`${acompanhamento ? "O que precisa de atenção agora, com as listas de cada alerta" : "Visão geral da operação"} · ${resumo.ativos} mentorados ativos`}
        actions={<BotaoNovoMentorado />}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full max-w-sm"
          value={busca}
          placeholder="Buscar mentorado nas listas desta tela…"
          aria-label="Buscar mentorado nas listas desta tela"
          onChange={(e) => filtrar({ qDash: e.target.value })}
        />
        {busca.trim() ? (
          <SeloBusca
            termo={busca}
            n={resumo.ativosNaBusca}
            total={resumo.ativos}
            unidade="mentorado(s) ativo(s) · os totais continuam da operação inteira"
            limpar={() => filtrar({ qDash: "" })}
          />
        ) : (
          <span className="text-xs text-muted">filtra as listas de mentorados abaixo — os totais continuam da operação inteira</span>
        )}
      </div>
      {resumo.adesao && (
        <Alert variant="warning" title="Poucas respostas na Pesquisa de Experiência">
          <p>
            {`Desde ${fmtD(INICIO_COBRANCA_NPS)}, ${resumo.adesao.respostas} resposta(s) para ${resumo.adesao.total} mentorado(s) com sessão (${resumo.adesao.pct}%, a meta é ${Math.round(100 * META_ADESAO_EXP)}%). Reforce o convite ao fim das suas sessões — a pesquisa é anônima e leva poucos minutos.`}
          </p>
          <a href={LINK_PESQUISA_EXP} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Link da pesquisa para enviar
          </a>
        </Alert>
      )}
      <PainelAtencao itens={resumo.atencao} ir={verItem} />
      {!acompanhamento && <Detalhe resumo={resumo} sessoes={dados.sessoes} hoje={hoje} busca={busca} abrirEncontro={setEncontroAberto} />}
      <Listas listas={resumo.listas} />
      <EncontroGrupo encontro={encontroAberto} onClose={() => setEncontroAberto(null)} />
    </div>
  );
}

export default function Dashboard({ modo }: { modo: "completo" | "acompanhamento" }) {
  return (
    <AvisoRelacoes complementares={COMPLEMENTARES}>
      <Conteudo modo={modo} />
    </AvisoRelacoes>
  );
}
