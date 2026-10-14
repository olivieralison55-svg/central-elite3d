import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // O tsconfig diz `jsx: preserve` porque quem compila o JSX é o Next. No
  // runner ninguém compila, então o teste de uma .tsx não parseia sem isto.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
  },
});
