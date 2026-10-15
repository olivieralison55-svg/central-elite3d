import { describe, expect, it } from "vitest";

import { deveCopiar, diferencasDoSnapshot, hashGit, semRelatorio, versaoResolvida } from "./sync-design-system.mjs";

// `printf 'a' | git hash-object --stdin`, e o mesmo para 'b' e 'c'.
const HA = "2e65efe2a145dda7ee51d1741299f848e5bf752e";
const HB = "63d8dbd40c23542e740659a7168a0ce3138ea748";
const HC = "3410062ba67c5ed59b854387a8bc0ec012479368";

describe("sync-design-system (UI-01, STACK-01, SEC-03)", () => {
  it("hashGit dá o hash do git hash-object, inclusive para bytes que não são texto", () => {
    expect(hashGit(Buffer.from("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    // printf '\x00\xff\n\x80' | git hash-object --stdin
    expect(hashGit(Buffer.from([0x00, 0xff, 0x0a, 0x80]))).toBe("750f29b89c24641e8f0ebc78991c4dfa6a02ff7d");
  });

  it("deveCopiar leva design-system, ui e a Inter, menos ui/chat/, kanban.tsx e tag.tsx", () => {
    const copiados = [
      "src/design-system/tokens.ts",
      "src/design-system/tokens.contrast.test.ts",
      "src/components/ui/button.tsx",
      "src/components/ui/chat-bubble.tsx",
      "src/public/fonts/InterVariable.woff2",
    ];
    const deFora = [
      "src/components/ui/chat/chat-shell.tsx",
      "src/components/ui/chat/index.ts",
      "src/components/ui/kanban.tsx",
      "src/components/ui/tag.tsx",
      "src/public/fonts/HankenGrotesk.ttf",
      "src/app/globals.css",
      "src/components/reports/report.css",
    ];
    expect([...copiados, ...deFora].filter(deveCopiar)).toEqual(copiados);
  });

  it("versaoResolvida lê a versão do importer raiz do lockfile, sem o sufixo de peers", () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    dependencies:",
      "      '@supabase/supabase-js':",
      "        specifier: 2.117.3",
      "        version: 2.117.3",
      "      next:",
      "        specifier: ^15.5.14",
      "        version: 15.5.21(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
      "      react:",
      "        specifier: ^19.2.4",
      "        version: 19.2.8",
      "    devDependencies:",
      "      vitest:",
      "        specifier: ^4.1.10",
      "        version: 4.1.10(@types/node@20.19.43)(vite@8.1.5(@types/node@20.19.43))",
      "",
      "packages:",
      "",
      "  react@18.3.1:",
      "    resolution: {integrity: sha512-x}",
      "",
      "  react@19.2.8:",
      "    resolution: {integrity: sha512-y}",
      "",
    ].join("\n");
    expect(versaoResolvida(lockfile, "next")).toBe("15.5.21");
    expect(versaoResolvida(lockfile, "react")).toBe("19.2.8");
    expect(versaoResolvida(lockfile, "vitest")).toBe("4.1.10");
    expect(versaoResolvida(lockfile, "@supabase/supabase-js")).toBe("2.117.3");
    expect(() => versaoResolvida(lockfile, "zod")).toThrow("zod");
  });

  it("semRelatorio tira só a linha do report.css e falha se ela não estiver lá", () => {
    const css = '@import "../design-system/tokens.css";\n@import "../components/reports/report.css";\n\n@tailwind base;\n';
    expect(semRelatorio(css)).toBe('@import "../design-system/tokens.css";\n\n@tailwind base;\n');
    expect(() => semRelatorio('@import "../design-system/tokens.css";\n')).toThrow("report.css");
  });

  it("diferencasDoSnapshot acusa hash diferente e arquivo ausente na árvore da plataforma", () => {
    const snapshot = [
      `sha ${"f".repeat(40)}`,
      "versao next 15.5.21",
      "excecao next 15.5.22 GHSA-0000-0000-0000",
      `blob ${HA} src/components/ui/button.tsx`,
      `blob ${HB} src/components/ui/card.tsx`,
      `blob ${HC} src/design-system/tokens.ts`,
      "",
    ].join("\n");
    const entrada = (hash, caminho) => `100644 blob ${hash}\t${caminho}\0`;
    const igual =
      "040000 tree " + "e".repeat(40) + "\tsrc/components/ui\0" +
      entrada(HA, "src/components/ui/button.tsx") +
      entrada(HB, "src/components/ui/card.tsx") +
      entrada(HC, "src/design-system/tokens.ts");
    expect(diferencasDoSnapshot(snapshot, igual)).toEqual([]);

    const divergente = entrada(HA, "src/components/ui/button.tsx") + entrada(HC, "src/components/ui/card.tsx");
    expect(diferencasDoSnapshot(snapshot, divergente)).toEqual([
      "src/components/ui/card.tsx: hash diferente",
      "src/design-system/tokens.ts: ausente na plataforma",
    ]);

    // SNAPSHOT sem blob não pode conferir por vacuidade.
    expect(() => diferencasDoSnapshot(`sha ${"f".repeat(40)}\n`, igual)).toThrow("blob");
  });
});
