# General Proofreading Pack V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-first `general_proofreading_pack` that handles punctuation, layout, lexical candidates, consistency, compliance, and logic-suspicion checks for all manuscript types, then feeds structured findings into the existing governed `screening` / `editing` / `proofreading` modules.

**Architecture:** Land the general layer first because it provides the shared issue contract, text normalization, Python worker seam, and API orchestration that later medical analyzers will reuse. Keep V1 backend-only, preserve existing knowledge and rule governance authority, and treat optional third-party packages as advisory adapters behind explicit enablement.

**Tech Stack:** TypeScript, Node `node:test`, `tsx`, Python 3.12, `pytest`, existing DOCX/document-structure pipeline, existing governed module services.

---

## Scope Notes

- This plan implements:
  - [2026-04-11-general-proofreading-pack-v1-design.md](C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md)
- This plan is the prerequisite foundation for:
  - [2026-04-11-medical-specialized-modules-v1.md](C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-11-medical-specialized-modules-v1.md)
- V1 is backend-only.
- No automatic knowledge write-back or rule write-back in this pass.
- No web workbench expansion in this pass.

## Closeout Sync (2026-04-12)

- The V1 general proofreading baseline is landed in the current repository state.
- This checklist has been backfilled against the current workspace state rather than preserved red-green command history.
- The originally planned standalone `proofreading-general-quality.spec.ts`, `editing-general-quality.spec.ts`, and `screening-general-quality.spec.ts` were consolidated into existing manuscript-quality and module integration coverage instead of being kept as separate files.
- Commit checkboxes remain intentionally open because this worktree also contains parallel Harness changes and is not yet isolated into quality-only commits.

## File Structure

### New files

- `packages/contracts/src/manuscript-quality.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- `apps/api/src/modules/manuscript-quality/index.ts`
- `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
- `apps/worker-py/src/manuscript_quality/contracts.py`
- `apps/worker-py/src/manuscript_quality/text_normalization.py`
- `apps/worker-py/src/manuscript_quality/general_proofreading.py`
- `apps/worker-py/src/manuscript_quality/adapter_registry.py`
- `apps/worker-py/src/manuscript_quality/run_quality_checks.py`
- `apps/worker-py/src/manuscript_quality/__init__.py`
- `apps/worker-py/tests/manuscript_quality/test_text_normalization.py`
- `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`
- `apps/worker-py/tests/manuscript_quality/test_adapter_registry.py`

### Modified files

- `packages/contracts/src/governed-execution.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- `apps/api/src/modules/editorial-execution/types.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/editing/editing-service.ts`
- `apps/api/src/modules/screening/screening-service.ts`
- `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- `apps/api/test/modules/module-orchestration.spec.ts`
- `docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md`

## Test Commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-report.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts`
- Worker focused:
  - `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_text_normalization.py ./tests/manuscript_quality/test_general_proofreading.py ./tests/manuscript_quality/test_adapter_registry.py -q`
- Checkpoints:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-report.spec.ts ./test/modules/module-orchestration.spec.ts`
  - `pnpm --filter @medical/api typecheck`
  - `pnpm typecheck`

---

### Task 1: Lock the shared quality contract and summary shape

**Files:**
- Create: `packages/contracts/src/manuscript-quality.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Test: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [x] Cover the unified general-quality issue contract in `./test/manuscript-quality/manuscript-quality-service.spec.ts`.
- [x] Verify the focused manuscript-quality contract suite passes in the current repository state.
- [x] Add the minimal shared contract surface:

```ts
export type ManuscriptQualityScope = "general_proofreading" | "medical_specialized";
export type ManuscriptQualityAction = "auto_fix" | "suggest_fix" | "manual_review" | "block";
```

- [x] Extend execution snapshots with optional finding summaries, not authority-changing decisions.
- [x] Re-run the focused test and confirm the contract behavior now passes in the current repository state.
- [ ] Commit with `git commit -m "feat: add general proofreading quality contracts"`.

### Task 2: Build text normalization and general proofreading analyzers

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/contracts.py`
- Create: `apps/worker-py/src/manuscript_quality/text_normalization.py`
- Create: `apps/worker-py/src/manuscript_quality/general_proofreading.py`
- Create: `apps/worker-py/src/manuscript_quality/__init__.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_text_normalization.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`

- [x] Cover sentence and paragraph slicing stability in worker tests.
- [x] Cover punctuation, consistency, compliance, and logic suspicion findings in worker tests.
- [x] Verify the focused worker normalization suite passes in the current repository state.
- [x] Implement the minimal normalization seam:

```py
paragraphs = build_paragraph_blocks(blocks)
sentences = split_sentences(paragraphs)
```

- [x] Implement deterministic general analyzers:

```py
issues.extend(check_punctuation_layout(normalized))
issues.extend(check_lexical_candidates(normalized))
issues.extend(check_basic_consistency(normalized))
issues.extend(check_compliance_markers(normalized))
issues.extend(check_logic_suspicions(normalized))
```

- [x] Re-run the worker tests and confirm PASS.
- [ ] Commit with `git commit -m "feat: add general proofreading worker analyzers"`.

### Task 3: Add the API worker adapter and general orchestration service

**Files:**
- Create: `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- Create: `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- Create: `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- Create: `apps/api/src/modules/manuscript-quality/index.ts`
- Test: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [x] Cover degraded worker execution in the manuscript-quality service test suite.
- [x] Verify the focused API suite passes with degraded worker fallback behavior.
- [x] Implement the Python worker adapter with the repo’s existing spawn-and-JSON pattern.
- [x] Implement general-only orchestration first:

```ts
const requestedScopes: Array<"general_proofreading"> = ["general_proofreading"];
```

- [x] Normalize worker failure into one conservative `manual_review` system issue.
- [x] Re-run the focused API test and confirm PASS.
- [ ] Commit with `git commit -m "feat: add general proofreading api orchestration"`.

### Task 4: Integrate the general layer into proofreading

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`

- [x] Cover proofreading draft quality reporting through the shared manuscript-quality suite and `proofreading-rule-report.spec.ts`.
- [x] Extend the report test to require a `## Quality Findings` section.
- [x] Verify focused proofreading quality reporting passes in the current repository state.
- [x] Inject the quality service into proofreading draft generation.
- [x] Merge findings into the payload and report rendering without changing final-confirm semantics.
- [x] Re-run the proofreading tests and confirm PASS.
- [ ] Commit with `git commit -m "feat: integrate general proofreading into proofreading"`.

### Task 5: Integrate general findings into editing and screening

**Files:**
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`

- [x] Cover suggestion-focused editing findings and conservative screening escalation in focused module integration tests.
- [x] Cover screening compliance escalation in focused module integration tests.
- [x] Verify focused editing and screening quality coverage passes in the current repository state.
- [x] Inject scoped general findings into editing and screening as advisory evidence.
- [x] Extend the orchestration test to prove governed execution still completes.
- [x] Re-run the focused module tests and confirm PASS.
- [ ] Commit with `git commit -m "feat: integrate general proofreading into editing and screening"`.

### Task 6: Add the disabled-by-default third-party adapter seam

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/adapter_registry.py`
- Create: `apps/worker-py/src/manuscript_quality/run_quality_checks.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_adapter_registry.py`

- [x] Cover disabled-by-default adapter behavior in focused worker tests.
- [x] Cover the advisory-only constraint for external adapters in focused worker tests.
- [x] Verify the focused adapter-registry suite passes in the current repository state.
- [x] Implement the adapter registry so unconfigured tools return metadata only.
- [x] Implement the worker CLI entrypoint used by the API adapter.
- [x] Re-run the adapter tests and confirm PASS.
- [ ] Commit with `git commit -m "feat: add general proofreading adapter seam"`.

### Task 7: Run checkpoints and sync the approved design doc

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md`

- [x] Run the worker checkpoint suite.
- [x] Run the focused API checkpoint suite.
- [x] Run `pnpm --filter @medical/api typecheck` and `pnpm typecheck`.
- [x] Update the approved design doc with implementation status notes.
- [ ] Commit with `git commit -m "docs: sync general proofreading implementation status"`.

## Review Notes

- This plan intentionally excludes medical terminology, medical data consistency, statistical expression, evidence alignment, and privacy-specific medical routing. Those belong in [2026-04-11-medical-specialized-modules-v1.md](C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-11-medical-specialized-modules-v1.md).
- If implementation pressure gets high, Task 6 can be deferred without breaking the V1 baseline.
- Do not let optional adapters bypass the fixed action ladder: `auto_fix`, `suggest_fix`, `manual_review`, `block`.
