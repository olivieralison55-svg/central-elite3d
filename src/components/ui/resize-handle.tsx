"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O divisor arrastável entre uma área de conteúdo e o painel à sua DIREITA, e
 * o hook que lembra a largura escolhida.
 *
 * Os dois moram juntos porque nunca se usa um sem o outro: quem arrasta espera
 * que a largura sobreviva ao fechar da gaveta, e um divisor que esquece é um
 * ajuste que vira tarefa repetida.
 *
 * Vale para o painel à direita. Um divisor à esquerda inverteria o sinal do
 * delta; quando aparecer o primeiro caso, ele ganha um parâmetro — inventar o
 * lado que ninguém usa é código sem quem o corrija.
 */

export interface ResizableWidthRange {
  min: number;
  max: number;
  initial: number;
}

export function clampWidth(width: number, range: ResizableWidthRange): number {
  if (!Number.isFinite(width)) return range.initial;
  return Math.round(Math.max(range.min, Math.min(range.max, width)));
}

/**
 * A largura de um painel, arrastável e LEMBRADA entre sessões.
 *
 * `localStorage` e não banco: é preferência de tela desta máquina, não
 * propriedade do conteúdo — a mesma classificação que a proporção escolhida
 * numa revisão, que também não é persistida na peça. A consequência aceita é
 * que outro navegador começa no padrão.
 */
export function useResizableWidth(
  storageKey: string,
  range: ResizableWidthRange,
): [number, (width: number) => void] {
  const [width, setWidth] = useState(range.initial);

  // Lido num efeito, nunca no `useState`: tocar `localStorage` durante o
  // render divergiria do HTML do servidor e quebraria a hidratação.
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) setWidth(clampWidth(Number(stored), range));
    // A faixa é constante por chamador; relê-la a cada render reabriria o
    // efeito sem motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function update(next: number) {
    const clamped = clampWidth(next, range);
    setWidth(clamped);
    try {
      window.localStorage.setItem(storageKey, String(clamped));
    } catch {
      // Modo privado, cota estourada: a largura vale para esta sessão e pronto.
      // Falhar aqui não pode derrubar a tela.
    }
  }

  return [width, update];
}

export default function ResizeHandle({
  width,
  range,
  label = "Largura do painel",
  onResize,
}: {
  width: number;
  range: ResizableWidthRange;
  label?: string;
  onResize: (width: number) => void;
}) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      tabIndex={0}
      onPointerDown={(e) => {
        drag.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const state = drag.current;
        if (!state || state.pointerId !== e.pointerId) return;
        // Invertido: o painel está à direita, então arrastar para a ESQUERDA
        // aumenta a largura dele.
        onResize(state.startWidth - (e.clientX - state.startX));
      }}
      onPointerUp={(e) => {
        if (drag.current?.pointerId === e.pointerId) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          drag.current = null;
        }
      }}
      onKeyDown={(e) => {
        // Teclado tem de fazer o mesmo que o ponteiro: um divisor só-mouse é um
        // controle que parte das pessoas simplesmente não tem.
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onResize(width + 16);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onResize(width - 16);
        }
      }}
      // Alvo de 8px para uma régua de 1px: o alvo precisa ser fácil de acertar
      // (erro nº 6 do *Top 10 Application-Design Mistakes* — alvos pequenos
      // demais), e a linha visível continua fina.
      className="group relative w-2 shrink-0 cursor-col-resize touch-none border-l border-line outline-none"
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-full transition-colors duration-quick group-hover:bg-primary/20 group-focus:bg-primary/30" />
    </div>
  );
}
