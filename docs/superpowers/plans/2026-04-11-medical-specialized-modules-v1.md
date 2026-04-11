# Medical Specialized Modules V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-first manuscript quality layer that adds `general_proofreading_pack` and `medical_specialized_modules` to the existing governed `screening` / `editing` / `proofreading` pipeline without changing the current knowledge-governance authority model.

**Architecture:** Add one shared issue contract, one Python worker quality-analysis seam, and one API orchestration module that feeds structured findings into the three existing business modules. Land the work in phases: contracts and worker analyzers first, then API integration and module-specific routing, then optional third-party adapter seams behind flags, while keeping knowledge/rule write-back out of scope for V1.

**Tech Stack:** TypeScript, Node `node:test`, `tsx`, Python 3.12, `pytest`, existing DOCX/document-structure pipeline, existing governed execution and module services.

---

## Scope Notes

- This plan implements the two approved specs together:
  - [2026-04-11-general-proofreading-pack-v1-design.md](C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md)
  - [2026-04-11-medical-specialized-modules-v1-design.md](C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md)
- This is intentionally a backend-only V1.
- Existing report assets and job payloads remain the primary operator-facing output surface in V1.
- Direct third-party package integration is deferred until the local analyzer baseline is stable.
- Automatic knowledge or rule write-back is explicitly out of scope.

## File Structure

### New files

- `packages/contracts/src/manuscript-quality.ts`
  - Shared contracts for normalized text slices, quality issue records, summaries, routing scopes, and adapter results.
- `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
  - API-local helpers for converting worker results into module-friendly payloads.
- `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
  - Node-to-Python adapter that invokes the new worker script, validates JSON, and normalizes failures into conservative review signals.
- `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
  - Orchestrates which analyzers run for each module and returns structured findings plus summaries.
- `apps/api/src/modules/manuscript-quality/index.ts`
  - Barrel export for the new API module.
- `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
  - Main red/green coverage for API orchestration, module scoping, and degraded worker handling.
- `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
  - Proofreading integration tests for report payload composition and manual-review routing.
- `apps/api/test/editing/editing-medical-quality.spec.ts`
  - Editing integration tests for suggestion-only findings and deterministic-rule coexistence.
- `apps/api/test/screening/screening-medical-quality.spec.ts`
  - Screening integration tests for high-risk findings and escalation behavior.
- `apps/worker-py/src/manuscript_quality/contracts.py`
  - Python dataclasses and typed payload parsing for normalized text, issue outputs, summaries, and adapter metadata.
- `apps/worker-py/src/manuscript_quality/text_normalization.py`
  - Pure-text preprocessing that generates paragraph, sentence, heading, list, and token slices from extracted text blocks.
- `apps/worker-py/src/manuscript_quality/general_proofreading.py`
  - General proofreading analyzers for punctuation/layout, lexical candidates, consistency checks, compliance markers, and logic suspicions.
- `apps/worker-py/src/manuscript_quality/medical_specialized.py`
  - Medical analyzers for terminology drift, numeric/data consistency, statistical expression, evidence alignment, and privacy/ethics checks.
- `apps/worker-py/src/manuscript_quality/adapter_registry.py`
  - Disabled-by-default adapter seam for optional `AutoCorrect` / `pycorrector` / sensitive lexicon integrations.
- `apps/worker-py/src/manuscript_quality/run_quality_checks.py`
  - CLI entrypoint invoked by the API adapter.
- `apps/worker-py/src/manuscript_quality/__init__.py`
  - Package marker and re-exports for worker helpers.
- `apps/worker-py/tests/manuscript_quality/test_text_normalization.py`
  - Focused tests for normalized slicing and stable coordinates.
- `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`
  - Focused tests for punctuation, consistency, and compliance findings.
- `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`
  - Focused tests for terminology, numeric consistency, statistical-expression, evidence-alignment, and privacy detection.
- `apps/worker-py/tests/manuscript_quality/test_adapter_registry.py`
  - Focused tests proving optional adapters stay disabled and advisory by default.

### Modified files

- `packages/contracts/src/index.ts`
  - Re-export the new manuscript-quality contract surface.
- `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
  - Add optional finding-summary fields to execution snapshots without changing authority boundaries.
- `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
  - Persist finding summaries alongside knowledge-hit snapshots.
- `apps/api/src/modules/editorial-execution/types.ts`
  - Add light-weight interop types for module-level quality summaries where needed.
- `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Call the new quality service during draft generation, merge findings into report payloads, and keep finalization conservative.
- `apps/api/src/modules/editing/editing-service.ts`
  - Request scoped general and medical findings, persist suggestion summaries, and keep deterministic transforms unchanged.
- `apps/api/src/modules/screening/screening-service.ts`
  - Request scoped medical-first findings, attach high-risk summaries, and surface escalation signals for reviewer attention.
- `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
  - Extend report assertions to cover the new quality issue sections.
- `apps/api/test/modules/module-orchestration.spec.ts`
  - Prove the new quality layer coexists with governed execution, verification seeding, and existing module results.
- `apps/worker-py/src/document_enhancement/privacy.py`
  - Reuse existing privacy heuristics from the medical-quality layer instead of duplicating logic.
- `docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md`
  - Mark V1 implementation status after the work lands.
- `docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md`
  - Mark V1 plan and implementation status after the work lands.

## Test Commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-medical-quality.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-medical-quality.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/screening/screening-medical-quality.spec.ts`
- Worker focused:
  - `cd apps/worker-py && python -m pytest ./tests/manuscript_quality -q`
- Checkpoints:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-report.spec.ts ./test/modules/module-orchestration.spec.ts`
  - `pnpm --filter @medical/api typecheck`
  - `pnpm typecheck`

---

### Task 1: Lock the shared quality contract and snapshot summary shape

**Files:**
- Create: `packages/contracts/src/manuscript-quality.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Test: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [ ] **Step 1: Write the failing API test for a unified quality issue contract**

```ts
test("quality service returns structured issues with fixed scope, category, action, and evidence fields", async () => {
  const result = await service.run({
    module: "proofreading",
    manuscriptType: "clinical_study",
    sourceText: "摘要目的研究纳入120例，正文写118例。",
  });

  assert.equal(result.issues[0]?.module_scope, "medical_specialized");
  assert.equal(result.issues[0]?.issue_type, "medical_data_consistency");
  assert.equal(result.issues[0]?.action, "manual_review");
  assert.ok(result.issues[0]?.evidence.length > 0);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`

Expected: FAIL because the manuscript-quality module and shared contracts do not exist yet.

- [ ] **Step 3: Add the minimal shared contract surface**

```ts
export type ManuscriptQualityScope = "general_proofreading" | "medical_specialized";
export type ManuscriptQualityAction = "auto_fix" | "suggest_fix" | "manual_review" | "block";

export interface ManuscriptQualityIssue {
  issue_id: string;
  module_scope: ManuscriptQualityScope;
  issue_type: string;
  category: string;
  severity: "info" | "warning" | "error";
  action: ManuscriptQualityAction;
  confidence: number;
  explanation?: string;
  suggestion?: string;
  evidence: string[];
}
```

- [ ] **Step 4: Extend execution snapshots with optional finding summaries, not raw authority-changing decisions**

```ts
finding_summary?: {
  total_issues: number;
  blocked_issue_count: number;
  manual_review_count: number;
  by_scope: Record<string, number>;
}
```

- [ ] **Step 5: Re-run the focused test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`

Expected: still FAIL, but now at missing worker adapter and orchestration code instead of missing types.

- [ ] **Step 6: Commit the contract layer**

```bash
git add packages/contracts/src/manuscript-quality.ts packages/contracts/src/index.ts apps/api/src/modules/execution-tracking/execution-tracking-record.ts apps/api/src/modules/execution-tracking/execution-tracking-service.ts apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts
git commit -m "feat: add manuscript quality contracts"
```

### Task 2: Build the Python text-normalization seam and general proofreading analyzers

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/contracts.py`
- Create: `apps/worker-py/src/manuscript_quality/text_normalization.py`
- Create: `apps/worker-py/src/manuscript_quality/general_proofreading.py`
- Create: `apps/worker-py/src/manuscript_quality/__init__.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_text_normalization.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`
- Test: `apps/worker-py/tests/manuscript_quality/test_text_normalization.py`
- Test: `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`

- [ ] **Step 1: Write the failing normalization tests for stable paragraph and sentence slicing**

```py
def test_text_normalization_builds_stable_sentence_and_paragraph_coordinates():
    result = normalize_text_blocks([
        {"section": "abstract", "block_kind": "paragraph", "text": "摘要目的：观察效果。结论：有效。"}
    ])

    assert result.paragraph_blocks[0].section == "abstract"
    assert result.sentence_blocks[0].text == "摘要目的：观察效果。"
    assert result.sentence_blocks[1].paragraph_index == 0
```

- [ ] **Step 2: Write the failing general-proofreading test for punctuation plus consistency plus compliance**

```py
def test_general_proofreading_flags_punctuation_consistency_and_absolute_claims():
    result = run_general_proofreading_checks(
        text="本研究(目的是观察疗效。该疗法100%安全，摘要写120例，正文写118例。"
    )

    issue_types = {issue.issue_type for issue in result.issues}
    assert "punctuation_layout" in issue_types
    assert "consistency" in issue_types
    assert "compliance" in issue_types
```

- [ ] **Step 3: Run the worker tests and verify they fail**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_text_normalization.py ./tests/manuscript_quality/test_general_proofreading.py -q`

Expected: FAIL because the manuscript_quality package does not exist yet.

- [ ] **Step 4: Implement the minimal text normalization layer**

```py
def normalize_text_blocks(blocks: list[dict[str, object]]) -> NormalizedTextResult:
    paragraphs = build_paragraph_blocks(blocks)
    sentences = split_sentences(paragraphs)
    return NormalizedTextResult(
        normalized_text="".join(block.text for block in paragraphs),
        paragraph_blocks=paragraphs,
        sentence_blocks=sentences,
        heading_blocks=[block for block in paragraphs if block.block_kind == "heading"],
        list_blocks=[block for block in paragraphs if block.block_kind == "list"],
        token_map=[],
    )
```

- [ ] **Step 5: Implement narrow, deterministic general analyzers first**

```py
issues.extend(check_punctuation_layout(normalized))
issues.extend(check_basic_consistency(normalized))
issues.extend(check_compliance_markers(normalized))
issues.extend(check_logic_suspicions(normalized))
```

- [ ] **Step 6: Re-run the worker tests**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_text_normalization.py ./tests/manuscript_quality/test_general_proofreading.py -q`

Expected: PASS.

- [ ] **Step 7: Commit the worker general-proofreading baseline**

```bash
git add apps/worker-py/src/manuscript_quality apps/worker-py/tests/manuscript_quality/test_text_normalization.py apps/worker-py/tests/manuscript_quality/test_general_proofreading.py
git commit -m "feat: add worker general proofreading analyzers"
```

### Task 3: Add the medical specialized analyzers and reuse the privacy advisory

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- Modify: `apps/worker-py/src/document_enhancement/privacy.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`
- Test: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`

- [ ] **Step 1: Write the failing medical-specialized test for terminology drift and numeric inconsistency**

```py
def test_medical_specialized_flags_terminology_drift_and_group_count_conflicts():
    result = run_medical_specialized_checks(
        text=(
            "ALT升高患者纳入120例。"
            "丙氨酸氨基转移酶升高患者分为观察组60例、对照组50例。"
        ),
        manuscript_type="clinical_study",
        module="proofreading",
    )

    issue_types = {issue.issue_type for issue in result.issues}
    assert "medical_terminology" in issue_types
    assert "medical_data_consistency" in issue_types
```

- [ ] **Step 2: Add a second failing test for statistical expression, evidence alignment, and privacy**

```py
def test_medical_specialized_flags_statistical_and_privacy_risks():
    result = run_medical_specialized_checks(
        text=(
            "差异显著。P值未报告。结果提示相关性。结论证明因果关系。"
            "患者联系电话13800138000。"
        ),
        manuscript_type="clinical_study",
        module="screening",
    )

    issue_types = {issue.issue_type for issue in result.issues}
    assert "statistical_expression" in issue_types
    assert "evidence_alignment" in issue_types
    assert "ethics_privacy" in issue_types
```

- [ ] **Step 3: Run the focused medical worker test and verify it fails**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py -q`

Expected: FAIL because the medical analyzer does not exist yet.

- [ ] **Step 4: Implement conservative medical analyzers with explicit manual-review defaults**

```py
issues.extend(check_medical_terminology_drift(normalized))
issues.extend(check_medical_numeric_consistency(normalized))
issues.extend(check_statistical_expression(normalized))
issues.extend(check_evidence_alignment(normalized))
issues.extend(check_privacy_ethics(normalized, privacy_advisory=build_privacy_advisory(text)))
```

- [ ] **Step 5: Reuse the existing privacy heuristic helper instead of duplicating regex logic**

```py
from src.document_enhancement.privacy import build_privacy_advisory
```

- [ ] **Step 6: Re-run the focused medical worker test**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py -q`

Expected: PASS.

- [ ] **Step 7: Commit the medical analyzer layer**

```bash
git add apps/worker-py/src/manuscript_quality/medical_specialized.py apps/worker-py/src/document_enhancement/privacy.py apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
git commit -m "feat: add worker medical specialized analyzers"
```

### Task 4: Add the API worker adapter and module-scoped orchestration service

**Files:**
- Create: `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- Create: `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- Create: `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- Create: `apps/api/src/modules/manuscript-quality/index.ts`
- Test: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [ ] **Step 1: Add the second failing API test for degraded worker execution**

```ts
test("quality service degrades to manual review when the worker is unavailable", async () => {
  const result = await service.run({
    module: "proofreading",
    manuscriptType: "clinical_study",
    sourceBlocks: [],
  });

  assert.equal(result.summary.manual_review_count, 1);
  assert.equal(result.issues[0]?.issue_type, "system_degraded");
  assert.equal(result.issues[0]?.action, "manual_review");
});
```

- [ ] **Step 2: Run the focused API test again**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`

Expected: FAIL because the adapter and service do not exist.

- [ ] **Step 3: Implement the Python worker adapter using the existing spawn-and-JSON pattern**

```ts
export class ManuscriptQualityWorkerAdapter {
  async run(input: WorkerPayload): Promise<WorkerResult> {
    return runPythonJsonWorker({
      scriptPath: QUALITY_CHECK_SCRIPT,
      payload: input,
    });
  }
}
```

- [ ] **Step 4: Implement module-aware orchestration in the new service**

```ts
const requestedScopes =
  input.module === "screening"
    ? ["medical_specialized"]
    : input.module === "editing"
      ? ["general_proofreading", "medical_specialized"]
      : ["general_proofreading", "medical_specialized"];
```

- [ ] **Step 5: Normalize degraded worker failures into conservative findings**

```ts
const systemIssue = buildSystemDegradedIssue(
  "quality_worker_unavailable",
  errorMessage,
);

return {
  issues: [systemIssue],
  summary: buildSummary({ issues: [systemIssue] }),
  adapters: [],
};
```

- [ ] **Step 6: Re-run the focused API test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit the API orchestration seam**

```bash
git add apps/api/src/modules/manuscript-quality apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts
git commit -m "feat: add manuscript quality api orchestration"
```

### Task 5: Integrate the quality layer into proofreading draft generation first

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Create: `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`

- [ ] **Step 1: Write the failing proofreading integration test for merged rule and quality findings**

```ts
test("proofreading draft payload includes general and medical quality findings without auto-finalizing them", async () => {
  const result = await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/draft.md",
  });

  assert.ok(result.job.payload?.qualityFindings);
  assert.equal(
    (result.job.payload?.qualityFindings as { summary: { manual_review_count: number } }).summary.manual_review_count,
    1,
  );
  assert.equal(result.asset.asset_type, "proofreading_draft_report");
});
```

- [ ] **Step 2: Extend the report test to require a new quality-findings section**

```ts
assert.match(reportMarkdown, /## Quality Findings/);
assert.match(reportMarkdown, /medical_data_consistency/);
```

- [ ] **Step 3: Run the proofreading tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-medical-quality.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: FAIL because proofreading does not call the quality service yet.

- [ ] **Step 4: Inject the quality service into proofreading draft generation only**

```ts
const qualityFindings = await this.manuscriptQualityService.run({
  module: "proofreading",
  manuscriptId: input.manuscriptId,
  manuscriptType: resolvedContext.moduleContext.manuscript.manuscript_type,
  sourceBlocks: blocks,
  tableSnapshots,
});
```

- [ ] **Step 5: Merge findings into job payload and report rendering without changing final-confirm semantics**

```ts
payload: {
  ...queuedJob.payload,
  qualityFindings,
  manualReviewItems: [
    ...(proofreadingFindings?.manualReviewItems ?? []),
    ...qualityFindings.issues
      .filter((issue) => issue.action === "manual_review" || issue.action === "block")
      .map((issue) => ({
        ruleId: issue.issue_id,
        reason: issue.issue_type,
      })),
  ],
}
```

- [ ] **Step 6: Re-run the proofreading tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-medical-quality.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit the proofreading integration**

```bash
git add apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/editorial-execution/types.ts apps/api/test/proofreading/proofreading-medical-quality.spec.ts apps/api/test/proofreading/proofreading-rule-report.spec.ts
git commit -m "feat: integrate manuscript quality into proofreading"
```

### Task 6: Integrate scoped findings into editing and screening without changing authority boundaries

**Files:**
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Create: `apps/api/test/editing/editing-medical-quality.spec.ts`
- Create: `apps/api/test/screening/screening-medical-quality.spec.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`
- Test: `apps/api/test/editing/editing-medical-quality.spec.ts`
- Test: `apps/api/test/screening/screening-medical-quality.spec.ts`
- Test: `apps/api/test/modules/module-orchestration.spec.ts`

- [ ] **Step 1: Write the failing editing integration test for suggestion-focused findings**

```ts
test("editing persists quality suggestions without turning them into deterministic rewrites", async () => {
  const result = await editingService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "editing/manuscript-1/output.docx",
    fileName: "output.docx",
  });
  const summary = result.job.payload?.qualityFindings as { summary: { suggest_fix_count: number } };
  assert.equal(summary.summary.suggest_fix_count, 1);
  assert.equal(
    (result.job.payload?.qualityFindings as { issues: Array<{ action: string }> }).issues[0]?.action,
    "suggest_fix",
  );
});
```

- [ ] **Step 2: Write the failing screening integration test for escalation-first findings**

```ts
test("screening persists medical risk findings as reviewer-facing escalation signals", async () => {
  const result = await screeningService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "screener-1",
    actorRole: "screener",
    storageKey: "screening/manuscript-1/report.md",
    fileName: "report.md",
  });
  const payload = result.job.payload?.qualityFindings as { summary: { manual_review_count: number } };
  assert.equal(payload.summary.manual_review_count, 2);
});
```

- [ ] **Step 3: Run the focused editing and screening tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts`

Expected: FAIL because neither module is wired to the quality service.

- [ ] **Step 4: Inject scoped findings into editing while keeping deterministic transforms separate**

```ts
const qualityFindings = await this.manuscriptQualityService.run({
  module: "editing",
  manuscriptId: input.manuscriptId,
  manuscriptType,
  sourceBlocks,
  tableSnapshots,
});
```

- [ ] **Step 5: Inject scoped findings into screening as advisory evidence, not auto-decision logic**

```ts
payload: {
  ...queuedJob.payload,
  qualityFindings,
  escalationSignals: qualityFindings.issues
    .filter((issue) => issue.action !== "suggest_fix")
    .map((issue) => ({
      issueId: issue.issue_id,
      issueType: issue.issue_type,
      action: issue.action,
    })),
}
```

- [ ] **Step 6: Extend the orchestration test to prove verification and governed execution still complete**

```ts
assert.equal(result.snapshot_id, "snapshot-1");
assert.ok(result.job.payload?.qualityFindings);
```

- [ ] **Step 7: Re-run the focused module tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts ./test/modules/module-orchestration.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit the editing and screening integration**

```bash
git add apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/screening/screening-service.ts apps/api/test/editing/editing-medical-quality.spec.ts apps/api/test/screening/screening-medical-quality.spec.ts apps/api/test/modules/module-orchestration.spec.ts
git commit -m "feat: integrate manuscript quality into editing and screening"
```

### Task 7: Add the disabled-by-default third-party adapter seam and prove it cannot bypass governance

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/adapter_registry.py`
- Create: `apps/worker-py/src/manuscript_quality/run_quality_checks.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_adapter_registry.py`
- Test: `apps/worker-py/tests/manuscript_quality/test_adapter_registry.py`

- [ ] **Step 1: Write the failing adapter-registry test for disabled-by-default behavior**

```py
def test_optional_adapters_are_reported_but_do_not_run_without_explicit_enablement():
    result = run_quality_checks(
        text="该疗法100%安全。",
        environment={},
    )

    assert result.adapters[0].status == "not_configured"
    assert all(issue.module_scope in {"general_proofreading", "medical_specialized"} for issue in result.issues)
```

- [ ] **Step 2: Add a second failing test to prove external adapters only return advisory candidates**

```py
def test_optional_adapters_never_emit_auto_fix_for_high_risk_medical_or_compliance_issues():
    result = maybe_run_optional_adapters(
        text="结果证明因果关系。",
        enabled={"pycorrector": True},
    )

    assert all(issue.action != "auto_fix" for issue in result.issues)
```

- [ ] **Step 3: Run the focused adapter tests and verify they fail**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_adapter_registry.py -q`

Expected: FAIL because the adapter registry and CLI entrypoint do not exist.

- [ ] **Step 4: Implement the adapter registry as metadata-first and advisory-only**

```py
if not enabled:
    return AdapterRunResult(adapters=[AdapterStatus(name=name, status="not_configured")], issues=[])
```

- [ ] **Step 5: Implement the worker CLI entrypoint used by the API adapter**

```py
if __name__ == "__main__":
    payload = json.loads(sys.argv[sys.argv.index("--payload-json") + 1])
    result = run_quality_checks_payload(payload)
    print(json.dumps(asdict(result), ensure_ascii=False))
```

- [ ] **Step 6: Re-run the focused adapter tests**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_adapter_registry.py -q`

Expected: PASS.

- [ ] **Step 7: Commit the adapter seam**

```bash
git add apps/worker-py/src/manuscript_quality/adapter_registry.py apps/worker-py/src/manuscript_quality/run_quality_checks.py apps/worker-py/tests/manuscript_quality/test_adapter_registry.py
git commit -m "feat: add guarded manuscript quality adapter seam"
```

### Task 8: Run checkpoints and sync the approved design docs

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md`
- Modify: `docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md`

- [ ] **Step 1: Run the worker checkpoint suite**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality -q`

Expected: PASS.

- [ ] **Step 2: Run the focused API checkpoint suite**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-medical-quality.spec.ts ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts ./test/modules/module-orchestration.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck checkpoints**

Run:

```bash
pnpm --filter @medical/api typecheck
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Update the two approved design docs with implementation status notes**

```md
Implemented in V1:
- backend manuscript-quality issue contract
- worker general proofreading analyzers
- worker medical specialized analyzers
- proofreading, editing, and screening integration
- guarded optional adapter seam
```

- [ ] **Step 5: Commit the checkpoint and doc sync**

```bash
git add docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md
git commit -m "docs: sync manuscript quality implementation status"
```

## Review Notes

- If implementation pressure gets high, Task 7 can be deferred without breaking the V1 backend baseline.
- Do not add a standalone findings database table in this pass unless job payload size or snapshot summary limits become a demonstrated problem.
- Do not add web workbench surfaces in this pass; existing report assets and payloads are the operator contract for V1.
- Do not let any optional adapter bypass the fixed action ladder: `auto_fix`, `suggest_fix`, `manual_review`, `block`.
