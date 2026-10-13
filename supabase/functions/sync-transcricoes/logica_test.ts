// deno test supabase/functions/sync-transcricoes/logica_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { acharMentorado, dataDoTitulo, ehGrupo, triagem, vereditoJev } from "./logica.ts";

const MS = [
  { id: "1", nome: "Paulo Barbosa", email: "paulaum.comex@gmail.com" },
  { id: "2", nome: "Paulo Henrique", email: null },
  { id: "3", nome: "Ana Clara Bargas", email: null },
];

Deno.test("title date keeps the meeting's offset", () => {
  assertEquals(dataDoTitulo("Plano de Ação Elite 3D - Paulo Barbosa - 2026/10/06 14:04 GMT-03:00 - Anotações do Gemini"),
    "2026-10-06T14:04:00-03:00");
  assertEquals(dataDoTitulo("Reunião sem data"), null);
});

Deno.test("mentee: e-mail wins, name is the fallback, a tie matches nobody", () => {
  assertEquals(acharMentorado("convidado x@y.com paulaum.comex@gmail.com", "qualquer", MS)?.id, "1");
  assertEquals(acharMentorado("", "Plano de Ação Elite 3D - Ana Clara Bargas  - 2026/10/05 09:57 GMT-03:00", MS)?.id, "3");
  assertEquals(acharMentorado("", "Diagnóstico - Paulo - 2026/10/05 09:57 GMT-03:00", MS), null);
});

Deno.test("group meetings never reach a personal dossier", () => {
  assertEquals(ehGrupo("Plantão de Dúvidas Elite 3D # Diovani - 2026/10/07"), true);
  assertEquals(ehGrupo("Weekly mentores Elite3D by STLFLIX"), true);
  assertEquals(ehGrupo("Plano de Ação Elite 3D - Paulo Barbosa"), false);
});

Deno.test("deterministic gate", () => {
  const fala = "Mentor: oi, vamos falar do anúncio\nAluno: certo, subi os produtos\n";
  assertEquals(triagem(null) !== null, true);
  assertEquals(triagem(fala) !== null, true); // too short
  assertEquals(triagem(fala.repeat(60)), null);
  assertEquals(triagem("Mentor: blá blá\n".repeat(200)) !== null, true); // one speaker
});

Deno.test("Jev thresholds (calibrated 13/10/2026)", () => {
  const j = (u: number, c: number) => ({ qualidade: { choice: u >= 0.5 ? "utilizavel" : "suja", confidence: 1,
    probabilities: { utilizavel: u } }, conteudo: { noul: c } });
  assertEquals(vereditoJev(j(0.99, 0.96)), null);
  assertEquals(vereditoJev(j(0.04, 0.56)) !== null, true);
  assertEquals(vereditoJev(j(0.99, 0.1)) !== null, true);
});

Deno.test("names with regex characters do not break matching", () => {
  const ms = [{ id: "9", nome: "Zé (midnight", email: null }, ...MS];
  assertEquals(acharMentorado("", "Plano de Ação Elite 3D - Ana Clara Bargas - 2026/10/05 09:57 GMT-03:00", ms)?.id, "3");
});
