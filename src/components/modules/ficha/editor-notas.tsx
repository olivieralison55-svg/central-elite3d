"use client";

import { Bold, Code, Heading1, Heading2, Heading3, Italic, Link, List, ListChecks, ListOrdered, type LucideIcon, Minus, Pilcrow, Quote, Strikethrough, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSessao } from "@/components/shell/contexto";
import { useEscrita } from "@/components/shell/use-escrita";
import Alert from "@/components/ui/alert";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import { PROSE_CLASS } from "@/components/ui/prose";
import Skeleton from "@/components/ui/skeleton";
import { type ResultadoEscrita, salvarNota } from "@/lib/data/escritas";
import { lerNota } from "@/lib/data/leituras";
import { fmtInstante } from "@/lib/datas";
import { atalhoPara, type ComandoNota, criarAutosave, linkValido, sanitizarNota } from "@/lib/notas";
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
        const limpo = sanitizarNota(html);
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
      // Colar também passa pelo sanitizador (NOTE-02).
      const aoColar = (e: ClipboardEvent) => {
        e.preventDefault();
        const html = e.clipboardData?.getData("text/html") ?? "";
        if (html) document.execCommand("insertHTML", false, sanitizarNota(html) ?? "");
        else document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
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
      el.addEventListener("click", aoClicar);
      document.addEventListener("visibilitychange", aoEsconder);
      // SEC-06: o sair() grava a nota pendente antes do signOut.
      const soltar = registrarPendencia(() => autosave.descarregar());
      return () => {
        el.removeEventListener("input", aoDigitar);
        el.removeEventListener("keydown", aoTeclar);
        el.removeEventListener("paste", aoColar);
        el.removeEventListener("click", aoClicar);
        document.removeEventListener("visibilitychange", aoEsconder);
        soltar();
        // NOTE-05: trocar de aba, de ficha ou de tela grava o que ficou pendente.
        void autosave.descarregar();
      };
    };
    let vivo = true;
    let desligar: () => void = () => undefined;
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
      if (lida.dados) setAviso(`Salvo ${fmtInstante(lida.dados.atualizado_em)}`);
      // NOTE-06: quem não escreve só lê.
      if (edita) desligar = ligar(el);
    };
    void abrir().catch((erro: unknown) => console.error("[central-elite3d] abrir nota", erro));
    return () => {
      vivo = false;
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
    const atual = document.getSelection();
    selecao.current = atual?.rangeCount ? atual.getRangeAt(0).cloneRange() : null;
    setLinkAberto(true);
  };
  const inserirLink = (url: string) => {
    const el = editor.current;
    setLinkAberto(false);
    if (!el) return;
    el.focus();
    const atual = document.getSelection();
    if (atual && selecao.current) {
      atual.removeAllRanges();
      atual.addRange(selecao.current);
    }
    document.execCommand("createLink", false, url);
    el.dispatchEvent(new Event("input"));
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
        className={`${PROSE_CLASS} ${CHECKLIST} min-h-40 rounded-8 border border-line bg-background p-4 outline-none focus:border-primary/70 empty:before:text-muted empty:before:content-[attr(data-vazio)] ${estado.fase === "carregando" ? "hidden" : ""}`}
      />
      <Dialog open={linkAberto} onClose={() => setLinkAberto(false)} title="Inserir link">
        <LinkForm aoInserir={inserirLink} />
      </Dialog>
    </div>
  );
}
