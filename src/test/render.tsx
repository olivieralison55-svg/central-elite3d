import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DadosContexto,
  NavegarContexto,
  type Navegador,
  SessaoContexto,
  UI_INICIAL,
  type Ui,
  UiContexto,
  type ValorSessao,
} from "@/components/shell/contexto";
import type { Dataset } from "@/lib/data/esquemas";
import { PAPEL_LABEL, type Papel, pode } from "@/lib/papeis";

import { datasetDeTeste } from "./fixtures";

// O stub de navegação: anota cada pedido em vez de chamar o roteador do Next.
export interface NavegadorFalso extends Navegador {
  chamadas: Array<["ir" | "substituir", string]>;
}

export function navegadorFalso(caminho = "/dash"): NavegadorFalso {
  const chamadas: NavegadorFalso["chamadas"] = [];
  return {
    caminho,
    chamadas,
    ir: (destino) => chamadas.push(["ir", destino]),
    substituir: (destino) => chamadas.push(["substituir", destino]),
  };
}

export interface OpcoesTela {
  papel: Papel;
  dados?: Dataset;
  ui?: Partial<Ui>;
  navegar?: Navegador;
}

// Uma tela renderizada no servidor, como o vitest `node` permite, com os quatro contextos montados
// a partir de fixtures. Devolve o HTML.
export function renderTela(el: ReactElement, { papel, dados = datasetDeTeste(), ui, navegar = navegadorFalso() }: OpcoesTela): string {
  const usuario = { id: `usuario-${papel}`, email: `${papel}@exemplo.com` };
  const sessao: ValorSessao = {
    usuario,
    perfil: { id: usuario.id, role: papel, nome: PAPEL_LABEL[papel], email: usuario.email },
    papel,
    pode: (cap) => pode(papel, cap),
    sair: () => Promise.resolve(),
  };
  return renderToStaticMarkup(
    <SessaoContexto.Provider value={sessao}>
      <DadosContexto.Provider value={{ dados, erros: {}, recarregando: false, recarregar: () => Promise.resolve() }}>
        <UiContexto.Provider value={{ ui: { ...UI_INICIAL, ...ui }, mudar: () => undefined }}>
          <NavegarContexto.Provider value={navegar}>{el}</NavegarContexto.Provider>
        </UiContexto.Provider>
      </DadosContexto.Provider>
    </SessaoContexto.Provider>,
  );
}
