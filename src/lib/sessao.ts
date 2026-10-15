import type { EventoSessao, Perfil, Resultado } from "./data/auth";
import { ehPapel, type Papel } from "./papeis";

// A sessão em fases, porte de `boot` e `afterLogin` (index.html:672–708). Hoje o logout deixa
// o papel e o menu de quem saiu; aqui cada evento leva a uma fase, e só `pronto` carrega dado.

export interface Usuario {
  id: string;
  email: string;
}

export type EstadoSessao =
  | { fase: "verificando" }
  | { fase: "anonimo" }
  | { fase: "lendoPerfil"; usuario: Usuario }
  // AUTH-06: a sessão sem perfil é encerrada; quem faz o signOut é o provider.
  | { fase: "semPerfil"; usuario: Usuario; encerrarSessao: true }
  | { fase: "papelInvalido"; usuario: Usuario; perfil: Perfil }
  | { fase: "pronto"; usuario: Usuario; perfil: Perfil; papel: Papel };

// O resultado do R01, lido num efeito fora do callback do onAuthStateChange.
export interface PerfilLido {
  tipo: "PERFIL_LIDO";
  usuarioId: string;
  resultado: Resultado<Perfil>;
}

export const SESSAO_INICIAL: EstadoSessao = { fase: "verificando" };

export function reduzirSessao(estado: EstadoSessao, evento: EventoSessao | PerfilLido): EstadoSessao {
  if (evento.tipo === "PERFIL_LIDO") return comPerfil(estado, evento);
  // EDGE-02: renovação que falha sem volta chega como SIGNED_OUT.
  if (evento.tipo === "SIGNED_OUT" || !evento.usuario) return { fase: "anonimo" };
  // O mesmo usuário (TOKEN_REFRESHED, USER_UPDATED, o SIGNED_IN que o auth-js repete ao voltar à aba) não muda a fase.
  if ("usuario" in estado && estado.usuario.id === evento.usuario.id) return estado;
  return { fase: "lendoPerfil", usuario: evento.usuario };
}

function comPerfil(estado: EstadoSessao, { usuarioId, resultado }: PerfilLido): EstadoSessao {
  // SEC-06: a resposta atrasada de outro usuário não vale para a sessão atual.
  if (estado.fase !== "lendoPerfil" || estado.usuario.id !== usuarioId) return estado;
  if (!resultado.ok) return { fase: "semPerfil", usuario: estado.usuario, encerrarSessao: true };
  const perfil = resultado.dados;
  if (!ehPapel(perfil.role)) return { fase: "papelInvalido", usuario: estado.usuario, perfil };
  return { fase: "pronto", usuario: estado.usuario, perfil, papel: perfil.role };
}

type Pendencia = () => Promise<void> | void;
const pendencias = new Set<Pendencia>();

// O editor de notas registra aqui a gravação que ainda não saiu. Devolve o cancelamento.
export function registrarPendencia(fn: Pendencia): () => void {
  pendencias.add(fn);
  return () => {
    pendencias.delete(fn);
  };
}

// Roda cada pendência uma vez e esvazia a lista. O sair() espera isto antes do signOut, para a
// nota sair com o JWT de quem a escreveu (SEC-06).
export async function descarregarPendencias(): Promise<void> {
  const agora = [...pendencias];
  pendencias.clear();
  await Promise.all(agora.map((fn) => fn()));
}
