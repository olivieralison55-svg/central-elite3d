// deno test supabase/functions/admin-usuarios/logica_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { gerarSenha, PEDIDO, recusaContraSiMesmo } from "./logica.ts";

const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

Deno.test("pedido: normaliza e-mail, recusa papel fora da lista e senha curta", () => {
  const ok = PEDIDO.parse({ acao: "criar", email: " Ana@X.com ", nome: " Ana ", papel: "mentor" });
  assertEquals(ok, { acao: "criar", email: "ana@x.com", nome: "Ana", papel: "mentor" });
  assert(!PEDIDO.safeParse({ acao: "criar", email: "ana@x.com", nome: "Ana", papel: "cs" }).success);
  assert(!PEDIDO.safeParse({ acao: "senha", id: OUTRO, senha: "1234567" }).success);
  assert(!PEDIDO.safeParse({ acao: "excluir", id: "nao-e-uuid" }).success);
  assert(!PEDIDO.safeParse({ acao: "apagar_tudo" }).success);
});

Deno.test("senha gerada: tamanho certo, só do alfabeto, sem viés mesmo com bytes no teto", () => {
  const s = gerarSenha();
  assertEquals(s.length, 14);
  assert(/^[A-HJ-NP-Za-km-np-z2-9]+$/.test(s));
  // 255 está acima do teto e é descartado; 0 vira a primeira letra.
  let chamada = 0;
  const bytes = (n: number) => new Uint8Array(n).fill(chamada++ === 0 ? 255 : 0);
  assertEquals(gerarSenha(4, bytes), "AAAA");
});

Deno.test("o admin não se exclui nem se rebaixa; com os outros, pode", () => {
  assert(recusaContraSiMesmo({ acao: "excluir", id: EU }, EU));
  assert(recusaContraSiMesmo({ acao: "editar", id: EU, email: "a@x.com", nome: "A", papel: "mentor" }, EU));
  assertEquals(recusaContraSiMesmo({ acao: "editar", id: EU, email: "a@x.com", nome: "A", papel: "admin" }, EU), null);
  assertEquals(recusaContraSiMesmo({ acao: "excluir", id: OUTRO }, EU), null);
});
