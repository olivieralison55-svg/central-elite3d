"use client";

import { type Ui, useUi } from "@/components/shell/contexto";
import SortHeader from "@/components/ui/sort-header";
import { alternarOrdem, type Ordem } from "@/lib/ordem";

// A ordenação de uma tabela pelo estado de tela (`sortState`, index.html:1198–1230): a ordem que
// a pessoa escolheu, ou null antes do primeiro clique, quando vale a padrão da tabela, sem seta.
export const ordemEscolhida = (ui: Ui, tabela: string): Ordem | null => {
  const escolhida = ui.sortState[tabela];
  return escolhida ? { campo: escolhida.coluna, direcao: escolhida.direcao } : null;
};

// O cabeçalho clicável de uma coluna: alterna pela T37 e grava a ordem da tabela.
export function CabecalhoOrdenavel({ tabela, campo, rotulo }: { tabela: string; campo: string; rotulo: string }) {
  const { ui, mudar } = useUi();
  const ordem = ordemEscolhida(ui, tabela);
  return (
    <SortHeader
      label={rotulo}
      direction={ordem?.campo === campo ? ordem.direcao : null}
      onToggle={() => {
        const nova = alternarOrdem(ordem, campo);
        mudar({ sortState: { ...ui.sortState, [tabela]: { coluna: nova.campo, direcao: nova.direcao } } });
      }}
    />
  );
}
