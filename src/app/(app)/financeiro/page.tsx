import Financeiro from "@/components/modules/financeiro/financeiro";

// /financeiro: contratos, entradas, parcelas e cobranças da Lia (NAV-01). Quem não vê financeiro
// é mandado para /dash pela casca (NAV-04).
export default function PaginaFinanceiro() {
  return <Financeiro />;
}
