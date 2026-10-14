import type { Resultado } from "./data/esquemas";
import type { ResultadoEscrita } from "./data/escritas";

// Uma regra só para todo botão que grava (design, componente 5). Nenhum handler do index.html
// confere capacidade, sessão, trava ou linhas (mapeamento §4.2): aqui toda escrita passa por isso.

export interface Escrita {
  pode: boolean; // a capacidade da escrita no papel da sessão
  ocupado: { current: boolean }; // a trava do botão que disparou
  usuarioId: string; // o usuário da tela
  usuarioDaSessao(): Promise<string | null>; // o usuário do supabase-js agora
  escrever(): Promise<ResultadoEscrita>;
  avisar(mensagem: string, tipo: "sucesso" | "erro"): void;
  recarregar(): Promise<void>;
  sucesso?: string; // sem ele, sucesso não tem toast, como W18 e W19 hoje
  // O passo da tela depois de gravar e recarregar, com o resultado: abrir a ficha criada (W14).
  depois?(gravado: Extract<ResultadoEscrita, { ok: true }>): void;
}

// Devolve true só quando a escrita gravou; o modal só fecha com true.
export async function executarEscrita(o: Escrita): Promise<boolean> {
  // WRITE-08: sem a capacidade, a porta nem é chamada.
  if (!o.pode) {
    console.error("[central-elite3d] escrita sem capacidade");
    return false;
  }
  // WRITE-04: a trava é tomada antes do primeiro await, e o segundo clique do mesmo tick não passa.
  if (o.ocupado.current) return false;
  o.ocupado.current = true;
  try {
    // SEC-06: sem sessão, a escrita iria como anon e voltaria vazia; com a de outra pessoa (login
    // em outra aba), gravaria com o JWT dela. Nada sai, e a escrita se descarta.
    if ((await o.usuarioDaSessao()) !== o.usuarioId) {
      console.error("[central-elite3d] escrita descartada: a sessão mudou");
      return false;
    }
    const r = await o.escrever();
    if (r.ok) {
      // WRITE-06 e WRITE-07: gravou, e um passo seguinte falhou.
      if (r.aviso) o.avisar(r.aviso, "erro");
      else if (o.sucesso) o.avisar(o.sucesso, "sucesso");
      await o.recarregar();
      o.depois?.(r);
      return true;
    }
    // WRITE-05: o formulário fica aberto com o que foi digitado.
    if ("erro" in r) {
      o.avisar(r.erro, "erro");
      return false;
    }
    // WRITE-02: nunca sucesso, e a tela recarrega para mostrar o que o banco tem.
    o.avisar("zeroLinhas" in r ? "Nada foi gravado: sem permissão ou registro não encontrado." : `${r.linhas} de ${r.esperadas} gravadas`, "erro");
    await o.recarregar();
    return false;
  } finally {
    o.ocupado.current = false;
  }
}

// WRITE-06: o W11 e depois o W11b. A falha da adoção não desfaz o cadastro salvo: vira aviso.
export async function comAdocao(salvar: () => Promise<ResultadoEscrita>, adotar: () => Promise<Resultado<null>>): Promise<ResultadoEscrita> {
  const salvo = await salvar();
  if (!salvo.ok) return salvo;
  const adocao = await adotar();
  return adocao.ok ? salvo : { ...salvo, aviso: `Cadastro salvo, mas as cobranças da Lia não foram puxadas: ${adocao.erro}` };
}
