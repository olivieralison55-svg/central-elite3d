# PoC — middleware de codificação inválida (NAV-03, T9)

Pedida pelo design (componente 2) no começo da Fase 2: o `next start` local precisa responder
307 para `/dash` num endereço de ficha que não decodifica. Só códigos de saída, de status e o
caminho do `Location` (GATE-03).

- 2026-10-14 11:04 (-03), árvore de rascunho em `dbc3cc1` (`git worktree add --detach`, removida
  no fim com `git worktree remove --force`), Node 24.20.0, Next 15.5.21.
- Na árvore de rascunho: o `src/middleware.ts` da T9 e duas páginas descartáveis,
  `src/app/dash/page.tsx` e `src/app/mentorado/[id]/page.tsx`, que não entram na branch.

| comando | exit | resultado |
| ------- | ---- | --------- |
| `pnpm install --offline --frozen-lockfile` | 0 | — |
| `pnpm exec next build` | 0 | o relatório do build lista `ƒ Middleware` |
| `pnpm exec next start -p 4317` | 143 | encerrado pelo agente depois dos `curl` |
| `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' 'http://localhost:4317/mentorado/%E0%A4%A'` | 0 | 307, `Location` com caminho `/dash` |
| `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' 'http://localhost:4317/mentorado/abc-123'` | 0 | 200, a página descartável da ficha |
| `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:4317/dash'` | 0 | 200 |

Resultado: verde. O NAV-03 fica como está; o G3.8 confere de novo no preview da Vercel.
