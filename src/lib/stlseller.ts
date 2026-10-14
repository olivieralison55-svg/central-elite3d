import type { StlMentorado } from "./data/esquemas";
import { normalizaEmail } from "./mentorados";

// STLSeller do index.html (:3110–3123). Muita gente usa um endereço na mentoria e outro na loja: o
// e-mail da ficha casa primeiro com o e-mail do formulário e, se nenhum casar, com o da conta
// STLFLIX. Sem e-mail na ficha não há com o que casar.
export function stlsellerDe(registros: readonly StlMentorado[], email: string | null | undefined): StlMentorado | null {
  const alvo = normalizaEmail(email);
  if (!alvo) return null;
  return registros.find((r) => r.email === alvo) ?? registros.find((r) => normalizaEmail(r.email_stlflix) === alvo) ?? null;
}
