// Link vindo do banco (os `link_*` da sessão e do mentorado, o `link` do STLSeller) só vira
// `href` se começa com http: ou https:, como o `linkOr` de hoje (index.html:965–969). Qualquer
// outro valor aparece como texto: o React 19 bloqueia `javascript:`, mas deixa `data:` passar
// (SEC-05, THREAT-08).
export const linkSeguro = (url: string | null | undefined): string | null => (url && /^https?:/i.test(url) ? url : null);
