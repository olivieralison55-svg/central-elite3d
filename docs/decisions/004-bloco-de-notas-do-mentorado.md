# AD-004 — Bloco de notas do mentorado em contenteditable, sem biblioteca de editor

- **Status**: active
- **Date**: 2026-10-13
- **Scope**: aba "Notas" da ficha (`index.html`: `abaNotas`, `carregarNota`, `salvarNota`, `notaCmd`, `atalhoNota`), tabela `mentorado_notas`.

## Decisão

Uma nota por mentorado, HTML livre numa linha de `mentorado_notas`. O editor é
`contenteditable` + `document.execCommand`, com barra (títulos, negrito, itálico,
sublinhado, tachado, código, listas, checklist, citação, divisor, link) e atalhos
de markdown no início do bloco (`# `, `## `, `### `, `- `, `1. `, `> `, `[] `,
```` ``` ````+Enter, `---`+Enter). Salva sozinho 1 s depois da última tecla.

## Por quê

- O app é um `index.html` sem build. Tiptap/Editor.js exigiriam bundler ou ESM de
  CDN fora da lista (cdnjs/jsdelivr com UMD). `execCommand` está obsoleto no papel,
  mas todo browser ainda o implementa e cobre exatamente esse conjunto.
- Uma página por mentorado (não várias notas) basta para o uso pedido; várias
  páginas por mentorado viram tabela com `id` quando alguém pedir.

## Particularidades

- **XSS**: o que um mentor grava, outro papel renderiza. Todo HTML passa pelo
  DOMPurify (cdnjs, 3.2.6) com allowlist de tags e só `href`/`class` — ao abrir,
  ao colar e ao salvar. Sem DOMPurify carregado, `limparNota` devolve vazio
  (falha fechada) em vez de HTML cru.
- **Concorrência**: quem salva por último vence. Duas pessoas na mesma nota ao
  mesmo tempo perdem a edição de uma. Teto aceito; subir para checagem por
  `atualizado_em` se acontecer.
- **Papéis**: admin e mentor escrevem (`escreverNotas`), diretoria lê. O limite
  real é o RLS da migration `20261013_mentorado_notas.sql`.
