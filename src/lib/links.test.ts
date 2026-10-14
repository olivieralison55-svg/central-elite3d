import { describe, expect, it } from "vitest";

import { linkSeguro } from "./links";

describe("link do banco só como http(s) (SEC-05)", () => {
  it("http: e https: passam, com o endereço inteiro", () => {
    expect(linkSeguro("http://exemplo.com/gravacao?id=1")).toBe("http://exemplo.com/gravacao?id=1");
    expect(linkSeguro("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(linkSeguro("HTTPS://EXEMPLO.COM")).toBe("HTTPS://EXEMPLO.COM");
  });

  it("javascript:, data: e mailto: devolvem null", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "mailto:ana@exemplo.com",
    ]) {
      expect(linkSeguro(url), url).toBeNull();
    }
  });

  it("caminho relativo devolve null, inclusive o que começa com //", () => {
    for (const url of ["/mentorado/m1", "exemplo.com/gravacao", "//evil.example/x"]) {
      expect(linkSeguro(url), url).toBeNull();
    }
  });

  it("vazio devolve null", () => {
    expect(linkSeguro("")).toBeNull();
    expect(linkSeguro(null)).toBeNull();
    expect(linkSeguro(undefined)).toBeNull();
  });
});
