import { describe, expect, it } from "vitest";

import { linkSeguro, linkWhatsapp } from "./links";

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

describe("Canal WhatsApp: o número vira wa.me (AD-012)", () => {
  it("número do Brasil, com ou sem máscara, 55 ou 0 da frente, ganha o 55; o DDD 55 não se confunde com o DDI", () => {
    for (const valor of ["11 99999-8888", "(11) 99999-8888", "11999998888", "011 99999-8888", "5511999998888", "+55 (11) 99999-8888"]) {
      expect(linkWhatsapp(valor), valor).toBe("https://wa.me/5511999998888");
    }
    expect(linkWhatsapp("(11) 3333-4444")).toBe("https://wa.me/551133334444");
    expect(linkWhatsapp("(55) 99999-8888")).toBe("https://wa.me/5555999998888");
  });

  it("com +, o número já traz o DDI", () => {
    expect(linkWhatsapp("+351 912 345 678")).toBe("https://wa.me/351912345678");
    expect(linkWhatsapp("+1 415 555 1234")).toBe("https://wa.me/14155551234");
  });

  it("link http(s) passa como está; texto, número curto e esquema perigoso devolvem null", () => {
    expect(linkWhatsapp("https://chat.whatsapp.com/abc")).toBe("https://chat.whatsapp.com/abc");
    for (const valor of ["link whats", "", null, undefined, "123", "chat.whatsapp.com/A1b2C3d4E5f6G7h8I9j0k1", "javascript:alert(1)", "data:text/html,oi"]) {
      expect(linkWhatsapp(valor), String(valor)).toBeNull();
    }
  });
});
