"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpDown, ListFilter, Pin } from "lucide-react";
import { Card, CardHeader } from "./card";
import Input from "./input";
import NumberInput from "./number-input";
import Skeleton from "./skeleton";

const SKELETON_ROWS = 5;

/** Makes a cell editable on double-click. Only columns that map to a single
 *  stored field get this — derived numbers (CPA, ROAS) and natural keys stay
 *  read-only, since neither can be written back. */
interface ColumnEdit<T> {
  /** `number` uses the pt-BR grouped editor; `text` a plain field. */
  kind: "number" | "text";
  /** The stored value in editable form ("" when empty). */
  value: (row: T) => string;
}

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  /** Freeze to the left. In a `freezable` table this is only the initial state
   *  and the user can toggle it; elsewhere it is fixed. */
  sticky?: boolean;
  /** Freeze to the right permanently (e.g. an actions column). Not toggleable. */
  stickyRight?: boolean;
  /** Tighter horizontal padding (e.g. a compact actions column). */
  dense?: boolean;
  edit?: ColumnEdit<T>;
  /**
   * The column that absorbs the leftover width — at most one per table.
   *
   * Every other column then shrinks to its own content, so the table can never
   * be wider than its container and never needs a horizontal scrollbar. The
   * `max-w-0` is what makes it work: without it a table cell sizes to its
   * content and `truncate` inside has no width to truncate against.
   *
   * Whatever `render` returns for this column must carry `truncate` (and
   * `min-w-0` if it sits in a flex row) or the text will still push out.
   */
  elastic?: boolean;
  render: (row: T) => React.ReactNode;
}

interface EditingCell {
  row: string;
  column: string;
}

/** Inline editor: commits on Enter or blur, discards on Esc. Mounted only for
 *  the cell being edited, so the draft dies with it. */
function CellEditor({
  kind,
  initial,
  align,
  onCommit,
  onCancel,
}: {
  kind: ColumnEdit<unknown>["kind"];
  initial: string;
  align?: Column<unknown>["align"];
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  // Esc must not also fire the blur commit that follows it.
  const cancelled = useRef(false);

  const shared = {
    autoFocus: true,
    className: `h-7 px-2 text-sm ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
    onBlur: () => {
      if (cancelled.current) return;
      onCommit(draft);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit(draft);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelled.current = true;
        onCancel();
      }
    },
  };

  return kind === "number" ? (
    <NumberInput value={draft} onChange={setDraft} {...shared} />
  ) : (
    <Input value={draft} onChange={(e) => setDraft(e.target.value)} {...shared} />
  );
}

const alignCell = (a?: Column<unknown>["align"]) =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "";

const padX = (dense?: boolean) => (dense ? "px-2" : "px-5");

/**
 * Elastic column takes the slack; the rest hold their content width.
 *
 * Only applied to tables that actually declare an elastic column — sizing every
 * table this way would silently stop text wrapping in the ones that never asked
 * for it.
 */
function widthClass(col: { elastic?: boolean }, hasElastic: boolean): string {
  if (!hasElastic) return "";
  return col.elastic ? "w-full max-w-0" : "w-px whitespace-nowrap";
}

// Opaque background (with hover) so frozen/pinned cells never let scrolling
// content show through. Inset edge shadows mark the freeze boundaries; kept as
// literal strings so Tailwind's scanner emits them.
const BODY_BG = "bg-background group-hover:bg-selected";
// The `0 1px 0 var(--sub-bg)` outset on the header paints 1px of the header's
// own colour just below it, masking the sub-pixel sliver of scrolling rows that
// would otherwise bleed at the header / first-row seam.
const SH = {
  headTop: "shadow-[inset_0_-1px_0_var(--line),0_1px_0_0_var(--sub-bg)]",
  headTopLeft: "shadow-[inset_-1px_0_0_var(--line),inset_0_-1px_0_var(--line),0_1px_0_0_var(--sub-bg)]",
  headTopRight: "shadow-[inset_1px_0_0_var(--line),inset_0_-1px_0_var(--line),0_1px_0_0_var(--sub-bg)]",
  colLeft: "shadow-[inset_-1px_0_0_var(--line)]",
  colRight: "shadow-[inset_1px_0_0_var(--line)]",
  rowBottom: "shadow-[inset_0_-1px_0_var(--line)]",
  rowBottomColLeft: "shadow-[inset_-1px_0_0_var(--line),inset_0_-1px_0_var(--line)]",
  rowBottomColRight: "shadow-[inset_1px_0_0_var(--line),inset_0_-1px_0_var(--line)]",
} as const;

function sameMap(a: Record<string, number>, b: Record<string, number>) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * Generic table: sub-bg header, selected hover (dash-ref-01/02).
 *
 * With `freezable` it becomes a data-grid: click a header to freeze a column to
 * the left, click a row's first cell to freeze that row to the top. Both follow
 * click order and stay visible while the grid scrolls — which only means
 * something when the grid scrolls inside itself, so `freezable` normally comes
 * with `maxHeight`.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Nenhum registro",
  loading = false,
  freezable = false,
  maxHeight,
  onEdit,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
  /** Lets the user pin columns and rows by clicking. Off by default: on a table
   *  that fits its container the affordance would be noise. */
  freezable?: boolean;
  /** Caps the grid's height so it scrolls inside itself (e.g. "70vh"). Without
   *  it the page scrolls and nothing is sticky. */
  maxHeight?: string;
  /** Persists one edited cell. Columns only become editable when this is set.
   *  It owns its own error reporting — the table just awaits it. */
  onEdit?: (row: T, columnKey: string, value: string) => Promise<void>;
}) {
  const [pinnedCols, setPinnedCols] = useState<string[]>(
    () => columns.filter((c) => c.sticky && !c.stickyRight).map((c) => c.key),
  );
  const [pinnedRows, setPinnedRows] = useState<(string | number)[]>([]);
  const headRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const [colOffsets, setColOffsets] = useState<{ left: Record<string, number>; right: Record<string, number> }>({
    left: {},
    right: {},
  });
  const [rowTops, setRowTops] = useState<Record<string, number>>({});

  const [editing, setEditing] = useState<EditingCell | null>(null);

  const hasElastic = columns.some((col) => col.elastic);
  const isPinnedCol = (k: string) => pinnedCols.includes(k);

  const canEdit = (col: Column<T>) => onEdit !== undefined && col.edit !== undefined;

  async function commitEdit(row: T, col: Column<T>, value: string) {
    setEditing(null);
    if (!onEdit || !col.edit || value === col.edit.value(row)) return;
    try {
      await onEdit(row, col.key, value);
    } catch (err) {
      // The handler reports to the user; this only keeps a rejected promise
      // from escaping the table.
      console.error(`[data-table] edit of ${col.key} failed`, err);
    }
  }

  const measure = useCallback(() => {
    const width = (k: string) => headRefs.current[k]?.offsetWidth ?? 0;
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const left: Record<string, number> = {};
    let l = 0;
    for (const key of pinnedCols) {
      const col = byKey.get(key);
      if (!col || col.stickyRight) continue;
      left[key] = l;
      l += width(key);
    }
    const right: Record<string, number> = {};
    let r = 0;
    for (let i = columns.length - 1; i >= 0; i--) {
      const col = columns[i];
      if (col.stickyRight) {
        right[col.key] = r;
        r += width(col.key);
      }
    }
    setColOffsets((prev) =>
      sameMap(prev.left, left) && sameMap(prev.right, right) ? prev : { left, right },
    );

    const headerH = theadRef.current?.offsetHeight ?? 0;
    const pinnedSet = new Set(pinnedRows.map(String));
    const tops: Record<string, number> = {};
    let t = headerH;
    // Stack pinned rows in original row order (index order), not click order.
    for (const row of rows) {
      const key = String(rowKey(row));
      if (!pinnedSet.has(key)) continue;
      tops[key] = t;
      t += rowRefs.current[key]?.offsetHeight ?? 0;
    }
    setRowTops((prev) => (sameMap(prev, tops) ? prev : tops));
  }, [columns, pinnedCols, pinnedRows, rows, rowKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure, rows.length, loading]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const toggleCol = (key: string) =>
    setPinnedCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleRow = (key: string | number) =>
    setPinnedRows((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // Column display order: left-frozen (click order), scrolling, right-frozen.
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const leftFrozen = pinnedCols
    .map((k) => byKey.get(k))
    .filter((c): c is Column<T> => !!c && !c.stickyRight);
  const ordered = [
    ...leftFrozen,
    ...columns.filter((c) => !isPinnedCol(c.key) && !c.stickyRight),
    ...columns.filter((c) => c.stickyRight),
  ];
  const rowHeaderKey = ordered[0]?.key;

  // Row display order: pinned rows first, kept in original index order.
  const pinnedSet = new Set(pinnedRows.map(String));
  const orderedRows = [
    ...rows.filter((row) => pinnedSet.has(String(rowKey(row)))),
    ...rows.filter((row) => !pinnedSet.has(String(rowKey(row)))),
  ];

  const colSide = (col: Column<T>): "left" | "right" | null =>
    col.stickyRight ? "right" : isPinnedCol(col.key) ? "left" : null;

  const headCell = (col: Column<T>) => {
    const side = colSide(col);
    if (side === "left")
      return { cls: `z-50 ${SH.headTopLeft}`, style: { left: colOffsets.left[col.key] ?? 0 } };
    if (side === "right")
      return { cls: `z-50 ${SH.headTopRight}`, style: { right: colOffsets.right[col.key] ?? 0 } };
    return { cls: `z-40 ${SH.headTop}`, style: undefined as React.CSSProperties | undefined };
  };

  const bodyCell = (col: Column<T>, pinnedRow: boolean, top: number) => {
    const side = colSide(col);
    const style: React.CSSProperties = {};
    if (side === "left") style.left = colOffsets.left[col.key] ?? 0;
    if (side === "right") style.right = colOffsets.right[col.key] ?? 0;
    if (pinnedRow) style.top = top;
    if (!side && !pinnedRow) return { cls: "", style: undefined };
    let z: string;
    let sh: string;
    if (side && pinnedRow) {
      z = "z-30";
      sh = side === "left" ? SH.rowBottomColLeft : SH.rowBottomColRight;
    } else if (side) {
      z = "z-10";
      sh = side === "left" ? SH.colLeft : SH.colRight;
    } else {
      z = "z-20";
      sh = SH.rowBottom;
    }
    return { cls: `sticky ${BODY_BG} ${z} ${sh}`, style };
  };

  // An elastic table asks to fit its container, which is the opposite of cells
  // that refuse to wrap — so the two layouts are mutually exclusive.
  const bodyWrap = hasElastic ? "" : "whitespace-nowrap";

  return (
    // overflow-auto, not overflow-hidden: in a narrow container a table wider
    // than its box used to be CLIPPED, so the right-hand column — usually the
    // row actions — silently disappeared instead of becoming reachable.
    // isolate: sticky headers/pinned cells go up to z-50 internally — without
    // a contained stacking context that leaked past the AppShell header/sidebar
    // (z-20/z-30) during scroll, painting the table on top of the app chrome.
    <div className="isolate overflow-auto rounded-md border border-line" style={{ maxHeight }}>
      {/* border-separate (not collapse) so sticky cells paint an opaque
          background — collapsed borders let scrolling rows bleed through. */}
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead ref={theadRef}>
          <tr className="bg-sub-bg text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            {ordered.map((col) => {
              const h = headCell(col);
              const toggleable = freezable && !col.stickyRight;
              const pinnedCol = isPinnedCol(col.key) && toggleable;
              return (
                <th
                  key={col.key}
                  ref={(el) => {
                    headRefs.current[col.key] = el;
                  }}
                  onClick={toggleable ? () => toggleCol(col.key) : undefined}
                  title={toggleable ? (pinnedCol ? "Desafixar coluna" : "Fixar coluna") : undefined}
                  style={h.style}
                  className={`sticky top-0 whitespace-nowrap bg-sub-bg ${padX(col.dense)} py-3 ${widthClass(col, hasElastic)} ${alignCell(col.align)} ${
                    toggleable ? "group/th cursor-pointer select-none" : ""
                  } ${h.cls}`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 ${col.align === "right" ? "flex-row-reverse" : ""} ${col.align === "center" ? "justify-center" : ""}`}
                  >
                    {toggleable && col.align === "center" && <Pin size={11} className="invisible" aria-hidden />}
                    {col.header}
                    {col.sortable && <ArrowUpDown size={11} className="opacity-70" />}
                    {toggleable && (
                      <Pin
                        size={11}
                        className={
                          pinnedCol
                            ? "text-primary"
                            : "text-muted opacity-0 transition-opacity group-hover/th:opacity-60"
                        }
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="group">
                {ordered.map((col) => {
                  const b = bodyCell(col, false, 0);
                  return (
                    <td
                      key={col.key}
                      style={b.style}
                      className={`border-t border-line ${padX(col.dense)} py-3.5 ${widthClass(col, hasElastic)} ${alignCell(col.align)} ${b.cls}`}
                    >
                      <Skeleton
                        className={`h-3.5 ${col.align === "right" ? "ml-auto w-10" : col.align === "center" ? "mx-auto w-14" : "w-24"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={ordered.length} className="px-4 py-10 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
          {!loading &&
            orderedRows.map((row) => {
              const key = rowKey(row);
              const pinnedRow = pinnedSet.has(String(key));
              const top = rowTops[String(key)] ?? 0;
              return (
                <tr
                  key={key}
                  ref={(el) => {
                    rowRefs.current[String(key)] = el;
                  }}
                  className="group bg-background transition hover:bg-selected"
                >
                  {ordered.map((col) => {
                    const b = bodyCell(col, pinnedRow, top);
                    const isRowHeader = freezable && col.key === rowHeaderKey;
                    const editable = canEdit(col);
                    const isEditing =
                      editing?.row === String(key) && editing.column === col.key;
                    return (
                      <td
                        key={col.key}
                        style={b.style}
                        onDoubleClick={
                          editable && !isEditing
                            ? () => setEditing({ row: String(key), column: col.key })
                            : undefined
                        }
                        title={editable && !isEditing ? "Dois cliques para editar" : undefined}
                        className={`${bodyWrap} border-t border-line ${padX(col.dense)} ${isEditing ? "py-2" : "py-3.5"} ${widthClass(col, hasElastic)} ${alignCell(col.align)} ${editable ? "cursor-cell" : ""} ${b.cls}`}
                      >
                        {isEditing && col.edit ? (
                          <CellEditor
                            kind={col.edit.kind}
                            initial={col.edit.value(row)}
                            align={col.align}
                            onCommit={(value) => commitEdit(row, col, value)}
                            onCancel={() => setEditing(null)}
                          />
                        ) : isRowHeader ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(key);
                            }}
                            title={pinnedRow ? "Desafixar linha" : "Fixar linha"}
                            className="inline-flex cursor-pointer select-none items-center gap-1.5"
                          >
                            {col.render(row)}
                            <Pin
                              size={11}
                              className={
                                pinnedRow
                                  ? "text-primary"
                                  : "text-muted opacity-0 transition-opacity group-hover:opacity-60"
                              }
                            />
                          </span>
                        ) : (
                          col.render(row)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

/** Modulix-style table block: white card, dashed-rule header, table inside. */
export function TableCard<T>({
  title,
  actions,
  filterLabel = "Filtrar",
  onFilter,
  ...tableProps
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  filterLabel?: string;
  onFilter?: () => void;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
  freezable?: boolean;
  maxHeight?: string;
  onEdit?: (row: T, columnKey: string, value: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          actions ??
          (onFilter && (
            <button
              type="button"
              onClick={onFilter}
              className="flex items-center gap-2 rounded-md border border-line bg-background px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-selected"
            >
              {filterLabel} <ListFilter size={13} />
            </button>
          ))
        }
      />
      <div className="p-4">
        <DataTable {...tableProps} />
      </div>
    </Card>
  );
}
