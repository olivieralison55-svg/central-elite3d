import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DateRangeCalendar from "./date-range-calendar";
import DropdownMenu from "./dropdown-menu";
import FilterDropdown from "./filter-dropdown";
import Popover from "./popover";

/**
 * The four anchored panels isolate their root so the panel's own z-index cannot leak past the
 * AppShell header. Isolation alone left the root at z-auto, so a positioned sibling rendered
 * after it (a Select wrapper, a card) painted over the open panel. While open the root must
 * carry z-[15]; closed, it must not, or every trigger on the page would float over its neighbours.
 *
 * Static markup runs no effect and no click, so the open state is forced: the first useState of
 * each component is `open`, and `aberto.valor` replaces its initial value.
 */
const aberto = vi.hoisted(() => ({ valor: false }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: <T,>(inicial: T | (() => T)) =>
      react.useState(inicial === false && aberto.valor ? (true as T) : inicial),
  };
});

const casos = {
  Popover: () => createElement(Popover, { label: "Opções", trigger: () => "abrir", children: "painel" }),
  DropdownMenu: () => createElement(DropdownMenu, { label: "Menu", items: [], onChange: () => {} }),
  FilterDropdown: () =>
    createElement(FilterDropdown, { label: "Filtro", options: [], selected: new Set<string>(), onChange: () => {} }),
  DateRangeCalendar: () => createElement(DateRangeCalendar, { days: ["2026-10-01"], onApply: () => {}, onClear: () => {} }),
};

// The root class: the first element of the markup.
const classeDaRaiz = (html: string) => /^<div[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("floating panels stack above later siblings only while open", () => {
  afterEach(() => {
    aberto.valor = false;
  });

  for (const [nome, render] of Object.entries(casos)) {
    it(`${nome}: open root takes z-[15], closed root takes none`, () => {
      expect(classeDaRaiz(renderToStaticMarkup(render())).split(/\s+/)).not.toContain("z-[15]");
      aberto.valor = true;
      const raiz = classeDaRaiz(renderToStaticMarkup(render())).split(/\s+/);
      expect(raiz).toContain("isolate");
      expect(raiz).toContain("z-[15]");
    });
  }
});
