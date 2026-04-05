# Phase Boundary Index

**Date:** 2026-04-03  
**Status:** Approved for repository documentation reconciliation

## Purpose

This document explains how to interpret `phase` plan/spec files against the
repository's actual delivery history.

In this repository, a phase document is the canonical record of intended scope.
A branch name, PR title, or merge commit is a delivery vehicle, not automatically
a perfect one-to-one representation of that phase's final scope.

This index exists to prevent future readers from assuming that every phase was
delivered through one cleanly isolated branch or one PR with the same name.

## Interpretation Rules

- `docs/superpowers/plans/*.md` define the intended implementation slice.
- `docs/superpowers/specs/*.md` define the design boundary for that slice.
- Branch names and PR titles are historical implementation containers and may be
  cumulative.
- When a branch or merge commit includes multiple adjacent slices, the phase
  plan/spec remains the canonical scope definition.
- We do not rewrite Git history solely to make phase naming look cleaner after
  the fact.
- When historical delivery containers are misleading enough to confuse future
  planning or handoff, we add a reconciliation document instead of renaming old
  history.

## Numbering Rules

- `phase8aa`, `phase8ab`, `phase8ac`, and `phase8ad` are continuation labels
  after `phase8z`, not child phases of `phase8a`.
- Within the current repository, `phase8` has 29 planned slices:
  `8a, 8b, 8c, 8d, 8f, 8g, 8h, 8i-8z, 8aa-8ad`.
- `phase8e` is currently an unused label. It is not treated as missing work
  unless a future document explicitly defines it.
- `phase9` lettering is sparse by historical authoring. Missing letters between
  `9a` and `9q` are currently unused labels, not implied lost phases.

## Boundary Status

| Phase | Planned Scope Source | Primary Delivery Vehicle | Boundary Status | Notes |
|------|----------------------|--------------------------|-----------------|-------|
| Foundation / V1 Foundation | `2026-03-25-medical-manuscript-system-v1-foundation.md` | merge `6adc467`, early mainline bootstrapping | Clean | Broad by design; not a naming problem. |
| Phase 2 | `2026-03-27-phase2-document-mainline-and-agent-skeleton.md` | delivered cumulatively before and inside merge `51fde95` | Cumulative, acceptable | No separate misleading Phase 2 merge vehicle to reconcile. |
| Phase 3 | `2026-03-28-phase3-governed-execution-and-learning-traceability.md` | delivered cumulatively before and inside merge `51fde95` | Cumulative, acceptable | Scope is still recoverable from plan/spec and commit content. |
| Phase 4 | `2026-03-28-phase4-agent-runtime-integration.md` | merge `51fde95` from `codex/phase4-agent-runtime-integration` | Reconcile needed | Merge vehicle also carries substantial Phase 2 and Phase 3 delivery. |
| Phase 5 | `2026-03-28-phase5-learning-governance-writeback-loop.md` | merge `06f8de8` from `codex/phase5-learning-governance` | Clean | Delivery vehicle aligns closely with planned scope. |
| Phase 6A | `2026-03-28-phase6a-evaluation-and-experiment-ops.md` | delivered cumulatively before and inside merge `e0f578b` | Cumulative, acceptable | Early cumulative delivery, but not a misleading standalone Phase 6A merge label. |
| Phase 7A | `2026-03-28-phase7a-knowledge-review-workbench-and-mini-program.md` | delivered cumulatively before and inside merge `e0f578b` | Cumulative, acceptable | Closely adjacent to 7B and carried in the same implementation window. |
| Phase 7B | `2026-03-28-phase7b-knowledge-review-web-workbench.md` | merge `e0f578b` from `codex/phase7b-knowledge-review-web` | Reconcile needed | Delivery vehicle includes Phase 6A, 7A, and 7B work. |
| Phase 8 family | `2026-03-30-phase8a...` through `2026-03-31-phase8z...` | merges `d61f8e1`, `b12d3ea`, plus adjacent topic merges | Reconcile needed | Historical delivery became an umbrella batch rather than one clean per-slice sequence. |
| Phase 9A | `2026-03-31-phase9a-persistent-verification-ops-http.md` | delivered during the broader Phase 8 umbrella window | Tracked under Phase 8 reconciliation | Not treated as an independent boundary anomaly; document under Phase 8. |
| Phase 9Q | `2026-04-03-phase9q-evaluation-sample-context-handoff.md` | PR #8 / merge `d06d0a6` | Clean | Focused scope, aligned branch naming. |
| Phase 9R | `2026-04-03-phase9r-runtime-binding-verification-linkage.md` | focused mainline delivery around commit `b9c26c3` | Clean | Narrow, traceable slice with aligned plan/spec/implementation. |
| Phase 9S | `2026-04-03-phase9s-governed-evaluation-run-seeding.md` | PR #9 / merge `91792a1` | Clean | Focused scope, aligned branch naming. |
| Phase 9T | `2026-04-03-phase9t-governed-run-check-execution.md` | PR #10 / merge `098d016` | Clean | Focused scope, aligned branch naming. |
| Phase 10A | `2026-04-03-phase10a-production-operations-baseline-design.md` | focused mainline delivery around the production-baseline rollout | Clean | Narrow operations baseline with clear repo-owned contract. |
| Phase 10B | `2026-04-03-phase10b-model-governance-routing-linkage-design.md` | focused mainline delivery around the routing-governance rollout | Clean | Focused governance slice with aligned README/runtime/docs. |
| Phase 10C | `2026-04-04-phase10c-evaluation-workbench-operations-depth-design.md` | focused mainline delivery around the evaluation-ops deepening rollout | Clean | Focused evaluation evidence slice, still read-only by design. |
| Phase 10D | `2026-04-04-phase10d-gold-set-and-harness-ops-design.md` | focused mainline delivery around the gold-set and harness dataset rollout | Clean | Distinct harness/governed-dataset lane; not a boundary anomaly. |
| Phase 10E | `2026-04-04-phase10e-retrieval-quality-harness-completion-design.md` | focused mainline delivery around retrieval-quality harness completion | Clean | Retrieval substrate and retrieval-quality evidence remain aligned. |
| Phase 10F | `2026-04-04-phase10f-local-first-harness-adapter-platform-design.md` | focused mainline delivery around harness adapter isolation | Clean | Optional adapter boundary landed as its own focused slice. |
| Phase 10G | `2026-04-04-phase10g-release-and-migration-reliability-hardening-design.md` | focused mainline delivery around release/migration hardening | Clean | Production-ops continuation with aligned manifest/migration scope. |
| Phase 10H | `2026-04-05-phase10h-secrets-contract-and-upgrade-rehearsal-guardrails-design.md` | focused mainline delivery around secrets/rehearsal guardrails | Clean | Narrow continuation of the production-ops lane. |
| Phase 10I | `2026-04-05-phase10i-privacy-evidence-and-academic-structure-baseline-design.md` plus adjacent `phase10i-*` plan/spec files | cumulative, acceptable | Intentional bounded sub-slicing under one worker-only advisory lane, not a naming problem. |
| Phase 10J | `2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md` | commit `19299dd` on `main` | Cumulative, acceptable | `10J-10M` landed together in one focused orchestration commit; per-phase plan/spec files remain the canonical scope split. |
| Phase 10K | `2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md` | commit `19299dd` on `main` | Cumulative, acceptable | Adjacent orchestration ownership guardrail landed in the same delivery container as `10J-10M`. |
| Phase 10L | `2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md` | commit `19299dd` on `main` | Cumulative, acceptable | Read-only inspection slice landed in the same focused delivery container as `10J-10M`. |
| Phase 10M | `2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md` | commit `19299dd` on `main` | Cumulative, acceptable | Focus-ordering slice shares the same orchestrator commit without creating scope ambiguity in the docs. |
| Phase 10N | `2026-04-05-phase10n-governed-orchestration-scoped-replay-design.md` | commit `3765e0a` on `main` | Clean | Returns to the one focused slice / one clear verification story pattern. |
| Phase 10O | `2026-04-05-phase10o-governed-orchestration-replay-budgeting-design.md` | focused mainline delivery around the replay-budgeting rollout | Clean | Continues the same execution/orchestration lane with one bounded CLI/service slice. |
| Phase 10P | `2026-04-05-phase10p-governed-orchestration-budgeted-replay-alignment-design.md` | focused mainline delivery around the budgeted-replay alignment rollout | Clean | Keeps the same lane and narrows behavior change to budgeted replay ordering only. |
| Phase 10Q | `2026-04-05-phase10q-boot-recovery-budget-guardrail-design.md` | focused mainline delivery around the boot-recovery budget rollout | Clean | Extends the same bounded replay semantics into startup wiring without adding a new control plane. |
| Phase 10R | `2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview-design.md` | focused mainline delivery around the budgeted dry-run preview rollout | Clean | Extends the same bounded replay semantics into the read-only inspection lane without adding new mutation authority. |
| Phase 10S | `2026-04-05-phase10s-governed-orchestration-readiness-windows-design.md` | focused mainline delivery around readiness-window inspection rollout | Clean | Deepens the same read-only inspection lane with explicit replay-readiness timing, without adding replay controls or mutation authority. |
| Phase 10T | `2026-04-05-phase10t-governed-orchestration-readiness-summary-rollup-design.md` | focused mainline delivery around readiness-summary inspection rollout | Clean | Adds a glanceable readiness rollup to the same read-only inspection lane without adding replay controls or mutation authority. |
| Phase 10U | `2026-04-05-phase10u-governed-orchestration-json-contract-stabilization-design.md` | focused mainline delivery around orchestration json-contract stabilization | Clean | Stabilizes machine-readable replay and dry-run output with additive metadata while keeping the same local read-only / replay semantics. |

## Practical Guidance For Future Work

- Treat `phase4`, `phase7b`, and `phase8` as the only historical phases that
  currently require explicit boundary reconciliation.
- Do not create separate reconciliation tracks for `phase2`, `phase3`,
  `phase6a`, `phase7a`, or `phase9a` unless later evidence shows that current
  documentation remains too ambiguous.
- Treat `10I` as intentionally sub-sliced but still boundary-clean, and treat
  `10J-10M` as one acceptable adjacent cumulative delivery cluster whose
  per-phase plan/spec files remain canonical.
- When creating future phases, prefer the Phase 9Q / 9R / 9S / 9T pattern: one
  design, one plan, one focused delivery slice, and one clear verification
  story. `10N`, `10O`, `10P`, `10Q`, `10R`, `10S`, `10T`, and `10U` are the current best Phase 10 examples of that pattern.

## Related Documents

- `2026-04-03-phase4-7b-8-boundary-reconciliation.md`
- `README.md`
- `docs/OPERATIONS.md`
