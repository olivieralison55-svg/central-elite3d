"use client";

import { type ReactNode, useEffect, useState } from "react";

import { lerCaminho, telaPermitida } from "@/lib/endereco";
import type { Papel } from "@/lib/papeis";

import { NavegarProvider, type Ui, UiProvider, useNavegar, useSessao, useUi } from "./contexto";
import { DadosDoUsuario } from "./dados";
import Menu from "./menu";
import { Carregando, SessaoProvider } from "./sessao";

// A troca de caminho, porte de aplicarEndereco (index.html:1370–1388). Roda a cada caminho
// novo, inclusive no voltar e no avançar do navegador, que o roteador do Next entrega como
// caminho (NAV-07).
export function aplicarCaminho(caminho: string, papel: Papel, mudar: (parcial: Partial<Ui>) => void, substituir: (destino: string) => void): void {
  const { tela } = lerCaminho(caminho.split("/"));
  // NAV-04: link colado não abre o que o menu esconde.
  if (!telaPermitida(tela, papel)) return substituir("/dash");
  const parcial: Partial<Ui> = {};
  // NAV-10: o foco é do aviso do Dashboard que trouxe a pessoa a Sessões.
  if (tela !== "sessoes") parcial.foco = null;
  // A ficha volta para a lista de onde foi aberta, e o menu acende essa lista.
  if (tela !== "mentorado") parcial.voltarPara = `/${tela}`;
  mudar(parcial);
}

// A casca de quem está pronto: o menu e a tela. A tela fechada para o papel não renderiza: o
// Skeleton fica até o /dash.
export function Moldura({ children }: { children: ReactNode }) {
  const { papel } = useSessao();
  const { mudar } = useUi();
  const { caminho, substituir } = useNavegar();
  useEffect(() => aplicarCaminho(caminho, papel, mudar, substituir), [caminho, papel, mudar, substituir]);
  const permitida = telaPermitida(lerCaminho(caminho.split("/")).tela, papel);
  const [recolhido, setRecolhido] = useState(false);
  return (
    <div className="min-h-screen bg-canvas">
      <Menu recolhido={recolhido} alternar={() => setRecolhido((r) => !r)} />
      <main className={`px-4 py-6 transition-all md:px-8 md:py-8 ${recolhido ? "md:ml-[68px]" : "md:ml-[240px]"}`}>{permitida ? children : <Carregando />}</main>
    </div>
  );
}

// O layout do grupo (app). O estado de tela e a carga nascem dentro da sessão pronta, com a key
// do usuário (AUTH-08); a Moldura só aparece com a primeira carga (NAV-08). O servidor só
// renderiza o Skeleton da sessão em verificação: nada de sessão, dado ou relógio sai de lá.
export default function Casca({ children }: { children: ReactNode }) {
  return (
    <NavegarProvider>
      <SessaoProvider>
        <UiProvider>
          <DadosDoUsuario>
            <Moldura>{children}</Moldura>
          </DadosDoUsuario>
        </UiProvider>
      </SessaoProvider>
    </NavegarProvider>
  );
}
