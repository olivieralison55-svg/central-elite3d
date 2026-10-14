"use client";

import { usePathname, useRouter } from "next/navigation";
import { type Context, createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import type { Perfil } from "@/lib/data/auth";
import type { Capacidade, Papel } from "@/lib/papeis";
import type { Usuario } from "@/lib/sessao";

// Sessão, dado, estado de tela e navegação, cada um num contexto: as telas leem daqui, e o teste
// troca o valor pelo mesmo contexto (src/test/render.tsx).

export type Relacao =
  | "mentorados"
  | "mentorados_basic"
  | "parcelas"
  | "lia_cobrancas"
  | "sessoes"
  | "rotas"
  | "marcos_definicao"
  | "mentorado_marcos"
  | "faturamento_mensal"
  | "canais"
  | "mentorado_canais"
  | "sessoes_orfas"
  | "stlseller_mentorados"
  | "stlseller_pedidos_marketplace"
  | "stlseller_produtos_vendidos"
  | "nps_respostas"
  | "experiencia_respostas"
  | "nps_analises"
  | "experiencia_adesao"
  | "analise_ia_mentor"
  | "transcricoes";

export type ErrosDeCarga = Partial<Record<Relacao, string>>;

// ponytail: linha sem tipo próprio, só leitura e `unknown` em cada coluna; cada campo do Dataset
// ganha o z.infer do schema da sua relação quando os schemas Zod existirem.
type Linha = Readonly<Record<string, unknown>>;

export interface Dataset {
  mentorados: Linha[]; // R02 ou R03, conforme o papel
  parcelas: Linha[];
  cobrancas: Linha[];
  sessoes: Linha[];
  rotas: Linha[];
  marcos: Linha[];
  mentoradoMarcos: Linha[];
  faturamento: Linha[];
  canais: Linha[];
  mentoradoCanais: Linha[];
  orfas: Linha[];
  stlseller: Linha[];
  stlPedidos: Linha[];
  stlProdutos: Linha[];
  nps: Linha[];
  experiencia: Linha[];
  analise: Linha | null; // R19 ou R21
  adesao: Linha | null; // R20
  transcricoes: Linha[];
}

export interface ValorSessao {
  usuario: Usuario;
  perfil: Perfil;
  papel: Papel;
  pode(cap: Capacidade): boolean;
  sair(): Promise<void>;
}

export interface ValorDados {
  dados: Dataset;
  erros: ErrosDeCarga;
  recarregando: boolean;
  recarregar(): Promise<void>;
}

// Os globais que hoje sobrevivem à troca de tela (index.html:625–647, 1199, 2203, 2320).
export interface Ui {
  filtro: {
    q: string;
    mentor: string;
    statusFin: string;
    tipoSessao: string;
    qDash: string;
    qSessoes: string;
    qFin: string;
    qRotas: string;
    qAnalise: string;
    qNps: string;
    npsPeriodo: "semana" | "mes";
    npsMentor: string;
    mentorSel: string;
    npsPagPeriodo: number;
    npsPagResp: number;
    npsAba: string;
    iaAba: string;
    iaSel: string;
  };
  mesMatriz: string | null; // null = o padrão de OPS-04
  foco: { ids: string[]; titulo: string; dica: string } | null;
  rotaAtual: string | null;
  rotaMentoradoId: string | null;
  marcoAberto: string | null;
  voltarPara: string;
  sortState: Record<string, { coluna: string; direcao: "asc" | "desc" }>;
}

export interface ValorUi {
  ui: Ui;
  mudar(parcial: Partial<Ui>): void;
}

export interface Navegador {
  caminho: string;
  ir(destino: string): void;
  substituir(destino: string): void;
}

export const UI_INICIAL: Ui = {
  filtro: {
    q: "",
    mentor: "",
    statusFin: "",
    tipoSessao: "",
    qDash: "",
    qSessoes: "",
    qFin: "",
    qRotas: "",
    qAnalise: "",
    qNps: "",
    npsPeriodo: "semana",
    npsMentor: "",
    mentorSel: "",
    npsPagPeriodo: 1,
    npsPagResp: 1,
    npsAba: "sessoes",
    iaAba: "geral",
    iaSel: "",
  },
  mesMatriz: null,
  foco: null,
  rotaAtual: null,
  rotaMentoradoId: null,
  marcoAberto: null,
  // Quem chega por link colado não veio de lista nenhuma: Mentorados é o palpite honesto (index.html:1360).
  voltarPara: "/mentorados",
  sortState: {},
};

export const SessaoContexto = createContext<ValorSessao | null>(null);
export const DadosContexto = createContext<ValorDados | null>(null);
export const UiContexto = createContext<ValorUi | null>(null);
export const NavegarContexto = createContext<Navegador | null>(null);

function usar<T>(contexto: Context<T | null>, nome: string): T {
  const valor = useContext(contexto);
  if (valor === null) throw new Error(`[central-elite3d] ${nome} fora do provider`);
  return valor;
}

export const useSessao = () => usar(SessaoContexto, "useSessao");
export const useDados = () => usar(DadosContexto, "useDados");
export const useUi = () => usar(UiContexto, "useUi");
export const useNavegar = () => usar(NavegarContexto, "useNavegar");

export function UiProvider({ children }: { children: ReactNode }) {
  const [ui, setUi] = useState(UI_INICIAL);
  const mudar = useCallback((parcial: Partial<Ui>) => setUi((atual) => ({ ...atual, ...parcial })), []);
  const valor = useMemo(() => ({ ui, mudar }), [ui, mudar]);
  return <UiContexto.Provider value={valor}>{children}</UiContexto.Provider>;
}

// A única porta para o roteador do Next. SEC-01: destino que resolve para outra origem vira
// `/dash` e não chega ao roteador, porque o `router.replace` faria `location.replace` nele.
export function NavegarProvider({ children }: { children: ReactNode }) {
  const roteador = useRouter();
  const caminho = usePathname();
  const navegar = useMemo<Navegador>(() => {
    const seguro = (destino: string) => {
      const origem = window.location.origin;
      return new URL(destino, origem).origin === origem ? destino : "/dash";
    };
    return {
      caminho,
      ir: (destino) => roteador.push(seguro(destino)),
      substituir: (destino) => roteador.replace(seguro(destino)),
    };
  }, [roteador, caminho]);
  return <NavegarContexto.Provider value={navegar}>{children}</NavegarContexto.Provider>;
}
