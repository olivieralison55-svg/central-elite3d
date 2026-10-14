"use client";

import { type ChangeEvent, useState } from "react";
import toast from "react-hot-toast";

import { DataHora, LinksSessao, StatusSessao } from "@/components/modules/comum/celulas";
import { useDados, useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import Dialog from "@/components/ui/dialog";
import EmptyState from "@/components/ui/empty-state";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import SectionLabel from "@/components/ui/section-label";
import SegmentedProgress from "@/components/ui/segmented-progress";
import Select from "@/components/ui/select";
import { ETAPAS, ETAPAS_GRUPO, MENTORES, S_STATUS } from "@/lib/constantes";
import type { Mentorado, Sessao } from "@/lib/data/esquemas";
import { type CamposSessao, confirmarSessao, delSessao, salvarSessao } from "@/lib/data/escritas";
import { fmtD } from "@/lib/datas";
import { nomeDe } from "@/lib/mentorados";
import { aplicarOrdem } from "@/lib/ordem";
import { concluidas1a1De, sessoes1a1De, sessoesGrupoDe, trilhaDe } from "@/lib/sessoes";

// A aba Sessões da ficha (index.html:3310–3336) e os modais de sessão (openSessao e
// openConfirmarSessao, index.html:3593–3682): a trilha 1:1 por etapa, os encontros em grupo por
// data, o formulário (W03, W05) e a confirmação (W04). O mentor edita e confirma; criar pede
// criarSessao e excluir pede excluir (mapeamento §4.2). Os corpos são exportados à parte do
// Dialog, que não renderiza sem `document` (design, componente 6).

const opcoes = (valores: readonly string[]) => valores.map((valor) => ({ value: valor, label: valor }));
// O mentor gravado continua escolhível mesmo fora de MENTORES (quem saiu do projeto).
const mentoresCom = (atual: string | null) => [...MENTORES, ...(atual && !MENTORES.includes(atual) ? [atual] : [])];

type Campos = Record<Exclude<keyof CamposSessao, "mentorado_id">, string>;

// A nova sessão sugere a próxima etapa 1:1 que o mentorado ainda não tem. Com as 12 usadas, a
// sugestão de hoje ("Checkup extra") não é opção e o navegador ficava na primeira: a primeira etapa.
function camposDe(sessao: Sessao | null, usadas: ReadonlySet<string | null>): Campos {
  return {
    etapa: sessao?.etapa || (ETAPAS.find((etapa) => !usadas.has(etapa)) ?? ETAPAS[0]),
    status: sessao?.status || "Agendada",
    mentor: sessao?.mentor ?? "",
    data: sessao?.data ?? "",
    hora: sessao?.hora?.slice(0, 5) ?? "",
    link_meet: sessao?.link_meet ?? "",
    link_gravacao: sessao?.link_gravacao ?? "",
    link_anotacoes: sessao?.link_anotacoes ?? "",
  };
}

const LINKS: readonly [keyof Campos, string][] = [
  ["link_meet", "Link Meet"],
  ["link_gravacao", "Link gravação"],
  ["link_anotacoes", "Link anotações"],
];

// W03: sem sessão cria, com sessão atualiza; W05 exclui, num ConfirmDialog. Sem validação, como
// hoje (mapeamento §10, item 30).
export function SessaoForm({ sessao, mentoradoId, aoTerminar }: { sessao: Sessao | null; mentoradoId: string; aoTerminar(): void }) {
  const { dados } = useDados();
  const { pode } = useSessao();
  const [campos, setCampos] = useState(() => camposDe(sessao, new Set(sessoes1a1De(dados.sessoes, mentoradoId).map((s) => s.etapa))));
  const [excluindo, setExcluindo] = useState(false);
  // Editar pede escreverSessao; criar pede criarSessao (o RLS só dá INSERT em sessoes ao admin).
  const salvar = useEscrita(sessao ? "escreverSessao" : "criarSessao", (gravada: CamposSessao) => salvarSessao(sessao?.id ?? null, gravada), "Sessão salva");
  const excluir = useEscrita("excluir", (id: string) => delSessao(id), "Sessão excluída");
  const escolher = (campo: keyof Campos) => (valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const digitar = (campo: keyof Campos) => (e: ChangeEvent<HTMLInputElement>) => escolher(campo)(e.target.value);
  const conhecidas = [...ETAPAS, ...ETAPAS_GRUPO];
  // Etapa fora das listas (registro antigo) vira opção dela: sem isso, salvar trocaria a etapa calado.
  const etapas = [...conhecidas, ...(sessao?.etapa && !conhecidas.includes(sessao.etapa) ? [sessao.etapa] : [])];
  const gravar = async () => {
    if (await salvar.executar({ mentorado_id: mentoradoId, ...campos })) aoTerminar();
  };
  const confirmarExclusao = async () => {
    if (!sessao || !(await excluir.executar(sessao.id))) return;
    setExcluindo(false);
    aoTerminar();
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Etapa" htmlFor="sessao-etapa">
          <Select id="sessao-etapa" options={opcoes(etapas)} value={campos.etapa} onChange={escolher("etapa")} />
        </FormField>
        <FormField label="Status" htmlFor="sessao-status">
          <Select id="sessao-status" options={opcoes(S_STATUS)} value={campos.status} onChange={escolher("status")} />
        </FormField>
        <FormField label="Mentor" htmlFor="sessao-mentor">
          <Select id="sessao-mentor" options={[{ value: "", label: "—" }, ...opcoes(mentoresCom(sessao?.mentor ?? null))]} value={campos.mentor} onChange={escolher("mentor")} />
        </FormField>
        <FormField label="Data" htmlFor="sessao-data">
          <Input id="sessao-data" type="date" value={campos.data} onChange={digitar("data")} />
        </FormField>
        <FormField label="Hora" htmlFor="sessao-hora">
          <Input id="sessao-hora" type="time" value={campos.hora} onChange={digitar("hora")} />
        </FormField>
      </div>
      <div className="grid gap-4">
        {LINKS.map(([campo, rotulo]) => (
          <FormField key={campo} label={rotulo} htmlFor={`sessao-${campo}`}>
            <Input id={`sessao-${campo}`} value={campos[campo]} onChange={digitar(campo)} />
          </FormField>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={salvar.ocupado} data-escrita="W03" onClick={() => void gravar().catch((erro: unknown) => console.error("[central-elite3d] salvar sessão", erro))}>
          Salvar sessão
        </Button>
        {sessao && pode("excluir") && (
          <Button variant="outline" size="sm" className="text-danger" data-escrita="W05" onClick={() => setExcluindo(true)}>
            Excluir
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={excluindo}
        title="Excluir sessão"
        description="Excluir esta sessão? A ação não pode ser desfeita."
        confirmLabel="Excluir sessão"
        busy={excluir.ocupado}
        onConfirm={() => void confirmarExclusao().catch((erro: unknown) => console.error("[central-elite3d] excluir sessão", erro))}
        onClose={() => setExcluindo(false)}
      />
    </div>
  );
}

// O modal de uma sessão, nova (`sessao` nula) ou existente. `aoTerminar` é o depois de gravar;
// sem ele, o mesmo que fechar.
export function SessaoDialogo({
  alvo,
  onClose,
  aoTerminar = onClose,
}: {
  alvo: { sessao: Sessao | null; mentoradoId: string } | null;
  onClose(): void;
  aoTerminar?(): void;
}) {
  const { dados } = useDados();
  const titulo = alvo ? `${alvo.sessao ? "Editar sessão" : "Nova sessão"} · ${nomeDe(dados.mentorados, alvo.mentoradoId)}` : undefined;
  return (
    <Dialog open={alvo !== null} onClose={onClose} title={titulo}>
      {alvo && <SessaoForm sessao={alvo.sessao} mentoradoId={alvo.mentoradoId} aoTerminar={aoTerminar} />}
    </Dialog>
  );
}

// W04: confirmar exige o mentor; sem ele, a sessão entra concluída sem dono e some da contagem por
// mentor. Confirmar não mexe na etapa deduzida (OPS-08).
export function ConfirmarSessaoForm({ sessao, aoTerminar }: { sessao: Sessao; aoTerminar(): void }) {
  const { dados } = useDados();
  const [mentor, setMentor] = useState(sessao.mentor ?? "");
  const { executar, ocupado } = useEscrita("escreverSessao", (quem: string) => confirmarSessao(sessao.id, quem), "Sessão confirmada como concluída");
  const confirmar = async () => {
    if (!mentor) {
      toast.error("Selecione quem atendeu a sessão");
      return;
    }
    if (await executar(mentor)) aoTerminar();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{`${sessao.etapa ?? ""} · ${nomeDe(dados.mentorados, sessao.mentorado_id)} · ${fmtD(sessao.data)}`}</p>
      <FormField label="Quem atendeu esta sessão?" htmlFor="confirmar-mentor">
        <Select id="confirmar-mentor" options={[{ value: "", label: "Selecione o mentor…" }, ...opcoes(mentoresCom(sessao.mentor))]} value={mentor} onChange={setMentor} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button loading={ocupado} data-escrita="W04" onClick={() => void confirmar().catch((erro: unknown) => console.error("[central-elite3d] confirmar sessão", erro))}>
          Confirmar como concluída
        </Button>
        <Button variant="outline" onClick={aoTerminar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ConfirmarSessaoDialogo({ sessao, onClose }: { sessao: Sessao | null; onClose(): void }) {
  return (
    <Dialog open={sessao !== null} onClose={onClose} title="Confirmar sessão">
      {sessao && <ConfirmarSessaoForm sessao={sessao} aoTerminar={onClose} />}
    </Dialog>
  );
}

export default function AbaSessoes({ mentorado: m }: { mentorado: Mentorado }) {
  const { dados } = useDados();
  const { pode } = useSessao();
  const [editando, setEditando] = useState<{ sessao: Sessao | null } | null>(null);
  const [confirmando, setConfirmando] = useState<Sessao | null>(null);
  const trilha = sessoes1a1De(dados.sessoes, m.id);
  // Os encontros em grupo do mentorado, do mais recente para o mais antigo.
  const grupo = aplicarOrdem(sessoesGrupoDe(dados.sessoes, m.id), { campo: "data", direcao: "desc" }, { data: (s) => s.data });
  // OPS-05: a legenda da trilha conta só as 1:1.
  const legenda = `${concluidas1a1De(dados.sessoes, m.id)} de ${trilha.length} sessões 1:1 concluídas`;
  const escreve = pode("escreverSessao");
  const linha = (s: Sessao) => (
    <li key={s.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,2fr)_auto] sm:items-center">
      <span className="text-sm font-semibold text-ink">{s.etapa}</span>
      <StatusSessao status={s.status} />
      <DataHora data={s.data} hora={s.hora} />
      <span className="flex flex-col gap-1 text-sm">
        <span className="text-ink">{s.mentor || "— sem mentor"}</span>
        <LinksSessao links={s} />
      </span>
      <span className="flex flex-wrap gap-2">
        {escreve && s.status === "Aguardando confirmação" && (
          <Button size="sm" data-escrita="W04" onClick={() => setConfirmando(s)}>
            Confirmar
          </Button>
        )}
        {escreve && (
          <Button variant="outline" size="sm" data-escrita="W03" onClick={() => setEditando({ sessao: s })}>
            Editar
          </Button>
        )}
      </span>
    </li>
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <SegmentedProgress segments={trilhaDe(dados.sessoes, m.id)} label={legenda} />
          <span className="text-sm text-muted">{legenda}</span>
        </span>
        {pode("criarSessao") && (
          <Button data-escrita="W03" onClick={() => setEditando({ sessao: null })}>
            + Nova sessão
          </Button>
        )}
      </div>
      <section className="space-y-2">
        <SectionLabel as="h3">Sessões 1:1 com mentores</SectionLabel>
        {trilha.length ? <ul className="divide-y divide-line">{trilha.map(linha)}</ul> : <EmptyState title="Nenhuma sessão registrada ainda." />}
      </section>
      {grupo.length > 0 && (
        <section className="space-y-2">
          <SectionLabel as="h3">{`Sessões em grupo · ${grupo.length}`}</SectionLabel>
          <ul className="divide-y divide-line">{grupo.map(linha)}</ul>
        </section>
      )}
      <SessaoDialogo alvo={editando && { sessao: editando.sessao, mentoradoId: m.id }} onClose={() => setEditando(null)} />
      <ConfirmarSessaoDialogo sessao={confirmando} onClose={() => setConfirmando(null)} />
    </div>
  );
}
