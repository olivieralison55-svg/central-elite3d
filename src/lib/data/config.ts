import { z } from "zod";

// Os valores de produção do index.html (:530–531). A chave publicável é pública por desenho.
const URL_PRODUCAO = "https://matgynpiscyoshnjzolo.supabase.co";
const CHAVE_PRODUCAO = "sb_publishable_S7cckKfundDsqo-s_qL2-A_lgPkY9Yl";

// Acesso literal ao nome: é a forma que o Next troca pelo valor no bundle do cliente.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? URL_PRODUCAO;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? CHAVE_PRODUCAO;

const payloadJwt = z.object({ role: z.string() });

// O `role` do payload, ou null se a chave não tem forma de JWT.
function papelDoJwt(chave: string): string | null {
  const partes = chave.split(".");
  if (partes.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    const lido = payloadJwt.safeParse(payload);
    return lido.success ? lido.data.role : null;
  } catch (erro) {
    // Payload que não é base64 nem JSON não é JWT: a chave cai na recusa de validarConfig.
    if (erro instanceof SyntaxError || (erro instanceof DOMException && erro.name === "InvalidCharacterError")) return null;
    throw erro;
  }
}

// STACK-06: lista de permissão. Devolve o erro, com o nome da variável, ou null.
// Não cita nenhum texto de chave secreta: se for parar no bundle do cliente, a
// varredura do build (G2.3) não acha a própria guarda (THREAT-02).
export function validarConfig({ url, chave }: { url: string; chave: string }): string | null {
  if (url !== URL_PRODUCAO) return `NEXT_PUBLIC_SUPABASE_URL precisa ser ${URL_PRODUCAO}`;
  if (chave.startsWith("sb_publishable_") || papelDoJwt(chave) === "anon") return null;
  return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY precisa começar com sb_publishable_ ou ser um JWT com role anon";
}
