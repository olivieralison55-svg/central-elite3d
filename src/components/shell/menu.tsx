"use client";

import {
  ChartColumn,
  Clock,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu as IconeMenu,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Sparkles,
  Star,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import Drawer from "@/components/ui/drawer";
import NavItem from "@/components/ui/nav-item";
import ThemeToggle from "@/components/ui/theme-toggle";
import { lerCaminho } from "@/lib/endereco";
import { itensDoMenu, PAPEL_LABEL, type Papel } from "@/lib/papeis";

import { useNavegar, useSessao, useUi } from "./contexto";

// A sidebar, o menu mobile e o bloco do usuário (index.html:482–529), só com primitivos do
// design system e sem CSS próprio (UI-08). Os itens saem do papel a cada render: quem entra
// depois de outro vê só o menu dele (NAV-06, AUTH-08).

// Os ícones de hoje, um por tela.
const ICONES: Record<string, LucideIcon> = {
  "/dash": LayoutDashboard,
  "/acompanhamento": TriangleAlert,
  "/mentorados": Users,
  "/sessoes": Clock,
  "/rotas": Route,
  "/mentores": UserCog,
  "/analise": ChartColumn,
  "/nps": Star,
  "/ia": Sparkles,
  "/financeiro": Wallet,
};

// Na ficha, o item aceso é a lista de onde ela foi aberta (index.html:1384–1386).
export function itemAceso(caminho: string, voltarPara: string): string {
  const endereco = lerCaminho(caminho.split("/"));
  return endereco.tela === "mentorado" ? voltarPara : `/${endereco.tela}`;
}

// A logo da Elite 3D (480×106) com o nome do app embaixo: a preta no tema claro, a branca no `.dark`.
// `<img>` simples: são dois PNG estáticos de `public/`, sem otimização que o `next/image` traga.
// Largura e altura fixas na proporção do PNG (480×106) e `items-start`: o `flex-col` estica o filho
// na largura toda, e a logo saía larga e achatada.
const TITULO = (
  <span className="flex flex-col items-start gap-1">
    <img src="/logo-elite3d-preta.png" alt="Elite 3D" width={86} height={19} className="h-[19px] w-[86px] dark:hidden" />
    <img src="/logo-elite3d-branca.png" alt="Elite 3D" width={86} height={19} className="hidden h-[19px] w-[86px] dark:block" />
    <span className="text-[11px] font-medium text-muted">Central de Controle</span>
  </span>
);

// Nome, papel, tema e Sair: no pé da sidebar e no do menu mobile.
export function Usuario({ nome, papel, sair, recolhido = false }: { nome: string; papel: Papel; sair(): Promise<void>; recolhido?: boolean }) {
  // Recolhida, a sidebar mostra o avatar, com nome e papel no title, e o Sair em ícone.
  if (recolhido) {
    return (
      <div className="flex flex-col items-center gap-1 border-t border-line p-3" title={`${nome} · ${PAPEL_LABEL[papel]}`}>
        <Avatar name={nome} />
        <button type="button" onClick={() => void sair()} title="Sair" aria-label="Sair" className="rounded-6 p-1.5 text-muted transition-colors duration-quick hover:bg-selected hover:text-ink">
          <LogOut size={15} />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 border-t border-line p-3">
      <Avatar name={nome} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{nome}</span>
        <span className="block truncate text-[11px] text-muted">{PAPEL_LABEL[papel]}</span>
      </span>
      <ThemeToggle />
      <Button variant="ghost" size="sm" onClick={() => void sair()}>
        Sair
      </Button>
    </div>
  );
}

// A sidebar recolhe para 68px, como a da product-ops (AppShell.tsx): só o selo 3D, os ícones e o
// avatar. O estado mora na Moldura, que também desloca o conteúdo.
export default function Menu({ recolhido = false, alternar = () => {} }: { recolhido?: boolean; alternar?: () => void }) {
  const { usuario, perfil, papel, sair } = useSessao();
  const { ui } = useUi();
  const { caminho } = useNavegar();
  const [aberto, setAberto] = useState(false);
  // O menu mobile fecha quando o caminho muda: clique num item, voltar ou avançar.
  useEffect(() => setAberto(false), [caminho]);

  const aceso = itemAceso(caminho, ui.voltarPara);
  const itens = (fechados: boolean) => (
    <nav aria-label="Telas" className="flex flex-col gap-0.5">
      {itensDoMenu(papel).map((item) => (
        <NavItem key={item.caminho} href={item.caminho} icon={ICONES[item.caminho]} label={item.rotulo} active={item.caminho === aceso} collapsed={fechados} />
      ))}
    </nav>
  );
  const nome = perfil.nome || perfil.email || usuario.email;
  const usuarioDoMenu = <Usuario nome={nome} papel={papel} sair={sair} />;
  const botao = "rounded-6 p-1.5 text-muted transition-colors duration-quick hover:bg-selected hover:text-ink";

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-sub-bg transition-all md:flex ${recolhido ? "w-[68px]" : "w-[240px]"}`}>
        {recolhido ? (
          <div className="flex flex-col items-center gap-1 px-3 pb-1 pt-4">
            <img src="/logo-elite3d-icone-preta.png" alt="Elite 3D" width={28} height={28} className="h-7 w-7 dark:hidden" />
            <img src="/logo-elite3d-icone-branca.png" alt="Elite 3D" width={28} height={28} className="hidden h-7 w-7 dark:block" />
            <button type="button" onClick={alternar} className={botao} title="Expandir" aria-label="Expandir o menu">
              <PanelLeftOpen size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2 px-4 pb-2 pt-4">
            <div className="flex-1">{TITULO}</div>
            <button type="button" onClick={alternar} className={botao} title="Recolher" aria-label="Recolher o menu">
              <PanelLeftClose size={16} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2.5 pt-2">{itens(recolhido)}</div>
        {recolhido ? <Usuario nome={nome} papel={papel} sair={sair} recolhido /> : usuarioDoMenu}
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-background px-3 md:hidden">
        <Button variant="ghost" size="icon" aria-label="Abrir o menu" onClick={() => setAberto(true)}>
          <IconeMenu size={18} />
        </Button>
        {TITULO}
      </header>
      <Drawer open={aberto} onClose={() => setAberto(false)} header={TITULO} footer={usuarioDoMenu} widthClassName="max-w-[280px]">
        <div className="p-2.5">{itens(false)}</div>
      </Drawer>
    </>
  );
}
