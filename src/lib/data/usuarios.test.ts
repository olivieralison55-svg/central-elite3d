import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { criarUsuario, excluirUsuario, listarUsuarios, novaSenha } from "./usuarios";

// Um cliente falso com só o `functions.invoke`: guarda o pedido e devolve a resposta dada.
function falso(resposta: { data: unknown; error: unknown }) {
  const pedidos: Array<{ nome: string; corpo: unknown }> = [];
  const db = {
    functions: {
      invoke: (nome: string, { body }: { body: unknown }) => {
        pedidos.push({ nome, corpo: body });
        return Promise.resolve(resposta);
      },
    },
  };
  return { db: db as unknown as SupabaseClient, pedidos };
}

const ANA = { id: "u1", email: "ana@x.com", nome: "Ana", papel: "mentor", ultimo_acesso: null, criado_em: "2026-10-01T10:00:00Z" };

describe("porta da gestão de usuários (AD-011)", () => {
  it("lista pela admin-usuarios e valida a resposta", async () => {
    const { db, pedidos } = falso({ data: { ok: true, usuarios: [ANA] }, error: null });
    expect(await listarUsuarios(db)).toEqual({ ok: true, dados: [ANA] });
    expect(pedidos).toEqual([{ nome: "admin-usuarios", corpo: { acao: "listar" } }]);
    const torto = falso({ data: { ok: true, usuarios: [{ id: 1 }] }, error: null });
    expect(await listarUsuarios(torto.db)).toEqual({ ok: false, erro: "admin-usuarios: schema mismatch" });
  });

  it("criar e nova senha devolvem a senha gerada; o pedido leva o tipo de conta", async () => {
    const { db, pedidos } = falso({ data: { ok: true, id: "u2", senha: "Abc23456789xyz" }, error: null });
    expect(await criarUsuario({ nome: "Bia", email: "bia@x.com", papel: "diretoria" }, db)).toEqual({ ok: true, linhas: 1, id: "u2", senha: "Abc23456789xyz" });
    expect(pedidos[0].corpo).toEqual({ acao: "criar", nome: "Bia", email: "bia@x.com", papel: "diretoria" });
    expect(await novaSenha("u2", db)).toMatchObject({ ok: true, senha: "Abc23456789xyz" });
  });

  it("erro da função chega com a mensagem do corpo; sem corpo legível, a do supabase-js", async () => {
    const comCorpo = falso({ data: null, error: { message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ ok: false, erro: "só administrador gerencia usuários" }), { status: 403 }) } });
    expect(await excluirUsuario("u1", comCorpo.db)).toEqual({ ok: false, erro: "só administrador gerencia usuários" });
    const semCorpo = falso({ data: null, error: { message: "Failed to send a request to the Edge Function" } });
    expect(await excluirUsuario("u1", semCorpo.db)).toEqual({ ok: false, erro: "Failed to send a request to the Edge Function" });
  });

  it("resposta 2xx sem o id gravado não é sucesso", async () => {
    const { db } = falso({ data: { ok: true }, error: null });
    expect(await excluirUsuario("u1", db)).toEqual({ ok: false, zeroLinhas: true });
  });
});
