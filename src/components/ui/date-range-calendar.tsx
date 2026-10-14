"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

const isoDay = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const rangeOf = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

/**
 * Range picker restricted to the days that have data. Apply reports the ISO
 * bounds; only days present in `days` are selectable.
 */
export default function DateRangeCalendar({
  days,
  onApply,
  onClear,
  placeholder = "Selecionar período",
  start = null,
  end = null,
}: {
  /** ISO `YYYY-MM-DD` days that carry data. */
  days: string[];
  onApply: (start: string, end: string) => void;
  onClear: () => void;
  placeholder?: string;
  /** Range currently in force. Pass it when the caller can select days by other
   *  means (clicking the chart, opening on a default window) — otherwise the
   *  trigger would read "Selecionar período" while a filter is applied. */
  start?: string | null;
  end?: string | null;
}) {
  const dataDays = useMemo(() => new Set(days), [days]);
  const months = useMemo(() => [...new Set(days.map((d) => d.slice(0, 7)))].sort(), [days]);

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(months[0] ?? "");
  const [calStart, setCalStart] = useState<string | null>(start);
  const [calEnd, setCalEnd] = useState<string | null>(end);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Follow the range the caller reports, but never while the panel is open —
  // mid-pick the internal state is a half-built range the caller has not seen.
  useEffect(() => {
    if (open) return;
    setCalStart(start);
    setCalEnd(end);
  }, [start, end, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const [y, m] = viewMonth ? viewMonth.split("-").map(Number) : [2026, 1];
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const mi = months.indexOf(viewMonth);

  const eff = hoverDay ?? calEnd;
  const [rs, re] = calStart && eff ? rangeOf(calStart, eff) : [null, null];

  function pick(day: string) {
    if (!calStart || calEnd) {
      setCalStart(day);
      setCalEnd(null);
      setHoverDay(null);
    } else {
      const [s, en] = rangeOf(calStart, day);
      setCalStart(s);
      setCalEnd(en);
      setHoverDay(null);
    }
  }

  const btnLabel =
    calStart && calEnd
      ? `${calStart.slice(8)}/${calStart.slice(5, 7)} → ${calEnd.slice(8)}/${calEnd.slice(5, 7)}`
      : calStart
        ? `${calStart.slice(8)}/${calStart.slice(5, 7)} → ?`
        : placeholder;
  const active = Boolean(calStart);

  const hint = !calStart
    ? "Clique no dia de início"
    : !calEnd
      ? "Clique no dia final"
      : `${calStart.slice(8)}/${calStart.slice(5, 7)} → ${calEnd.slice(8)}/${calEnd.slice(5, 7)}`;

  function clear() {
    setCalStart(null);
    setCalEnd(null);
    setHoverDay(null);
    onClear();
    setOpen(false);
  }

  function apply() {
    if (!calStart || !calEnd) return;
    onApply(calStart, calEnd);
    setOpen(false);
  }

  return (
    // isolate: contains the panel's z-[200] so it can't leak past the AppShell
    // header/sidebar stacking context when the trigger scrolls near the top.
    <div ref={wrapRef} className="relative inline-flex isolate">
      <button
        type="button"
        onClick={() => {
          setViewMonth(calStart ? calStart.slice(0, 7) : months[0] ?? "");
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-quick ${
          active
            ? "border-primary bg-primary text-white"
            : "border-line bg-background text-ink hover:border-primary hover:text-primary"
        }`}
      >
        <CalendarDays size={13} />
        {btnLabel}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[200] min-w-[264px] rounded-12 border border-line bg-background p-4 shadow-dialog">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => mi > 0 && setViewMonth(months[mi - 1])}
              className={`px-1 text-muted transition-colors duration-quick hover:text-primary ${mi > 0 ? "" : "invisible"}`}
            >
              ‹
            </button>
            <span className="text-[13px] font-bold text-ink">
              {PT_MONTHS[m - 1]} {y}
            </span>
            <button
              type="button"
              onClick={() => mi < months.length - 1 && setViewMonth(months[mi + 1])}
              className={`px-1 text-muted transition-colors duration-quick hover:text-primary ${mi < months.length - 1 ? "" : "invisible"}`}
            >
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DOW.map((d, i) => (
              <span key={i} className="py-0.5 text-center text-[10px] font-semibold text-muted">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => !calEnd && setHoverDay(null)}>
            {Array.from({ length: firstDow }).map((_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const d = idx + 1;
              const day = isoDay(y, m - 1, d);
              const hasData = dataDays.has(day);
              const isS = day === rs;
              const isE = day === re;
              const isSingle = isS && isE;
              const mid = rs && re && day > rs && day < re;
              let cls = "text-muted";
              if (isSingle) cls = "rounded-8 bg-primary font-bold text-white";
              else if (isS) cls = "rounded-l-8 bg-primary font-bold text-white";
              else if (isE) cls = "rounded-r-8 bg-primary font-bold text-white";
              else if (mid) cls = "bg-info-soft text-info";
              else if (hasData) cls = "cursor-pointer rounded-8 font-medium text-ink hover:bg-selected";
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!hasData}
                  onClick={() => hasData && pick(day)}
                  onMouseEnter={() => hasData && calStart && !calEnd && setHoverDay(day)}
                  className={`flex h-8 w-8 items-center justify-center text-xs ${cls} ${!hasData ? "cursor-default" : ""}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-center text-[11px] text-muted">{hint}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={clear}
              className="rounded-8 border border-line bg-background px-3.5 py-1.5 text-xs text-ink transition-colors duration-quick hover:bg-selected"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!calStart || !calEnd}
              className="rounded-8 border border-primary bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-quick disabled:cursor-default disabled:opacity-45"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
