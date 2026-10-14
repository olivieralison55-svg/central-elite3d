import Button from "@/components/ui/button";

// O selo da busca (index.html:1259–1272): diz o termo e quantos casam, sobre o que os outros
// filtros da tela deixaram. Sem termo, nada.
export function SeloBusca({ termo, n, total, unidade, limpar }: { termo: string; n: number; total: number; unidade: string; limpar(): void }) {
  if (!termo.trim()) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span>{`Busca: “${termo.trim()}” · ${n} de ${total} ${unidade}`}</span>
      <Button variant="link" size="sm" onClick={limpar}>
        limpar busca
      </Button>
    </div>
  );
}
