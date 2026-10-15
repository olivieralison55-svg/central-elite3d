"use client";

import { Check, Pencil } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import toast from "react-hot-toast";

import CampoMoeda from "@/components/modules/comum/campo-moeda";
import { useDados, useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Badge, { type BadgeVariant } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DescriptionList from "@/components/ui/description-list";
import Dialog from "@/components/ui/dialog";
import EmptyState from "@/components/ui/empty-state";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import SectionLabel from "@/components/ui/section-label";
import Select, { type SelectOption } from "@/components/ui/select";
import type { Mentorado, Parcela } from "@/lib/data/esquemas";
import { addParcela, type CamposParcela, delParcela, type FinanceiroMentorado, salvarMentorado, salvarParcela, toggleParcela } from "@/lib/data/escritas";
import { hojeSP, prazoTexto } from "@/lib/datas";
import { aceitaParcelaManual, parcelaDaLia, parcelaVencida, proximaParcela } from "@/lib/financeiro";
import { fmtBRL, lerBRL, mascaraBRL } from "@/lib/moeda";
import { semMarcador } from "@/lib/marcador";

// A aba Financeiro da ficha (index.html:3276–3309; mapeamento §3.4): o status do contrato, da
// entrada e do restante, com as formas de pagamento (W11), e as parcelas (W18–W21). Quem não edita
// mentorado vê os status só para leitura (OPS-12); as parcelas pedem editarFinanceiro.

const CONTRATO = ["Assinado", "Aguardando assinatura", "Ainda não", "Cancelou"];
const ENTRADA = ["Pago", "Pago parcial", "Patrocinado", "Ainda não", "Cancelou"];
const RESTANTE = ["Pago", "Pago parcial", "Ainda não", "Patrocinado", "Cancelou"];
const NAO_INFORMADO = "— não informado —";

// OPS-14: status nulo no banco aparece como "— não informado —" selecionado, e quem não mexe grava
// nulo de volta (OPS-15). Valor fora da lista vira opção dele mesmo, para não sumir da tela.
const opcoesStatus = (valores: readonly string[], noBanco: string | null | undefined): SelectOption[] => [
  ...(noBanco ? [] : [{ value: "", label: NAO_INFORMADO }]),
  ...valores.map((valor) => ({ value: valor, label: valor })),
  ...(noBanco && !valores.includes(noBanco) ? [{ value: noBanco, label: noBanco }] : []),
];

type Status = Omit<FinanceiroMentorado, "aba">;

function LeituraStatus({ mentorado: m }: { mentorado: Mentorado }) {
  return (
    <DescriptionList
      items={[
        { term: "Contrato", value: m.contrato_status || NAO_INFORMADO },
        { term: "Entrada", value: m.entrada_status || NAO_INFORMADO },
        { term: "Forma entrada", value: m.entrada_forma_pgto || "—" },
        { term: "Restante", value: m.restante_status || NAO_INFORMADO },
        { term: "Forma restante", value: m.restante_forma_pgto || "—" },
      ]}
    />
  );
}

function FormStatus({ mentorado: m }: { mentorado: Mentorado }) {
  const [campos, setCampos] = useState<Record<keyof Status, string>>(() => ({
    contrato_status: m.contrato_status ?? "",
    entrada_status: m.entrada_status ?? "",
    entrada_forma_pgto: m.entrada_forma_pgto ?? "",
    restante_status: m.restante_status ?? "",
    restante_forma_pgto: m.restante_forma_pgto ?? "",
  }));
  const { executar, ocupado } = useEscrita("editarMentorado", (status: Status) => salvarMentorado(m.id, { aba: "financeiro", ...status }), "Mentorado atualizado");
  const escolher = (campo: keyof Status) => (valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const digitar = (campo: keyof Status) => (e: ChangeEvent<HTMLInputElement>) => escolher(campo)(e.target.value);
  // Campo vazio vai nulo: o "— não informado —" continua nulo se ninguém mexer (OPS-15).
  const salvar = () =>
    executar({
      contrato_status: campos.contrato_status || null,
      entrada_status: campos.entrada_status || null,
      entrada_forma_pgto: campos.entrada_forma_pgto || null,
      restante_status: campos.restante_status || null,
      restante_forma_pgto: campos.restante_forma_pgto || null,
    });
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Contrato" htmlFor="ficha-contrato">
          <Select id="ficha-contrato" options={opcoesStatus(CONTRATO, m.contrato_status)} value={campos.contrato_status} onChange={escolher("contrato_status")} />
        </FormField>
        <FormField label="Entrada" htmlFor="ficha-entrada">
          <Select id="ficha-entrada" options={opcoesStatus(ENTRADA, m.entrada_status)} value={campos.entrada_status} onChange={escolher("entrada_status")} />
        </FormField>
        <FormField label="Forma entrada" htmlFor="ficha-entrada-forma">
          <Input id="ficha-entrada-forma" value={campos.entrada_forma_pgto} placeholder="pix, cartão…" onChange={digitar("entrada_forma_pgto")} />
        </FormField>
        <FormField label="Restante" htmlFor="ficha-restante">
          <Select id="ficha-restante" options={opcoesStatus(RESTANTE, m.restante_status)} value={campos.restante_status} onChange={escolher("restante_status")} />
        </FormField>
        <FormField label="Forma restante" htmlFor="ficha-restante-forma">
          <Input id="ficha-restante-forma" value={campos.restante_forma_pgto} placeholder="parc. boleto…" onChange={digitar("restante_forma_pgto")} />
        </FormField>
      </div>
      <Button loading={ocupado} data-escrita="W11" onClick={() => void salvar().catch((erro: unknown) => console.error("[central-elite3d] salvar financeiro", erro))}>
        Salvar alterações
      </Button>
    </section>
  );
}

// "DD/MM" do vencimento, como o azulejo de hoje.
const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

// Um azulejo por parcela. A editável alterna paga ↔ aberta no clique (W18) e abre a edição no lápis.
// A da Lia não tem controle nenhum (FIN-05).
function Azulejo({ parcela: p, editavel, aoEditar }: { parcela: Parcela; editavel: boolean; aoEditar(): void }) {
  const { executar, ocupado } = useEscrita("editarFinanceiro", () => toggleParcela(p.id, p.status));
  const tom: BadgeVariant = p.status === "paga" ? "success" : parcelaVencida(p, hojeSP()) ? "danger" : "neutral";
  const conteudo = (
    <span className="flex flex-col items-start gap-1">
      <span className="text-sm font-semibold text-ink">{`#${p.numero ?? ""}${p.valor != null ? ` ${fmtBRL(p.valor)}` : ""}`}</span>
      <Badge variant={tom}>{p.status === "paga" ? (
          <span className="inline-flex items-center gap-1">
            paga
            <Check aria-hidden size={12} />
          </span>
        ) : p.vencimento ? (
          diaMes(p.vencimento)
        ) : (
          "aberta"
        )}</Badge>
    </span>
  );
  return (
    <li className="flex items-center gap-1 rounded-8 border border-line bg-background p-2" title={parcelaDaLia(p) ? "Vem da Lia — muda lá, reflete aqui" : undefined}>
      {editavel ? (
        <Button
          variant="ghost"
          className="h-auto flex-1 justify-start py-1"
          title="Clique para alternar paga/aberta"
          loading={ocupado}
          data-escrita="W18"
          onClick={() => void executar().catch((erro: unknown) => console.error("[central-elite3d] alternar parcela", erro))}
        >
          {conteudo}
        </Button>
      ) : (
        <span className="flex-1 px-2 py-1">{conteudo}</span>
      )}
      {editavel && (
        <Button variant="ghost" size="icon" aria-label={`Editar parcela #${p.numero ?? ""}`} data-escrita="W20" onClick={aoEditar}>
          <Pencil size={14} aria-hidden />
        </Button>
      )}
    </li>
  );
}

// W19: o número sai do maior do mentorado + 1, e a 13ª é recusada pela porta.
function NovaParcela({ mentoradoId }: { mentoradoId: string }) {
  const { dados } = useDados();
  const [vencimento, setVencimento] = useState("");
  const [valor, setValor] = useState("");
  const { executar, ocupado } = useEscrita("editarFinanceiro", (venc: string | null, v: number | null) => addParcela(mentoradoId, dados.parcelas, venc, v));
  const adicionar = async () => {
    if (!(await executar(vencimento || null, lerBRL(valor)))) return;
    setVencimento("");
    setValor("");
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormField label="Vencimento" htmlFor="nova-parcela-vencimento">
        <Input id="nova-parcela-vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
      </FormField>
      <FormField label="Valor" htmlFor="nova-parcela-valor">
        <CampoMoeda id="nova-parcela-valor" placeholder="Valor (R$)" value={valor} onChange={setValor} />
      </FormField>
      <Button variant="outline" size="sm" loading={ocupado} data-escrita="W19" onClick={() => void adicionar().catch((erro: unknown) => console.error("[central-elite3d] adicionar parcela", erro))}>
        + Adicionar parcela
      </Button>
    </div>
  );
}

const STATUS_PARCELA = [
  { value: "aberta", label: "Aberta" },
  { value: "paga", label: "Paga" },
];

// Editar (W20) e excluir (W21) uma parcela (openParcela, index.html:3557–3591). O número é ≥ 1 e
// único no mentorado. O corpo é exportado à parte do Dialog, que não renderiza sem `document`.
export function ParcelaForm({ parcela: p, aoTerminar }: { parcela: Parcela; aoTerminar(): void }) {
  const { dados } = useDados();
  const [campos, setCampos] = useState(() => ({
    numero: p.numero === null ? "" : String(p.numero),
    vencimento: p.vencimento ?? "",
    valor: p.valor != null ? mascaraBRL(p.valor, true) : "",
    status: p.status === "paga" ? "paga" : "aberta",
  }));
  const [excluindo, setExcluindo] = useState(false);
  const salvar = useEscrita("editarFinanceiro", (parcela: CamposParcela) => salvarParcela(p.id, parcela), "Parcela atualizada");
  const excluir = useEscrita("editarFinanceiro", () => delParcela(p.id), "Parcela excluída");
  const mudar = (campo: keyof typeof campos) => (valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const gravar = async () => {
    const numero = Number.parseInt(campos.numero, 10);
    if (!numero || numero < 1) {
      toast.error("Número de parcela inválido");
      return;
    }
    if (dados.parcelas.some((x) => x.mentorado_id === p.mentorado_id && x.numero === numero && x.id !== p.id)) {
      toast.error(`Já existe a parcela #${numero} deste mentorado`);
      return;
    }
    if (await salvar.executar({ numero, vencimento: campos.vencimento || null, valor: lerBRL(campos.valor), status: campos.status })) aoTerminar();
  };
  const confirmarExclusao = async () => {
    if (!(await excluir.executar())) return;
    setExcluindo(false);
    aoTerminar();
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Número" htmlFor="parcela-numero">
          <Input id="parcela-numero" type="number" min={1} max={12} value={campos.numero} onChange={(e) => mudar("numero")(e.target.value)} />
        </FormField>
        <FormField label="Vencimento" htmlFor="parcela-vencimento">
          <Input id="parcela-vencimento" type="date" value={campos.vencimento} onChange={(e) => mudar("vencimento")(e.target.value)} />
        </FormField>
        <FormField label="Valor (R$)" htmlFor="parcela-valor">
          <CampoMoeda id="parcela-valor" placeholder="R$ 0,00" value={campos.valor} onChange={mudar("valor")} />
        </FormField>
        <FormField label="Status" htmlFor="parcela-status">
          <Select id="parcela-status" options={STATUS_PARCELA} value={campos.status} onChange={mudar("status")} />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={salvar.ocupado} data-escrita="W20" onClick={() => void gravar().catch((erro: unknown) => console.error("[central-elite3d] salvar parcela", erro))}>
          Salvar parcela
        </Button>
        <Button variant="outline" size="sm" className="text-danger" data-escrita="W21" onClick={() => setExcluindo(true)}>
          Excluir
        </Button>
      </div>
      <ConfirmDialog
        open={excluindo}
        title="Excluir parcela"
        description={`Excluir a parcela #${p.numero ?? ""}? A ação não pode ser desfeita.`}
        confirmLabel="Excluir parcela"
        busy={excluir.ocupado}
        onConfirm={() => void confirmarExclusao().catch((erro: unknown) => console.error("[central-elite3d] excluir parcela", erro))}
        onClose={() => setExcluindo(false)}
      />
    </div>
  );
}

function Parcelas({ mentorado: m }: { mentorado: Mentorado }) {
  const { dados } = useDados();
  const { pode } = useSessao();
  const [editando, setEditando] = useState<Parcela | null>(null);
  const parcelas = dados.parcelas.filter((p) => p.mentorado_id === m.id);
  const edita = pode("editarFinanceiro");
  const proxima = proximaParcela(parcelas);
  const titulo = [
    "Parcelas",
    parcelas.length ? `${parcelas.filter((p) => p.status === "paga").length}/${parcelas.length} pagas` : "",
    proxima ? `#${proxima.numero ?? ""} ${prazoTexto(proxima.vencimento)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <SectionLabel as="h3">{titulo}</SectionLabel>
      {parcelas.some(parcelaDaLia) && (
        <p className="text-sm text-muted">Estas parcelas vêm da Lia e se atualizam sozinhas quando o pagamento muda lá. Por isso não são editáveis aqui.</p>
      )}
      {parcelas.length ? (
        <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {parcelas.map((p) => (
            <Azulejo key={p.id} parcela={p} editavel={edita && !parcelaDaLia(p)} aoEditar={() => setEditando(p)} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Sem parcelas (pagamento à vista ou não cadastrado)." />
      )}
      {edita && aceitaParcelaManual(parcelas) && <NovaParcela mentoradoId={m.id} />}
      <Dialog open={editando !== null} onClose={() => setEditando(null)} title={editando ? `Parcela #${editando.numero ?? ""} · ${semMarcador(m.nome)}` : undefined}>
        {editando && <ParcelaForm parcela={editando} aoTerminar={() => setEditando(null)} />}
      </Dialog>
    </section>
  );
}

export default function AbaFinanceiro({ mentorado }: { mentorado: Mentorado }) {
  const { pode } = useSessao();
  return (
    <div className="space-y-6">
      {pode("editarMentorado") ? <FormStatus mentorado={mentorado} /> : <LeituraStatus mentorado={mentorado} />}
      <Parcelas mentorado={mentorado} />
    </div>
  );
}
