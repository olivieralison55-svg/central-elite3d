// DATA-09: as escritas de hoje chamam o `loadAll` sem `await` (index.html:3496, :3547), e uma
// resposta velha que chega depois sobrescreve a nova. Aqui cada pedido ganha um número, e só o
// último pedido entrega o resultado.

// O que a última recarga pedida deixa: a carga em vigor e o erro dela. Falha mantém a carga
// anterior, que é null antes da primeira que deu certo.
export interface Recarregado<T> {
  atual: T | null;
  erro: string | null;
}

// Devolve `null` à recarga que foi superada por um pedido mais novo: a resposta dela se descarta.
export function criarRecarga<T extends { ok: true }>(): (carregar: () => Promise<T | { ok: false; erro: string }>) => Promise<Recarregado<T> | null> {
  let pedidos = 0;
  let atual: T | null = null;
  return async (carregar) => {
    const numero = ++pedidos;
    const lido = await carregar();
    if (numero !== pedidos) return null;
    if (!lido.ok) return { atual, erro: lido.erro };
    atual = lido;
    return { atual, erro: null };
  };
}
