# AD-009 — A cor primária do app é o verde da Elite 3D, sobreposta ao design system

- **Status**: active
- **Date**: 2026-10-15
- **Scope**: `tailwind.config.ts`, `src/app/globals.css`, `src/test/marca.test.ts`.
- **Decided by**: o Lucas, ao ver o app rodando (o app antigo usava `--primary:#B9FF46`, `index.html:18–56`).

## Decisão

1. **A cor primária é o verde da Elite 3D** (`#B9FF46`, pressed `#9FE22F`), no lugar do azul STLFLIX
   do design system. A sobreposição mora em arquivo do projeto, depois do `@import` dos tokens:
   nunca na cópia (AD-008; `tokens.ts` e `tokens.css` seguem com o azul).
2. **`primary` e `primary-dark` viram `rgb(var(--primary-rgb) / <alpha-value>)`** no
   `tailwind.config.ts`, depois do spread de `tailwindColors`. O Tailwind 3.4 descarta em silêncio a
   utility com alpha sobre `var()` puro, e o DS usa `bg-primary/20`, `ring-primary/40` etc.
3. **Dois ajustes de contraste**, porque lima é cor de fundo e de realce, não de texto:
   - **Branco sobre lima** (`bg-primary text-white`: botão primário, badge, avatar, dia do
     calendário) mede 1,2:1. Regra de projeto `.bg-primary.text-white { color: #10141A }`, também no
     hover em `primary-dark`: 15,4:1 no lima e 11,8:1 no lima do hover.
   - **Lima sobre branco** (`text-primary`, `border-primary`, `ring-primary`, `outline-primary`, o
     contorno de foco e as séries de `TrendChart` por `var(--primary)`) mede 1,2:1 no tema claro. No
     claro essas utilities usam `#3F6212` (`--primary-ink-rgb`; 7,1:1 sobre `#fff`, 6,6:1 sobre o
     canvas `#f5f6f8`, 5,8:1 sobre `--selected`); no `.dark` usam o próprio lima (14,1:1 sobre
     `#1c1c1d`). `bg-primary` continua lima nos dois temas.
4. O `chartPalette` do DS (série 1 azul) fica como está.

## Por quê

- A marca do cliente é o verde; o azul era a marca da STLFLIX.
- Trocar só o hex deixaria botão e texto ilegíveis (WCAG AA pede 4,5:1 no texto).

## Consequências

- Voltar ao azul ou mudar o verde é editar `globals.css` (`--primary-*`): nenhum componente muda.
- O `TrendChart` ainda desenha as barras não selecionadas com `rgba(65,105,225,0.22)` literal, na
  cópia do DS. Fica azul-claro até a plataforma trocar por token.
- `src/test/marca.test.ts` trava o verde, o override do config e a regra do botão.
