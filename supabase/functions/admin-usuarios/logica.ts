// Regras puras da gestão de usuários (AD-011): o pedido validado, a senha gerada e as recusas
// que protegem o próprio admin. O index.ts só fala com o Auth e com `profiles`.

import { z } from "npm:zod@3.25.76";

export const PAPEIS = ["admin", "diretoria", "mentor"] as const;

const id = z.string().uuid();
const email = z.string().trim().toLowerCase().email();
const nome = z.string().trim().min(1).max(120);
const papel = z.enum(PAPEIS);
// Vazia ou ausente: a função gera uma. Digitada: no mínimo 8, o mínimo do Auth é 6.
const senha = z.string().min(8).max(72).optional();

export const PEDIDO = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("listar") }),
  z.object({ acao: z.literal("criar"), email, nome, papel, senha }),
  z.object({ acao: z.literal("editar"), id, email, nome, papel }),
  z.object({ acao: z.literal("senha"), id, senha }),
  z.object({ acao: z.literal("excluir"), id }),
]);
export type Pedido = z.infer<typeof PEDIDO>;

// Sem 0/O, 1/l/I: a senha é ditada ou copiada à mão.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function gerarSenha(tamanho = 14, aleatorio: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // Rejeição acima do maior múltiplo do alfabeto: sem viés de módulo.
  const teto = 256 - (256 % ALFABETO.length);
  let saida = "";
  while (saida.length < tamanho) {
    for (const b of aleatorio(tamanho)) {
      if (b < teto && saida.length < tamanho) saida += ALFABETO[b % ALFABETO.length];
    }
  }
  return saida;
}

// O admin não se tranca para fora: não se exclui nem tira o próprio papel de admin.
export function recusaContraSiMesmo(pedido: Pedido, quem: string): string | null {
  if (pedido.acao === "excluir" && pedido.id === quem) return "Você não pode excluir o próprio usuário.";
  if (pedido.acao === "editar" && pedido.id === quem && pedido.papel !== "admin") return "Você não pode tirar o próprio papel de administrador.";
  return null;
}
