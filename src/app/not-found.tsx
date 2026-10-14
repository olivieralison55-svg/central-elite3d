"use client";

import { useEffect } from "react";

import { NavegarProvider, useNavegar } from "@/components/shell/contexto";
import { Carregando } from "@/components/shell/sessao";

// Caminho desconhecido abre o Dashboard (NAV-03), trocando o endereço sem entrada nova no
// histórico.
function ParaODashboard() {
  const { substituir } = useNavegar();
  useEffect(() => substituir("/dash"), [substituir]);
  return <Carregando />;
}

export default function NaoEncontrado() {
  return (
    <NavegarProvider>
      <ParaODashboard />
    </NavegarProvider>
  );
}
