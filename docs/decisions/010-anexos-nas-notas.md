# AD-010 — Imagens e documentos nas notas do mentorado, num bucket privado, citados como `anexo:`

- **Status**: active
- **Date**: 2026-10-15
- **Scope**: `supabase/migrations/20261015_notas_anexos.sql`, `src/lib/data/escritas.ts`
  (`enviarAnexo`), `src/lib/data/leituras.ts` (`linksAssinados`), `src/lib/notas.ts`,
  `src/components/modules/ficha/editor-notas.tsx`, `src/app/marca.css`.
- **Decided by**: o Lucas (produto); o desenho, pelo orquestrador. Estende o AD-004.

## Decisão

1. **Bucket privado `notas-anexos`.** O objeto mora em `<mentorado_id>/<uuid>-<nome-saneado>`
   (minúsculo, sem acento, só `[a-z0-9._-]`, até 80 caracteres), com 10 MB de limite e só PNG, JPEG,
   WEBP, GIF, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT e CSV. O cliente confere tamanho e tipo antes de
   enviar (o toast diz por quê); o bucket confere de novo.
2. **O HTML gravado cita o anexo, nunca a URL.** Imagem: `<img src="anexo:<caminho>" alt="<nome>">`;
   documento: `<a href="anexo:<caminho>" class="anexo"><nome></a>`. Ao exibir, o editor troca no DOM
   cada `anexo:` pela URL assinada; antes de salvar, `canonizarAnexos` volta a URL assinada do bucket
   para `anexo:`, e só então o sanitizador roda.
3. **A URL assinada vale 1 h** (`createSignedUrls(…, 3600)`), pedida a cada abertura da nota.
4. **Sem SVG.** SVG é documento com script: aberto pelo link assinado, rodaria na origem do Storage.
5. **Sem delete nem update.** Tirar o anexo da nota não apaga o arquivo, e o upload não sobrescreve
   (`upsert: false`).
6. **Quem lê e quem envia.** Lê quem lê as notas (admin, diretoria, mentor), pelo RLS de `select` em
   `storage.objects`; envia quem escreve as notas (admin, mentor; `escreverNotas`), pelo de `insert`.
   A diretoria não vê os botões de Imagem e Anexo.

## Por quê

- Bucket público deixaria qualquer um com o link abrir o documento de um mentorado para sempre.
- URL assinada no HTML expira em 1 h: a nota salva com ela perderia a imagem no dia seguinte. O
  `anexo:` é estável, e o sanitizador aceita `img` só com ele: imagem externa, `data:` e pixel de
  rastreio colados saem (THREAT-07).

## Consequências

- O arquivo tirado da nota fica órfão no bucket. Limpeza, se um dia pesar, é job à parte que cruza
  `storage.objects` com o `anexo:` das notas.
- Nota aberta por mais de 1 h mostra imagem quebrada até reabrir.
- Quem copia o link assinado de um documento o repassa por até 1 h.
