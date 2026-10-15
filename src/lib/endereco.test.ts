import { describe, expect, it } from "vitest";

import { abaVisivel, caminhoDoHash, lerCaminho, telaPermitida } from "./endereco";

// As listas da spec (NAV-01), escritas aqui e não importadas: o teste não confere o código contra ele mesmo.
const TELAS = ["dash", "acompanhamento", "mentorados", "sessoes", "rotas", "mentores", "analise", "nps", "ia", "financeiro"] as const;
const ABAS = ["cadastro", "financeiro", "sessoes", "notas", "stlseller"] as const;
const PAPEIS = ["admin", "diretoria", "mentor"] as const;
const ORIGEM = "https://central-elite3d.vercel.app";

// Os segmentos como o pathname os traz: ainda codificados.
const segmentos = (caminho: string) => caminho.split("/");

describe("endereço: caminho, hash antigo e guardas (NAV-01 a NAV-05, CUT-02, SEC-01)", () => {
  it("NAV-01: os 10 caminhos de tela resolvem para a tela de mesmo nome", () => {
    for (const tela of TELAS) expect(lerCaminho(segmentos(`/${tela}`)), tela).toEqual({ tela });
  });

  it("NAV-01: /mentorado/<id> abre o cadastro e /mentorado/<id>/<aba> abre a aba pedida, com o id decodificado", () => {
    expect(lerCaminho(segmentos("/mentorado/m1"))).toEqual({ tela: "mentorado", id: "m1", aba: "cadastro" });
    for (const aba of ABAS) {
      expect(lerCaminho(segmentos(`/mentorado/m1/${aba}`)), aba).toEqual({ tela: "mentorado", id: "m1", aba });
    }
    expect(lerCaminho(segmentos("/mentorado/Jo%C3%A3o/notas"))).toEqual({ tela: "mentorado", id: "João", aba: "notas" });
  });

  it("NAV-01: as abas completo, basico e qualquer outra viram cadastro", () => {
    for (const aba of ["completo", "basico", "xyz", "Financeiro"]) {
      expect(lerCaminho(segmentos(`/mentorado/m1/${aba}`)), aba).toEqual({ tela: "mentorado", id: "m1", aba: "cadastro" });
      expect(abaVisivel(aba, "admin"), aba).toBe("cadastro");
    }
    expect(abaVisivel(undefined, "mentor")).toBe("cadastro");
  });

  it("NAV-03: /, caminho desconhecido e codificação inválida dão o Dashboard sem lançar", () => {
    for (const caminho of ["/", "", "/xyz", "/mentorado", "/mentorado/%E0%A4%A", "/mentorado/m1/%E0%A4%A", "/%E0%A4%A"]) {
      expect(lerCaminho(segmentos(caminho)), caminho).toEqual({ tela: "dash" });
    }
  });

  it("NAV-02: o hash antigo de uma tela vira o caminho dela", () => {
    for (const tela of TELAS) expect(caminhoDoHash(`#/${tela}`), tela).toBe(`/${tela}`);
  });

  it("NAV-02: o hash de ficha vira /mentorado/<id>[/<aba de ABAS_FICHA>], com o id em encodeURIComponent", () => {
    expect(caminhoDoHash("#/mentorado/m1")).toBe("/mentorado/m1");
    for (const aba of ["financeiro", "sessoes", "notas", "stlseller"]) {
      expect(caminhoDoHash(`#/mentorado/m1/${aba}`), aba).toBe(`/mentorado/m1/${aba}`);
    }
    expect(caminhoDoHash("#/mentorado/m1/completo")).toBe("/mentorado/m1");
    expect(caminhoDoHash("#/mentorado/Jo%C3%A3o%20Silva/notas")).toBe("/mentorado/Jo%C3%A3o%20Silva/notas");
    expect(caminhoDoHash("#/mentorado/a%2Fb%3Fc%23d")).toBe("/mentorado/a%2Fb%3Fc%23d");
  });

  it("NAV-02: #, #/, vazio, forma desconhecida e codificação inválida devolvem null", () => {
    for (const hash of ["#", "#/", "", "#/xyz", "#/mentorado", "#/mentorado/%E0%A4%A"]) {
      expect(caminhoDoHash(hash), hash).toBeNull();
    }
  });

  it("SEC-01: os vetores do THREAT-01 devolvem null, e um id hostil fica na mesma origem", () => {
    // Os da spec (SEC-01) e os da T11, que escreve `#//evil.example/login` e a barra invertida dobrada.
    const vetores = [
      "#//evil.example",
      "#//evil.example/login",
      "#/\\evil.example",
      "#/\\\\evil.example",
      "#/%2F%2Fevil.example",
      "#/%09/evil.example",
      "#javascript:alert(1)",
    ];
    for (const hash of vetores) expect(caminhoDoHash(hash), hash).toBeNull();
    for (const hash of [
      "#/mentorado/%2F%2Fevil.example",
      "#/mentorado/%5C%5Cevil.example",
      "#/mentorado/https%3A%2F%2Fevil.example",
      "#/mentorado/%09%2F%2Fevil.example/financeiro",
    ]) {
      const caminho = caminhoDoHash(hash);
      expect(caminho && new URL(caminho, ORIGEM).origin, hash).toBe(ORIGEM);
    }
  });

  it("NAV-04: /financeiro, /analise, /nps e /mentores exigem verFinanceiro; as outras telas abrem para os 3 papéis", () => {
    for (const tela of ["financeiro", "analise", "nps", "mentores"] as const) {
      expect(PAPEIS.map((papel) => telaPermitida(tela, papel)), tela).toEqual([true, true, false]);
    }
    for (const tela of ["dash", "acompanhamento", "mentorados", "sessoes", "rotas", "ia", "mentorado"] as const) {
      expect(PAPEIS.map((papel) => telaPermitida(tela, papel)), tela).toEqual([true, true, true]);
    }
  });

  it("NAV-05: as abas financeiro e stlseller sem verFinanceiro mostram sessoes; as outras ficam", () => {
    for (const aba of ["financeiro", "stlseller"]) {
      expect(PAPEIS.map((papel) => abaVisivel(aba, papel)), aba).toEqual([aba, aba, "sessoes"]);
    }
    for (const aba of ["cadastro", "sessoes", "notas"]) {
      expect(PAPEIS.map((papel) => abaVisivel(aba, papel)), aba).toEqual([aba, aba, aba]);
    }
  });

  it("CUT-02: o link antigo #/mentorado/<id>/financeiro abre a ficha desse mentorado na aba Financeiro para o admin", () => {
    const id = "6b1f0c3e-6f5e-4a1e-9f3b-2d7c8e9a0b1c";
    const caminho = caminhoDoHash(`#/mentorado/${id}/financeiro`);
    expect(caminho).toBe(`/mentorado/${id}/financeiro`);
    expect(lerCaminho(segmentos(caminho ?? ""))).toEqual({ tela: "mentorado", id, aba: "financeiro" });
    expect(abaVisivel("financeiro", "admin")).toBe("financeiro");
  });
});
