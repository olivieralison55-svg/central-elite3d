import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const CONFIG: unknown = JSON.parse(readFileSync(join(RAIZ, "vercel.json"), "utf8"));

// GATE-04 AC4: a branch leva o vercel.json que sobrepõe o preset do projeto
// para Next.js. (A main sem o arquivo é fato do git, conferido no G4.)
describe("vercel.json (GATE-04)", () => {
  it("diz framework nextjs", () => {
    expect(CONFIG).toMatchObject({ framework: "nextjs" });
  });

  it("instala com o lockfile congelado e builda com pnpm build", () => {
    expect(CONFIG).toMatchObject({
      installCommand: "pnpm install --frozen-lockfile",
      buildCommand: "pnpm build",
    });
  });

  it("não traz outra chave além das 3", () => {
    expect(Object.keys(CONFIG as object).sort()).toEqual(["buildCommand", "framework", "installCommand"]);
  });
});
