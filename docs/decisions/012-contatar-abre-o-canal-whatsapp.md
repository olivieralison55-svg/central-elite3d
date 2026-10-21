# AD-012 — "Contatar" abre a conversa no wa.me com o número do Canal WhatsApp

- **Status**: active
- **Date**: 2026-10-21
- **Scope**: lista "Mentorados sem sessão há +30 dias" do Dashboard e do Acompanhamento (`src/components/modules/dashboard/dashboard.tsx`), `linkWhatsapp` em `src/lib/links.ts`, coluna `mentorados.link_whatsapp`.

## Decisão

O "Canal WhatsApp" da aba Cadastro (`link_whatsapp`) guarda o **número** do mentorado.
Na lista "Mentorados sem sessão há +30 dias", o selo "Contatar" vira botão que abre
`https://wa.me/<número>` em aba nova. Sem "+", o número é do Brasil (DDD e número, com
ou sem máscara, 55 ou 0 na frente) e ganha o 55; com "+", já traz o DDI. Um link http(s)
gravado ali continua abrindo como está (SEC-05). Qualquer outro texto mantém o selo,
sem ação. "Nunca começou" não muda.

## Por quê

- A primeira versão, no mesmo dia, abria só o link do grupo gravado no campo, e nenhum
  botão apareceu: das 23 linhas da lista (lógica do painel sobre o snapshot de paridade
  de 2026-10-14, só contagens), 18 tinham o texto `link whats` e 5 estavam vazias. O
  Lucas decidiu que o campo passa a receber o número.
- Nenhuma das relações que o app lê (R01–R22) tem telefone; o `contact.phone` do
  `payload` da Lia aparece em 7 das 177 cobranças. Reusar a coluna evita migration no
  banco de produção, e o mentor também vê o botão (`link_whatsapp` está na view
  `mentorados_basic`, `20260916_email_do_mentorado.sql`).

## Trade-off

- O botão só aparece depois que alguém troca o `link whats` pelo número na ficha.
- Número de fora sem "+" não é reconhecido e fica com o selo. A troca para
  libphonenumber fica para quando isso acontecer.
- O nome "Canal WhatsApp" e a leitura da ficha, que mostra valor que não é link como
  texto com `*`, não mudaram.
