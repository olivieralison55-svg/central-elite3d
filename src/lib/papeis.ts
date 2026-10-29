// Papéis e capacidades (index.html:662–670). Isto é interface, não segurança: quem recusa
// é o RLS, onde `diretoria` não tem policy de escrita em lugar nenhum (mapeamento §5).

export const PAPEIS = ["admin", "diretoria", "mentor"] as const;
export type Papel = (typeof PAPEIS)[number];

export type Capacidade =
  | "verFinanceiro"
  | "verIa"
  | "criarMentorado"
  | "editarMentorado"
  | "editarFinanceiro"
  | "criarSessao"
  | "excluir"
  | "escreverSessao"
  | "escreverRotas"
  | "escreverNotas"
  | "gerirUsuarios"
  | "enviarFaturamento" // o mentor envia o próprio mês
  | "conferirFaturamento"; // o admin confere e fecha

export const CAPACIDADES: Record<Papel, readonly Capacidade[]> = {
  admin: [
    "verFinanceiro",
    "criarMentorado",
    "editarMentorado",
    "editarFinanceiro",
    "escreverSessao",
    "criarSessao",
    "escreverRotas",
    "escreverNotas",
    "excluir",
    "verIa",
    "gerirUsuarios",
    "conferirFaturamento",
  ],
  diretoria: ["verFinanceiro", "verIa"],
  // verIa sem verFinanceiro = recorte do mentor na Análise IA (analise_ia_mentor).
  mentor: ["escreverSessao", "escreverRotas", "escreverNotas", "verIa", "enviarFaturamento"],
};

export const PAPEL_LABEL: Record<Papel, string> = { admin: "Administrador", diretoria: "Diretoria", mentor: "Mentor" };

// `profiles.role` vem do banco: nulo ou texto qualquer (AUTH-07).
export function ehPapel(valor: unknown): valor is Papel {
  return PAPEIS.some((papel) => papel === valor);
}

// Papel fora da lista não tem capacidade nenhuma. A guarda vem antes do índice:
// `CAPACIDADES["constructor"]` acharia o Object do protótipo.
export function pode(papel: string | null, cap: Capacidade): boolean {
  return ehPapel(papel) && CAPACIDADES[papel].includes(cap);
}

export interface ItemMenu {
  caminho: string;
  rotulo: string;
}

// A ordem do menu de hoje (index.html:489–498). Itens com `requer` somem sem a capacidade (NAV-06).
const MENU: ReadonlyArray<ItemMenu & { requer?: Capacidade }> = [
  { caminho: "/dash", rotulo: "Dashboard" },
  { caminho: "/acompanhamento", rotulo: "Acompanhamento" },
  { caminho: "/mentorados", rotulo: "Mentorados" },
  { caminho: "/sessoes", rotulo: "Sessões" },
  { caminho: "/rotas", rotulo: "Rotas" },
  { caminho: "/mentores", rotulo: "Mentores", requer: "verFinanceiro" },
  { caminho: "/analise", rotulo: "STLSeller", requer: "verFinanceiro" },
  { caminho: "/nps", rotulo: "NPS", requer: "verFinanceiro" },
  { caminho: "/ia", rotulo: "Análise IA", requer: "verIa" },
  { caminho: "/financeiro", rotulo: "Financeiro", requer: "verFinanceiro" },
  // Todos os papéis: o mentor vê o próprio mês (o RLS recorta), a diretoria só lê.
  { caminho: "/faturamento", rotulo: "Faturamento" },
  { caminho: "/usuarios", rotulo: "Usuários", requer: "gerirUsuarios" },
];

export function itensDoMenu(papel: Papel): ItemMenu[] {
  return MENU.filter((item) => !item.requer || pode(papel, item.requer));
}
