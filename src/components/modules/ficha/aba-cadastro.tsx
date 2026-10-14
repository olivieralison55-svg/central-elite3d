"use client";

import { type ChangeEvent, useState } from "react";
import toast from "react-hot-toast";

import { LinkExterno } from "@/components/modules/comum/celulas";
import { useDados, useNavegar, useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DescriptionList from "@/components/ui/description-list";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import SectionLabel from "@/components/ui/section-label";
import Select from "@/components/ui/select";
import { chaveNome } from "@/lib/busca";
import type { Mentorado } from "@/lib/data/esquemas";
import { adotarOrfas, type CadastroMentorado, excluirMentorado, type ResultadoEscrita, salvarMentorado, salvarSituacao, type SituacaoMentorado } from "@/lib/data/escritas";
import { fmtD, hojeSP } from "@/lib/datas";
import { comAdocao } from "@/lib/escrita";
import { msgErroMentorado, normalizaEmail, resumoExclusao, situacaoDe } from "@/lib/mentorados";

// A aba Cadastro da ficha (index.html:3233–3274; mapeamento §3.4): nome, fechamento, e-mail e os
// três links, a situação e a exclusão. Quem não edita mentorado vê o cadastro só para leitura e
// não vê a situação (OPS-12).

type Campos = Record<"nome" | "email" | "data_fechamento" | "link_drive" | "link_mapa_mental" | "link_whatsapp", string>;

const camposDe = (m: Mentorado): Campos => ({
  nome: m.nome ?? "",
  email: m.email ?? "",
  data_fechamento: m.data_fechamento ?? "",
  link_drive: m.link_drive ?? "",
  link_mapa_mental: m.link_mapa_mental ?? "",
  link_whatsapp: m.link_whatsapp ?? "",
});

// W11 e depois o W11b: preencher ou corrigir o e-mail pode destravar cobrança que chegou antes do
// cadastro (OPS-13). O e-mail repetido ganha a explicação própria; os outros erros vão inteiros.
async function gravarCadastro(id: string, cadastro: CadastroMentorado): Promise<ResultadoEscrita> {
  const gravado = await comAdocao(
    () => salvarMentorado(id, cadastro),
    () => adotarOrfas(id),
  );
  return !gravado.ok && "erro" in gravado ? { ok: false, erro: msgErroMentorado(gravado.erro) } : gravado;
}

// A adoção é automática, e o aviso conta o que ela puxou, porque o financeiro da ficha muda junto
// (index.html:3488–3495).
const msgSalvo = (gravado: Extract<ResultadoEscrita, { ok: true }>): string =>
  gravado.adotadas ? `Mentorado atualizado · ${gravado.adotadas} cobrança(s) da Lia vinculada(s)` : "Mentorado atualizado";

// Link vindo do banco só vira href com http(s) (SEC-05); sem link, um traço.
const link = (url: string | null) => (url ? <LinkExterno url={url} rotulo={url} /> : "—");

function LeituraCadastro({ mentorado: m }: { mentorado: Mentorado }) {
  return (
    <DescriptionList
      items={[
        { term: "Nome", value: m.nome || "—" },
        { term: "Data de fechamento", value: fmtD(m.data_fechamento) },
        { term: "E-mail no Google Agenda", value: m.email || "—" },
        { term: "Link Drive", value: link(m.link_drive) },
        { term: "Link Mapa Mental", value: link(m.link_mapa_mental) },
        { term: "Canal WhatsApp", value: link(m.link_whatsapp) },
      ]}
    />
  );
}

function FormCadastro({ mentorado: m }: { mentorado: Mentorado }) {
  const [campos, setCampos] = useState(() => camposDe(m));
  const { executar, ocupado } = useEscrita("editarMentorado", (cadastro: CadastroMentorado) => gravarCadastro(m.id, cadastro), msgSalvo);
  const mudar = (campo: keyof Campos) => (e: ChangeEvent<HTMLInputElement>) => setCampos((atual) => ({ ...atual, [campo]: e.target.value }));
  const salvar = async () => {
    const nome = campos.nome.trim();
    if (!nome) {
      toast.error("Informe o nome");
      return;
    }
    // O e-mail é a chave do sync, e o único do banco é em lower(): vai normalizado (OPS-13).
    await executar({
      aba: "cadastro",
      nome,
      email: normalizaEmail(campos.email),
      data_fechamento: campos.data_fechamento || null,
      link_drive: campos.link_drive || null,
      link_mapa_mental: campos.link_mapa_mental || null,
      link_whatsapp: campos.link_whatsapp || null,
    });
  };
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nome" htmlFor="ficha-nome">
          <Input id="ficha-nome" value={campos.nome} onChange={mudar("nome")} />
        </FormField>
        <FormField label="Data de fechamento" htmlFor="ficha-fechamento">
          <Input id="ficha-fechamento" type="date" value={campos.data_fechamento} onChange={mudar("data_fechamento")} />
        </FormField>
        <FormField
          label="E-mail no Google Agenda"
          htmlFor="ficha-email"
          hint={m.email ? "O sync casa o evento por este e-mail — o nome no título do convite não importa mais." : "Sem isto, o sync ainda depende do nome escrito no título do evento."}
          className="sm:col-span-2"
        >
          <Input id="ficha-email" type="email" value={campos.email} placeholder="o e-mail que ele usa no convite" onChange={mudar("email")} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Link Drive" htmlFor="ficha-link_drive">
          <Input id="ficha-link_drive" value={campos.link_drive} onChange={mudar("link_drive")} />
        </FormField>
        <FormField label="Link Mapa Mental" htmlFor="ficha-link_mapa_mental">
          <Input id="ficha-link_mapa_mental" value={campos.link_mapa_mental} onChange={mudar("link_mapa_mental")} />
        </FormField>
        <FormField label="Canal WhatsApp" htmlFor="ficha-link_whatsapp">
          <Input id="ficha-link_whatsapp" value={campos.link_whatsapp} onChange={mudar("link_whatsapp")} />
        </FormField>
      </div>
      <Button loading={ocupado} data-escrita="W11" onClick={() => void salvar().catch((erro: unknown) => console.error("[central-elite3d] salvar cadastro", erro))}>
        Salvar alterações
      </Button>
    </section>
  );
}

const SITUACOES = [
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "cancelado", label: "Cancelado" },
];

// W12: as datas da pausa só existem em "pausado".
function FormSituacao({ mentorado: m }: { mentorado: Mentorado }) {
  const [campos, setCampos] = useState<SituacaoMentorado>(() => ({ situacao: situacaoDe(m), pausado_em: m.pausado_em ?? "", retorno_previsto: m.retorno_previsto ?? "" }));
  // A pausa sem data vale hoje, lido na hora de gravar (EDGE-03).
  const { executar, ocupado } = useEscrita("editarMentorado", (situacao: SituacaoMentorado) => salvarSituacao(m.id, situacao, hojeSP()), "Situação atualizada");
  const data = (campo: "pausado_em" | "retorno_previsto") => (e: ChangeEvent<HTMLInputElement>) => setCampos((atual) => ({ ...atual, [campo]: e.target.value }));
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <SectionLabel as="h3">Situação</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Situação" htmlFor="ficha-situacao">
          <Select id="ficha-situacao" options={SITUACOES} value={campos.situacao} onChange={(situacao) => setCampos((atual) => ({ ...atual, situacao }))} />
        </FormField>
        {campos.situacao === "pausado" && (
          <>
            <FormField label="Pausado em" htmlFor="ficha-pausado_em">
              <Input id="ficha-pausado_em" type="date" value={campos.pausado_em ?? ""} onChange={data("pausado_em")} />
            </FormField>
            <FormField label="Retorno previsto" htmlFor="ficha-retorno_previsto">
              <Input id="ficha-retorno_previsto" type="date" value={campos.retorno_previsto ?? ""} onChange={data("retorno_previsto")} />
            </FormField>
          </>
        )}
      </div>
      <Button size="sm" loading={ocupado} data-escrita="W12" onClick={() => void executar(campos).catch((erro: unknown) => console.error("[central-elite3d] salvar situação", erro))}>
        Salvar situação
      </Button>
    </section>
  );
}

// W13: as filhas de `mentorados` são ON DELETE CASCADE, então a confirmação conta o que vai embora e
// pede o nome digitado (OPS-11, index.html:3704–3746).
function ExcluirMentorado({ mentorado: m }: { mentorado: Mentorado }) {
  const { dados } = useDados();
  const { ir } = useNavegar();
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const { partes, concluidas } = resumoExclusao(dados, m.id);
  // O endereço da ficha morre com ela: excluída, a tela vai para a lista.
  const { executar, ocupado } = useEscrita("excluir", () => excluirMentorado(m.id), "Mentorado excluído", () => ir("/mentorados"));
  const confere = chaveNome(digitado) === chaveNome(m.nome);
  const excluir = async () => {
    // Conferido de novo no clique: o botão travado não é a única guarda.
    if (!confere) {
      toast.error("Digite o nome do mentorado para confirmar");
      return;
    }
    if (await executar()) setAberto(false);
  };
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <SectionLabel as="h3">Excluir mentorado</SectionLabel>
      <p className="text-sm leading-relaxed text-muted">
        {`Apaga a ficha e tudo que está pendurado nela${partes.length ? `: ${partes.join(", ")}` : ""}. Não dá para desfazer. Se a pessoa apenas saiu do programa, marque `}
        <strong>Cancelado</strong>
        {" na situação acima — assim o histórico fica de pé."}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="text-danger"
        data-escrita="W13"
        onClick={() => {
          setDigitado("");
          setAberto(true);
        }}
      >
        Excluir mentorado…
      </Button>
      <ConfirmDialog
        open={aberto}
        title="Excluir mentorado"
        confirmLabel="Excluir definitivamente"
        busy={ocupado}
        confirmDisabled={!confere}
        onConfirm={() => void excluir().catch((erro: unknown) => console.error("[central-elite3d] excluir mentorado", erro))}
        onClose={() => setAberto(false)}
        description={
          <>
            <p>
              <strong className="text-ink">{m.nome}</strong>
              {` e ${partes.length ? `o que está pendurado na ficha — ${partes.join(", ")} — somem` : "a ficha some"} do sistema.`}
            </p>
            {concluidas > 0 && (
              <p className="mt-2 font-medium text-danger">
                {`${concluidas} ${concluidas === 1 ? "sessão concluída sai" : "sessões concluídas saem"} da contagem dos mentores, então o fechamento do mês muda.`}
              </p>
            )}
            <p className="mt-2">Não há desfazer, e o histórico não volta.</p>
            <FormField label="Para confirmar, digite o nome do mentorado" htmlFor="excluir-nome" className="mt-4">
              <Input id="excluir-nome" autoComplete="off" placeholder={m.nome ?? ""} value={digitado} onChange={(e) => setDigitado(e.target.value)} />
            </FormField>
          </>
        }
      />
    </section>
  );
}

export default function AbaCadastro({ mentorado }: { mentorado: Mentorado }) {
  const { pode } = useSessao();
  const edita = pode("editarMentorado");
  return (
    <div className="space-y-6">
      {edita ? <FormCadastro mentorado={mentorado} /> : <LeituraCadastro mentorado={mentorado} />}
      {edita && <FormSituacao mentorado={mentorado} />}
      {pode("excluir") && <ExcluirMentorado mentorado={mentorado} />}
    </div>
  );
}
