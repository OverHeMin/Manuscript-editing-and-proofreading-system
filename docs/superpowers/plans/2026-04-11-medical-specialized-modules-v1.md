# Medical Specialized Modules V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the landed `general_proofreading_pack` foundation with `medical_specialized_modules` so the system can surface structured medical terminology drift, medical data consistency conflicts, statistical-expression issues, evidence-alignment suspicions, and ethics or privacy risks across `screening`, `editing`, and `proofreading`.

**Architecture:** Reuse the shared manuscript-quality contract, Python worker entrypoint, and API orchestration from the general plan, then add one medical analyzer layer plus module-specific routing and payload rendering. Keep V1 conservative: the medical layer produces structured findings and escalation signals, but it does not auto-write knowledge, auto-write rules, or auto-decide high-risk medical conclusions.

**Tech Stack:** TypeScript, Node `node:test`, `tsx`, Python 3.12, `pytest`, existing manuscript-quality foundation, existing governed module services.

---

## Scope Notes

- This plan implements:
  - [2026-04-11-medical-specialized-modules-v1-design.md](C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md)
- This plan depends on the shared foundation from:
  - [2026-04-11-general-proofreading-pack-v1.md](C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-11-general-proofreading-pack-v1.md)
- This plan does not recreate the shared contract, text normalization seam, or third-party adapter registry.
- V1 remains backend-only.
- No automatic knowledge write-back or rule write-back in this pass.

## Closeout Sync (2026-04-12)

- The V1 medical specialized layer is landed in the current repository state, and the design doc below has been synced with both V1 and the current bounded V1.5 table-aware slices.
- This checklist has been backfilled against the current workspace state rather than preserved red-green command history.
- The current implementation goes beyond the original minimum by adding conservative table-text consistency, pure-text count consistency, and comparison-direction slices while still staying advisory-only.
- Commit checkboxes remain intentionally open because this worktree also contains parallel Harness changes and is not yet isolated into quality-only commits.

## File Structure

### New files

- `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`
- `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- `apps/api/test/editing/editing-medical-quality.spec.ts`
- `apps/api/test/screening/screening-medical-quality.spec.ts`
- `apps/api/test/shared/medical-quality-fixture.ts`

### Modified files

- `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/editing/editing-service.ts`
- `apps/api/src/modules/screening/screening-service.ts`
- `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
- `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- `apps/api/test/editing/editing-medical-quality.spec.ts`
- `apps/api/test/screening/screening-medical-quality.spec.ts`
- `apps/api/test/modules/module-orchestration.spec.ts`
- `apps/worker-py/src/document_enhancement/privacy.py`
- `docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md`

## Test Commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-medical-quality.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-medical-quality.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/screening/screening-medical-quality.spec.ts`
- Worker focused:
  - `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py -q`
- Checkpoints:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-medical-quality.spec.ts ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts ./test/modules/module-orchestration.spec.ts`
  - `pnpm --filter @medical/api typecheck`
  - `pnpm typecheck`

---

### Task 1: Lock medical taxonomy and routing behavior in tests

**Files:**
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- Modify: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [x] Cover fixed medical issue categories in the focused manuscript-quality API suite:

```ts
const MEDICAL_ISSUE_TYPES = [
  "medical_terminology",
  "medical_data_consistency",
  "statistical_expression",
  "evidence_alignment",
  "ethics_privacy",
] as const;
```

- [x] Cover the rule that screening stays at least as conservative as editing for the same medical text.
- [x] Verify the focused manuscript-quality API suite passes in the current repository state.
- [x] Add the minimal local helper enums or constants for medical issue taxonomy.
- [x] Re-run the focused API test and confirm the taxonomy and routing behavior now pass in the current repository state.
- [ ] Commit with `git commit -m "test: lock medical specialized quality taxonomy"`.

### Task 2: Add the worker medical specialized analyzers

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- Modify: `apps/worker-py/src/document_enhancement/privacy.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`

- [x] Cover terminology drift and numeric inconsistency in focused worker tests.
- [x] Cover statistical expression, evidence alignment, privacy risk, and the current bounded table-aware slices in focused worker tests.
- [x] Verify the focused medical worker suite passes in the current repository state.
- [x] Implement conservative medical analyzers:

```py
issues.extend(check_medical_terminology_drift(normalized))
issues.extend(check_medical_numeric_consistency(normalized))
issues.extend(check_statistical_expression(normalized))
issues.extend(check_evidence_alignment(normalized))
issues.extend(check_privacy_ethics(normalized, privacy_advisory=build_privacy_advisory(text)))
```

- [x] Reuse the existing privacy heuristic helper instead of duplicating regex logic.
- [x] Re-run the focused worker test and confirm PASS.
- [ ] Commit with `git commit -m "feat: add medical specialized worker analyzers"`.

### Task 3: Extend API orchestration to run mixed general plus medical scopes

**Files:**
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- Modify: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [x] Cover mixed-scope orchestration on a medical manuscript in the focused API suite.
- [x] Verify the focused API suite passes with dual-scope orchestration in the current repository state.
- [x] Extend the service to request both scopes:

```ts
const requestedScopes = ["general_proofreading", "medical_specialized"] as const;
```

- [x] Keep degraded behavior conservative when the medical analyzer fails by returning a `manual_review` system issue.
- [x] Re-run the focused API test and confirm PASS.
- [ ] Commit with `git commit -m "feat: extend manuscript quality orchestration for medical scope"`.

### Task 4: Integrate medical findings into proofreading, editing, and screening

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Create: `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- Create: `apps/api/test/editing/editing-medical-quality.spec.ts`
- Create: `apps/api/test/screening/screening-medical-quality.spec.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`

- [x] Cover medical findings in proofreading draft payloads.
- [x] Cover the rule that terminology and statistics findings remain advisory in editing.
- [x] Cover reviewer-facing evidence-alignment and privacy escalation in screening.
- [x] Verify the focused proofreading, editing, and screening suites pass in the current repository state.
- [x] Extend proofreading payloads and reports to include medical findings.
- [x] Extend editing payloads to include medical findings without turning them into deterministic rewrites.
- [x] Extend screening payloads to include reviewer-facing escalation signals for non-`suggest_fix` medical issues.
- [x] Extend the orchestration test to prove governed execution still completes.
- [x] Re-run the focused module tests and confirm PASS.
- [ ] Commit with `git commit -m "feat: integrate medical specialized quality into module runs"`.

### Task 5: Run checkpoints and sync the approved design doc

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md`

- [x] Run `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py -q`.
- [x] Run the focused API checkpoint suite.
- [x] Run `pnpm --filter @medical/api typecheck` and `pnpm typecheck`.
- [x] Update the approved design doc with implementation status notes.
- [ ] Commit with `git commit -m "docs: sync medical specialized implementation status"`.

## Review Notes

- This plan assumes the shared manuscript-quality foundation from [2026-04-11-general-proofreading-pack-v1.md](C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-11-general-proofreading-pack-v1.md) is already landed.
- Do not let medical findings auto-decide high-risk research, statistical, or privacy conclusions.
- Do not add new third-party medical packages in this pass; first stabilize the repo-owned medical analyzer behavior.
