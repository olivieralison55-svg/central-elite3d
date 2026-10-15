"use client";

import {
  Bold,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  ImagePlus,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Alert from "@/components/ui/alert";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import Dialog from "@/components/ui/dialog";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import { PROSE_CLASS } from "@/components/ui/prose";
import Skeleton from "@/components/ui/skeleton";
import { SUPABASE_URL } from "@/lib/data/config";
import { enviarAnexo, removerAnexo, type ResultadoEscrita, salvarNota } from "@/lib/data/escritas";
import { lerNota, linksAssinados } from "@/lib/data/leituras";
import { fmtInstante } from "@/lib/datas";
import {
  ANEXO,
  type AnexoDaNota,
  anexosDaNota,
  atalhoPara,
  caminhosDeAnexo,
  canonizarAnexos,
  citacoesDoAnexo,
  type ComandoNota,
  conferirArquivo,
  criarAutosave,
  dentroDoEditor,
  htmlDoAnexo,
  linkValido,
  pontoDoAnexo,
  resolverAnexos,
  sanitizarNota,
  TIPOS_DOCUMENTO,
  TIPOS_IMAGEM,
} from "@/lib/notas";
import { registrarPendencia } from "@/lib/sessao";

// O bloco de notas do mentorado (AD-004; abaNotas, index.html:3357–3437). O editor é um
// contenteditable NÃO controlado: o JSX não tem filho, e o HTML entra uma vez por abertura pela ref,
// com a saída do sanitizador. O React nunca reconcilia o conteúdo, e o cursor não pula (mapeamento
// §9, risco 13). Barra e atalhos usam os comandos de edição do navegador, sem biblioteca (NOTE-01).

type Estado = { fase: "carregando" } | { fase: "pronto" } | { fase: "erro"; mensagem: string } | { fase: "semSanitizador" };

const BARRA: readonly [ComandoNota, LucideIcon, string][] = [
  ["h1", Heading1, "Título"],
  ["h2", Heading2, "Subtítulo"],
  ["h3", Heading3, "Seção"],
  ["p", Pilcrow, "Texto"],
  ["bold", Bold, "Negrito (⌘B)"],
  ["italic", Italic, "Itálico (⌘I)"],
  ["underline", Underline, "Sublinhado (⌘U)"],
  ["strikeThrough", Strikethrough, "Tachado"],
  ["code", Code, "Código"],
  ["ul", List, "Lista"],
  ["ol", ListOrdered, "Lista numerada"],
  ["check", ListChecks, "Checklist"],
  ["quote", Quote, "Citação"],
  ["hr", Minus, "Divisor"],
  ["link", Link, "Link"],
];

// As listas de tarefa: a caixa antes do item (desenhada em CSS, sem caractere; `.nota-checklist` mora
// em marca.css), e o item feito riscado.
const CHECKLIST = "nota-checklist [&_ul.checklist]:list-none [&_ul.checklist]:pl-1 [&_ul.checklist>li.feito]:text-muted [&_ul.checklist>li.feito]:line-through";

// W10: o conteúdo já sanitizado, com o instante de quem grava (o relógio fica fora da porta).
async function gravarNota(mentoradoId: string, conteudo: string): Promise<ResultadoEscrita> {
  const gravada = await salvarNota(mentoradoId, conteudo, new Date().toISOString());
  return !gravada.ok && "erro" in gravada ? { ok: false, erro: `Notas não salvas: ${gravada.erro}` } : gravada;
}

// O anexo enviado (AD-010), com o nome do arquivo no erro do Storage.
async function enviar(mentoradoId: string, arquivo: File): Promise<ResultadoEscrita> {
  const enviado = await enviarAnexo(mentoradoId, arquivo);
  return !enviado.ok && "erro" in enviado ? { ok: false, erro: `"${arquivo.name}" não foi enviado: ${enviado.erro}` } : enviado;
}

// W22 (AD-010, emenda): o anexo apagado do bucket, com o nome do arquivo no erro do Storage.
async function excluir(anexo: AnexoDaNota): Promise<ResultadoEscrita> {
  const removido = await removerAnexo(anexo.caminho);
  return !removido.ok && "erro" in removido ? { ok: false, erro: `"${anexo.nome}" não foi excluído: ${removido.erro}` } : removido;
}

// AD-010: os `anexo:` da nota viram links assinados no DOM, para ler e para editar. Sem link, a
// nota abre igual e o toast diz por quê.
async function resolver(el: HTMLElement): Promise<void> {
  const caminhos = caminhosDeAnexo(el);
  if (caminhos.length === 0) return;
  const links = await linksAssinados(caminhos);
  if (!links.ok) {
    toast.error(`Os anexos da nota não abriram: ${links.erro}`);
    return;
  }
  resolverAnexos(el, links.dados);
}

// O anexo abre em outra aba pelo link assinado pedido na hora: o `anexo:` ainda sem link não navega.
async function abrirAnexo(caminho: string): Promise<void> {
  const links = await linksAssinados([caminho]);
  if (!links.ok) {
    toast.error(`O anexo não abriu: ${links.erro}`);
    return;
  }
  const url = linkValido(links.dados.get(caminho) ?? "");
  if (!url) {
    toast.error("O anexo não abriu: o arquivo não está no bucket.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

// No contenteditable o clique num link só põe o cursor: aqui ele abre o endereço em outra aba, no
// editor e no quadro só leitura. Arrastar para selecionar não abre, e só http(s) sai (NOTE-08).
function abrirLink(e: MouseEvent): void {
  const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!link || document.getSelection()?.isCollapsed === false) return;
  e.preventDefault();
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith(ANEXO)) {
    void abrirAnexo(href.slice(ANEXO.length)).catch((erro: unknown) => console.error("[central-elite3d] abrir anexo", erro));
    return;
  }
  const url = linkValido(href);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

const ACEITA_IMAGEM = TIPOS_IMAGEM.join(",");
const ACEITA_DOCUMENTO = [...TIPOS_DOCUMENTO, ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"].join(",");

// A seleção do editor, guardada para o que cai nela depois: o Dialog do link e o envio do anexo
// tiram o foco. Seleção fora do editor não é guardada.
function selecaoAtual(editor: HTMLElement): Range | null {
  const atual = document.getSelection();
  return dentroDoEditor(atual?.rangeCount ? atual.getRangeAt(0).cloneRange() : null, editor);
}

// O nó que é filho direto do editor: o bloco onde o cursor está.
function blocoDe(no: Node, editor: HTMLElement): Node | null {
  let atual: Node | null = no;
  while (atual && atual.parentNode !== editor) atual = atual.parentNode;
  return atual;
}

// O comando da barra ou do atalho sobre a seleção (notaCmd, index.html:3411–3427). Termina com um
// input, que agenda a gravação.
function aplicar(editor: HTMLElement, comando: ComandoNota): void {
  editor.focus();
  const bloco = (tag: string) => document.execCommand("formatBlock", false, tag);
  if (comando === "h1" || comando === "h2" || comando === "h3" || comando === "p" || comando === "pre") bloco(comando);
  else if (comando === "quote") bloco("blockquote");
  else if (comando === "ul") document.execCommand("insertUnorderedList");
  else if (comando === "ol") document.execCommand("insertOrderedList");
  else if (comando === "hr") document.execCommand("insertHorizontalRule");
  else if (comando === "check") {
    document.execCommand("insertUnorderedList");
    document.getSelection()?.anchorNode?.parentElement?.closest("ul")?.classList.toggle("checklist");
  } else if (comando === "code") {
    const texto = document.getSelection()?.toString() ?? "";
    if (!texto) bloco("pre");
    else {
      const codigo = document.createElement("code");
      codigo.textContent = texto;
      // O espaço de largura zero deixa o cursor sair do código.
      document.execCommand("insertHTML", false, sanitizarNota(`${codigo.outerHTML}\u200b`) ?? "");
    }
  } else document.execCommand(comando);
  editor.dispatchEvent(new Event("input"));
}

// NOTE-08: o link, num Dialog, só http: ou https:.
export function LinkForm({ aoInserir }: { aoInserir(url: string): void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const inserir = () => {
    const url = linkValido(texto);
    if (url) aoInserir(url);
    else setErro("Use um endereço que comece com http:// ou https://.");
  };
  return (
    <div className="space-y-4">
      <FormField label="Endereço do link" htmlFor="nota-link" error={erro || undefined}>
        <Input id="nota-link" value={texto} placeholder="https://…" onChange={(e) => setTexto(e.target.value)} />
      </FormField>
      <Button onClick={inserir}>Inserir link</Button>
    </div>
  );
}

export default function EditorNotas({ mentoradoId }: { mentoradoId: string }) {
  const { usuario, pode } = useSessao();
  const edita = pode("escreverNotas");
  const editor = useRef<HTMLDivElement>(null);
  const selecao = useRef<Range | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aviso, setAviso] = useState("");
  const [linkAberto, setLinkAberto] = useState(false);
  const { executar } = useEscrita("escreverNotas", (conteudo: string) => gravarNota(mentoradoId, conteudo));
  // O efeito vive enquanto o editor está montado: grava pelo executor do render mais recente.
  const executarRef = useRef(executar);
  executarRef.current = executar;
  // AD-010: o anexo sobe pela mesma regra de escrita (capacidade, trava, sessão, toast) e, enviado,
  // entra na seleção guardada.
  const imagemInput = useRef<HTMLInputElement>(null);
  const anexoInput = useRef<HTMLInputElement>(null);
  const pendente = useRef<{ nome: string; imagem: boolean } | null>(null);
  const anexo = useEscrita("escreverNotas", (arquivo: File) => enviar(mentoradoId, arquivo), undefined, (gravado) => inserirAnexo(gravado.caminho));
  const enviarArquivo = async (arquivo: File, imagem: boolean) => {
    const recusa = conferirArquivo(arquivo, imagem);
    if (recusa) {
      toast.error(recusa);
      return;
    }
    pendente.current = { nome: arquivo.name, imagem };
    await anexo.executar(arquivo);
  };
  const enviarRef = useRef(enviarArquivo);
  enviarRef.current = enviarArquivo;
  // W22: a lista "Anexos" sai do DOM do editor (ao abrir, a cada input e depois de inserir ou
  // excluir, que disparam input). Excluir apaga o arquivo do bucket e, só depois, as citações dele.
  const [anexos, setAnexos] = useState<AnexoDaNota[]>([]);
  const [excluindo, setExcluindo] = useState<AnexoDaNota | null>(null);
  const exclusao = useEscrita("escreverNotas", (alvo: AnexoDaNota) => excluir(alvo), "Anexo excluído");
  const confirmarExclusao = async () => {
    const el = editor.current;
    if (!el || !excluindo) return;
    // Falhou no Storage: nada sai da nota, e o toast já mostrou o erro.
    if (!(await exclusao.executar(excluindo))) return;
    for (const no of citacoesDoAnexo(el, excluindo.caminho, SUPABASE_URL)) no.remove();
    setExcluindo(null);
    el.dispatchEvent(new Event("input"));
  };

  useEffect(() => {
    // NOTE-03: sem sanitizador o editor não abre: nada de HTML na tela e nada gravado.
    if (sanitizarNota("") === null) {
      setEstado({ fase: "semSanitizador" });
      return;
    }
    // As gravações saem uma de cada vez: uma pausa durante outra gravação não se perde na trava.
    const ligar = (el: HTMLDivElement) => {
      let fila: Promise<void> = Promise.resolve();
      const gravar = async (html: string) => {
        // AD-010: a URL assinada não vai para o banco; volta a `anexo:` antes do sanitizador.
        const limpo = sanitizarNota(canonizarAnexos(html, SUPABASE_URL));
        if (limpo === null) return;
        setAviso((await executarRef.current(limpo)) ? `Salvo ${fmtInstante(new Date().toISOString())}` : "Erro ao salvar");
      };
      // O autosave guarda o último HTML digitado como texto (o htmlRef do design): quem descarrega
      // não lê o DOM, porque o nó já pode estar solto quando o cleanup roda.
      const autosave = criarAutosave({
        salvar: (html) => (fila = fila.then(() => gravar(html)).catch((erro: unknown) => console.error("[central-elite3d] gravar nota", erro))),
      });
      const aoDigitar = () => {
        autosave.mudou(el.innerHTML);
        setAviso("Editando…");
        setAnexos(anexosDaNota(el, SUPABASE_URL));
      };
      const aoTeclar = (e: KeyboardEvent) => {
        if (e.key !== " " && e.key !== "Enter") return;
        const selecionado = document.getSelection();
        const no = selecionado?.anchorNode;
        if (!selecionado || !no || no.nodeType !== 3) return;
        const antes = (no.textContent ?? "").slice(0, selecionado.anchorOffset);
        const bloco = blocoDe(no, el)?.textContent ?? "";
        // Só no começo do bloco: o marcador tem de ser tudo o que o bloco tem.
        if (bloco.replace(/\u00a0/g, " ").trim() !== antes.replace(/\u00a0/g, " ").trim()) return;
        const comando = atalhoPara(antes, e.key);
        if (!comando) return;
        e.preventDefault();
        no.textContent = (no.textContent ?? "").slice(selecionado.anchorOffset);
        aplicar(el, comando);
      };
      // Colar também passa pelo sanitizador (NOTE-02); o link assinado colado volta a `anexo:` e é
      // resolvido de novo. A imagem colada sobe como a do botão (AD-010). Texto do Word e do Excel
      // vem com um PNG da seleção junto: com texto no HTML, o que entra é o HTML.
      const aoColar = (e: ClipboardEvent) => {
        e.preventDefault();
        const html = e.clipboardData?.getData("text/html") ?? "";
        const imagem = Array.from(e.clipboardData?.files ?? []).find((arquivo) => arquivo.type.startsWith("image/"));
        if (imagem && !html.replace(/<[^>]*>/g, "").trim()) {
          selecao.current = selecaoAtual(el);
          void enviarRef.current(imagem, true).catch((erro: unknown) => console.error("[central-elite3d] enviar anexo", erro));
          return;
        }
        if (!html) {
          document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
          return;
        }
        document.execCommand("insertHTML", false, sanitizarNota(canonizarAnexos(html, SUPABASE_URL)) ?? "");
        void resolver(el).catch((erro: unknown) => console.error("[central-elite3d] anexos da nota", erro));
      };
      // O arquivo solto no editor sobe no lugar do cursor: imagem como imagem, o resto como anexo.
      // ponytail: cai na seleção atual, não no ponto do mouse; caretRangeFromPoint se pedirem.
      const aoArrastar = (e: DragEvent) => {
        if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
      };
      const aoSoltar = (e: DragEvent) => {
        const arquivo = e.dataTransfer?.files[0];
        if (!arquivo) return;
        e.preventDefault();
        selecao.current = selecaoAtual(el);
        void enviarRef.current(arquivo, arquivo.type.startsWith("image/")).catch((erro: unknown) => console.error("[central-elite3d] enviar anexo", erro));
      };
      // A caixa do checklist marca o item feito (index.html:3389–3392).
      const aoClicar = (e: MouseEvent) => {
        const item = e.target instanceof Element ? e.target.closest("ul.checklist > li") : null;
        if (!item || e.offsetX >= 24) return;
        item.classList.toggle("feito");
        el.dispatchEvent(new Event("input"));
      };
      // NOTE-05: a aba escondida grava o pendente, no lugar do `beforeunload` assíncrono de hoje.
      const aoEsconder = () => {
        if (document.visibilityState === "hidden") void autosave.descarregar();
      };
      el.addEventListener("input", aoDigitar);
      el.addEventListener("keydown", aoTeclar);
      el.addEventListener("paste", aoColar);
      el.addEventListener("dragover", aoArrastar);
      el.addEventListener("drop", aoSoltar);
      el.addEventListener("click", aoClicar);
      document.addEventListener("visibilitychange", aoEsconder);
      // SEC-06: o sair() grava a nota pendente antes do signOut.
      const soltar = registrarPendencia(() => autosave.descarregar());
      return () => {
        el.removeEventListener("input", aoDigitar);
        el.removeEventListener("keydown", aoTeclar);
        el.removeEventListener("paste", aoColar);
        el.removeEventListener("dragover", aoArrastar);
        el.removeEventListener("drop", aoSoltar);
        el.removeEventListener("click", aoClicar);
        document.removeEventListener("visibilitychange", aoEsconder);
        soltar();
        // NOTE-05: trocar de aba, de ficha ou de tela grava o que ficou pendente.
        void autosave.descarregar();
      };
    };
    let vivo = true;
    let desligar: () => void = () => undefined;
    let soltarClique: () => void = () => undefined;
    const abrir = async () => {
      // SEC-06: a leitura confere a sessão do supabase-js contra o usuário da tela.
      const lida = await lerNota(mentoradoId, usuario.id);
      const el = editor.current;
      if (!vivo || !el) return;
      if (!lida.ok) {
        setEstado({ fase: "erro", mensagem: lida.erro });
        return;
      }
      el.innerHTML = sanitizarNota(lida.dados?.conteudo ?? "") ?? "";
      setEstado({ fase: "pronto" });
      setAnexos(anexosDaNota(el, SUPABASE_URL));
      if (lida.dados) setAviso(`Salvo ${fmtInstante(lida.dados.atualizado_em)}`);
      // NOTE-06: quem não escreve só lê; os anexos abrem para os dois.
      if (edita) desligar = ligar(el);
      el.addEventListener("click", abrirLink);
      soltarClique = () => el.removeEventListener("click", abrirLink);
      await resolver(el);
    };
    void abrir().catch((erro: unknown) => console.error("[central-elite3d] abrir nota", erro));
    return () => {
      vivo = false;
      soltarClique();
      desligar();
    };
  }, [mentoradoId, usuario.id, edita]);

  const comandar = (comando: ComandoNota) => {
    const el = editor.current;
    if (!el) return;
    if (comando !== "link") {
      aplicar(el, comando);
      return;
    }
    // O Dialog tira o foco do editor: a seleção é guardada para o link cair no texto marcado.
    selecao.current = selecaoAtual(el);
    setLinkAberto(true);
  };
  const voltarSelecao = (el: HTMLElement) => {
    el.focus();
    const atual = document.getSelection();
    if (atual && selecao.current) {
      atual.removeAllRanges();
      atual.addRange(selecao.current);
    }
  };
  const inserirLink = (url: string) => {
    const el = editor.current;
    setLinkAberto(false);
    if (!el) return;
    voltarSelecao(el);
    document.execCommand("createLink", false, url);
    el.dispatchEvent(new Event("input"));
  };
  // AD-010: o anexo enviado entra como `anexo:` sanitizado no fim da seleção guardada, sem nunca
  // trocar o texto marcado; sem seleção no editor, no fim da nota. Se o navegador não o pôs no editor,
  // ele é acrescentado no fim. Depois agenda a gravação e ganha o link assinado para aparecer na hora.
  function inserirAnexo(caminho: string | undefined) {
    const el = editor.current;
    const enviado = pendente.current;
    pendente.current = null;
    if (!el || !caminho || !enviado) return;
    const ponto = pontoDoAnexo(selecao.current, el);
    el.focus();
    if (ponto) {
      const atual = document.getSelection();
      atual?.removeAllRanges();
      atual?.addRange(ponto);
      document.execCommand("insertHTML", false, sanitizarNota(htmlDoAnexo(caminho, enviado.nome, enviado.imagem)) ?? "");
    }
    if (citacoesDoAnexo(el, caminho, SUPABASE_URL).length === 0) el.insertAdjacentHTML("beforeend", sanitizarNota(htmlDoAnexo(caminho, enviado.nome, enviado.imagem)) ?? "");
    el.dispatchEvent(new Event("input"));
    void resolver(el).catch((erro: unknown) => console.error("[central-elite3d] anexos da nota", erro));
  }
  // O botão guarda a seleção e abre o seletor de arquivo; o valor volta a vazio para o mesmo
  // arquivo poder subir de novo.
  const escolher = (entrada: RefObject<HTMLInputElement | null>) => {
    if (!editor.current) return;
    selecao.current = selecaoAtual(editor.current);
    entrada.current?.click();
  };
  const aoEscolher = (e: { target: HTMLInputElement }, imagem: boolean) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void enviarArquivo(arquivo, imagem).catch((erro: unknown) => console.error("[central-elite3d] enviar anexo", erro));
  };

  if (estado.fase === "semSanitizador") {
    return (
      <Alert variant="danger" title="O editor não abriu com segurança neste navegador">
        Sem o sanitizador, as notas não são exibidas nem gravadas aqui. Recarregue a página ou use outro navegador.
      </Alert>
    );
  }
  if (estado.fase === "erro") {
    return (
      <Alert variant="danger" title="Não foi possível carregar as notas">
        {estado.mensagem}
      </Alert>
    );
  }
  const editavel = edita && estado.fase === "pronto";
  return (
    <div className="space-y-3">
      {edita ? (
        <div role="toolbar" aria-label="Formatação da nota" className="flex flex-wrap items-center gap-1 rounded-8 border border-line bg-sub-bg p-1">
          {BARRA.map(([comando, Icone, titulo]) => (
            <Button key={comando} variant="ghost" size="sm" title={titulo} aria-label={titulo} onMouseDown={(e) => e.preventDefault()} onClick={() => comandar(comando)}>
              <Icone aria-hidden size={16} />
            </Button>
          ))}
          <Button variant="ghost" size="sm" title="Imagem" aria-label="Imagem" loading={anexo.ocupado} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(imagemInput)}>
            <ImagePlus aria-hidden size={16} />
          </Button>
          <Button variant="ghost" size="sm" title="Anexo" aria-label="Anexo" loading={anexo.ocupado} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(anexoInput)}>
            <Paperclip aria-hidden size={16} />
          </Button>
          <Input ref={imagemInput} type="file" accept={ACEITA_IMAGEM} hidden aria-label="Escolher imagem" onChange={(e) => aoEscolher(e, true)} />
          <Input ref={anexoInput} type="file" accept={ACEITA_DOCUMENTO} hidden aria-label="Escolher anexo" onChange={(e) => aoEscolher(e, false)} />
          <span className="ml-auto px-2 text-xs text-muted">{aviso}</span>
        </div>
      ) : (
        <p className="text-xs text-muted">Somente leitura para o seu papel.</p>
      )}
      {estado.fase === "carregando" && <Skeleton className="h-40" />}
      <div
        ref={editor}
        role="textbox"
        aria-multiline="true"
        aria-label="Notas do mentorado"
        aria-readonly={!editavel}
        contentEditable={editavel || undefined}
        data-escrita={editavel ? "W10" : undefined}
        data-vazio={editavel ? "Escreva aqui… use # para título, - para lista, [] para checklist." : "Sem notas."}
        className={`${PROSE_CLASS} ${CHECKLIST} nota-anexos min-h-40 rounded-8 border border-line bg-background p-4 outline-none focus:border-primary/70 empty:before:text-muted empty:before:content-[attr(data-vazio)] ${estado.fase === "carregando" ? "hidden" : ""}`}
      />
      {estado.fase === "pronto" && (
        <section aria-label="Anexos da nota" data-escrita={editavel ? "W22" : undefined} className="space-y-2">
          <h3 className="text-sm font-medium text-ink">Anexos</h3>
          {anexos.length === 0 ? (
            <p className="text-xs text-muted">Nenhum anexo nesta nota.</p>
          ) : (
            <ul className="divide-y divide-line rounded-8 border border-line">
              {anexos.map((item) => {
                const Icone = item.imagem ? ImageIcon : FileText;
                return (
                  <li key={item.caminho} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Icone aria-hidden size={16} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate" title={item.nome}>
                      {item.nome}
                    </span>
                    <Button variant="ghost" size="sm" aria-label={`Abrir ${item.nome}`} onClick={() => void abrirAnexo(item.caminho).catch((erro: unknown) => console.error("[central-elite3d] abrir anexo", erro))}>
                      Abrir
                    </Button>
                    {editavel && (
                      <Button variant="outline" size="sm" className="text-danger" data-escrita="W22" aria-label={`Excluir ${item.nome}`} onClick={() => setExcluindo(item)}>
                        Excluir
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {editavel && (
        <ConfirmDialog
          open={excluindo !== null}
          title="Excluir anexo"
          description={`Excluir "${excluindo?.nome ?? ""}"? O arquivo é apagado e sai da nota. A ação não pode ser desfeita.`}
          confirmLabel="Excluir anexo"
          busy={exclusao.ocupado}
          onConfirm={() => void confirmarExclusao().catch((erro: unknown) => console.error("[central-elite3d] excluir anexo", erro))}
          onClose={() => setExcluindo(null)}
        />
      )}
      <Dialog open={linkAberto} onClose={() => setLinkAberto(false)} title="Inserir link">
        <LinkForm aoInserir={inserirLink} />
      </Dialog>
    </div>
  );
}
