import { defineConfig } from "vitest/config";
import path from "node:path";

// `pnpm parity` (G2.5, GATE-06): só a corrida de paridade, fora do `pnpm test`. Ela precisa do
// snapshot de produção e do merge-base, então não roda offline (TEST-06).
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["scripts/parity/**/*.parity.ts"],
    // Um snapshot inteiro, nos 3 papéis, com uma instância do app antigo por métrica.
    testTimeout: 30 * 60 * 1000,
  },
});
