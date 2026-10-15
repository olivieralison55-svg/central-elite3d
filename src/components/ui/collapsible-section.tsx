"use client";

import { ChevronRight } from "lucide-react";

/**
 * Seção que abre e fecha, para o segundo nível de revelação de um inspetor.
 *
 * Irmã da `Section` do `card.tsx`, não substituta: aquela é um agrupador
 * SEMPRE aberto, com fundo e cartão próprio; esta é uma linha de lista que
 * esconde o conteúdo até alguém pedir.
 *
 * O critério que ela existe para cumprir é do NN/g (Nielsen, *Progressive
 * Disclosure*): mostrar de saída o que se usa sempre, adiar o resto para UM
 * segundo nível — e deixar óbvio o caminho até ele. Daí o `hint`: o rótulo
 * sozinho ("Imagens") diz o assunto, e a pista à direita ("sem imagem", "3
 * apontamentos") diz o que há lá dentro ANTES de abrir, que é o "information
 * scent" do critério 2. Ícone sem texto é o erro nº 5 do *Top 10
 * Application-Design Mistakes*, então o título é sempre palavra.
 *
 * Quem controla o aberto/fechado é o pai, de propósito: "uma seção por vez"
 * é uma regra do painel inteiro, não de cada linha, e um estado interno aqui
 * tornaria impossível.
 */
export default function CollapsibleSection<Id extends string>({
  id,
  title,
  icon,
  hint,
  open,
  onToggle,
  children,
}: {
  id: Id;
  title: string;
  /** Opcional e sempre AO LADO do título, nunca no lugar dele. */
  icon?: React.ReactNode;
  /** Pista do conteúdo, mostrada só com a seção fechada. */
  hint?: string;
  open: boolean;
  onToggle: (id: Id) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-quick hover:bg-sub-bg"
      >
        <ChevronRight
          size={13}
          className={`shrink-0 text-muted transition-transform duration-quick ${open ? "rotate-90" : ""}`}
        />
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
          {icon}
          {title}
        </span>
        {hint && !open && <span className="ml-auto truncate text-[11px] text-muted">{hint}</span>}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
