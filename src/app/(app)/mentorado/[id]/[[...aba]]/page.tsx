import Ficha from "@/components/modules/ficha/ficha";

// /mentorado/<id> e /mentorado/<id>/<aba>: a ficha (NAV-01). O optional catch-all casa zero ou mais
// segmentos, e a ficha usa só o primeiro, como o lerEndereco de hoje (index.html:1364–1366). O id
// chega decodificado: o que não decodifica o middleware já mandou para /dash (NAV-03).
export default async function PaginaFicha({ params }: { params: Promise<{ id: string; aba?: string[] }> }) {
  const { id, aba } = await params;
  return <Ficha id={id} aba={aba?.[0]} />;
}
