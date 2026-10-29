// Constantes de domínio do index.html (:561–671, :807–809), que o mapeamento §2.2 chama de
// contrato. A trilha 1:1 é a mesma `TRILHA` do sync-google-calendar: as duas pontas precisam
// concordar, senão o sync inventa uma etapa que a tela não sabe desenhar. Os mentores não moram
// aqui: vêm do cadastro (`Dataset.mentores`, AD-013).

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

export const ETAPA_ORD: Readonly<Partial<Record<string, number>>> = Object.fromEntries([
  ...ETAPAS.map((etapa, i) => [etapa, i + 1]),
  ...ETAPAS_GRUPO.map((etapa, i) => [etapa, 90 + i]),
]);

// Etapa fora das duas listas (registro antigo) não tem ordem: quem grava e quem ordena usa 99,
// como o `ETAPA_ORD[etapa]||99` de hoje.
export const ordemDaEtapa = (etapa: string): number => ETAPA_ORD[etapa] ?? 99;

// O mesmo domínio do CHECK de `sessoes.status` e da `promover_sessoes_vencidas()`.
export const S_STATUS: readonly string[] = ["Não iniciada", "Agendada", "Aguardando confirmação", "Concluída", "Bloqueada"];

// Gamificação: a faixa vem do faturamento acumulado real, da maior para a menor.
export const NIVEIS: readonly { nome: string; min: number }[] = [
  { nome: "Diamante", min: 100000 },
  { nome: "Platina", min: 50000 },
  { nome: "Ouro", min: 20000 },
  { nome: "Prata", min: 10000 },
  { nome: "Bronze", min: 1 },
  { nome: "Iniciante", min: 0 },
];

// A cobrança dos formulários de NPS vale daqui pra frente: sessões anteriores não entram. A
// sessão só cobra a pesquisa PRAZO_RESPOSTA_DIAS depois de realizada. Os dois são os argumentos
// da rpc `experiencia_adesao` (R20, AD-002).
export const INICIO_COBRANCA_NPS = "2026-10-13";
export const PRAZO_RESPOSTA_DIAS = 2;

// ponytail: meta fixa de 70%; virar configuração se a gestão quiser ajustar sem deploy.
export const META_ADESAO_EXP = 0.7;
export const LINK_PESQUISA_EXP =
  "https://docs.google.com/forms/d/e/1FAIpQLSeZ5JLebJ2RdsDWDiBcPSzysWu4XqLKuQuyHppPxIYESsljWw/viewform";
