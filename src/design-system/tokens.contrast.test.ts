import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { chartPalette, neutral, semantic } from "./tokens";

/**
 * Contrast is a CLAIM about the palette (AD-010), so it is measured here rather
 * than trusted. The test reads tokens.css — the file that actually ships — and
 * refuses a value that drops a pair below its floor. Changing a colour without
 * checking the pair is exactly the regression this catches.
 */

const CSS = readFileSync(join(__dirname, "tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing block: ${selector}`);
  const body = CSS.slice(start, CSS.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const light = block(":root");
const dark = { ...light, ...block(".dark") };

function channels(color: string): [number, number, number] {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (!rgba) throw new Error(`unparseable colour: ${color}`);
  const parts = rgba[1].split(",").map((p) => Number(p.trim()));
  return [parts[0], parts[1], parts[2]];
}

/** Flattens a possibly translucent colour onto an opaque background. */
function flatten(color: string, onto: string): [number, number, number] {
  const alpha = Number(color.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1);
  const [r, g, b] = channels(color);
  const [br, bg, bb] = channels(onto);
  return [
    r * alpha + br * (1 - alpha),
    g * alpha + bg * (1 - alpha),
    b * alpha + bb * (1 - alpha),
  ];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: string, bg: string): number {
  const a = luminance(flatten(fg, bg));
  const b = luminance(channels(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const THEMES = [
  ["light", light],
  ["dark", dark],
] as const;

describe.each(THEMES)("%s theme", (_name, t) => {
  const surface = t["--background"];

  it.each([
    ["--ink", 4.5],
    ["--muted", 4.5],
    ["--text-primary", 4.5],
    ["--text-secondary", 4.5],
    ["--text-tertiary", 4.5],
  ])("%s clears AA on --background", (token, floor) => {
    expect(ratio(t[token], surface)).toBeGreaterThanOrEqual(floor);
  });

  it("keeps the four text levels as distinct, ordered steps", () => {
    const levels = (
      ["--text-primary", "--text-secondary", "--text-tertiary", "--text-quaternary"] as const
    ).map((k) => ratio(t[k], surface));
    for (let i = 1; i < levels.length; i += 1) {
      // each level must be a visibly weaker step than the one above it
      expect(levels[i - 1] / levels[i]).toBeGreaterThan(1.15);
    }
  });

  it.each(["success", "danger", "warning", "info", "purple"])(
    "%s reads on both --background and its own soft panel",
    (family) => {
      const text = t[`--${family}`];
      expect(ratio(text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(text, t[`--${family}-soft`])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps recess, canvas and surface as three distinct values", () => {
    // The DIRECTION of the ladder is the designer's call and is not pinned
    // here: the dark theme runs recess → page → surface → hover, the light one
    // was hand-tuned out of that order (AD-010, primeira emenda). What must
    // hold either way is that the three SURFACES stay apart — collapse any two
    // and a card stops reading as a card on the thing behind it.
    const steps = ["--sub-bg", "--canvas", "--background"].map((k) => t[k]);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it("gives hover something to change against", () => {
    // Hover is a state OF the surface, so that is the pair that has to differ.
    // In light it currently sits on the same white as --sub-bg, which is a
    // taste call and not pinned; landing on --background would not be.
    expect(t["--selected"]).not.toBe(t["--background"]);
  });

  it("draws a hairline weaker than the strong one, and neither invisible", () => {
    // The absolute strength is a taste call — it was pulled back by hand after
    // the measured pass. The ORDER is not: line-strong exists to be the louder
    // divider, and a hairline that composites onto its own surface is a bug.
    expect(ratio(t["--line"], surface)).toBeGreaterThan(1.05);
    expect(ratio(t["--line-strong"], surface)).toBeGreaterThan(
      ratio(t["--line"], surface),
    );
  });
});

it("keeps tokens.ts in sync with the CSS that actually ships", () => {
  // The two files are a mirror by hand, and the light ladder gets tuned live in
  // the CSS. Without this the TS copy silently rots into a lie that nothing
  // renders — `tailwindColors` reads the vars, so no pixel ever disagrees.
  expect(neutral.canvas).toBe(light["--canvas"]);
  expect(neutral.background).toBe(light["--background"]);
  expect(neutral.subBg).toBe(light["--sub-bg"]);
  expect(neutral.selected).toBe(light["--selected"]);
  expect(neutral.ink).toBe(light["--ink"]);
  expect(neutral.muted).toBe(light["--muted"]);
  for (const [family, v] of Object.entries(semantic)) {
    expect(v.text, family).toBe(light[`--${family}`]);
    expect(v.soft, family).toBe(light[`--${family}-soft`]);
  }
});

it("keeps every chart series legible on BOTH themes at once", () => {
  // A series colour cannot flip with the theme without changing the identity of
  // the category, so each one has to clear 3:1 (WCAG 1.4.11) on both surfaces.
  for (const color of chartPalette) {
    expect(ratio(color, light["--background"]), color).toBeGreaterThanOrEqual(3);
    expect(ratio(color, dark["--background"]), color).toBeGreaterThanOrEqual(3);
  }
});

it("has no duplicate series colours", () => {
  expect(new Set(chartPalette).size).toBe(chartPalette.length);
});
