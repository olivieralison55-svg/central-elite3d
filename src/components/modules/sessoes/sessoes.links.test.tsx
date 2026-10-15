import { describe, expect, it } from "vitest";

import type { Sessao } from "@/lib/data/esquemas";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Sessoes from "./sessoes";

// O link_meet passa pela mesma célula de links na linha 1:1 e no encontro em grupo.
const sessao = (campos: Partial<Sessao> & { id: string }): Sessao => ({
  mentorado_id: "m1",
  etapa: "Checkup 1",
  ordem: 3,
  status: "Concluída",
  mentor: "Luan",
  data: null,
  hora: null,
  link_meet: null,
  link_gravacao: null,
  link_anotacoes: null,
  google_event_id: null,
  etapa_deduzida: false,
  ...campos,
});

describe("tela Sessões: link_meet (SEC-05)", () => {
  it('SEC-05: link_meet com javascript: ou data: aparece como texto, na 1:1 e no encontro; com https vira <a> com rel="noopener noreferrer"', () => {
    const sessoes = [
      sessao({ id: "l1", data: "2026-09-01", link_meet: "javascript:alert(1)" }),
      sessao({ id: "l2", data: "2026-09-02", link_meet: "data:text/html,oi" }),
      sessao({ id: "l3", data: "2026-09-03", link_meet: "https://meet.google.com/abc" }),
      sessao({ id: "l4", etapa: "Plantão de Dúvida Semanal", ordem: 90, data: "2026-09-04", hora: "19:00:00", link_meet: "data:text/html,grupo" }),
    ];
    const html = renderTela(<Sessoes />, { papel: "admin", dados: { ...datasetDeTeste(), sessoes } });
    expect(html).not.toMatch(/href="(?:javascript|data):/);
    for (const url of ["javascript:alert(1)", "data:text/html,oi", "data:text/html,grupo"]) {
      expect(html, url).toContain(`<span class="text-muted" title="${url}">meet*</span>`);
    }
    expect(html).toContain('<a href="https://meet.google.com/abc" target="_blank" rel="noopener noreferrer"');
  });
});
