"use client";

import type { ComponentPropsWithoutRef } from "react";

import Input from "@/components/ui/input";
import { mascaraBRL } from "@/lib/moeda";

type Props = Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "onChange" | "onBlur" | "type" | "inputMode"> & {
  value: string;
  onChange(texto: string): void;
};

// Dinheiro digitado à brasileira (index.html:2441; AD-008): o Input do DS com teclado decimal, a
// máscara a cada tecla e as duas casas ao sair do campo. Quem usa guarda o texto e lê o valor com
// lerBRL: "2000.50" colado vira "R$ 2.000,50", que vale 2000,5. O NumberInput do DS apaga o ponto
// e leria 200050 (OPS-20).
export default function CampoMoeda({ value, onChange, ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(mascaraBRL(e.target.value))}
      onBlur={(e) => onChange(mascaraBRL(e.target.value, true))}
    />
  );
}
