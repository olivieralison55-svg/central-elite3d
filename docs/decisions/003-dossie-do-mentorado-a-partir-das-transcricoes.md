# AD-003 — Dossiê do mentorado a partir das transcrições, com Jev de porteiro

- **Status**: active
- **Date**: 2026-10-13
- **Scope**: `supabase/functions/buscar-transcricoes` (busca diária no Drive, 06:00), `supabase/functions/sync-transcricoes` (processa a fila a cada 10 min), tabelas `transcricoes` e `mentorado_dossies`,
  workflow n8n `iK1jiqXLhD8JzmSV`. Substitui o plano em `docs/planejamento/transcricoes-calls-1-1.md`.

## Decisão

Cada call 1:1 gravada no Meet gera um doc "Anotações do Gemini" (resumo, próximos passos e
a transcrição completa abaixo de `📖 Transcrição`) na pasta do Drive
`1CK91GHbe-BI4OdZJ0hPTbxqeMD0uReKn`, compartilhada com a service account `@software`.
O sync lê esse doc e mantém **um dossiê vivo por mentorado** (`mentorado_dossies.documento`,
markdown pronto para prompt), com a seção "Última mentoria".

O texto passa por três portões, do mais barato ao mais caro:
1. **Triagem determinística:** sem transcrição, menos de 2.000 caracteres ou menos de dois falantes.
2. **Jev** (TypeSafe System One, `jev-latest`): `qualidade` (choice utilizavel/suja/incompleta) e
   `conteudo` (noul: há orientação de negócio). Passa com P(utilizavel) ≥ 0,7 e conteudo ≥ 0,5.
3. **Claude** (`claude-opus-5-5`): reescreve o dossiê e também pode rejeitar
   (call de outra pessoa, não é mentoria, sem orientação aproveitável).

Toda rejeição fica em `transcricoes.motivo`, com o veredito do Jev em `jev`.

## Por quê

- O Jev custa uma fração de uma chamada Opus e responde em ~2 s. Calibrado em 13/10/2026 com
  duas calls reais e três textos sujos: as calls deram 0,98 e 1,0 em `utilizavel`; a call
  cortada, o ruído de reconhecimento de fala e o texto embaralhado deram 0,0–0,04. A margem
  é larga, então o limiar 0,7 não é sensível.
- Diferente do analista de NPS (AD-001), aqui o Jev não precisa escrever nada: só decidir
  se vale gastar o Claude, que é exatamente o que ele faz bem.
- O texto da transcrição não vai para o banco: o dossiê é o produto, e o doc continua no Drive.

## Particularidades medidas

- O orçamento do Jev é 64k tokens por requisição; uma call de 1 h tem ~22k. O corte fica em 180k caracteres.
- Encontro em grupo (plantão, weekly) vira `grupo` sem passar por Jev nem Claude.
- O casamento é pelo e-mail na linha "convidado" do doc e, se não houver, pelo nome no título
  (a mesma regra do sync do Calendar). O nome vem do banco, então a comparação é por conjunto
  de palavras e não por regex: um nome com "(" derrubou a primeira rodada.
- Só entram calls dos **últimos 30 dias** (`JANELA_DIAS`): nem enfileira nem processa as mais
  antigas. Em 13/10/2026 a pasta tinha 347 docs desde março; ficaram 46. As 3 calls de março já
  processadas e seus dossiês foram apagados para o dossiê nascer só da janela.
- Ordem: a fila processa da call mais antiga para a mais nova, então a evolução é reconstruída
  em ordem. São 2 por rodada, a cada 10 min (~4 h para as 46).
