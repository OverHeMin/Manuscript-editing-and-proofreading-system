# Proofreading Quality Control Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Use superpowers:test-driven-development before any production code change. Do not execute later phases until the current slice has tests and evidence.

**Goal:** Make the medical proofreading workflow demonstrably controllable end-to-end: context-aware proofreading, rule/knowledge/residual provenance, Harness content gates, human confirmation reconciliation, final `human_final_docx` delivery, table safety evidence, and multi-manuscript real acceptance.

**Architecture:** Deliver this as staged, evidence-first slices. The first slice is API-only and adds structured quality evidence to proofreading payloads without changing the AI execution path. Later slices add Harness gates, UI, table robustness, and real manuscript acceptance. Every claim must be backed by machine-readable JSON, markdown reports, raw payloads, screenshots where UI is involved, and explicit residual-risk boundaries.

**Tech Stack:** TypeScript API (`apps/api`), React web (`apps/web`), Python document pipeline (`apps/worker-py`), PostgreSQL persistent runtime, LibreOffice conversion, real model provider routing.

---

## Non-Negotiable Scope Rules

- Do not claim universal AI proofreading accuracy. Reports must say results are bounded by the tested model, manuscripts, gold set, rules, knowledge, and manual review sample.
- Do not bypass item-level human confirmation. Final deliverables must be reconciled against confirmation decisions.
- Treat `human_final_docx` as the formal final handoff artifact. `final_proof_annotated_docx` is an intermediate/finalize artifact unless explicitly published as human final.
- Keep residual/free-play and residual learning inside the proofreading loop. Do not expand residual learning into editing unless a separate plan is approved.
- Keep complex table work conservative: parse, preserve, report confidence, and escalate low-confidence cases. Do not silently rebuild complex medical tables when confidence is low.
- Do not hide failures. Every real acceptance run must record failed steps and residual risks.

## Real Manuscript Acceptance Matrix

Use these manuscripts unless the user adds or removes files:

| ID | Expected Format | Required Checks |
| --- | --- | --- |
| `SZX250905001` | `.docx` | normalized asset materialized, source blocks, table blocks, proofreading, confirmation, final/human final |
| `SZX250917007` | `.doc` | auto `.doc -> normalized_docx`, conversion log, source blocks, proofreading, confirmation, final/human final |
| `SZX250926002` | `.docx` | table extraction, normalized asset, proofreading, confirmation, final/human final |
| `SZX250928002` | `.docx` | oncology terminology/consistency, normalized asset, proofreading, confirmation, final/human final |
| `SZX250910004` | `.doc` | auto `.doc -> normalized_docx`, conversion log, table blocks, proofreading, confirmation, final/human final |

Each manuscript run must output: input path, SHA-256 hash, upload asset id, normalized asset id, source block count, table block count, model/provider id, rule set id, knowledge ids, skill package ids, issue counts by layer/source, pass run ids, confirmation decisions, final asset id, human final asset id if published, download signatures, and failure details.

---

# Slice 1: API Quality Evidence MVP

**Purpose:** Create reliable, low-risk payload evidence before changing gates or UI. This addresses AI provenance, context segmentation confidence, residual free-play observability, and issue quality summaries.

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-issue-contract.ts` only if new issue source enums are needed.
- Test: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-ai-plan-service.spec.ts`

## Task 1.1: Issue Provenance and Quality Summary

- [ ] Write a failing test proving draft job payload contains `issueQualitySummary` with:
  - `totalIssueCount`
  - `actionableIssueCount`
  - `highRiskIssueCount`
  - `duplicateCandidateCount`
  - `bySource.rule`
  - `bySource.knowledge`
  - `bySource.residual`
  - `bySource.model`
  - `unattributedIssueCount`
- [ ] Write a failing test proving each issue used in the summary is classified without mutating existing issue content.
- [ ] Implement a deterministic summary builder from `proofreadingPlan.issues`, `proofreadingDeepPassRuns`, and existing findings.
- [ ] Verify targeted tests pass.

## Task 1.2: Residual Free-Play Summary

- [ ] Write a failing test proving draft payload contains `residualFreePlaySummary` with:
  - `enabled`
  - `passKind=residual_synthesis`
  - `residualOnlyIssueCount`
  - `deduplicatedResidualIssueCount`
  - `requiresHumanSampling`
  - `limitations`
- [ ] Write a failing test proving residual/free-play issues are not counted as rule/knowledge hits unless explicit IDs exist.
- [ ] Implement summary extraction from the residual synthesis pass.
- [ ] Verify targeted tests pass.

## Task 1.3: Context Consistency Evidence Layer

- [ ] Write a failing test proving draft payload contains `contextConsistencyLayer` with checks for:
  - terminology consistency
  - sample size consistency
  - group consistency
  - time point consistency
  - unit consistency
  - table-text consistency
  - reference citation consistency
  - conclusion support consistency
- [ ] Write a failing test proving long/segmented manuscripts include block anchors:
  - `sourceBlockCount`
  - `tableBlockCount`
  - `neighborWindowSize`
  - `wholeDocumentAnchorCount`
  - `crossBlockCheckCount`
  - `limitations`
- [ ] Implement a deterministic context layer builder. It should add evidence and limitations; it should not pretend to fully solve semantic consistency.
- [ ] Add the layer to `proofreadingLayerMatrix` as `context_consistency` with evidence, without changing existing AI pass execution.
- [ ] Verify targeted tests pass.

## Task 1.4: Real Model Evidence Report

- [ ] Add a script or acceptance helper that fails if the selected route is mock/in-memory-only when running real acceptance.
- [ ] Generate `REAL_MODEL_PROOFREADING_ACCEPTANCE.json` and `.md` containing provider, model id, route source, input file hash, draft job id, pass run ids, issue counts, source/table block counts, elapsed time, and raw payload path.
- [ ] Run once against one real manuscript after Tasks 1.1-1.3.

**Slice 1 Verification:**
- `cd apps/api && pnpm.cmd exec tsc -p tsconfig.json --noEmit`
- `cd apps/api && pnpm.cmd exec tsx --test test/proofreading/proofreading-bare-run.spec.ts`
- `cd apps/api && pnpm.cmd exec tsx --test test/proofreading/proofreading-ai-plan-service.spec.ts`
- One real draft run with `REAL_MODEL_PROOFREADING_ACCEPTANCE.md/json`.

---

# Slice 2: Harness Report-Only Content Gates

**Purpose:** Make Harness measure content quality before enforcing hard blocking. This avoids breaking normal proofreading when gold sets are incomplete.

**Files:**
- Modify: `apps/api/src/modules/harness-datasets/gold-set-assertion-runner.ts`
- Modify: `apps/api/src/modules/harness-datasets/index.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Test: `apps/api/test/harness-datasets/harness-dataset-service.spec.ts`
- Test: `apps/api/test/http/workbench-http.spec.ts`

## Task 2.1: Gate Metrics Schema

- [ ] Add failing tests for `harnessQualityReport` containing:
  - gold set family/version ids
  - case count
  - assertion count
  - recall
  - false positive count
  - false negative / missed expected count
  - rule hit coverage
  - knowledge hit coverage
  - residual coverage
  - required layer coverage
  - manual review sampling requirement
  - limitations and residual risks
- [ ] Implement report-only metrics in gold set assertion evaluation.
- [ ] Ensure reports explicitly state they do not represent universal manuscript accuracy.

## Task 2.2: Finalize Gate Dry Run

- [ ] Add failing tests proving finalize payload/report can include gate status without blocking when enforcement is disabled.
- [ ] Add an enforcement switch for published required gold sets only.
- [ ] Add failing tests proving hard blocking only occurs when the switch is enabled and required published gates fail.
- [ ] Verify existing finalize tests still pass.

## Task 2.3: Harness Evidence Report

- [ ] Generate `HARNESS_CONTENT_GATE_REPORT.md/json` containing thresholds, actual metrics, failed cases, blocked/not-blocked status, and rerun id.

**Slice 2 Verification:**
- `cd apps/api && pnpm.cmd exec tsx --test test/harness-datasets/harness-dataset-service.spec.ts`
- `cd apps/api && pnpm.cmd exec tsx --test test/http/workbench-http.spec.ts --test-name-pattern "proofreading|harness"`

---

# Slice 3: Human Confirmation and Final Artifact Reconciliation

**Purpose:** Prove item-level confirmation controls final output and that `human_final_docx` is the formal deliverable.

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/web/src/features/manuscript-workbench/*`
- Test: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`

## Task 3.1: Confirmation Decision Authority

- [ ] Add failing tests for accepted, rejected, accepted-with-edit, route-to-rule, route-to-knowledge decisions.
- [ ] Add failing tests proving final/human final payload contains `confirmationReconciliation` mapping `issueId -> decision -> final action`.
- [ ] Ensure direct final publication without confirmation evidence is reported as a risk or blocked according to policy.

## Task 3.2: Human Final Artifact

- [ ] Add failing tests proving `publishHumanFinal` creates `human_final_docx` and advances export selection.
- [ ] Generate `FINAL_ARTIFACT_RECONCILIATION_REPORT.md/json` with draft asset id, confirmation decisions, final asset id, human final asset id, download signatures, and decision-to-change mapping.

## Task 3.3: Frontend Confirmation Screenshots

- [ ] Fix web env/CORS if persistent API returns `Failed to fetch`.
- [ ] Capture screenshots for login, manuscript detail, issue list, accept, reject, edit, batch confirmation, confirmation history, final output/human final.
- [ ] Store screenshots under `.codex-qa-logs/deepseek-proofreading/screenshots/`.

---

# Slice 4: Gold Set Management UX

**Purpose:** Make gold sets maintainable by humans in internal testing.

**Files:**
- Modify: `apps/web/src/features/harness-datasets/*`
- Modify: API harness routes only if missing endpoints block the UX.
- Test: `apps/web/test/harness-datasets-workbench-page.spec.tsx`
- Test: `apps/api/test/http/workbench-http.spec.ts`

## Tasks

- [ ] Add UX for family → version → cases → assertions → publish.
- [ ] Add import/export for cases and expected issues.
- [ ] Add validation for missing source assets, empty assertions, unpublished rubrics.
- [ ] Add screenshots and a short operator guide.

---

# Slice 5: Rule/Knowledge Authoring and Multi-User Intake

**Purpose:** Safely support multiple internal contributors entering rules and knowledge.

**Files:**
- Modify: `apps/web/src/features/template-governance/*`
- Modify: knowledge web/API files only where conflict or audit checks are missing.
- Test: rule/knowledge web and HTTP specs.

## Tasks

- [ ] Continue reducing repeated/low-value rule center cards.
- [ ] Add clearer save/publish/review status in authoring flows.
- [ ] Add or verify optimistic concurrency/version conflict behavior.
- [ ] Add two/three-user E2E evidence covering concurrent edit conflict, insufficient permission, reviewer publish, audit log, and final ownership.
- [ ] Generate `MULTI_USER_AUTHORING_ACCEPTANCE.md/json`.

---

# Slice 6: Complex Table Safety and Reconstruction Evidence

**Purpose:** Improve table reliability without pretending all complex tables can be safely auto-rebuilt.

**Files:**
- Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
- Modify: `apps/worker-py/src/document_pipeline/normalize.py`
- Modify: API document-pipeline files only if needed to expose confidence/evidence.
- Test: `apps/worker-py/tests/document_pipeline/test_table_patches.py`
- Test: document-pipeline API specs if metadata is exposed.

## Tasks

- [ ] Add fixtures for merged cells, multi-header tables, footnotes, units, P values, and cross-page-like rows.
- [ ] Add failing tests for grid preservation, annotations, and confidence scoring.
- [ ] Implement conservative reconstruction with low-confidence escalation.
- [ ] Generate per-table evidence: original screenshot or structure JSON, parsed structure JSON, rebuilt docx/HTML evidence, confidence, escalation reason.
- [ ] Generate `COMPLEX_TABLE_ACCEPTANCE_REPORT.md/json`.

---

# Slice 7: DOC Normalization Evidence Hardening

**Purpose:** Keep `.doc -> .docx` automatic conversion proven and auditable.

**Files:**
- Modify: `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- Modify: normalization tests only if extra metadata is missing.

## Tasks

- [ ] Record LibreOffice binary/version when available.
- [ ] Record conversion command, stdout/stderr summary, source hash, normalized hash, output path, and failure status.
- [ ] Add failure-mode tests for missing LibreOffice, corrupt `.doc`, and unsupported document objects where feasible.
- [ ] Generate `DOC_NORMALIZATION_AUDIT_REPORT.md/json`.

---

# Slice 8: Multi-Manuscript Real Acceptance

**Purpose:** Prove repeatability across the full user-provided manuscript set.

**Artifacts:**
- Create: `.codex-qa-logs/deepseek-proofreading/MULTI_MANUSCRIPT_ACCEPTANCE_REPORT.md`
- Create: `.codex-qa-logs/deepseek-proofreading/multi-manuscript-acceptance.json`
- Store raw payloads and screenshots in subdirectories.

## Tasks

- [ ] For each manuscript in the matrix, upload original file and record hash.
- [ ] Verify normalization and conversion evidence.
- [ ] Run proofreading draft with real model route; fail if mock route is detected.
- [ ] Save raw job payload, pass run payloads, model/provider evidence, rule/knowledge/skill IDs.
- [ ] Save `issueQualitySummary`, `residualFreePlaySummary`, `contextConsistencyLayer`, `harnessQualityReport` if present.
- [ ] Save confirmation draft decisions and final/human final assets.
- [ ] Download final artifacts and verify signatures.
- [ ] Summarize pass/fail per manuscript and residual risks.

---

## Recommended Execution Order

1. Slice 1: API Quality Evidence MVP.
2. Slice 2: Harness report-only gates.
3. Slice 3: confirmation/human final reconciliation.
4. Slice 7: `.doc` normalization audit hardening.
5. Slice 8: multi-manuscript real acceptance baseline.
6. Slice 4: Gold Set UX.
7. Slice 6: complex table safety.
8. Slice 5: multi-user rule/knowledge authoring.

This order prioritizes the user’s core concern: “AI校对能不能正常校、分块上下文能不能控制、Harness 能不能把质量管住、最终能不能人工确认并生成终稿”。

## Global Verification Commands

- `cd apps/api && pnpm.cmd exec tsc -p tsconfig.json --noEmit`
- `cd apps/api && pnpm.cmd exec tsx --test test/proofreading/proofreading-bare-run.spec.ts`
- `cd apps/api && pnpm.cmd exec tsx --test test/proofreading/proofreading-ai-plan-service.spec.ts`
- `cd apps/api && pnpm.cmd exec tsx --test test/harness-datasets/harness-dataset-service.spec.ts`
- `cd apps/api && pnpm.cmd exec tsx --test test/http/workbench-http.spec.ts`
- `cd apps/web && pnpm.cmd exec vitest run test/manuscript-workbench-detail.spec.tsx test/harness-datasets-workbench-page.spec.tsx`
- `python -m pytest apps/worker-py/tests/document_pipeline/test_normalize.py apps/worker-py/tests/document_pipeline/test_table_patches.py -q`

## Completion Standard

A slice is not complete unless:

- Its red tests failed before implementation.
- Its green tests pass after implementation.
- It emits machine-readable JSON evidence when required.
- It emits markdown evidence when required.
- It lists residual risks and non-guaranteed boundaries.
- It does not claim broader guarantees than the evidence supports.
