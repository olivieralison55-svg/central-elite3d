// admin-usuarios — a tela Usuários do admin (AD-011).
//
// Listar, criar, editar (nome, e-mail, papel), trocar senha e excluir usuário pede a Auth Admin
// API, que só aceita a service_role key — e o app não tem essa chave (AD-007). Quem chama é o
// browser, com o JWT da sessão; a função confere que o dono dele é `admin` em `profiles` antes
// de qualquer coisa. `profiles` é atualizado aqui também: o trigger `handle_new_user()` cria
// todo usuário como mentor, e `role` não é editável pelo cliente.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { gerarSenha, PEDIDO, type Pedido, recusaContraSiMesmo } from "./logica.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Chamada com Bearer, sem cookie: liberar a origem não abre nada que o JWT não abra.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Db = SupabaseClient;

async function listar(db: Db) {
  // ponytail: uma página de 1.000 usuários; a mentoria tem dezenas. Paginar se passar disso.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const { data: perfis, error: e2 } = await db.from("profiles").select("id, nome, role");
  if (e2) throw new Error(`profiles: ${e2.message}`);
  const porId = new Map((perfis ?? []).map((p) => [p.id as string, p]));
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    nome: (porId.get(u.id)?.nome as string | null) ?? null,
    papel: (porId.get(u.id)?.role as string | null) ?? null,
    ultimo_acesso: u.last_sign_in_at ?? null,
    criado_em: u.created_at,
  }));
}

async function gravarPerfil(db: Db, id: string, campos: { nome: string; email: string; papel: string }) {
  const { error } = await db.from("profiles").upsert({ id, nome: campos.nome, email: campos.email, role: campos.papel }).select("id").single();
  if (error) throw new Error(`profiles: ${error.message}`);
}

async function executar(db: Db, pedido: Pedido): Promise<Record<string, unknown>> {
  switch (pedido.acao) {
    case "listar":
      return { usuarios: await listar(db) };
    case "criar": {
      const senha = pedido.senha ?? gerarSenha();
      const { data, error } = await db.auth.admin.createUser({ email: pedido.email, password: senha, email_confirm: true });
      if (error) throw new Error(error.message);
      await gravarPerfil(db, data.user.id, pedido);
      return { id: data.user.id, senha };
    }
    case "editar": {
      const { error } = await db.auth.admin.updateUserById(pedido.id, { email: pedido.email, email_confirm: true });
      if (error) throw new Error(error.message);
      await gravarPerfil(db, pedido.id, pedido);
      return { id: pedido.id };
    }
    case "senha": {
      const senha = pedido.senha ?? gerarSenha();
      const { error } = await db.auth.admin.updateUserById(pedido.id, { password: senha });
      if (error) throw new Error(error.message);
      return { id: pedido.id, senha };
    }
    case "excluir": {
      const { error } = await db.auth.admin.deleteUser(pedido.id);
      if (error) throw new Error(error.message);
      return { id: pedido.id };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return resposta({ ok: false, erro: "método não permitido" }, 405);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: quem, error: eUser } = await db.auth.getUser(token);
  if (eUser || !quem.user) return resposta({ ok: false, erro: "sessão inválida" }, 401);
  const { data: perfil, error: ePerfil } = await db.from("profiles").select("role").eq("id", quem.user.id).maybeSingle();
  if (ePerfil) return resposta({ ok: false, erro: `profiles: ${ePerfil.message}` }, 500);
  if (perfil?.role !== "admin") return resposta({ ok: false, erro: "só administrador gerencia usuários" }, 403);

  const lido = PEDIDO.safeParse(await req.json().catch(() => null));
  if (!lido.success) return resposta({ ok: false, erro: `pedido inválido: ${lido.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}` }, 400);
  const recusa = recusaContraSiMesmo(lido.data, quem.user.id);
  if (recusa) return resposta({ ok: false, erro: recusa }, 400);

  try {
    return resposta({ ok: true, ...(await executar(db, lido.data)) });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[admin-usuarios]", lido.data.acao, erro);
    return resposta({ ok: false, erro }, 400);
  }
});
