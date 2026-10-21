# AD-012 — "Contatar" abre o Canal WhatsApp da ficha, não um telefone

- **Status**: active
- **Date**: 2026-10-21
- **Scope**: lista "Mentorados sem sessão há +30 dias" do Dashboard e do Acompanhamento (`src/components/modules/dashboard/dashboard.tsx`), coluna `mentorados.link_whatsapp`.

## Decisão

Na lista "Mentorados sem sessão há +30 dias", o selo "Contatar" vira botão que abre,
em aba nova, o `link_whatsapp` do mentorado — o "Canal WhatsApp" da aba Cadastro da
ficha. Só vira botão o link que passa no `linkSeguro` (http/https, SEC-05). Sem link
válido o selo "Contatar" continua, sem ação. "Nunca começou" não muda.

## Por quê

- `link_whatsapp` é o único dado de WhatsApp do mentorado. Nenhuma das relações que o
  app lê (R01–R22, snapshot de paridade de 2026-10-14, `select *`) tem telefone; o
  `contact.phone` do `payload` da Lia aparece em 7 das 177 cobranças.
- O mentor também vê o botão: `link_whatsapp` está na view `mentorados_basic`
  (`20260916_email_do_mentorado.sql`).

## Trade-off

- **Hoje quase ninguém tem o botão.** No snapshot de 2026-10-14, dos 88 mentorados,
  1 tem link `https://chat.whatsapp.com/…`, 49 têm o texto `link whats` (marcador,
  não link) e 38 estão vazios. Linha com selo e sem botão é ficha sem Canal WhatsApp,
  não defeito: o conserto é preencher a ficha.
- O botão abre o grupo, não a conversa privada. Um `https://wa.me/55…` gravado no
  Canal WhatsApp também funciona, porque vale qualquer link http(s). Telefone de
  verdade (coluna, campo no Cadastro, `wa.me` montado) pede migration no banco de
  produção e fica para quando o grupo não bastar.
