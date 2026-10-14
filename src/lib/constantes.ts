// Constantes de domínio do index.html (:585–600). A trilha 1:1 é a mesma `TRILHA` do
// sync-google-calendar: as duas precisam concordar, senão o sync inventa uma etapa que a tela
// não sabe desenhar.

export const ETAPAS: readonly string[] = [
  "Diagnóstico de Negócio",
  "Plano de Ação",
  "Checkup 1",
  "Checkup 2",
  "Checkup 3",
  "Checkup 4",
  "Checkup 5",
  "Checkup 6",
  "Checkup 7",
  "Checkup 8",
  "Checkup 9",
  "Checkup 10",
];

// Sessões em grupo: encontros coletivos, fora da trilha de 12 sessões 1:1. Ordem 90+ para nunca
// colidir com a numeração das etapas individuais.
export const ETAPAS_GRUPO: readonly string[] = ["Plantão de Dúvida Semanal", "Sessão de Implementação Mensal"];

// Etapa fora das duas listas (registro antigo) não tem ordem: quem grava usa 99.
export const ETAPA_ORD: Readonly<Partial<Record<string, number>>> = Object.fromEntries([
  ...ETAPAS.map((etapa, i) => [etapa, i + 1]),
  ...ETAPAS_GRUPO.map((etapa, i) => [etapa, 90 + i]),
]);
