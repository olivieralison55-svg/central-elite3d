import { describe, expect, it } from "vitest";

import { criarRecarga } from "./recarga";

type Carga = { ok: true; versao: string };
type Lido = Carga | { ok: false; erro: string };

// Uma resposta que o teste entrega quando quiser: é a rede respondendo fora de ordem.
function adiada() {
  let entregar: (lido: Lido) => void = () => undefined;
  const promessa = new Promise<Lido>((resolve) => {
    entregar = resolve;
  });
  return { promessa, entregar };
}

const carga = (versao: string): Carga => ({ ok: true, versao });

describe("recarga em que a última pedida vence (DATA-09)", () => {
  it("DATA-09: duas recargas sobrepostas com respostas fora de ordem: vale a da última pedida", async () => {
    for (const chegada of [
      ["segunda", "primeira"],
      ["primeira", "segunda"],
    ] as const) {
      const recarregar = criarRecarga<Carga>();
      const respostas = { primeira: adiada(), segunda: adiada() };
      const primeira = recarregar(() => respostas.primeira.promessa);
      const segunda = recarregar(() => respostas.segunda.promessa);
      for (const qual of chegada) respostas[qual].entregar(carga(qual));

      const caso = `a ${chegada[0]} chega antes`;
      expect(await primeira, caso).toBeNull();
      expect(await segunda, caso).toEqual({ atual: carga("segunda"), erro: null });
      // A resposta descartada não virou a carga em vigor.
      expect(await recarregar(() => Promise.resolve({ ok: false, erro: "timeout" })), caso).toEqual({ atual: carga("segunda"), erro: "timeout" });
    }
  });

  it("DATA-09: recarga que falha mantém o dataset anterior e devolve o erro", async () => {
    const recarregar = criarRecarga<Carga>();
    expect(await recarregar(() => Promise.resolve({ ok: false, erro: "Failed to fetch" }))).toEqual({ atual: null, erro: "Failed to fetch" });
    expect(await recarregar(() => Promise.resolve(carga("1")))).toEqual({ atual: carga("1"), erro: null });
    expect(await recarregar(() => Promise.resolve({ ok: false, erro: "sessoes: schema mismatch" }))).toEqual({
      atual: carga("1"),
      erro: "sessoes: schema mismatch",
    });
    expect(await recarregar(() => Promise.resolve(carga("2")))).toEqual({ atual: carga("2"), erro: null });
  });

  it("DATA-09: a última pedida vence também quando falha, e a resposta velha que chega depois se descarta", async () => {
    const recarregar = criarRecarga<Carga>();
    await recarregar(() => Promise.resolve(carga("1")));
    const velha = adiada();
    const pedidoVelho = recarregar(() => velha.promessa);
    const novo = await recarregar(() => Promise.resolve({ ok: false, erro: "timeout" }));
    velha.entregar(carga("velha"));

    expect(novo).toEqual({ atual: carga("1"), erro: "timeout" });
    expect(await pedidoVelho).toBeNull();
    expect(await recarregar(() => Promise.resolve({ ok: false, erro: "timeout" }))).toEqual({ atual: carga("1"), erro: "timeout" });
  });
});
