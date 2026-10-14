"use client";

import { useEffect, useState } from "react";

/**
 * `false` no primeiro render do servidor e no primeiro do cliente — nunca
 * `window.matchMedia` durante o render. Ler o `window` na inicialização do
 * estado quebra a hidratação: o HTML do servidor não tem viewport, e o React
 * reclama da divergência antes de qualquer efeito rodar.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
