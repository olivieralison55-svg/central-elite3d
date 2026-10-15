import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortaoSessao } from "./sessao";
import TelaLogin, { enviarLogin, FormularioLogin } from "./tela-login";

// As tags de abertura de um elemento, cada uma com os atributos num objeto.
const tags = (html: string, elemento: string) =>
  (html.match(new RegExp(`<${elemento}\\b[^>]*>`, "g")) ?? []).map((tag) =>
    Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])),
  );
const textoDe = (html: string, elemento: string) => [...html.matchAll(new RegExp(`<${elemento}\\b[^>]*>([^<]*)</${elemento}>`, "g"))].map((m) => m[1]);
const nada = () => undefined;

// As quatro mensagens de classificarErroLogin (T12; design, "Error Handling Strategy").
const MENSAGENS = [
  "E-mail ou senha inválidos.",
  "Sem conexão com o servidor. Tente de novo.",
  "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "Não foi possível entrar: Email logins are disabled.",
];

describe("tela de login (AUTH-01 a AUTH-05, AUTH-08, AUTH-10)", () => {
  it("AUTH-03: cada label aponta, por htmlFor, para o seu campo; Entrar é o único submit do mesmo form", () => {
    const html = renderToStaticMarkup(<TelaLogin />);
    const rotulos = [...html.matchAll(/<label for="([^"]+)"[^>]*>([^<]*)<\/label>/g)].map((m) => [m[2], m[1]]);
    const campo = (id: string) => tags(html, "input").find((input) => input.id === id);
    expect(rotulos.map(([rotulo, id]) => [rotulo, campo(id)?.type])).toEqual([
      ["E-mail", "email"],
      ["Senha", "password"],
    ]);

    const formulario = html.match(/<form\b[^>]*>([\s\S]*)<\/form>/)?.[1] ?? "";
    expect(tags(formulario, "input")).toHaveLength(2);
    const botoes = tags(formulario, "button");
    expect(botoes.map((botao) => botao.type)).toEqual(["submit"]);
    expect(botoes[0]).not.toHaveProperty("disabled");
    expect(textoDe(formulario, "button")).toEqual(["Entrar"]);

    // Button loading durante o envio: travado e anunciado como ocupado.
    const enviando = tags(renderToStaticMarkup(<FormularioLogin erro={null} enviando enviar={nada} />), "button")[0];
    expect([enviando.type, enviando.disabled, enviando["aria-busy"]]).toEqual(["submit", "", "true"]);
  });

  it("AUTH-04 e AUTH-05: mostra, num alerta, exatamente a mensagem que a T12 deu ao erro", async () => {
    for (const mensagem of MENSAGENS) {
      const erro = await enviarLogin("ana@exemplo.com", "s3gredo", async () => mensagem);
      expect(erro).toBe(mensagem);
      const html = renderToStaticMarkup(<FormularioLogin erro={erro} enviando={false} enviar={nada} />);
      expect([...html.matchAll(/<p role="alert"[^>]*>([^<]*)<\/p>/g)].map((m) => m[1])).toEqual([mensagem]);
    }
    expect(renderToStaticMarkup(<FormularioLogin erro={null} enviando={false} enviar={nada} />)).not.toContain('role="alert"');
  });

  it("AUTH-02: entrar recebe o e-mail sem espaços e a senha como digitada; campo vazio não chama o Supabase", async () => {
    const pedidos: Array<[string, string]> = [];
    const entrarFalso = async (email: string, senha: string) => {
      pedidos.push([email, senha]);
      return null;
    };
    expect(await enviarLogin("  ana@exemplo.com ", " s3gredo ", entrarFalso)).toBeNull();
    expect(pedidos).toEqual([["ana@exemplo.com", " s3gredo "]]);

    for (const [email, senha] of [["", "s3gredo"], ["   ", "s3gredo"], ["ana@exemplo.com", ""]]) {
      expect(await enviarLogin(email, senha, entrarFalso), `${email}|${senha}`).toBe("Preencha e-mail e senha.");
    }
    expect(pedidos).toHaveLength(1);
  });

  it("AUTH-10: sem link de cadastro nem de recuperação de senha", () => {
    const html = renderToStaticMarkup(<TelaLogin />);
    expect(tags(html, "a")).toEqual([]);
    expect(html).not.toMatch(/cadastr|criar conta|esqueci|recuper|redefin/i);
    expect(html).toContain("Acesso restrito à equipe. Solicite seu login ao administrador.");
  });

  it("AUTH-08: a senha só mora no <input> da tela: os campos nascem vazios, sem value", () => {
    const campos = tags(renderToStaticMarkup(<TelaLogin />), "input");
    expect(campos.map((campo) => [campo.name, campo.value])).toEqual([
      ["email", undefined],
      ["senha", undefined],
    ]);
  });

  it("AUTH-01: sem sessão, o portão mostra e-mail, senha e Entrar, e não os filhos", () => {
    const html = renderToStaticMarkup(
      <PortaoSessao estado={{ sessao: { fase: "anonimo" }, perfilAusente: false }} sair={() => Promise.resolve()}>
        <p>filhos</p>
      </PortaoSessao>,
    );
    expect([textoDe(html, "label"), textoDe(html, "button")]).toEqual([["E-mail", "Senha"], ["Entrar"]]);
    expect(html).not.toContain("filhos");
  });
});
