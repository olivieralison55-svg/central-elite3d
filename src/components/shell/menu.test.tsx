import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ComponentProps, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import Button from "@/components/ui/button";
import type { Perfil } from "@/lib/data/auth";
import { PAPEL_LABEL } from "@/lib/papeis";
import { navegadorFalso, renderTela } from "@/test/render";

import { SessaoContexto, type ValorSessao } from "./contexto";
import Menu, { Usuario } from "./menu";

// O Drawer do DS devolve null sem `document` (drawer.tsx:50): no vitest `node` o menu mobile
// nunca renderiza. Com `gaveta.aberta`, o falso desenha o conteúdo e o pé dele em <menu-mobile>;
// fechada, é o Drawer de verdade.
const gaveta = vi.hoisted(() => ({ aberta: false }));
vi.mock("@/components/ui/drawer", async (importOriginal) => {
  const { createElement } = await import("react");
  const { default: Drawer } = await importOriginal<typeof import("@/components/ui/drawer")>();
  return {
    default: (props: ComponentProps<typeof Drawer>) =>
      gaveta.aberta ? createElement("menu-mobile", null, props.children, props.footer) : createElement(Drawer, props),
  };
});

const PASTA = fileURLToPath(new URL(".", import.meta.url));

// As tags de abertura de um elemento, cada uma com os atributos num objeto.
const tags = (html: string, elemento: string) =>
  (html.match(new RegExp(`<${elemento}\\b[^>]*>`, "g")) ?? []).map((tag) =>
    Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])),
  );
// [href, rótulo] de cada link do menu: o NavItem põe o ícone antes do rótulo.
const itens = (html: string) => [...html.matchAll(/<a\b[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]*)<\/a>/g)].map((m, i) => [tags(html, "a")[i].href, m[1]]);
const acesos = (html: string) => tags(html, "a").filter((a) => a["aria-current"] === "page").map((a) => a.href);

type Elemento = ReactElement<Record<string, unknown>>;
function elementos(no: unknown): Elemento[] {
  if (Array.isArray(no)) return no.flatMap(elementos);
  if (!isValidElement<Record<string, unknown>>(no)) return [];
  return [no, ...Object.values(no.props).flatMap(elementos)];
}

// O menu de hoje (index.html:489–498), na ordem.
const DE_ADMIN = [
  ["/dash", "Dashboard"],
  ["/acompanhamento", "Acompanhamento"],
  ["/mentorados", "Mentorados"],
  ["/sessoes", "Sessões"],
  ["/rotas", "Rotas"],
  ["/mentores", "Mentores"],
  ["/analise", "STLSeller"],
  ["/nps", "NPS"],
  ["/ia", "Análise IA"],
  ["/financeiro", "Financeiro"],
];
const DE_MENTOR = DE_ADMIN.filter(([caminho]) => !["/mentores", "/analise", "/nps", "/financeiro"].includes(caminho));

describe("menu, usuário e tema (NAV-06, UI-04, UI-08, AUTH-08)", () => {
  it("NAV-06 e AUTH-08: admin e diretoria veem 10 itens; o mentor que entra depois, só os 6 dele", () => {
    expect(itens(renderTela(<Menu />, { papel: "admin" }))).toEqual(DE_ADMIN);
    expect(itens(renderTela(<Menu />, { papel: "diretoria" }))).toEqual(DE_ADMIN);
    expect(itens(renderTela(<Menu />, { papel: "mentor" }))).toEqual(DE_MENTOR);
    expect(DE_MENTOR.map(([, rotulo]) => rotulo)).toEqual(["Dashboard", "Acompanhamento", "Mentorados", "Sessões", "Rotas", "Análise IA"]);
  });

  it("NAV-06 e UI-08: o menu mobile lista os mesmos itens do papel e leva o bloco do usuário com o Sair", () => {
    gaveta.aberta = true;
    onTestFinished(() => {
      gaveta.aberta = false;
    });
    for (const [papel, esperado] of [["admin", DE_ADMIN], ["diretoria", DE_ADMIN], ["mentor", DE_MENTOR]] as const) {
      const movel = /<menu-mobile>([\s\S]*)<\/menu-mobile>/.exec(renderTela(<Menu />, { papel }))?.[1] ?? "";
      expect(itens(movel), papel).toEqual(esperado);
      const usuario = renderToStaticMarkup(<Usuario nome={PAPEL_LABEL[papel]} papel={papel} sair={() => Promise.resolve()} />);
      expect(usuario).toContain(">Sair</button>");
      expect(movel, papel).toContain(usuario);
    }
  });

  it("a logo da Elite 3D abre a sidebar e o cabeçalho mobile: a preta no claro, a branca no escuro", () => {
    const html = renderTela(<Menu />, { papel: "admin" });
    const logos = tags(html, "img");
    // Sidebar e cabeçalho mobile: duas imagens em cada.
    expect(logos.map((l) => [l.src, l.alt])).toEqual(Array(2).fill([["/logo-elite3d-preta.png", "Elite 3D"], ["/logo-elite3d-branca.png", "Elite 3D"]]).flat());
    expect(logos[0].class).toContain("dark:hidden");
    expect(logos[1].class).toMatch(/\bhidden\b.*dark:block/);
    // As duas versões têm o mesmo tamanho: trocar o tema não muda a logo de tamanho.
    for (const logo of logos) {
      const classes = logo.class.split(" ");
      expect([classes.find((c) => c.startsWith("h-")), classes.find((c) => c.startsWith("w-")), logo.width, logo.height], logo.src).toEqual(["h-[19px]", "w-[86px]", "86", "19"]);
    }
    // 86×19 é a proporção do PNG (480×106): a logo não distorce.
    expect(Math.abs(86 / 19 - 480 / 106)).toBeLessThan(0.05);
    // O flex-col não estica a logo na largura do menu.
    expect(html).toMatch(/<span class="flex flex-col items-start gap-1"><img[^>]*logo-elite3d-preta/);
    expect(html.match(/Central de Controle/g)).toHaveLength(2);
    expect(html).not.toContain("Mentoria Elite 3D");
  });

  it("o item aceso é o da tela; na ficha, é o voltarPara", () => {
    expect(acesos(renderTela(<Menu />, { papel: "admin", navegar: navegadorFalso("/rotas") }))).toEqual(["/rotas"]);
    const fichaDeSessoes = renderTela(<Menu />, { papel: "admin", ui: { voltarPara: "/sessoes" }, navegar: navegadorFalso("/mentorado/m1/financeiro") });
    expect(acesos(fichaDeSessoes)).toEqual(["/sessoes"]);
    // Por link colado não houve lista: o voltarPara inicial, Mentorados.
    expect(acesos(renderTela(<Menu />, { papel: "mentor", navegar: navegadorFalso("/mentorado/m1") }))).toEqual(["/mentorados"]);
  });

  it("o usuário: Avatar, nome (ou e-mail), papel e o Sair, que chama o sair da sessão", () => {
    const comPerfil = (perfil: Perfil): ValorSessao => ({
      usuario: { id: "u1", email: "login@exemplo.com" },
      perfil,
      papel: "mentor",
      pode: () => false,
      sair: () => Promise.resolve(),
    });
    const html = (perfil: Perfil) =>
      renderTela(
        <SessaoContexto.Provider value={comPerfil(perfil)}>
          <Menu />
        </SessaoContexto.Provider>,
        { papel: "mentor" },
      );
    const ana = html({ id: "u1", role: "mentor", nome: "Ana Clara", email: "ana@exemplo.com" });
    expect(ana).toMatch(/<span class="flex shrink-0 items-center justify-center rounded-full[^"]*">AC<\/span>/);
    expect(ana).toContain('<span class="block truncate text-[13px] font-medium text-ink">Ana Clara</span>');
    expect(ana).toContain('<span class="block truncate text-[11px] text-muted">Mentor</span>');
    expect(html({ id: "u1", role: "mentor", nome: null, email: "ana@exemplo.com" })).toContain(">ana@exemplo.com</span>");
    expect(html({ id: "u1", role: "mentor", nome: "", email: null })).toContain(">login@exemplo.com</span>");

    let saidas = 0;
    const sair = async () => {
      saidas += 1;
    };
    const botoes = elementos(Usuario({ nome: "Ana Clara", papel: "mentor", sair })).filter((el) => el.type === Button);
    expect(botoes.map((botao) => botao.props.children)).toEqual(["Sair"]);
    const clicar = botoes[0].props.onClick;
    if (typeof clicar !== "function") throw new Error("o Sair não tem onClick");
    clicar();
    expect(saidas).toBe(1);
  });

  it("UI-04: ThemeToggle na casca; o menu mobile abre por um botão e nasce fechado", () => {
    const html = renderTela(<Menu />, { papel: "diretoria" });
    expect(tags(html, "button").map((botao) => botao["aria-label"] ?? null)).toEqual(["Recolher o menu", "Ativar tema escuro", null, "Abrir o menu"]);
    expect(html).not.toContain('role="dialog"');
  });

  it("UI-08: a casca não tem CSS próprio (nenhum style, <style> nem import de .css)", () => {
    const cssProprio = /\bstyle\s*=|<style\b|\.css["'`]/g;
    expect('<div style={{ color: "red" }} /><style>{x}</style>\nimport "./casca.css";'.match(cssProprio)).toHaveLength(3);
    const casca = readdirSync(PASTA).filter((nome) => /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome));
    expect(casca).toEqual(expect.arrayContaining(["menu.tsx", "sessao.tsx", "tela-login.tsx", "tela-papel.tsx"]));
    expect(casca.flatMap((nome) => (readFileSync(join(PASTA, nome), "utf8").match(cssProprio) ?? []).map((m) => `${nome}: ${m}`))).toEqual([]);
  });
});
