import { NextResponse, type NextRequest } from "next/server";

// NAV-03: o Next decodifica o parâmetro dinâmico antes da página e responde 400 quando a
// codificação é inválida (`/mentorado/%E0%A4%A`). O middleware roda antes do casamento de
// rota, com o caminho cru (`resolve-routes.js:308–316`), e manda esse endereço para o
// Dashboard. Só olha o caminho: não toca o banco.
export function middleware(req: NextRequest): NextResponse {
  try {
    decodeURIComponent(req.nextUrl.pathname);
  } catch (erro) {
    if (!(erro instanceof URIError)) throw erro;
    return NextResponse.redirect(new URL("/dash", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/mentorado/:path*"] };
