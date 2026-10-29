import Faturamento from "@/components/modules/faturamento/faturamento";

// /faturamento: a validação mensal do faturamento dos mentores. Aberta a todos os papéis: o mentor
// vê o próprio mês (o RLS recorta), o admin confere e fecha, a diretoria acompanha.
export default function PaginaFaturamento() {
  return <Faturamento />;
}
