"use client";

import { Check } from "lucide-react";

export interface Swatch {
  hex: string;
  label: string;
  /**
   * O que esta amostra SIGNIFICA, quando isso não é a própria cor — o papel de
   * uma paleta, por exemplo. Ausente, a cor continua sendo a identidade, que é
   * o comportamento de todo uso anterior a este campo.
   *
   * Existe porque duas amostras podem resolver para a MESMA cor num tema pouco
   * contrastado, e aí a chave e a comparação por cor colidiriam: as duas
   * apareceriam selecionadas e uma delas seria inalcançável.
   */
  value?: string;
}

/**
 * O `hex` que significa "esta amostra não é uma cor" — o automático, o
 * herdado, o não-definido. Genérico de propósito: o seletor não sabe o que a
 * ausência quer dizer no domínio de quem o usa, só que ela não pode ser
 * pintada.
 */
const NO_COLOR = "transparent";

/** A identidade de uma amostra: o valor quando ele existe, a cor quando não. */
export function swatchKey(swatch: Swatch): string {
  return swatch.value ?? swatch.hex;
}

/**
 * Está selecionada? Compara por valor quando a amostra tem um, e por cor
 * (sem diferenciar maiúscula) quando não — `#FFF` e `#fff` são a mesma cor, e
 * o mesmo papel nunca aparece em duas grafias.
 */
export function isSwatchSelected(swatch: Swatch, value: string | null): boolean {
  if (value == null) return false;
  if (swatch.value !== undefined) return swatch.value === value;
  return swatch.hex.toLowerCase() === value.toLowerCase();
}

/**
 * A cor do "check", escolhida por LUMINÂNCIA medida da amostra.
 *
 * Era um literal quase-preto, e ele sumia em cima de toda amostra escura —
 * exatamente as que mais precisam do sinal, já que o anel de seleção sozinho
 * é sutil num chip de 28 px. 0,18 é o ponto onde preto e branco empatam em
 * contraste sobre a mesma superfície: abaixo dele o branco ganha, acima o
 * preto. Não é um valor de gosto, sai de resolver `(L+0,05)² = 1,05 × 0,05`.
 */
export function checkColorFor(hex: string): string {
  const parsed = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!parsed) return "currentColor";
  const int = parseInt(parsed[1], 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * channel((int >> 16) & 255) +
    0.7152 * channel((int >> 8) & 255) +
    0.0722 * channel(int & 255);
  return luminance > 0.18 ? "#1c1c1f" : "#ffffff";
}

/**
 * Row of colour swatches — a closed set, not a colour wheel.
 *
 * Deliberate: the palette handed in comes from measured design tokens, and a
 * free picker would let someone save a colour that fails contrast or simply
 * looks foreign to the rest of the interface. Radio semantics so the group is
 * reachable by keyboard and announced as one control.
 */
export default function ColorSwatchPicker({
  swatches,
  value,
  onChange,
  name,
  disabled = false,
  className = "",
}: {
  swatches: readonly Swatch[];
  value: string | null;
  /** Recebe o `value` da amostra quando ela tem um, e a cor quando não. */
  onChange: (value: string) => void;
  /** Radio group name — must be unique per form. */
  name: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {swatches.map((swatch) => {
        const selected = isSwatchSelected(swatch, value);
        const noColor = swatch.hex === NO_COLOR;
        return (
          <button
            key={swatchKey(swatch)}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            aria-label={swatch.label}
            title={swatch.label}
            disabled={disabled}
            onClick={() => onChange(swatchKey(swatch))}
            style={noColor ? undefined : { backgroundColor: swatch.hex }}
            className={`relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md transition duration-quick ease-out-quart disabled:pointer-events-none disabled:opacity-60 ${
              // A amostra SEM cor não pode ser pintada: sobre o painel escuro do
              // inspetor, um fundo transparente lê como um chip preto, e o
              // operador clica nele esperando um fundo preto que nunca vem. O
              // contorno tracejado mais a barra diagonal são o vocabulário de
              // "nenhum" que o resto da interface já usa.
              noColor ? "border border-dashed border-line-strong text-muted" : ""
            } ${
              selected
                // Ring in the page background, so the halo reads on any swatch
                // colour and in either theme.
                ? "ring-2 ring-ink ring-offset-2 ring-offset-background"
                : "hover:scale-110"
            }`}
          >
            {noColor && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[1px] w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current"
              />
            )}
            {selected && (
              <Check
                size={13}
                strokeWidth={3}
                className="relative"
                style={{ color: checkColorFor(swatch.hex) }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
