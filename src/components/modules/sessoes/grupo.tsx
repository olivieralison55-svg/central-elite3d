"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import { LinksSessao, StatusSessao } from "@/components/modules/comum/celulas";
import { useDados, useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";
import Dialog from "@/components/ui/dialog";
import EmptyState from "@/components/ui/empty-state";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import SearchInput from "@/components/ui/search-input";
import SectionLabel from "@/components/ui/section-label";
import Select from "@/components/ui/select";
import { casaBusca } from "@/lib/busca";
import { ETAPAS_GRUPO, MENTORES, S_STATUS } from "@/lib/constantes";
import { confirmarGrupo, criarSessaoGrupo, type EncontroGrupo as CamposEncontro } from "@/lib/data/escritas";
import { fmtD, hojeSP } from "@/lib/datas";
import { ehAtivo, nomeDe } from "@/lib/mentorados";
import { type Encontro, resumoStatusGrupo } from "@/lib/sessoes";

// Os encontros em grupo (index.html:1990–2102): o detalhe com as presenças e a confirmação em lote
// (W01), e o registro de um encontro novo, uma linha por participante (W02). Os corpos são
// exportados à parte do Dialog, que não renderiza sem `document` (design, componente 6).

const opcoes = (valores: readonly string[]) => valores.map((valor) => ({ value: valor, label: valor }));

// Confirmar em lote exige o mentor, a mesma regra da confirmação individual: sem ele a sessão entra
// concluída sem dono e some da contagem por mentor. Só as presenças pendentes são marcadas.
function ConfirmarEncontro({ encontro, aoConfirmar }: { encontro: Encontro; aoConfirmar(): void }) {
  const ids = encontro.itens.filter((s) => s.status !== "Concluída").map((s) => s.id);
  const mentores = [...MENTORES, ...(encontro.mentor && !MENTORES.includes(encontro.mentor) ? [encontro.mentor] : [])];
  const [mentor, setMentor] = useState(encontro.mentor ?? "");
  const { executar, ocupado } = useEscrita("escreverSessao", (quem: string) => confirmarGrupo(ids, quem), `${ids.length} presença(s) confirmada(s)`);
  const confirmar = async () => {
    if (!mentor) {
      toast.error("Selecione quem atendeu a sessão");
      return;
    }
    if (await executar(mentor)) aoConfirmar();
  };
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <SectionLabel as="h3">Confirmar o encontro</SectionLabel>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Quem atendeu" htmlFor="grupo-confirmar-mentor" className="min-w-[12rem] flex-1">
          <Select id="grupo-confirmar-mentor" options={[{ value: "", label: "Selecione o mentor…" }, ...opcoes(mentores)]} value={mentor} onChange={setMentor} />
        </FormField>
        <Button loading={ocupado} data-escrita="W01" onClick={() => void confirmar().catch((erro: unknown) => console.error("[central-elite3d] confirmar encontro", erro))}>
          {`Marcar ${ids.length} como concluída`}
        </Button>
      </div>
      <p className="text-xs text-muted">Marca de uma vez todos os participantes que ainda não estão concluídos.</p>
    </section>
  );
}

export function DetalheEncontro({ encontro, aoConfirmar }: { encontro: Encontro; aoConfirmar(): void }) {
  const { dados } = useDados();
  const { pode } = useSessao();
  const nome = (id: string | null) => nomeDe(dados.mentorados, id);
  const presencas = [...encontro.itens].sort((a, b) => nome(a.mentorado_id).localeCompare(nome(b.mentorado_id), "pt-BR"));
  const temLinks = !!(encontro.link_meet || encontro.link_gravacao || encontro.link_anotacoes);
  const pendentes = encontro.itens.some((s) => s.status !== "Concluída");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {`${fmtD(encontro.data)}${encontro.hora ? ` · ${encontro.hora.slice(0, 5)}` : ""} · ${encontro.mentor || "sem mentor"} · ${encontro.itens.length} participante(s)`}
      </p>
      <p className="text-sm">{temLinks ? <LinksSessao links={encontro} /> : <span className="text-muted">Sem links registrados</span>}</p>
      <section className="space-y-2">
        <SectionLabel as="h3">{`Presenças · ${resumoStatusGrupo(encontro)}`}</SectionLabel>
        <ul className="divide-y divide-line">
          {presencas.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">{nome(s.mentorado_id)}</span>
              <StatusSessao status={s.status} />
            </li>
          ))}
        </ul>
      </section>
      {pode("escreverSessao") && pendentes && <ConfirmarEncontro encontro={encontro} aoConfirmar={aoConfirmar} />}
    </div>
  );
}

// O detalhe de um encontro: aberto quando há encontro, fechado com null.
export function EncontroGrupo({ encontro, onClose }: { encontro: Encontro | null; onClose(): void }) {
  return (
    <Dialog open={encontro !== null} onClose={onClose} title={encontro?.etapa ?? undefined}>
      {encontro && <DetalheEncontro encontro={encontro} aoConfirmar={onClose} />}
    </Dialog>
  );
}

const CAMPOS_TEXTO: readonly [keyof CamposEncontro, string, string, string?][] = [
  ["data", "Data", "date"],
  ["hora", "Hora", "time"],
  ["link_meet", "Link Meet", "text", "https://…"],
  ["link_gravacao", "Link gravação", "text", "https://…"],
];

// Registrar um encontro: uma linha por participante, com a mesma etapa, data, hora, mentor e status
// (OPS-06). Exige ao menos um participante.
export function RegistrarEncontroForm({ aoRegistrar }: { aoRegistrar(): void }) {
  const { dados } = useDados();
  const [campos, setCampos] = useState<Record<keyof CamposEncontro, string>>(() => ({
    etapa: ETAPAS_GRUPO[0],
    status: "Agendada",
    mentor: "",
    data: hojeSP(),
    hora: "",
    link_meet: "",
    link_gravacao: "",
  }));
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const ativos = dados.mentorados.filter(ehAtivo).sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"));
  const visiveis = ativos.filter((m) => casaBusca(busca, m.nome));
  const { executar, ocupado } = useEscrita("criarSessao", (ids: string[]) => criarSessaoGrupo(ids, campos), `Encontro registrado para ${marcados.length} participante(s)`);
  const mudar = (campo: keyof CamposEncontro) => (valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const registrar = async () => {
    const ids = ativos.filter((m) => marcados.includes(m.id)).map((m) => m.id);
    if (!ids.length) {
      toast.error("Selecione ao menos um participante");
      return;
    }
    if (await executar(ids)) aoRegistrar();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Um encontro coletivo é registrado como uma presença por participante.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Categoria" htmlFor="grupo-etapa">
          <Select id="grupo-etapa" name="etapa" options={opcoes(ETAPAS_GRUPO)} value={campos.etapa} onChange={mudar("etapa")} />
        </FormField>
        <FormField label="Status" htmlFor="grupo-status">
          <Select id="grupo-status" name="status" options={opcoes(S_STATUS)} value={campos.status} onChange={mudar("status")} />
        </FormField>
        <FormField label="Mentor" htmlFor="grupo-mentor">
          <Select id="grupo-mentor" name="mentor" options={[{ value: "", label: "—" }, ...opcoes(MENTORES)]} value={campos.mentor} onChange={mudar("mentor")} />
        </FormField>
        {CAMPOS_TEXTO.map(([campo, rotulo, tipo, dica]) => (
          <FormField key={campo} label={rotulo} htmlFor={`grupo-${campo}`}>
            <Input id={`grupo-${campo}`} type={tipo} value={campos[campo]} placeholder={dica} onChange={(e) => mudar(campo)(e.target.value)} />
          </FormField>
        ))}
      </div>
      <section className="space-y-3">
        <SectionLabel as="h3">Participantes</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput className="min-w-[12rem] flex-1" value={busca} placeholder="Buscar participante…" aria-label="Buscar participante" onChange={(e) => setBusca(e.target.value)} />
          {/* Marcar só alcança quem está visível: selecionar durante uma busca incluiria gente que a
              pessoa nem viu. Limpar alcança todos: marcação escondida entraria no encontro calada. */}
          <Button variant="outline" size="sm" onClick={() => setMarcados((atual) => [...new Set([...atual, ...visiveis.map((m) => m.id)])])}>
            {`${busca.trim() ? "Selecionar visíveis" : "Selecionar todos"} (${visiveis.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMarcados([])}>
            Limpar seleção
          </Button>
        </div>
        {!ativos.length ? (
          <EmptyState title="Nenhum mentorado ativo." />
        ) : visiveis.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {visiveis.map((m) => (
              <Checkbox
                key={m.id}
                label={m.nome}
                checked={marcados.includes(m.id)}
                onChange={() => setMarcados((atual) => (atual.includes(m.id) ? atual.filter((id) => id !== m.id) : [...atual, m.id]))}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhum mentorado ativo com esse nome." />
        )}
      </section>
      <Button loading={ocupado} data-escrita="W02" onClick={() => void registrar().catch((erro: unknown) => console.error("[central-elite3d] registrar encontro", erro))}>
        Registrar encontro
      </Button>
    </div>
  );
}

export function RegistrarEncontro({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Nova sessão em grupo">
      <RegistrarEncontroForm aoRegistrar={onClose} />
    </Dialog>
  );
}

// "+ Sessão em grupo": só com `criarSessao` (o RLS só dá INSERT em sessoes ao admin).
export function BotaoSessaoGrupo() {
  const { pode } = useSessao();
  const [aberto, setAberto] = useState(false);
  if (!pode("criarSessao")) return null;
  return (
    <>
      <Button data-escrita="W02" onClick={() => setAberto(true)}>
        + Sessão em grupo
      </Button>
      <RegistrarEncontro open={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
