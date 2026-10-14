"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";

import { usuarioDaSessao } from "@/lib/data/auth";
import type { ResultadoEscrita } from "@/lib/data/escritas";
import { executarEscrita } from "@/lib/escrita";
import type { Capacidade } from "@/lib/papeis";

import { useDados, useSessao } from "./contexto";

// O executor de escrita ligado ao papel e ao usuário da sessão, ao toast e à recarga da tela.
// `ocupado` vai para o `loading` do Button que dispara a escrita: desabilitado e com Spinner do
// clique até o fim dela (WRITE-03).
export function useEscrita<A extends unknown[]>(
  cap: Capacidade,
  escrever: (...args: A) => Promise<ResultadoEscrita>,
  sucesso?: string,
): { executar(...args: A): Promise<boolean>; ocupado: boolean } {
  const { usuario, pode } = useSessao();
  const { recarregar } = useDados();
  const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const executar = async (...args: A) => {
    const feito = executarEscrita({
      pode: pode(cap),
      ocupado: trava,
      usuarioId: usuario.id,
      usuarioDaSessao,
      escrever: () => escrever(...args),
      avisar: (mensagem, tipo) => (tipo === "erro" ? toast.error(mensagem) : toast.success(mensagem)),
      recarregar,
      sucesso,
    });
    // O executor toma a trava antes do primeiro await: ela já diz se há escrita em curso, desta
    // chamada ou de um clique anterior que ainda não terminou.
    setOcupado(trava.current);
    try {
      return await feito;
    } finally {
      setOcupado(trava.current);
    }
  };
  return { executar, ocupado };
}
