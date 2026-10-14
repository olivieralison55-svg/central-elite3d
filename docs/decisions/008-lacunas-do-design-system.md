# AD-008 — Lacunas do design system: primitivo, composição ou arquivo novo, nunca cópia editada

- **Status**: active (o Lucas aprovou o `tasks.md` da migração em 14/10/2026).
- **Date**: 2026-10-14
- **Scope**: `src/components/ui/` (os primitivos novos), `src/components/modules/` (as composições),
  `src/design-system/snapshot.test.ts`.
- **Decided by**: o orquestrador, no Design da migração, pela opção mais segura dentro da spec (UI-06).
- **Detalhe**: `.specs/features/migracao-nextjs/design.md` (componente 8, "Primitivos novos e lacunas
  do DS"); `docs/planejamento/mapeamento-migracao-nextjs.md` §8.

## Decisão

1. **Nenhuma lacuna fecha editando arquivo copiado.** Cada lacuna do mapeamento §8 fecha com um
   primitivo que o design system já tem, com uma composição deles no módulo, ou com um primitivo
   genérico novo em `src/components/ui/`.
2. **Uma resolução por lacuna:**

| lacuna | resolução | arquivo |
|---|---|---|
| data única | `Input type="date"` do DS. O campo nativo devolve `AAAA-MM-DD`, o mesmo valor que o `dateField` grava hoje (`index.html:1028–1040`) | nenhum novo |
| mês | dois `Select` do DS, mês e ano, compostos no módulo, com valor `AAAA-MM`. `type="month"` foi descartado: fora do Chromium de desktop e dos navegadores mobile, ele cai em texto livre | `modules/rotas/campo-mes.tsx` |
| combobox | `Popover` + `SearchInput` + lista, filtrada por `casaBusca`. O mentorado só troca no clique ou no Enter | `modules/rotas/escolher-mentorado.tsx` |
| trilha de 12 segmentos | primitivo novo `SegmentedProgress`: um segmento por etapa, com tom e rótulo | `ui/segmented-progress.tsx` |
| paginação | primitivo novo `Pagination`: "Página X de Y" entre dois `Button` de ícone | `ui/pagination.tsx` |
| ordenação e clique de linha | primitivo novo `SortHeader` no `header` da coluna, com a ordem calculada por `aplicarOrdem` (`src/lib/ordem.ts`). O clique de linha é um `<Link>` na primeira célula | `ui/sort-header.tsx` |
| moeda BRL | `Input` do DS com `inputMode="decimal"`, `mascaraBRL` no `onChange` e `mascaraBRL(v, true)` no `onBlur` (`src/lib/moeda.ts`) | `modules/comum/campo-moeda.tsx` |

3. **Os primitivos novos são genéricos.** Nomes e props em inglês, sem domínio e só com tokens do
   design system, para poderem subir para a plataforma.

## Primitivos novos

O teste do `SNAPSHOT` (`src/design-system/snapshot.test.ts`) lê esta lista. Cada item aceita, fora
da cópia, o primitivo e o teste dele ao lado (`<nome>.test.tsx`). Seção ausente, lista vazia ou item
fora do formato `` - `src/components/ui/<nome>.tsx` `` reprova o teste.

- `src/components/ui/segmented-progress.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/sort-header.tsx`

## Por quê

- Arquivo copiado e editado à mão deixa de ser o design system da plataforma e trava a próxima cópia
  (AD-006, AD-007).
- O `DataTable` só desenha o ícone de `sortable` e não tem clique de linha nem paginação
  (`data-table.tsx:26`, `:351`). O `Progress` é uma barra só. O `DateRangeCalendar` só escolhe
  intervalo sobre dias com dado.
- O `NumberInput` apaga o ponto (`number-input.tsx:32`): "2000.50" colado viraria 200050, uma
  parcela 100 vezes maior.

## Consequências

- Arquivo em `src/components/ui/` fora do `SNAPSHOT` e fora desta lista reprova o teste do
  `SNAPSHOT`. Primitivo novo entra nesta lista no mesmo commit que o cria.
- Subir um primitivo para a plataforma é copiá-lo para lá. Quando ele voltar na próxima cópia, sai
  desta lista e ganha a linha `blob` dele no `SNAPSHOT`.
- Lacuna fora do mapeamento §8 pede emenda a este AD antes do código.
