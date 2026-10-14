"use client";

import { type ReactElement, type ReactNode, useCallback, useEffect, useReducer } from "react";

import Skeleton from "@/components/ui/skeleton";
import { type EventoSessao, lerPerfil, ouvirSessao, type Perfil, type Resultado, sair as sairDoAuth } from "@/lib/data/auth";
import { pode } from "@/lib/papeis";
import { descarregarPendencias, type EstadoSessao, type PerfilLido, reduzirSessao, SESSAO_INICIAL } from "@/lib/sessao";

import { SessaoContexto, type ValorSessao } from "./contexto";
import TelaLogin from "./tela-login";
import TelaPapel from "./tela-papel";

// O provider da sessão: assina o Supabase Auth, lê o perfil e decide a tela de cada fase.
// O que os efeitos fazem mora em funções exportadas, porque o vitest roda no `node`, onde
// efeito não roda: o teste chama as funções direto.

export interface PortaSessao {
  ouvir(cb: (evento: EventoSessao) => void): () => void;
  lerPerfil(usuarioId: string): Promise<Resultado<Perfil>>;
  sair(): Promise<void>;
}

const PORTA: PortaSessao = { ouvir: ouvirSessao, lerPerfil, sair: sairDoAuth };

// AUTH-06: sem perfil, o provider encerra a sessão, e o SIGNED_OUT que vem depois levaria ao
// login. `perfilAusente` guarda o motivo: a tela "Perfil não encontrado" fica até o Sair.
export interface Estado {
  sessao: EstadoSessao;
  perfilAusente: boolean;
}

export type Acao = EventoSessao | PerfilLido | { tipo: "SAIR" };

export const ESTADO_INICIAL: Estado = { sessao: SESSAO_INICIAL, perfilAusente: false };

export function reduzir(atual: Estado, acao: Acao): Estado {
  if (acao.tipo === "SAIR") return atual.perfilAusente ? { ...atual, perfilAusente: false } : atual;
  const sessao = reduzirSessao(atual.sessao, acao);
  // O motivo sobrevive só à saída que ele mesmo pediu; uma sessão nova o descarta.
  const perfilAusente = sessao.fase === "semPerfil" || (atual.perfilAusente && sessao.fase === "anonimo");
  return sessao === atual.sessao && perfilAusente === atual.perfilAusente ? atual : { sessao, perfilAusente };
}

// O callback do onAuthStateChange só guarda o evento. Chamar o cliente dentro dele é o
// deadlock conhecido do auth-js (GoTrueClient.js:136–146). Devolve o cancelamento.
export function assinar(despachar: (acao: Acao) => void, porta: PortaSessao = PORTA): () => void {
  return porta.ouvir(despachar);
}

// O efeito separado, a cada fase nova: lê o perfil (R01) de quem está em `lendoPerfil` e
// encerra a sessão sem perfil (AUTH-06). Nenhuma outra fase chama o cliente.
export async function reagir(sessao: EstadoSessao, despachar: (acao: Acao) => void, porta: PortaSessao = PORTA): Promise<void> {
  if (sessao.fase === "semPerfil") return porta.sair();
  if (sessao.fase !== "lendoPerfil") return;
  const usuarioId = sessao.usuario.id;
  despachar({ tipo: "PERFIL_LIDO", usuarioId, resultado: await porta.lerPerfil(usuarioId) });
}

// SEC-06: a nota pendente sai antes do signOut, com o JWT de quem a escreveu.
export async function sair(despachar: (acao: Acao) => void, porta: PortaSessao = PORTA): Promise<void> {
  despachar({ tipo: "SAIR" });
  await descarregarPendencias();
  await porta.sair();
}

// O Skeleton de tela inteira: a sessão sendo verificada, o perfil sendo lido, e tudo o que
// o servidor renderiza (nada de sessão, dado ou relógio sai do servidor).
export function Carregando() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando" className="flex flex-col gap-4 p-4 md:p-8">
      <Skeleton className="h-[34px] w-[220px]" />
      <Skeleton className="h-[120px]" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-[200px]" />
    </div>
  );
}

// A tela de cada fase. Só `pronto` desenha os filhos: nenhuma leitura de dado antes dele.
export function PortaoSessao({ estado, sair, children }: { estado: Estado; sair(): Promise<void>; children: ReactNode }): ReactElement {
  const { sessao } = estado;
  if (sessao.fase === "semPerfil" || (sessao.fase === "anonimo" && estado.perfilAusente)) return <TelaPapel motivo="semPerfil" sair={sair} />;
  if (sessao.fase === "anonimo") return <TelaLogin />;
  if (sessao.fase === "papelInvalido") return <TelaPapel motivo="papelInvalido" sair={sair} />;
  if (sessao.fase !== "pronto") return <Carregando />;
  const { usuario, perfil, papel } = sessao;
  const valor: ValorSessao = { usuario, perfil, papel, pode: (cap) => pode(papel, cap), sair };
  // AUTH-08: a key é o usuário. Quem entra depois de outro ganha a árvore montada do zero:
  // dado, filtro e menu de quem saiu não sobram.
  return (
    <SessaoContexto.Provider key={usuario.id} value={valor}>
      {children}
    </SessaoContexto.Provider>
  );
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL);
  useEffect(() => assinar(despachar), []);
  useEffect(() => {
    reagir(estado.sessao, despachar).catch((erro: unknown) => console.error("[central-elite3d] sessão", erro));
  }, [estado.sessao]);
  const sairDaSessao = useCallback(() => sair(despachar), []);
  return (
    <PortaoSessao estado={estado} sair={sairDaSessao}>
      {children}
    </PortaoSessao>
  );
}
