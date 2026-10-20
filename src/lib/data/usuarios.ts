import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Papel } from "@/lib/papeis";

import { cliente } from "./cliente";
import type { Resultado } from "./esquemas";
import type { ResultadoEscrita } from "./escritas";

// A tela Usuários fala com a edge function admin-usuarios, a única que o app chama (AD-011): a
// Auth Admin API pede a chave secreta do projeto, que fica no servidor. A função confere o papel de quem chama.

const USUARIO = z.object({
  id: z.string(),
  email: z.string(),
  nome: z.string().nullable(),
  papel: z.string().nullable(),
  ultimo_acesso: z.string().nullable(),
  criado_em: z.string(),
});
export type Usuario = z.infer<typeof USUARIO>;

const ERRO = z.object({ erro: z.string() });
const LISTA = z.object({ ok: z.literal(true), usuarios: z.array(USUARIO) });
const GRAVADO = z.object({ ok: z.literal(true), id: z.string(), senha: z.string().optional() });

export interface CamposUsuario {
  nome: string;
  email: string;
  papel: Papel;
}

// Status fora de 2xx chega como FunctionsHttpError com a Response em `context`: a mensagem da
// função está no corpo dela.
async function chamar(corpo: Record<string, unknown>, db: SupabaseClient): Promise<Resultado<unknown>> {
  const { data, error } = await db.functions.invoke("admin-usuarios", { body: corpo });
  if (!error) return { ok: true, dados: data };
  const contexto: unknown = (error as { context?: unknown }).context;
  const lido = ERRO.safeParse(contexto instanceof Response ? await contexto.json().catch(() => null) : null);
  console.error(`[central-elite3d] admin-usuarios ${String(corpo.acao)}`, error);
  return { ok: false, erro: lido.success ? lido.data.erro : error.message };
}

export async function listarUsuarios(db: SupabaseClient = cliente()): Promise<Resultado<Usuario[]>> {
  const r = await chamar({ acao: "listar" }, db);
  if (!r.ok) return r;
  const lido = LISTA.safeParse(r.dados);
  if (!lido.success) {
    console.error(`[central-elite3d] admin-usuarios: schema mismatch`, lido.error.issues);
    return { ok: false, erro: `admin-usuarios: schema mismatch` };
  }
  return { ok: true, dados: lido.data.usuarios };
}

async function gravar(corpo: Record<string, unknown>, db: SupabaseClient): Promise<ResultadoEscrita> {
  const r = await chamar(corpo, db);
  if (!r.ok) return r;
  const lido = GRAVADO.safeParse(r.dados);
  if (!lido.success) return { ok: false, zeroLinhas: true };
  return { ok: true, linhas: 1, id: lido.data.id, senha: lido.data.senha };
}

// Criar e trocar senha devolvem a senha gerada, mostrada uma vez para o admin repassar.
export const criarUsuario = (campos: CamposUsuario, db: SupabaseClient = cliente()) => gravar({ acao: "criar", ...campos }, db);
export const editarUsuario = (id: string, campos: CamposUsuario, db: SupabaseClient = cliente()) => gravar({ acao: "editar", id, ...campos }, db);
export const novaSenha = (id: string, db: SupabaseClient = cliente()) => gravar({ acao: "senha", id }, db);
export const excluirUsuario = (id: string, db: SupabaseClient = cliente()) => gravar({ acao: "excluir", id }, db);
