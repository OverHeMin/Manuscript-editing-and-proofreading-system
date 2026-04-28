# Deep Proofreading Orchestrator Final Implementation Plan

> **Status:** Final plan after subagent feasibility review. This supersedes `docs/superpowers/plans/2026-04-28-deep-proofreading-orchestrator.md` for execution order and risk controls.
>
> **Execution rule:** Do not start implementation until the user explicitly says “开工”. Current code changes must be preserved unless the user explicitly asks to revert them.

**Goal:** Build a proofreading-only deep proofreading pipeline that handles large rule/knowledge libraries through semantic pre-analysis, fact ledger, intent slices, scoped retrieval, rule activation, knowledge budgeting, deterministic table/data checks, AI passes, deduplicated issue cards, and read-only evidence UI.

**Architecture:** Keep the existing governed proofreading context and human workflow. Only `proofreading_draft_run` uses the new orchestrator by default; bare runs, confirmation, OnlyOffice review, and `human_final_docx` publication stay on the existing path. Non-AI diagnostic stages are stored in job payload/context evidence, not as new database `proofreading_pass_runs` kinds.

**Tech stack:** TypeScript API modules, Python DOCX worker, existing document-pipeline table semantics, existing knowledge retrieval index, existing mainline AI executor, React workbench, Node/Python test suites.

---

## Review Result

Subagent review conclusion: **目标可实现，但原计划不可直接执行。**

### Blocking Corrections

1. **Table fidelity TS gap must be first.** Python fields `display_text`, `normalized_text`, `raw_xml_text`, `style_runs` must be added to API types and adapter before typecheck can pass.
2. **Do not fake vector retrieval.** Current `KnowledgeRetrievalService.rankIndexEntriesForContext` is deterministic context ranking, not vector similarity. The final implementation must label it as `context_rank` unless a real query embedding/vector scorer is added.
3. **Do not persist new non-AI pass kinds into `proofreading_pass_runs`.** Migration `0057_proofreading_pass_runs.sql` only allows the existing five AI pass kinds. Structural extraction, semantic analysis, fact ledger, and final regression diagnostics go into `job.payload.deepProofreading` and `output.contextEvidence.deepProofreading`.
4. **Document structure must be returned to the orchestrator.** Existing extraction helper is internal; the orchestrator must receive or re-extract document tables/objects explicitly.
5. **Fact ledger must not enter confirmation items.** It is visible/read-only evidence only; it must not change `confirmationItems`, `confirmationState`, publication readiness, or human final controls.
6. **OCR/image tables are low-confidence review-only.** They may produce review suggestions, never deterministic contradiction claims.
7. **Acceptance harness must validate orchestrator/job payload, not only `ProofreadingAiPlanService.createPlan`.**

---

## Scope Boundaries

### In Scope

- Proofreading draft execution only.
- Shared table extraction fields needed by proofreading.
- Read-only workbench evidence UI.
- Advisory issue cards and OnlyOffice comments.
- Existing legacy proofreading path as internal fallback.

### Out of Scope

- Screening execution changes.
- Editing execution changes.
- Rule/knowledge authoring UI changes.
- Automatic DOCX tracked changes.
- Publication blocking.
- Editable fact ledger.
- Replacing `human_final_docx` workflow.

---

## Implementation Phases

## Phase 0: Stabilize Current Branch Before New Work

**Purpose:** Preserve existing partial work and make the branch compilable before deeper changes.

**Files to inspect/fix first:**

- `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- `apps/api/test/knowledge/table-full-fidelity-snapshot.spec.ts`
- `apps/worker-py/src/document_pipeline/parse_docx.py`
- `apps/worker-py/src/document_pipeline/table_semantics.py`
- `apps/worker-py/tests/document_pipeline/test_deep_proofreading_table_fidelity.py`

**Actions:**

1. Run `git status --short --branch` and record that existing uncommitted implementation work is user-approved prior work.
2. Do not revert partial changes unless the user asks.
3. Complete only the minimum needed to restore `pnpm --filter @medical/api typecheck`.

**Verification:**

```bash
python -m pytest tests/document_pipeline/test_deep_proofreading_table_fidelity.py -v
pnpm --filter @medical/api test -- table-full-fidelity-snapshot
pnpm --filter @medical/api typecheck
```

---

## Phase 1: Contract and Data Boundary

### Task 1: Finalize Deep Proofreading Contracts

**Files:**

- `apps/api/src/modules/proofreading/deep-proofreading-contracts.ts`
- `apps/api/src/modules/proofreading/proofreading-issue-contract.ts`
- `apps/api/src/modules/proofreading/proofreading-pass-run-record.ts`
- `apps/api/src/modules/proofreading/index.ts`
- `apps/api/test/proofreading/deep-proofreading-contracts.spec.ts`

**Required changes:**

- Export `DeepProofreadingBudgetDecision` and complete `DeepProofreadingDiagnostics`.
- Keep `ProofreadingDeepPassKind` as the existing DB-backed five AI pass kinds only.
- Define `DeepProofreadingStageKind` separately for non-DB stages:
  - `document_structure_extraction`
  - `semantic_pre_analysis`
  - `global_fact_ledger_generation`
  - `final_regression_preparation`
- Define issue source values:
  - `deterministic_check`
  - `governed_rule`
  - `quality_package`
  - `ai_pass`
  - `residual_ai`
- Keep old source normalizers accepting `quality_check` and `legacy_correction`.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- deep-proofreading-contracts
pnpm --filter @medical/api typecheck
```

---

### Task 2: Complete Table Fidelity and Low-Confidence Evidence

**Files:**

- `apps/worker-py/src/document_pipeline/parse_docx.py`
- `apps/worker-py/src/document_pipeline/table_semantics.py`
- `apps/worker-py/tests/document_pipeline/test_deep_proofreading_table_fidelity.py`
- `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- `apps/api/test/knowledge/table-full-fidelity-snapshot.spec.ts`

**Required changes:**

- Add optional API type fields to `DocumentStructureTableGridCell`:
  - `display_text?: string`
  - `normalized_text?: string`
  - `raw_xml_text?: string`
  - `style_runs?: DocumentStructureTableStyleRun[]`
- Add `DocumentStructureTableStyleRun` with text, kind, paragraph/fragment indexes, font family, size, bold, italic, underline if available, script position, and optional character/run span fields.
- `normalizeGridCells` must preserve these fields only when present; missing fields remain `undefined`, not empty authoritative values.
- Python `display_text` preserves visual spacing such as `12.3  ±  1.4`.
- Python `normalized_text` is analysis-only, such as `12.3±1.4`.
- `raw_xml_text` is evidence, not a prompt default.
- `style_runs` preserves italic `P/t/F/r`, superscript `χ²`, subscript `PaO₂`, and other run-level signals.
- OCR/image/table-like drawings are marked low-confidence review-only via object evidence or table diagnostics.

**Acceptance checks:**

```bash
python -m pytest tests/document_pipeline/test_deep_proofreading_table_fidelity.py tests/document_pipeline/test_table_semantics.py tests/document_pipeline/test_parse_docx.py -v
pnpm --filter @medical/api test -- table-full-fidelity-snapshot
pnpm --filter @medical/api typecheck
```

---

## Phase 2: Deterministic Understanding Before AI

### Task 3: Semantic Pre-Analyzer

**Files:**

- `apps/api/src/modules/proofreading/document-semantic-pre-analyzer.ts`
- `apps/api/test/proofreading/document-semantic-pre-analyzer.spec.ts`

**Required behavior:**

- Identify section roles: abstract, methods, results, conclusion, references.
- Extract statistical/data entities: sample size, percentage, P value, CI, OR/HR/RR, mean±SD, units, table references.
- Return confidence per entity.
- Use deterministic regex/metadata first; no model dependency in this task.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- document-semantic-pre-analyzer
pnpm --filter @medical/api typecheck
```

---

### Task 4: Global Fact Ledger

**Files:**

- `apps/api/src/modules/proofreading/global-fact-ledger.ts`
- `apps/api/test/proofreading/global-fact-ledger.spec.ts`

**Required behavior:**

- Build facts from blocks, semantic entities, and table snapshots.
- Link text facts to table facts by table reference, group, indicator, unit, and statistical expression.
- Create conflicts for high-confidence contradictory values.
- Low-confidence OCR/image facts may become review facts only.
- Fact ledger is read-only evidence; no edit path.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- global-fact-ledger
pnpm --filter @medical/api typecheck
```

---

### Task 5: Intent-Based Slice Builder

**Files:**

- `apps/api/src/modules/proofreading/proofreading-slice-builder.ts`
- `apps/api/test/proofreading/proofreading-slice-builder.spec.ts`

**Required behavior:**

- Build table slices with caption, notes, footnotes, units, and body references.
- Build data/statistical slices from data-bearing sentences plus linked tables.
- Build consistency slices across abstract/results/conclusion facts.
- Build medical fact slices from disease/intervention/outcome terms.
- Build residual slices for uncovered or low-confidence areas.
- Do not slice by paragraph count alone.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- proofreading-slice-builder
pnpm --filter @medical/api typecheck
```

---

### Task 6: Deterministic Table/Data Checker

**Files:**

- `apps/api/src/modules/proofreading/table-data-deterministic-checker.ts`
- `apps/api/test/proofreading/table-data-deterministic-checker.spec.ts`

**Required behavior:**

- Check narrative/table number mismatch.
- Check sample size group sums.
- Check count/percentage consistency.
- Check P value range/direction.
- Check inverted CI.
- Check OR/HR/RR and CI consistency where data is high-confidence.
- Check unit/magnitude drift.
- Preserve display text while comparing normalized text.
- Attach style evidence for statistical symbol issues.
- Produce `verify_fact` suggestions, not automatic replacements, for medical/statistical contradictions.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- table-data-deterministic-checker manuscript-quality
pnpm --filter @medical/api typecheck
```

---

## Phase 3: Scoped Rule and Knowledge Use

### Task 7: Rule and Knowledge Retrieval

**Files:**

- `apps/api/src/modules/proofreading/rule-knowledge-retrieval-service.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/http/persistent-governance-runtime.ts`
- `apps/api/test/proofreading/rule-knowledge-retrieval-service.spec.ts`

**Required behavior:**

- Filter deterministically by module, template, manuscript type, package binding, status, and pass/slice.
- Recall by keyword/metadata from semantic analysis, table headers, section names, medical terms, statistical terms.
- Use existing `KnowledgeRetrievalService.rankIndexEntriesForContext` as `context_rank`, not `vector_similarity`.
- If a real query embedding/vector scorer is introduced later, record evidence as `vector_similarity`; otherwise do not emit that evidence type.
- Use model rerank only after deterministic + keyword + context-rank preselection and cap the candidate count.
- If ranking/rerank fails, fall back to deterministic + keyword.
- Inject `knowledgeRetrievalService` into `ProofreadingServiceOptions` from demo and persistent runtimes.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- rule-knowledge-retrieval-service proofreading-plan-context
pnpm --filter @medical/api typecheck
```

---

### Task 8: Rule Activation and Knowledge Budget

**Files:**

- `apps/api/src/modules/proofreading/rule-activation-service.ts`
- `apps/api/src/modules/proofreading/knowledge-budget-service.ts`
- `apps/api/test/proofreading/rule-activation-service.spec.ts`
- `apps/api/test/proofreading/knowledge-budget-service.spec.ts`

**Required behavior:**

- A table slice must not receive all document rules.
- Rule priority:
  1. deterministic high-risk exact-object rule
  2. journal/template scoped rule
  3. medical package rule
  4. general package rule
  5. explicit high-priority fallback rule
- Knowledge priority:
  1. journal template
  2. medical package
  3. general package
  4. template family
  5. dynamic recall/context rank
- Deduplicate explicit bindings and dynamic retrieval.
- Put only `prompt_snippet` or approved summaries into prompts by default.
- Return selected and excluded items with reasons.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- rule-activation-service knowledge-budget-service
pnpm --filter @medical/api typecheck
```

---

## Phase 4: AI Passes and Issue Assembly

### Task 9: Issue Card Assembler and Deduplication

**Files:**

- `apps/api/src/modules/proofreading/proofreading-issue-card-assembler.ts`
- `apps/api/test/proofreading/proofreading-issue-card-assembler.spec.ts`

**Required behavior:**

- Deduplicate by strong key, weak fact-object key, and semantic duplicate key.
- Main-card priority:
  1. deterministic check
  2. governed rule
  3. quality/medical package
  4. AI pass
  5. residual AI
- Merge duplicates into `supportingEvidence`.
- Conflicting suggestions set `conflicting_suggestions` and require human judgment.
- Output can project back to existing `ProofreadingAiPlan`/issue UI shape.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- proofreading-issue-card-assembler
pnpm --filter @medical/api typecheck
```

---

### Task 10: Slice-Aware AI Pass Runner

**Files:**

- `apps/api/src/modules/proofreading/deep-proofreading-pass-runner.ts`
- `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
- `apps/api/test/proofreading/proofreading-plan-context.spec.ts`
- `scripts/harness/run-real-proofreading-acceptance.spec.mjs`

**Required changes:**

- Extend `CreateProofreadingAiPlanInput` with optional:
  - `sliceContext`
  - `factLedgerSummary`
  - `activatedRules`
  - `budgetedKnowledge`
  - `deepDiagnostics`
- Update `buildProofreadingUserPayload` to include these fields.
- Update the system prompt so it no longer says every run is an “整篇稿件单次校对” when a slice context is provided.
- Preserve old full-document prompt behavior for legacy fallback.
- Ensure retry/replay serializes and reuses the deep context correctly.
- Each AI call receives one pass kind and one slice context or an explicit whole-document final-regression marker.
- No full `canonicalText` enters the prompt unless budget selected it.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- proofreading-plan-context
node --test scripts/harness/run-real-proofreading-acceptance.spec.mjs
pnpm --filter @medical/api typecheck
```

---

## Phase 5: Orchestrator Integration and Persistence

### Task 11: Deep Proofreading Orchestrator

**Files:**

- `apps/api/src/modules/proofreading/deep-proofreading-orchestrator.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/http/persistent-governance-runtime.ts`
- `apps/api/test/proofreading/deep-proofreading-orchestrator.spec.ts`
- `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`

**Trigger rule:**

Use new orchestrator only when all are true:

- job type is `proofreading_draft_run`
- governed context path is active
- `deepProofreadingEnabled !== false`

Keep old path for:

- bare proofreading
- confirmation
- `publishHumanFinal`
- fallback after orchestrator failure before safe output

**Pipeline:**

1. Source blocks and document structure/table snapshots.
2. Semantic pre-analysis.
3. Global fact ledger.
4. Intent slices.
5. Retrieval, activation, and budget.
6. Deterministic table/data checks.
7. AI pass runner.
8. Issue-card assembly.
9. Compatible report/plan projection.
10. `deepProofreading` diagnostics in job payload.

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- deep-proofreading-orchestrator proofreading-bare-run proofreading-medical-quality
pnpm --filter @medical/api test -- proofreading
pnpm --filter @medical/api typecheck
```

---

### Task 12: Observability Without DB Pass-Kind Migration

**Files:**

- `apps/api/src/modules/proofreading/proofreading-pass-run-record.ts`
- `apps/api/src/modules/proofreading/postgres-proofreading-pass-run-repository.ts`
- `apps/api/src/modules/proofreading/in-memory-proofreading-pass-run-repository.ts`
- `apps/api/src/modules/manuscripts/manuscript-api.ts`
- `apps/api/test/proofreading/deep-proofreading-orchestrator.spec.ts`
- `apps/api/test/manuscripts/manuscript-api-deep-proofreading.spec.ts`

**Required behavior:**

- Do not add non-AI stage kinds to `proofreading_pass_runs.pass_kind`.
- Existing five AI pass kinds continue to use pass-run repository.
- Store non-AI diagnostics under:
  - completed job payload: `deepProofreading`
  - pass-run output: `contextEvidence.deepProofreading`
  - manuscript execution overview evidence projection
- Create the missing manuscript API test file instead of referencing a non-existent `manuscript-api.spec.ts`.

**Diagnostics to expose:**

- pass status and duration
- slice counts and slice kinds
- activated rule count by pass/slice
- knowledge count and token estimate by pass/slice
- fact count and conflict count
- table confidence and unsupported structures
- issue count by source/severity/pass/dedupe status
- fallback reason and scope

**Acceptance checks:**

```bash
pnpm --filter @medical/api test -- deep-proofreading-orchestrator manuscript-api-deep-proofreading
pnpm --filter @medical/api typecheck
```

---

## Phase 6: Workbench and End-to-End Gate

### Task 13: Read-Only Deep Proofreading UI

**Files:**

- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- `apps/web/test/manuscript-workbench-deep-proofreading.spec.tsx`

**Required behavior:**

- Parse `job.payload.deepProofreading` defensively.
- Render deep proofreading overview.
- Render issue source/pass/slice/confidence labels.
- Render read-only fact ledger separately from confirmation items.
- Render pass execution and cost/rule/knowledge summary.
- Missing diagnostics render as `未记录`.
- Do not add fact ledger entries to `buildProofreadingConfirmationItems`.
- Do not change `targetText`, `replacementText`, `confirmationState`, `confirmationReady`, publish controls, or human final controls.

**Acceptance checks:**

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-deep-proofreading.spec.tsx test/manuscript-workbench-detail.spec.tsx
pnpm --filter @medsys/web typecheck
```

---

### Task 14: Acceptance Harness and Release Gate

**Files:**

- `scripts/harness/run-real-proofreading-acceptance.mjs`
- `scripts/harness/run-real-proofreading-acceptance.spec.mjs`
- `scripts/run-manuscript-workbench-gate.mjs`

**Required behavior:**

- Gate validates orchestrator/job payload, not just `ProofreadingAiPlanService.createPlan`.
- Required payload fields:
  - `deepProofreading.factLedgerSummary`
  - `deepProofreading.tableFidelityDiagnostics`
  - `deepProofreading.selectedRuleDiagnostics`
  - `deepProofreading.selectedKnowledgeBudgetDiagnostics`
  - `deepProofreading.passRuns`
- Required pass coverage:
  - `data_statistics_units_and_tables`
  - `residual_synthesis`
  - `final_regression_preparation` as non-DB diagnostic stage
- Real model execution remains opt-in; provider secrets stay redacted.

**Final verification:**

```bash
python -m pytest tests/document_pipeline/test_deep_proofreading_table_fidelity.py tests/document_pipeline/test_table_semantics.py tests/document_pipeline/test_parse_docx.py -v
pnpm --filter @medical/api test -- proofreading document-pipeline manuscript-quality
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-deep-proofreading.spec.tsx test/manuscript-workbench-detail.spec.tsx
node --test scripts/harness/run-real-proofreading-acceptance.spec.mjs
pnpm verify:manuscript-workbench
pnpm typecheck
```

---

## Execution Order

Use this order, not the original plan order:

1. Phase 0: stabilize current partial table-fidelity changes.
2. Task 1: contracts and pass/stage boundary.
3. Task 2: table fidelity and OCR low-confidence evidence.
4. Task 3: semantic pre-analysis.
5. Task 4: global fact ledger.
6. Task 5: intent slices.
7. Task 6: deterministic table/data checker.
8. Task 7: retrieval.
9. Task 8: activation and budget.
10. Task 9: issue assembler.
11. Task 10: slice-aware AI pass runner.
12. Task 11: orchestrator integration.
13. Task 12: diagnostics and manuscript API projection.
14. Task 13: workbench UI.
15. Task 14: acceptance harness and full gate.

---

## Risk Controls

- Every task starts with a failing test and ends with focused verification.
- No change to screening/editing execution.
- No automatic DOCX edits.
- No publication block.
- Low-confidence extraction produces review-only suggestions.
- Missing fidelity fields are unsupported evidence, not empty authoritative evidence.
- Legacy proofreading remains available as fallback.
- Cost growth is bounded by rule activation, knowledge budget, slice caps, and rerank caps.
- Retrieval evidence names must be truthful: `context_rank` unless true vector scoring exists.

---

## Stop Condition

Implementation must not begin until the user explicitly says “开工”.
