import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { tailwindColors } from "@/design-system/tokens";

import SegmentedProgress, { type SegmentedProgressTone } from "./segmented-progress";

// As utilidades de cor que o design system define: `bg-<token>`, e `bg-<grupo>-<passo>` nos
// aninhados (o `DEFAULT` é o grupo sozinho).
const TOKENS = new Set(
  Object.entries(tailwindColors).flatMap(([nome, valor]) =>
    typeof valor === "string" ? [nome] : Object.keys(valor).map((passo) => (passo === "DEFAULT" ? nome : `${nome}-${passo}`)),
  ),
);

// Cada segmento do markup: a dica e as classes.
const segmentos = (html: string) =>
  [...html.matchAll(/<span\b([^>]*)><\/span>/g)].map(([, atributos]) => ({
    title: /\btitle="([^"]*)"/.exec(atributos)?.[1],
    classes: /\bclass="([^"]*)"/.exec(atributos)?.[1].split(/\s+/) ?? [],
  }));

describe("SegmentedProgress (UI-06, OPS-05)", () => {
  it("desenha um segmento por item, na ordem, cada um com o rótulo dele no title", () => {
    const html = renderToStaticMarkup(
      <SegmentedProgress
        label="Trilha"
        segments={[
          { tone: "success", label: "Diagnóstico de Negócio: Concluída" },
          { tone: "primary", label: "Plano de Ação: Agendada" },
          { tone: "neutral", label: "Checkup 1: Não iniciada" },
        ]}
      />,
    );
    expect(segmentos(html).map((s) => s.title)).toEqual([
      "Diagnóstico de Negócio: Concluída",
      "Plano de Ação: Agendada",
      "Checkup 1: Não iniciada",
    ]);

    const doze = Array.from({ length: 12 }, (_, i) => ({ tone: "neutral" as const, label: `Etapa ${i + 1}` }));
    expect(segmentos(renderToStaticMarkup(<SegmentedProgress label="Trilha" segments={doze} />))).toHaveLength(12);
  });

  it("o conjunto é anunciado uma vez, como imagem com o aria-label", () => {
    const html = renderToStaticMarkup(
      <SegmentedProgress label="3 de 12 sessões concluídas" segments={[{ tone: "success", label: "Checkup 1: Concluída" }]} />,
    );
    expect(html).toMatch(/^<div\b[^>]*\brole="img"/);
    expect(html).toMatch(/^<div\b[^>]*\baria-label="3 de 12 sessões concluídas"/);
  });

  it("cada tom pinta com um token próprio do design system, sem style nem cor crua", () => {
    const tons: SegmentedProgressTone[] = ["success", "primary", "warning", "danger", "neutral"];
    const html = renderToStaticMarkup(<SegmentedProgress label="Tons" segments={tons.map((tone) => ({ tone, label: tone }))} />);
    const fundos = segmentos(html).map((s) => s.classes.filter((c) => c.startsWith("bg-")));
    expect(fundos.map((f) => f.length)).toEqual([1, 1, 1, 1, 1]);

    const cores = fundos.map(([classe]) => classe.slice("bg-".length));
    expect(cores.filter((cor) => !TOKENS.has(cor))).toEqual([]);
    expect(new Set(cores).size).toBe(5);
    // success, primary, warning e danger usam a própria família; neutral, nenhuma das coloridas.
    expect(cores.slice(0, 4).map((cor, i) => cor.startsWith(tons[i]))).toEqual([true, true, true, true]);
    expect(["primary", "success", "warning", "danger", "info", "purple", "tag"].filter((f) => cores[4].startsWith(f))).toEqual([]);
    expect(html).not.toMatch(/style=|#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
