"use client";

import { type ReactElement, type ReactNode, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import Alert from "@/components/ui/alert";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import type { Relacao } from "@/lib/data/esquemas";
import { type Carga, carregarTudo } from "@/lib/data/leituras";
import type { Papel } from "@/lib/papeis";
import { criarRecarga, type Recarregado } from "@/lib/recarga";

import { DadosContexto, useDados, useSessao } from "./contexto";
import { Carregando } from "./sessao";

// A carga do usuário da sessão: Skeleton até a primeira, erro com "Tentar de novo" e a recarga
// que as escritas pedem. O que os efeitos fazem mora em funções exportadas, porque o vitest roda
// no `node`, onde efeito não roda: o teste chama as funções direto.

export type CargaPronta = Extract<Carga, { ok: true }>;
export type EstadoDados = Recarregado<CargaPronta> & { recarregando: boolean };
type Recarga = ReturnType<typeof criarRecarga<CargaPronta>>;

export interface PortaDados {
  carregar(papel: Papel, usuarioId: string): Promise<Carga>;
  avisar(mensagem: string): void;
}

export const PORTA_DADOS: PortaDados = {
  carregar: (papel, usuarioId) => carregarTudo(papel, usuarioId),
  avisar: (mensagem) => toast.error(mensagem),
};

const ESTADO_INICIAL: EstadoDados = { atual: null, erro: null, recarregando: false };

// Uma carga, a primeira ou uma recarga. Só a última pedida chega ao estado (DATA-09). Falha numa
// recarga mantém o dataset anterior e vai para um toast.
export async function recarregarDados(
  recarga: Recarga,
  carregar: () => Promise<Carga>,
  mudar: (parcial: Partial<EstadoDados>) => void,
  avisar: (mensagem: string) => void,
): Promise<void> {
  mudar({ recarregando: true });
  const lido = await recarga(carregar);
  if (lido === null) return;
  mudar({ ...lido, recarregando: false });
  if (lido.atual !== null && lido.erro !== null) avisar(lido.erro);
}

// NAV-08: antes da primeira carga, Skeleton no lugar da tela, nunca "Ficha não encontrada".
// DATA-06: a primeira carga que falha mostra o erro e "Tentar de novo".
export function PortaoDados({ estado, recarregar, children }: { estado: EstadoDados; recarregar(): Promise<void>; children: ReactNode }): ReactElement {
  const { atual, erro, recarregando } = estado;
  if (atual !== null) {
    return <DadosContexto.Provider value={{ dados: atual.dados, erros: atual.erros, recarregando, recarregar }}>{children}</DadosContexto.Provider>;
  }
  if (erro === null || recarregando) return <Carregando />;
  return (
    <div className="p-4 md:p-8">
      <EmptyState title="Não foi possível carregar os dados" description={erro} action={<Button onClick={() => void recarregar()}>Tentar de novo</Button>} />
    </div>
  );
}

export function DadosProvider({ papel, usuarioId, porta = PORTA_DADOS, children }: { papel: Papel; usuarioId: string; porta?: PortaDados; children: ReactNode }) {
  const [recarga] = useState(() => criarRecarga<CargaPronta>());
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const mudar = useCallback((parcial: Partial<EstadoDados>) => setEstado((anterior) => ({ ...anterior, ...parcial })), []);
  const recarregar = useCallback(
    () =>
      recarregarDados(recarga, () => porta.carregar(papel, usuarioId), mudar, porta.avisar).catch((erro: unknown) =>
        console.error("[central-elite3d] carga", erro),
      ),
    [recarga, porta, papel, usuarioId, mudar],
  );
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  return (
    <PortaoDados estado={estado} recarregar={recarregar}>
      {children}
    </PortaoDados>
  );
}

// AUTH-08: a key é o usuário. Quem entra depois de outro ganha um provider montado do zero, sem o
// dado de quem saiu.
export function DadosDoUsuario({ children }: { children: ReactNode }) {
  const { usuario, papel } = useSessao();
  return (
    <DadosProvider key={usuario.id} papel={papel} usuarioId={usuario.id}>
      {children}
    </DadosProvider>
  );
}

// DATA-07: cada tela declara as relações de que depende (design, componente 6). Essencial com
// falha troca a tela pelo erro; complementar com falha vira um aviso, e o resto renderiza.
export function AvisoRelacoes({
  essenciais = [],
  complementares = [],
  children,
}: {
  essenciais?: Relacao[];
  complementares?: Relacao[];
  children: ReactNode;
}): ReactElement {
  const { erros, recarregar } = useDados();
  const essencial = essenciais.find((rel) => erros[rel] !== undefined);
  if (essencial !== undefined) {
    return (
      <EmptyState
        title="Não foi possível carregar esta tela"
        description={`${essencial}: ${erros[essencial]}`}
        action={<Button onClick={() => void recarregar()}>Tentar de novo</Button>}
      />
    );
  }
  const faltando = complementares.filter((rel) => erros[rel] !== undefined);
  return (
    <>
      {faltando.length > 0 && (
        <Alert variant="warning" title="Parte dos dados não carregou" className="mb-4">
          {faltando.map((rel) => (
            <p key={rel}>{`${rel}: ${erros[rel]}`}</p>
          ))}
        </Alert>
      )}
      {children}
    </>
  );
}
