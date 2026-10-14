"use client";

import { useLayoutEffect, useRef, useState } from "react";

const GAP = 8;

/**
 * Universal rule for floating panels: an open dropdown must be fully visible.
 *
 * Two passes — flip the panel above its trigger when there isn't room below,
 * then scroll the nearest scrollable ancestor (a dialog body, a column with
 * `overflow-y-auto`, the window) until the panel is on screen. Flipping alone
 * isn't enough: inside a clipped container the limit is the container, not the
 * viewport.
 *
 * Attach `panelRef` to the absolutely-positioned panel, whose offset parent
 * must be the trigger's wrapper, and place it with `top-full` / `bottom-full`
 * according to `dropUp`.
 */
export function useFloatingPanel<T extends HTMLElement>(open: boolean) {
  const panelRef = useRef<T>(null);
  const [dropUp, setDropUp] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setDropUp(false);
      return;
    }
    const panel = panelRef.current;
    const trigger = panel?.offsetParent;
    if (!panel || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const needed = panel.getBoundingClientRect().height + GAP;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setDropUp(needed > spaceBelow && spaceAbove > spaceBelow);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    // Runs after the flip settles, so it scrolls to the final position.
    panelRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, dropUp]);

  return { panelRef, dropUp };
}
