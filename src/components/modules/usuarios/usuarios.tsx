"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import CopyButton from "@/components/ui/copy-button";
import DataTable, { type Column } from "@/components/ui/data-table";
import Dialog from "@/components/ui/dialog";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import PageHeader from "@/components/ui/page-header";
import Select from "@/components/ui/select";
import type { ResultadoEscrita } from "@/lib/data/escritas";
import { type CamposUsuario, criarUsuario, editarUsuario, excluirUsuario, listarUsuarios, novaSenha, type Usuario } from "@/lib/data/usuarios";
import { fmtInstante } from "@/lib/datas";
import { ehPapel, PAPEIS, PAPEL_LABEL } from "@/lib/papeis";

// A tela Usuários (AD-011): as contas de acesso, só do admin. Criar e trocar senha geram uma senha
// que aparece uma vez, para copiar e repassar. A lista vem da edge function admin-usuarios, não do
// Dataset: ela lê o Auth, que o cliente não enxerga.

const OPCOES_PAPEL = PAPEIS.map((papel) => ({ value: papel, label: PAPEL_LABEL[papel] }));
const VAZIO: CamposUsuario = { nome: "", email: "", papel: "mentor" };

type Formulario = { id: string | null; campos: CamposUsuario };

const camposDe = (u: Usuario): CamposUsuario => ({ nome: u.nome ?? "", email: u.email, papel: ehPapel(u.papel) ? u.papel : "mentor" });

type Gravado = Extract<ResultadoEscrita, { ok: true }>;

function FormUsuario({ form, aoGravar }: { form: Formulario; aoGravar(gravado: Gravado, campos: CamposUsuario): void }) {
  const [campos, setCampos] = useState(form.campos);
  const criando = form.id === null;
  const { executar, ocupado } = useEscrita(
    "gerirUsuarios",
    (c: CamposUsuario) => (form.id === null ? criarUsuario(c) : editarUsuario(form.id, c)),
    criando ? "Usuário criado" : "Usuário atualizado",
    (gravado) => aoGravar(gravado, campos),
  );
  const mudar = (campo: keyof CamposUsuario) => (valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const enviar = () => {
    if (!campos.nome.trim() || !campos.email.trim()) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    void executar(campos).catch((erro: unknown) => console.error("[central-elite3d] gravar usuário", erro));
  };
  return (
    <div className="grid gap-4">
      <FormField label="Nome" htmlFor="usuario-nome">
        <Input id="usuario-nome" value={campos.nome} onChange={(e) => mudar("nome")(e.target.value)} />
      </FormField>
      <FormField label="E-mail" htmlFor="usuario-email" hint="É o login. Trocar aqui troca o e-mail de entrada.">
        <Input id="usuario-email" type="email" value={campos.email} onChange={(e) => mudar("email")(e.target.value)} />
      </FormField>
      <FormField label="Tipo de conta" htmlFor="usuario-papel">
        <Select id="usuario-papel" name="papel" options={OPCOES_PAPEL} value={campos.papel} onChange={mudar("papel")} />
      </FormField>
      <div>
        <Button loading={ocupado} onClick={enviar}>
          {criando ? "Criar usuário" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export default function Usuarios() {
  const { usuario } = useSessao();
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);
  const [trocando, setTrocando] = useState<Usuario | null>(null);
  const [senha, setSenha] = useState<{ email: string; senha: string } | null>(null);

  const carregar = useCallback(async () => {
    const r = await listarUsuarios();
    if (!r.ok) {
      toast.error(`Não foi possível carregar os usuários: ${r.erro}`);
      setLista([]);
      return;
    }
    setLista(r.dados);
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const mostrarSenha = (email: string, gravado: Gravado) => {
    if (gravado.senha) setSenha({ email, senha: gravado.senha });
  };
  const trocarSenha = useEscrita("gerirUsuarios", novaSenha, "Senha trocada", (gravado) => {
    if (trocando) mostrarSenha(trocando.email, gravado);
    setTrocando(null);
  });
  const excluir = useEscrita("gerirUsuarios", excluirUsuario, "Usuário excluído", () => {
    setExcluindo(null);
    void carregar();
  });

  const colunas: Column<Usuario>[] = [
    { key: "nome", header: "Nome", elastic: true, render: (u) => <span className="truncate">{u.nome || "—"}</span> },
    { key: "email", header: "E-mail", render: (u) => u.email },
    { key: "papel", header: "Tipo", render: (u) => <Badge>{ehPapel(u.papel) ? PAPEL_LABEL[u.papel] : "sem papel"}</Badge> },
    { key: "acesso", header: "Último acesso", render: (u) => (u.ultimo_acesso ? fmtInstante(u.ultimo_acesso) : "nunca") },
    {
      key: "acoes",
      header: "",
      align: "right",
      dense: true,
      render: (u) => (
        <span className="inline-flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setForm({ id: u.id, campos: camposDe(u) })}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTrocando(u)}>
            Nova senha
          </Button>
          {u.id !== usuario.id && (
            <Button variant="ghost" size="sm" onClick={() => setExcluindo(u)}>
              Excluir
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários"
        subtitle="Quem entra na Central e com que tipo de conta."
        actions={<Button onClick={() => setForm({ id: null, campos: VAZIO })}>+ Novo usuário</Button>}
      />
      <DataTable columns={colunas} rows={lista ?? []} rowKey={(u) => u.id} loading={lista === null} emptyMessage="Nenhum usuário" />

      <Dialog open={form !== null} onClose={() => setForm(null)} title={form?.id === null ? "Novo usuário" : "Editar usuário"}>
        {form && (
          <FormUsuario
            key={form.id ?? "novo"}
            form={form}
            aoGravar={(gravado, campos) => {
              mostrarSenha(campos.email, gravado);
              setForm(null);
              void carregar();
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir usuário"
        description={excluindo ? `${excluindo.nome || excluindo.email} perde o acesso à Central. Não dá para desfazer.` : ""}
        busy={excluir.ocupado}
        onConfirm={() => excluindo && void excluir.executar(excluindo.id)}
        onClose={() => setExcluindo(null)}
      />

      <ConfirmDialog
        open={trocando !== null}
        title="Gerar nova senha"
        description={trocando ? `A senha atual de ${trocando.nome || trocando.email} deixa de funcionar na hora. A nova aparece a seguir, uma vez.` : ""}
        confirmLabel="Gerar nova senha"
        busy={trocarSenha.ocupado}
        onConfirm={() => trocando && void trocarSenha.executar(trocando.id)}
        onClose={() => setTrocando(null)}
      />

      <Dialog open={senha !== null} onClose={() => setSenha(null)} title="Senha gerada">
        {senha && (
          <div className="grid gap-3">
            <p className="text-sm text-muted">{`Senha de ${senha.email}. Ela não aparece de novo: copie e repasse agora.`}</p>
            <div className="flex items-center gap-2">
              <code className="rounded-6 border border-line px-2 py-1 font-mono text-sm">{senha.senha}</code>
              <CopyButton text={senha.senha} label="Senha" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
