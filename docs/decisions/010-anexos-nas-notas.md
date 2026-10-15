# AD-010 — Imagens e documentos nas notas do mentorado, num bucket privado, citados como `anexo:`

- **Status**: active
- **Date**: 2026-10-15
- **Scope**: `supabase/migrations/20261015_notas_anexos.sql`,
  `supabase/migrations/20261015b_notas_anexos_excluir.sql`, `src/lib/data/escritas.ts`
  (`enviarAnexo`, `removerAnexo`), `src/lib/data/leituras.ts` (`linksAssinados`), `src/lib/notas.ts`,
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
5. **Excluir apaga o arquivo e as citações dele; sem update** (emenda de 15/10/2026, pedido do
   Lucas). A lista "Anexos" abaixo do editor mostra cada imagem e documento citado, com Abrir e,
   para quem escreve as notas, Excluir. Excluir pede confirmação (`ConfirmDialog`), apaga o objeto
   do bucket (`removerAnexo`, escrita W22) e só então tira da nota todo `img`/`a` daquele caminho e
   grava. Se o Storage recusar, nada sai da nota. Apagar só o trecho no editor continua não
   apagando o arquivo. O upload não sobrescreve (`upsert: false`).
6. **Quem lê e quem envia.** Lê quem lê as notas (admin, diretoria, mentor), pelo RLS de `select` em
   `storage.objects`; envia e apaga quem escreve as notas (admin, mentor; `escreverNotas`), pelo
   RLS de `insert` e pelo de `delete` (`notas_anexos_delete`, migration `20261015b`). A diretoria
   não vê os botões de Imagem, Anexo e Excluir.

## Por quê

- Bucket público deixaria qualquer um com o link abrir o documento de um mentorado para sempre.
- URL assinada no HTML expira em 1 h: a nota salva com ela perderia a imagem no dia seguinte. O
  `anexo:` é estável, e o sanitizador aceita `img` só com ele: imagem externa, `data:` e pixel de
  rastreio colados saem (THREAT-07).

## Consequências

- O arquivo tirado da nota sem o Excluir (apagando o trecho no editor) fica órfão no bucket. Limpeza, se um dia pesar, é job à parte que cruza
  `storage.objects` com o `anexo:` das notas.
- Nota aberta por mais de 1 h mostra imagem quebrada até reabrir.
- Quem copia o link assinado de um documento o repassa por até 1 h, ou até o anexo ser excluído.
- O mesmo arquivo citado em outra nota (link colado de uma nota na outra) some das duas ao ser
  excluído: a lista só tira as citações da nota aberta, e a outra fica com o link quebrado.
