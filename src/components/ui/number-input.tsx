"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Input from "@/components/ui/input";

/**
 * Numeric field that shows pt-BR grouping while you type ("1.234.567,89") but
 * keeps emitting the raw value the API expects ("1234567.89").
 *
 * A native `type="number"` cannot render a grouped value at all, so this is a
 * text field with its own formatting. Separators follow pt-BR strictly: "."
 * groups thousands and is never part of the number, "," is the decimal mark —
 * typing "." only inserts a group break, never a decimal.
 */

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

/** Raw ("1234.56") → display ("1.234,56"). */
function toDisplay(raw: string): string {
  if (raw === "" || raw === "-") return raw;
  const negative = raw.startsWith("-");
  const [int, dec] = raw.replace("-", "").split(".");
  const grouped = int.replace(GROUP, ".");
  const body = dec === undefined ? grouped : `${grouped},${dec}`;
  return negative ? `-${body}` : body;
}

/** Display → raw. Group dots are dropped; the first comma is the decimal mark
 *  and any further one is ignored, so a stray keystroke cannot corrupt it. */
function toRaw(display: string): string {
  const negative = display.trimStart().startsWith("-");
  const [int, ...rest] = display.replace(/[^\d,]/g, "").split(",");
  const body = rest.length === 0 ? int : `${int}.${rest.join("")}`;
  if (body === "" || body === ".") return negative ? "-" : "";
  return negative ? `-${body}` : body;
}

/** Reformatting shifts every group dot, so the caret is restored by counting
 *  the characters that actually carry meaning — digits and the decimal mark. */
const isSignificant = (char: string) => /[\d,]/.test(char);

function countSignificant(text: string): number {
  let count = 0;
  for (const char of text) if (isSignificant(char)) count += 1;
  return count;
}

function caretAfterSignificant(text: string, target: number): number {
  if (target === 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (isSignificant(text[i])) count += 1;
    if (count === target) return i + 1;
  }
  return text.length;
}

export default function NumberInput({
  value,
  onChange,
  onBlur,
  onFocus,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Raw numeric string — what gets stored and sent. "" means empty. */
  value: string;
  onChange: (raw: string) => void;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [display, setDisplay] = useState(() => toDisplay(value));
  const [focused, setFocused] = useState(false);

  // While the field is idle the prop wins, so a form re-seeded with another
  // row shows the new value instead of the stale draft.
  if (!focused && toRaw(display) !== value) setDisplay(toDisplay(value));

  useLayoutEffect(() => {
    if (caret.current === null) return;
    ref.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const typed = e.currentTarget.value;
    const position = e.currentTarget.selectionStart ?? typed.length;
    const before = countSignificant(typed.slice(0, position));
    const raw = toRaw(typed);
    const next = toDisplay(raw);
    caret.current = caretAfterSignificant(next, before);
    setDisplay(next);
    onChange(raw);
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        setDisplay(toDisplay(value));
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
