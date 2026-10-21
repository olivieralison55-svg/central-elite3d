// Link vindo do banco (os `link_*` da sessão e do mentorado, o `link` do STLSeller) só vira
// `href` se começa com http: ou https:, como o `linkOr` de hoje (index.html:965–969). Qualquer
// outro valor aparece como texto: o React 19 bloqueia `javascript:`, mas deixa `data:` passar
// (SEC-05, THREAT-08).
export const linkSeguro = (url: string | null | undefined): string | null => (url && /^https?:/i.test(url) ? url : null);

// O Canal WhatsApp guarda o número do mentorado, e o Contatar abre a conversa pelo wa.me (AD-012).
// Com "+", o número já traz o DDI; sem ele, é do Brasil: DDD e número, com ou sem o 55 ou o 0 da
// frente. Link http(s) gravado ali continua valendo; qualquer outro texto não vira `href`.
// ponytail: número de fora sem "+" não é reconhecido (fica o selo); libphonenumber se isso aparecer.
export function linkWhatsapp(valor: string | null | undefined): string | null {
  const link = linkSeguro(valor);
  if (link) return link;
  const texto = valor?.trim() ?? "";
  if (!/^\+?[\d\s().-]+$/.test(texto)) return null;
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "");
  if (texto.startsWith("+")) return digitos.length >= 8 && digitos.length <= 15 ? `https://wa.me/${digitos}` : null;
  if (digitos.length === 10 || digitos.length === 11) return `https://wa.me/55${digitos}`;
  return /^55\d{10,11}$/.test(digitos) ? `https://wa.me/${digitos}` : null;
}
