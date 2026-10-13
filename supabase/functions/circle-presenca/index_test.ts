import { assertEquals } from "jsr:@std/assert@1";
Deno.env.set("SUPABASE_URL", "http://x"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "x");
const { extrair, etapaDoEvento, mentorDoEvento } = await import("./index.ts");

Deno.test("acha e-mail e id do evento em qualquer profundidade", () => {
  assertEquals(extrair({ data: { member: { email: "Ana@X.com" }, event: { id: 36450345, name: "x" } } }),
    { email: "ana@x.com", eventId: 36450345 });
  assertEquals(extrair({ member_email: "b@y.com", event_id: "123" }), { email: "b@y.com", eventId: 123 });
  assertEquals(extrair({ nada: 1 }), { email: null, eventId: null });
});

Deno.test("etapa e mentor saem do nome do evento", () => {
  assertEquals(etapaDoEvento("Sessão de Implementação #7")?.etapa, "Sessão de Implementação Mensal");
  assertEquals(etapaDoEvento("Plantão de Dúvidas #23 - André")?.etapa, "Plantão de Dúvida Semanal");
  assertEquals(etapaDoEvento("Live aberta"), null);
  assertEquals(mentorDoEvento("Plantão de Dúvidas #25 - Sérgio"), "Sergio");
  assertEquals(mentorDoEvento("Plantão de Dúvidas Elite 3D #19 - Precificação com Petare"), "Petare");
  assertEquals(mentorDoEvento("Sessão de Implementação #7"), null);
});
