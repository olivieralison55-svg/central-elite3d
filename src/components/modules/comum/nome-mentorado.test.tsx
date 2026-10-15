import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NomeMentorado from "./nome-mentorado";

const html = (nome: string | null) => renderToStaticMarkup(<NomeMentorado nome={nome} />);

describe("NomeMentorado", () => {
  it.each([
    ["🟢 Ana", "ok", "text-success"],
    ["🟡 Ana", "atenção", "text-warning"],
    ["🟠 Ana", "atenção", "text-warning"],
    ["🔴 Ana", "risco", "text-danger"],
    ["⚠️Ana", "alerta", "text-warning"],
    ["✅ Ana", "concluído", "text-success"],
  ])("%s: ícone lucide com aria-label %s no tom %s, e o nome sem emoji", (nome, rotulo, tom) => {
    const saida = html(nome);
    expect(saida).toMatch(new RegExp(`<svg[^>]*aria-label="${rotulo}"[^>]*role="img"|<svg[^>]*role="img"[^>]*aria-label="${rotulo}"`));
    expect(saida).toContain(tom);
    expect(saida).toContain("Ana</span>");
    expect(saida).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿️]/u);
  });

  it("sem marcador é só o texto; outro emoji some sem ícone; HTML no nome sai escapado", () => {
    expect(html("Ana Clara")).toBe("Ana Clara");
    expect(html("🚀 Ana")).toBe("Ana");
    expect(html(null)).toBe("");
    expect(html('🔴 "><img src=x>')).toContain("&quot;&gt;&lt;img src=x&gt;");
  });
});
