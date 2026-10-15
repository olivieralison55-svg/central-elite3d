"use client";

import { type KeyboardEvent, useState } from "react";

import Button from "@/components/ui/button";
import Popover from "@/components/ui/popover";
import SearchInput from "@/components/ui/search-input";
import type { Mentorado } from "@/lib/data/esquemas";
import { casaBusca } from "@/lib/busca";
import NomeMentorado from "@/components/modules/comum/nome-mentorado";

// A escolha de mentorado da tela Rotas (buscaComboRotas, index.html:1299–1337; AD-008): Popover,
// SearchInput e uma lista. Digitar só recorta a lista: o mentorado troca no clique ou no Enter.

export const mentoradosQueCasam = (ativos: readonly Mentorado[], termo: string): Mentorado[] => ativos.filter((m) => casaBusca(termo, m.nome));

// Quem a tela mostra: o escolhido, se ainda é ativo; sem escolha, ou se ele deixou de ser, o
// primeiro ativo (index.html:2335). Sem ativo, ninguém.
export const mentoradoMostrado = (ativos: readonly Mentorado[], escolhidoId: string | null): string | null =>
  ativos.find((m) => m.id === escolhidoId)?.id ?? ativos[0]?.id ?? null;

const LISTA = "rotas-lista-mentorados";

interface Props {
  ativos: readonly Mentorado[];
  escolhidoId: string | null;
  termo: string;
  onTermo(termo: string): void;
  onEscolher(id: string): void;
}

export function PainelDeEscolha({ ativos, escolhidoId, termo, onTermo, onEscolher, fechar }: Props & { fechar(): void }) {
  const [indice, setIndice] = useState(0);
  const lista = mentoradosQueCasam(ativos, termo);
  const ativo = Math.min(indice, lista.length - 1);
  const escolher = (m: Mentorado) => {
    onEscolher(m.id);
    setIndice(0);
    fechar();
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice(Math.min(ativo + 1, lista.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice(Math.max(ativo - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (lista[ativo]) escolher(lista[ativo]);
    }
  };
  return (
    <div className="space-y-2">
      <SearchInput
        autoFocus
        autoComplete="off"
        role="combobox"
        aria-expanded
        aria-controls={LISTA}
        aria-label="Buscar mentorado por nome"
        placeholder="Buscar mentorado por nome…"
        value={termo}
        onChange={(e) => {
          onTermo(e.target.value);
          setIndice(0);
        }}
        onKeyDown={tecla}
      />
      {lista.length ? (
        <ul id={LISTA} role="listbox" aria-label="Mentorados ativos" className="max-h-64 overflow-y-auto">
          {lista.map((m, i) => (
            <li key={m.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === ativo}
                onClick={() => escolher(m)}
                className={`flex w-full items-center justify-between gap-2 rounded-6 px-2.5 py-2 text-left text-sm text-ink transition-colors duration-quick ${i === ativo ? "bg-selected" : "hover:bg-selected"}`}
              >
                <span><NomeMentorado nome={m.nome} /></span>
                {m.id === escolhidoId && <small className="text-muted">aberto agora</small>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2.5 py-2 text-sm text-muted">Nenhum mentorado ativo com esse nome.</p>
      )}
    </div>
  );
}

export default function EscolherMentorado(props: Props) {
  return (
    <Popover
      label="Escolher mentorado"
      // A raiz do Popover é isolada e sem z-index: sem o z, o Select de canal (irmão `relative`) pinta por cima do painel.
      className="z-20"
      panelClassName="w-80"
      trigger={() => (
        <Button variant="outline" size="sm">
          Trocar mentorado
        </Button>
      )}
    >
      {(fechar) => <PainelDeEscolha {...props} fechar={fechar} />}
    </Popover>
  );
}
