"use client";

import Link from "next/link";

import { SituacaoMentorado } from "@/components/modules/comum/celulas";
import { useDados, useNavegar, useSessao, useUi } from "@/components/shell/contexto";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import Tabs from "@/components/ui/tabs";
import { fmtD } from "@/lib/datas";
import { ABAS_FICHA, type Aba, abaVisivel, caminhoDaFicha } from "@/lib/endereco";
import { itensDoMenu } from "@/lib/papeis";
import { concluidas1a1De, implementacaoDe, plantoesDe, sessoes1a1De } from "@/lib/sessoes";

import AbaCadastro from "./aba-cadastro";
import AbaFinanceiro from "./aba-financeiro";
import AbaSessoes from "./aba-sessoes";
import AbaStlseller from "./aba-stlseller";
import EditorNotas from "./editor-notas";

// A ficha do mentorado (renderFicha, index.html:3188–3243; mapeamento §3.4): o topo comum a todas
// as abas, as abas que o papel abre e o corpo de cada uma. A ficha é o detalhe de uma lista: o
// "voltar" leva à lista de onde ela foi aberta (`voltarPara`), que é também o item aceso do menu.

const ROTULO_ABA: Record<Aba, string> = { cadastro: "Cadastro", financeiro: "Financeiro", sessoes: "Sessões", notas: "Notas", stlseller: "STLSeller" };

function Voltar() {
  const { papel } = useSessao();
  const { ui } = useUi();
  // A casca só grava em `voltarPara` tela que o papel abre: o rótulo sai do menu dele.
  const rotulo = itensDoMenu(papel).find((item) => item.caminho === ui.voltarPara)?.rotulo ?? "Mentorados";
  return (
    <Link href={ui.voltarPara} className="text-sm font-medium text-muted hover:text-ink hover:underline">
      {`← ${rotulo}`}
    </Link>
  );
}

// NAV-09 e EDGE-01: o endereço sobrevive ao registro. Link errado, ou ficha excluída e recarregada,
// não pode virar tela em branco.
function NaoEncontrada() {
  return (
    <div className="space-y-6">
      <Voltar />
      <PageHeader title="Ficha não encontrada" subtitle="Este mentorado não existe mais, ou o endereço está errado." />
      <EmptyState
        title="Se a ficha foi excluída, o histórico dela saiu junto."
        action={
          <Link href="/mentorados" className="text-sm font-semibold text-primary hover:underline">
            Ver todos os mentorados
          </Link>
        }
      />
    </div>
  );
}

export default function Ficha({ id, aba }: { id: string; aba?: string }) {
  const { dados } = useDados();
  const { papel, pode } = useSessao();
  const { ir } = useNavegar();
  const m = dados.mentorados.find((x) => x.id === id);
  if (!m) return <NaoEncontrada />;
  // NAV-05: quem não vê financeiro fica em Sessões sem reescrever a URL, e só vê as abas que abre.
  const atual = abaVisivel(aba, papel);
  const abas = ABAS_FICHA.filter((a) => abaVisivel(a, papel) === a);
  const parcelas = dados.parcelas.filter((p) => p.mentorado_id === m.id);
  const trilha = sessoes1a1De(dados.sessoes, m.id);
  const implementacao = implementacaoDe(dados.sessoes, m.id);
  // O topo não depende da aba: quem está no cadastro também quer saber se o financeiro está em dia.
  // OPS-05: o "N de M" conta só a trilha 1:1.
  const resumo = [
    `Fechamento ${fmtD(m.data_fechamento)}`,
    pode("verFinanceiro") && parcelas.length ? `${parcelas.filter((p) => p.status === "paga").length}/${parcelas.length} parcelas pagas` : "",
    trilha.length ? `${concluidas1a1De(dados.sessoes, m.id)} de ${trilha.length} sessões concluídas` : "",
    implementacao ? `Implementação feita em ${fmtD(implementacao.data)}` : "Implementação pendente",
    `${plantoesDe(dados.sessoes, m)} plantão(ões) de dúvida desde a entrada`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-6">
      <Voltar />
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {m.nome}
            <SituacaoMentorado mentorado={m} />
          </span>
        }
        subtitle={resumo}
      />
      <Tabs items={abas.map((a) => ({ value: a, label: ROTULO_ABA[a] }))} value={atual} onChange={(nova) => ir(caminhoDaFicha(m.id, abaVisivel(nova, papel)))} />
      {/* A key é o mentorado: outra ficha monta os formulários do zero, sem o estado da anterior. */}
      <div key={m.id}>
        {atual === "cadastro" && <AbaCadastro mentorado={m} />}
        {atual === "financeiro" && <AbaFinanceiro mentorado={m} />}
        {atual === "sessoes" && <AbaSessoes mentorado={m} />}
        {atual === "notas" && <EditorNotas mentoradoId={m.id} />}
        {atual === "stlseller" && <AbaStlseller mentorado={m} />}
      </div>
    </div>
  );
}
