"use client";

import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Spinner from "@/components/ui/spinner";

/**
 * Confirmação de uma ação destrutiva, sobre o `Dialog` do DS.
 *
 * Existe como primitivo porque excluir aparece em mais de um módulo e o
 * `window.confirm` não serve: ele não carrega o nome do que vai sumir, não
 * respeita tema nem foco, e trava a aba inteira enquanto a request roda.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Excluir",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  /** O que exatamente será perdido — nome da peça incluído. */
  description: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  /** Trava extra além de `busy` — ex.: nome digitado ainda não bate com o do objeto (BuildLoop, BL-01 item 7). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      // Fechar durante a request deixaria a ação rodando sem ninguém olhando.
      onClose={busy ? () => undefined : onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          {/* Mesma pele destrutiva que o diálogo de excluir arquivo do
              `ProjectDetailView` já usava: o `Button` do DS não tem variante
              `danger`, e inventar uma aqui criaria duas peles diferentes para a
              mesma ação. */}
          <Button
            variant="primary"
            className="!bg-danger hover:!bg-danger/90"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {busy && <Spinner size={14} className="text-white" />}
            {busy ? "Excluindo…" : confirmLabel}
          </Button>
        </>
      }
    >
      {/* `div`, not `p`: a caller may hand in its own block content — the
          BuildLoop typed-name confirmation passes a paragraph plus an `Input`,
          and a `<div>`/`<p>` inside a `<p>` is invalid HTML the browser
          reparents, which React reports as a hydration error. */}
      <div className="text-sm leading-relaxed text-muted">{description}</div>
    </Dialog>
  );
}
