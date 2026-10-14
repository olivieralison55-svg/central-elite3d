import { type AuthChangeEvent, type AuthError, isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";

import { cliente } from "./cliente";
import { ESQUEMAS, type Perfil, type Resultado } from "./esquemas";

export type { Perfil, Resultado } from "./esquemas";

// Login, saída, eventos da sessão e o perfil (R01), porte de index.html:672–720. Toda função
// recebe o cliente por último, com `cliente()` de padrão: os testes passam um falso.

export interface EventoSessao {
  tipo: AuthChangeEvent;
  usuario: { id: string; email: string } | null;
}

// AUTH-04 e AUTH-05. Hoje todo erro vira "senha errada" (index.html:715), e quem está sem rede
// troca a senha à toa. Só a credencial recusada fala em senha.
export function classificarErroLogin(erro: AuthError): string {
  if (erro.code === "invalid_credentials" || erro.status === 400) return "E-mail ou senha inválidos.";
  if (isAuthRetryableFetchError(erro)) return "Sem conexão com o servidor. Tente de novo.";
  if (erro.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  return `Não foi possível entrar: ${erro.message}.`;
}

// AUTH-02. Devolve a mensagem do erro, ou null quando entrou: quem segue é o onAuthStateChange.
export async function entrar(email: string, senha: string, db: SupabaseClient = cliente()): Promise<string | null> {
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  return error ? classificarErroLogin(error) : null;
}

export async function sair(db: SupabaseClient = cliente()): Promise<void> {
  const { error } = await db.auth.signOut();
  if (error) console.error("[central-elite3d] signOut", error);
}

// O callback só repassa o evento. Chamar o cliente dentro dele é o deadlock conhecido do
// auth-js; quem lê o perfil é um efeito separado. Devolve o cancelamento da assinatura.
export function ouvirSessao(cb: (evento: EventoSessao) => void, db: SupabaseClient = cliente()): () => void {
  const { data } = db.auth.onAuthStateChange((tipo, sessao) => {
    cb({ tipo, usuario: sessao ? { id: sessao.user.id, email: sessao.user.email ?? "" } : null });
  });
  return () => data.subscription.unsubscribe();
}

// SEC-06: o id do usuário da sessão atual, conferido antes de ler e de escrever, ou null.
export async function usuarioDaSessao(db: SupabaseClient = cliente()): Promise<string | null> {
  const { data, error } = await db.auth.getSession();
  if (error) console.error("[central-elite3d] getSession", error);
  return data.session?.user.id ?? null;
}

// R01 (index.html:686). Sem linha, com erro ou fora do schema: falha, e a sessão encerra (AUTH-06).
export async function lerPerfil(userId: string, db: SupabaseClient = cliente()): Promise<Resultado<Perfil>> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).single();
  if (error) {
    console.error("[central-elite3d] profiles", error);
    return { ok: false, erro: error.message };
  }
  const lido = ESQUEMAS.profiles.safeParse(data);
  if (!lido.success) {
    console.error("[central-elite3d] profiles: schema mismatch", lido.error.issues);
    return { ok: false, erro: "profiles: schema mismatch" };
  }
  return { ok: true, dados: lido.data };
}
