# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a failed read must show an error, test it with the failed relation returning zero rows: a fixture that keeps rows populated lets 'error only if data exists' survive.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `src/components/modules` · harmful: 0
- features: migracao-nextjs
- evidence: sensor9 m8 src/components/modules/financeiro/financeiro.tsx:280 (src/components/modules)
- last seen: 2026-10-15T11:17:13Z

### L-002 - Keep tasks.md Test count lines equal to the measured count of each task commit; estimates left in place fail G1.2 and the final-count check at verification.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `.specs` · harmful: 0
- features: migracao-nextjs
- evidence: validation.md Fix 1 (G1.2) (.specs)
- last seen: 2026-10-15T11:17:13Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
