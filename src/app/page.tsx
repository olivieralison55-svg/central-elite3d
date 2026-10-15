"use client";

import { useEffect } from "react";

import { NavegarProvider, useNavegar } from "@/components/shell/contexto";
import { Carregando } from "@/components/shell/sessao";
import { caminhoDoHash } from "@/lib/endereco";

// "/": a ponte do link antigo `#/…` (NAV-02, CUT-02). O hash só existe no cliente, então a
// troca roda no mount, sem entrada nova no histórico. Sem hash, ou com hash fora das formas
// conhecidas, abre o Dashboard (NAV-03).
function Ponte() {
  const { substituir } = useNavegar();
  useEffect(() => substituir(caminhoDoHash(window.location.hash) ?? "/dash"), [substituir]);
  return <Carregando />;
}

export default function Inicio() {
  return (
    <NavegarProvider>
      <Ponte />
    </NavegarProvider>
  );
}
