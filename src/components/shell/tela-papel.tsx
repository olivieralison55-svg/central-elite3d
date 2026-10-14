import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";

export type MotivoSemAcesso = "semPerfil" | "papelInvalido";

// AUTH-06 e AUTH-07: sem perfil, ou com papel fora da lista, a pessoa vê o motivo e o Sair, e
// nenhum dado é carregado. Hoje o primeiro é um toast e o segundo trava o roteador no
// Dashboard (index.html:687, 1373).
const TEXTOS: Record<MotivoSemAcesso, { titulo: string; descricao: string }> = {
  semPerfil: { titulo: "Perfil não encontrado", descricao: "Contate o admin." },
  papelInvalido: { titulo: "Papel não reconhecido", descricao: "O seu usuário não tem um papel válido. Contate o admin." },
};

export default function TelaPapel({ motivo, sair }: { motivo: MotivoSemAcesso; sair(): Promise<void> }) {
  const { titulo, descricao } = TEXTOS[motivo];
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <EmptyState className="w-full max-w-[420px]" title={titulo} description={descricao} action={<Button onClick={() => void sair()}>Sair</Button>} />
    </main>
  );
}
