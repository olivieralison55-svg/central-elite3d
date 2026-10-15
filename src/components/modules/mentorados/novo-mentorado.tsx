"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import { useNavegar, useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import { criarMentorado, type NovoMentorado as Novo, type ResultadoEscrita } from "@/lib/data/escritas";
import { hojeSP } from "@/lib/datas";
import { caminhoDaFicha } from "@/lib/endereco";
import { type CamposNovoMentorado, camposNovoMentorado, montarNovoMentorado, msgErroMentorado } from "@/lib/mentorados";

// Novo mentorado (openNovoMentorado e criarMentorado, index.html:3752–3780; W14). O corpo do
// modal é exportado à parte do Dialog, que não renderiza sem `document` (design, componente 6).

const opcoes = (valores: string[]) => valores.map((valor) => ({ value: valor, label: valor }));
const ENTRADA = opcoes(["Pago", "Pago parcial", "Ainda não", "Patrocinado"]);
const CONTRATO = opcoes(["Ainda não", "Aguardando assinatura", "Assinado"]);
const RESTANTE = opcoes(["Ainda não", "Pago parcial", "Pago", "Patrocinado"]);

// O e-mail repetido ganha a explicação própria; os outros erros vão inteiros.
async function gravar(novo: Novo): Promise<ResultadoEscrita> {
  const gravado = await criarMentorado(novo);
  return !gravado.ok && "erro" in gravado ? { ok: false, erro: msgErroMentorado(gravado.erro) } : gravado;
}

export function NovoMentoradoForm({ aoCriar }: { aoCriar(): void }) {
  const { ir } = useNavegar();
  const [campos, setCampos] = useState(() => camposNovoMentorado(hojeSP()));
  // Criado, a tela recarrega e abre a ficha dele na aba Cadastro, como o `openMentorado(data.id,
  // 'completo')` de hoje.
  const { executar, ocupado } = useEscrita("criarMentorado", gravar, "Mentorado criado", (gravado) => {
    if (gravado.id) ir(caminhoDaFicha(gravado.id));
  });
  const mudar = (campo: keyof CamposNovoMentorado) => (valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const enviar = async () => {
    const montado = montarNovoMentorado(campos);
    if (!montado.ok) {
      toast.error(montado.erro);
      return;
    }
    // WRITE-05: com erro, o modal fica aberto com o que foi digitado.
    if (await executar(montado.novo)) aoCriar();
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Nome" htmlFor="novo-nome" className="sm:col-span-2">
        <Input id="novo-nome" value={campos.nome} placeholder="Nome completo ou razão social" onChange={(e) => mudar("nome")(e.target.value)} />
      </FormField>
      <FormField
        label="E-mail no Google Agenda"
        htmlFor="novo-email"
        hint="Preenchendo aqui, o sync casa a sessão por este e-mail e o título do convite não precisa trazer o nome dele."
        className="sm:col-span-2"
      >
        <Input id="novo-email" type="email" value={campos.email} placeholder="o e-mail que ele usa no convite" onChange={(e) => mudar("email")(e.target.value)} />
      </FormField>
      <FormField label="Data de fechamento" htmlFor="novo-fechamento">
        <Input id="novo-fechamento" type="date" value={campos.data_fechamento} onChange={(e) => mudar("data_fechamento")(e.target.value)} />
      </FormField>
      <FormField label="Entrada" htmlFor="novo-entrada">
        <Select id="novo-entrada" name="entrada_status" options={ENTRADA} value={campos.entrada_status} onChange={mudar("entrada_status")} />
      </FormField>
      <FormField label="Forma entrada" htmlFor="novo-forma">
        <Input id="novo-forma" value={campos.entrada_forma_pgto} placeholder="pix, cartão…" onChange={(e) => mudar("entrada_forma_pgto")(e.target.value)} />
      </FormField>
      <FormField label="Contrato" htmlFor="novo-contrato">
        <Select id="novo-contrato" name="contrato_status" options={CONTRATO} value={campos.contrato_status} onChange={mudar("contrato_status")} />
      </FormField>
      <FormField label="Restante" htmlFor="novo-restante">
        <Select id="novo-restante" name="restante_status" options={RESTANTE} value={campos.restante_status} onChange={mudar("restante_status")} />
      </FormField>
      <div className="sm:col-span-2">
        <Button loading={ocupado} data-escrita="W14" onClick={() => void enviar().catch((erro: unknown) => console.error("[central-elite3d] criar mentorado", erro))}>
          Criar mentorado
        </Button>
      </div>
    </div>
  );
}

// O invólucro: fechado, o Dialog não monta o corpo, e o formulário volta aos padrões na próxima vez.
export function NovoMentorado({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Novo mentorado">
      <NovoMentoradoForm aoCriar={onClose} />
    </Dialog>
  );
}

// O botão das telas que oferecem criar mentorado, sempre atrás de `criarMentorado`. Onde a tela já
// tem uma ação própria, ele vai como secundário.
export function BotaoNovoMentorado({ secundario = false }: { secundario?: boolean }) {
  const { pode } = useSessao();
  const [aberto, setAberto] = useState(false);
  if (!pode("criarMentorado")) return null;
  return (
    <>
      <Button variant={secundario ? "outline" : "primary"} data-escrita="W14" onClick={() => setAberto(true)}>
        + Novo mentorado
      </Button>
      <NovoMentorado open={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
