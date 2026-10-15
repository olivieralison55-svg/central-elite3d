import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Button from "@/components/ui/button";

import { useDados } from "./contexto";
import { type Estado, PortaoSessao, reduzir } from "./sessao";
import TelaPapel, { type MotivoSemAcesso } from "./tela-papel";

const ana = { id: "u1", email: "ana@exemplo.com" };

type Elemento = ReactElement<Record<string, unknown>>;

// Os elementos de uma árvore devolvida por um componente sem hooks, props de elemento incluídas
// (o `action` do EmptyState). Serve para clicar num botão sem DOM.
function elementos(no: unknown): Elemento[] {
  if (Array.isArray(no)) return no.flatMap(elementos);
  if (!isValidElement<Record<string, unknown>>(no)) return [];
  return [no, ...Object.values(no.props).flatMap(elementos)];
}

// Renderiza a tela, confere o título e o único botão, e clica nele.
function conferir(motivo: MotivoSemAcesso, titulo: string) {
  let saidas = 0;
  const sair = async () => {
    saidas += 1;
  };
  const html = renderToStaticMarkup(<TelaPapel motivo={motivo} sair={sair} />);
  expect(html).toContain(`<p class="text-sm font-semibold text-ink">${titulo}</p>`);
  expect([...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])).toEqual(["Sair"]);

  const botoes = elementos(TelaPapel({ motivo, sair })).filter((el) => el.type === Button);
  expect(botoes).toHaveLength(1);
  const clicar = botoes[0].props.onClick;
  if (typeof clicar !== "function") throw new Error("o Sair não tem onClick");
  clicar();
  expect(saidas).toBe(1);
}

describe("telas de perfil e papel (AUTH-06, AUTH-07)", () => {
  it("AUTH-06: 'Perfil não encontrado' com o botão Sair, que chama o sair da sessão", () => {
    conferir("semPerfil", "Perfil não encontrado");
  });

  it("AUTH-07: 'Papel não reconhecido' com o botão Sair, que chama o sair da sessão", () => {
    conferir("papelInvalido", "Papel não reconhecido");
  });

  it("nessas fases o portão mostra só a tela e o Sair: nenhum dado, nem depois do SIGNED_OUT que encerrou a sessão sem perfil", () => {
    function TelaComDado() {
      useDados(); // fora do DadosProvider, lança: renderizar este filho já falharia o teste
      return <p>dado</p>;
    }
    const sair = () => Promise.resolve();
    const semPerfil: Estado = { sessao: { fase: "semPerfil", usuario: ana, encerrarSessao: true }, perfilAusente: true };
    const casos: Array<[Estado, MotivoSemAcesso]> = [
      [semPerfil, "semPerfil"],
      [reduzir(semPerfil, { tipo: "SIGNED_OUT", usuario: null }), "semPerfil"],
      [{ sessao: { fase: "papelInvalido", usuario: ana, perfil: { id: "u1", role: null, nome: null, email: null } }, perfilAusente: false }, "papelInvalido"],
      [{ sessao: { fase: "papelInvalido", usuario: ana, perfil: { id: "u1", role: "gestor", nome: null, email: null } }, perfilAusente: false }, "papelInvalido"],
    ];
    for (const [estado, motivo] of casos) {
      const html = renderToStaticMarkup(
        <PortaoSessao estado={estado} sair={sair}>
          <TelaComDado />
        </PortaoSessao>,
      );
      expect(html, `${estado.sessao.fase} → ${motivo}`).toBe(renderToStaticMarkup(<TelaPapel motivo={motivo} sair={sair} />));
    }
  });
});
