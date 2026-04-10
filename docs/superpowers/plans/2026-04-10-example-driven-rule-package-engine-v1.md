# Example-Driven Rule Package Engine V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-only example-driven rule package pipeline that converts `原稿 + 编后稿` into six explainable `RulePackageCandidate` outputs with future-UI-ready card fields and preview explanations, without publishing runtime `editorial_rule` records yet.

**Architecture:** Add a new contracts layer for rule-package outputs, then implement a layered API pipeline in `apps/api` with snapshot adaptation, diff normalization, six package recognizers, semantic-card assembly, and preview explanation. Verify the behavior against one real gold case plus two small synthetic fixtures so the first version is stable, explainable, and not overfit to one sample pair.

**Tech Stack:** TypeScript, existing DOCX/document-structure pipeline, Node `node:test`, `tsx`, `pnpm`, in-memory editorial rule harnesses.

---

## File Structure

### New files

- `packages/contracts/src/editorial-rule-packages.ts`
  - Shared types for example-pair input, normalized diff signals, rule package candidates, five-card payloads, and preview explanations.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - API-local helpers and narrowed runtime types derived from shared contracts.
- `apps/api/src/modules/editorial-rules/example-document-snapshot-adapter.ts`
  - Converts document-structure worker output or fixture payloads into stable `ExampleDocumentSnapshot` objects.
- `apps/api/src/modules/editorial-rules/example-pair-diff-service.ts`
  - Produces `EditIntentSignal[]` from original/edited snapshots.
- `apps/api/src/modules/editorial-rules/rule-package-recognizers.ts`
  - Six recognizers that convert normalized signals into `RulePackageCandidate` seeds.
- `apps/api/src/modules/editorial-rules/rule-package-preview-service.ts`
  - Builds hit/miss explanations and automation posture summaries for each candidate.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
  - Orchestrates snapshot adaptation, diff normalization, recognition, card assembly, and preview generation.
- `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`
  - Main red/green API behavior test for candidate generation and preview outputs.
- `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
  - Regression coverage for one real gold case and two synthetic mini-cases.
- `apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts`
  - Shared fixture builders for snapshots, blocks, tables, and expected candidate assertions.

### Modified files

- `packages/contracts/src/index.ts`
  - Export the new `editorial-rule-packages` contract surface.
- `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - Add backend-only endpoints for example-pair candidate generation and preview.
- `apps/api/src/modules/editorial-rules/index.ts`
  - Re-export the new rule package services.
- `apps/api/src/http/api-http-server.ts`
  - Route and validate the new API endpoints.

### Test commands

- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- API suite checkpoint:
  - `pnpm --filter @medical/api test -- editorial-rules`
- Typecheck checkpoint:
  - `pnpm --filter @medical/api typecheck`

---

### Task 1: Lock the outward API behavior with failing tests

**Files:**
- Create: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`
- Create: `apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`

- [ ] **Step 1: Write the failing API test for six package outputs**

```ts
test("example pair generation returns six rule package candidates with future-ui card fields", async () => {
  const response = await api.generateRulePackageCandidates({
    input: buildRealSampleFixture(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    [
      "front_matter",
      "abstract_keywords",
      "heading_hierarchy",
      "numeric_statistics",
      "three_line_table",
      "reference",
    ],
  );
  assert.ok(response.body.every((candidate) => candidate.cards.ai_understanding.summary.length > 0));
  assert.ok(response.body.every((candidate) => candidate.preview.decision.reason.length > 0));
});
```

- [ ] **Step 2: Run the test to verify it fails for the expected reason**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`

Expected: FAIL because `generateRulePackageCandidates` does not exist yet.

- [ ] **Step 3: Add a second failing test for preview explanations**

```ts
test("preview explains both a hit and a non-hit for a candidate package", async () => {
  const response = await api.previewRulePackage({
    packageDraft: buildAbstractKeywordCandidate().cards,
    sampleText: "摘要 目的 观察治疗效果。",
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.hits.length > 0);
  assert.ok(response.body.misses.length > 0);
});
```

- [ ] **Step 4: Run the same test file again**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`

Expected: FAIL because the preview endpoint is also missing.

- [ ] **Step 5: Commit the red tests**

```bash
git add apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts
git commit -m "test: lock example-driven rule package api behavior"
```

### Task 2: Add shared contracts for snapshots, signals, candidates, and preview payloads

**Files:**
- Create: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`

- [ ] **Step 1: Write the minimal shared contracts file**

```ts
export type RulePackageKind =
  | "front_matter"
  | "abstract_keywords"
  | "heading_hierarchy"
  | "numeric_statistics"
  | "three_line_table"
  | "reference";

export interface ExampleDocumentSnapshot {
  source: "original" | "edited";
  parser_status: "ready" | "partial" | "needs_manual_review";
  sections: SectionSnapshot[];
  blocks: BlockSnapshot[];
  tables: TableSnapshot[];
  warnings: string[];
}

export interface EditIntentSignal {
  id: string;
  package_hint: RulePackageKind | "unknown";
  signal_type:
    | "label_normalization"
    | "inserted_block"
    | "deleted_block"
    | "text_style_normalization"
    | "table_semantic_change"
    | "reference_style_change";
  object_hint: string;
  before?: string;
  after?: string;
  rationale: string;
  confidence: number;
  risk_flags: string[];
}
```

- [ ] **Step 2: Export the new contracts module**

```ts
export * from "./editorial-rule-packages.js";
```

- [ ] **Step 3: Add API-local narrowed helper types**

```ts
export interface RulePackageGenerationContext {
  manuscript_type: string;
  module: string;
}

export interface RulePackageRecognitionInput {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
  signals: EditIntentSignal[];
}
```

- [ ] **Step 4: Run the red tests again**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`

Expected: still FAIL, but now at missing service/API implementation rather than missing types.

- [ ] **Step 5: Commit the contracts layer**

```bash
git add packages/contracts/src/editorial-rule-packages.ts packages/contracts/src/index.ts apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts
git commit -m "feat: add rule package contracts"
```

### Task 3: Build the snapshot adapter and diff normalization seam

**Files:**
- Create: `apps/api/src/modules/editorial-rules/example-document-snapshot-adapter.ts`
- Create: `apps/api/src/modules/editorial-rules/example-pair-diff-service.ts`
- Modify: `apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

- [ ] **Step 1: Write a failing unit-style gold-case test for normalized signals**

```ts
test("diff normalization emits stable edit intent signals for the real gold case", () => {
  const { original, edited } = buildRealGoldSnapshots();
  const signals = service.extractSignals({ original, edited });

  assert.ok(signals.some((signal) => signal.package_hint === "front_matter"));
  assert.ok(signals.some((signal) => signal.package_hint === "three_line_table"));
  assert.ok(signals.some((signal) => signal.signal_type === "reference_style_change"));
});
```

- [ ] **Step 2: Run the gold-case test and verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

Expected: FAIL because the snapshot adapter and diff service do not exist.

- [ ] **Step 3: Implement the snapshot adapter**

```ts
export class ExampleDocumentSnapshotAdapter {
  fromFixture(input: FixtureSnapshotInput): ExampleDocumentSnapshot {
    return {
      source: input.source,
      parser_status: input.parser_status ?? "ready",
      sections: input.sections,
      blocks: input.blocks,
      tables: input.tables ?? [],
      warnings: input.warnings ?? [],
    };
  }
}
```

- [ ] **Step 4: Implement the diff normalization service with narrow, stable heuristics**

```ts
export class ExamplePairDiffService {
  extractSignals(input: {
    original: ExampleDocumentSnapshot;
    edited: ExampleDocumentSnapshot;
  }): EditIntentSignal[] {
    return [
      ...extractFrontMatterSignals(input),
      ...extractAbstractKeywordSignals(input),
      ...extractHeadingSignals(input),
      ...extractNumericSignals(input),
      ...extractTableSignals(input),
      ...extractReferenceSignals(input),
    ];
  }
}
```

- [ ] **Step 5: Run the gold-case test again**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

Expected: PASS for the signal extraction assertions.

- [ ] **Step 6: Commit the snapshot + diff seam**

```bash
git add apps/api/src/modules/editorial-rules/example-document-snapshot-adapter.ts apps/api/src/modules/editorial-rules/example-pair-diff-service.ts apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts
git commit -m "feat: add example pair snapshot and diff normalization seam"
```

### Task 4: Implement six rule package recognizers and card assembly

**Files:**
- Create: `apps/api/src/modules/editorial-rules/rule-package-recognizers.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

- [ ] **Step 1: Write a failing recognizer-level expectation for the six package kinds**

```ts
test("recognizers group normalized signals into six package candidates", () => {
  const candidates = recognizeRulePackages({
    original,
    edited,
    signals,
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.package_kind),
    [
      "front_matter",
      "abstract_keywords",
      "heading_hierarchy",
      "numeric_statistics",
      "three_line_table",
      "reference",
    ],
  );
});
```

- [ ] **Step 2: Run the authoring test file and confirm it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`

Expected: FAIL because recognition and card assembly are not implemented.

- [ ] **Step 3: Implement the six recognizers with a one-file registry**

```ts
export const RULE_PACKAGE_RECOGNIZERS: RulePackageRecognizer[] = [
  recognizeFrontMatterPackage,
  recognizeAbstractKeywordPackage,
  recognizeHeadingHierarchyPackage,
  recognizeNumericStatisticsPackage,
  recognizeThreeLineTablePackage,
  recognizeReferencePackage,
];
```

- [ ] **Step 4: Assemble the five future-UI cards in the package service**

```ts
export class EditorialRulePackageService {
  generateCandidates(input: RulePackageRecognitionInput): RulePackageCandidate[] {
    const seeds = recognizeRulePackages(input);
    return seeds.map((seed) => ({
      ...seed,
      cards: buildSemanticFiveCards(seed),
      preview: buildInitialPreview(seed),
    }));
  }
}
```

- [ ] **Step 5: Run both test files**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
```

Expected: authoring test still has preview/API failures, but six package recognition and card population assertions pass.

- [ ] **Step 6: Commit the recognizer layer**

```bash
git add apps/api/src/modules/editorial-rules/rule-package-recognizers.ts apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
git commit -m "feat: add rule package recognizers and semantic card assembly"
```

### Task 5: Implement preview explanation and backend API endpoints

**Files:**
- Create: `apps/api/src/modules/editorial-rules/rule-package-preview-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`

- [ ] **Step 1: Write a focused failing test for hit/miss explanation details**

```ts
test("preview includes hit reasons, miss reasons, and automation posture", async () => {
  const preview = await api.previewRulePackage({
    packageDraft: candidate,
    sampleText: "摘要 目的 观察治疗效果。",
  });

  assert.equal(preview.body.decision.automation_posture, "guarded_auto");
  assert.ok(preview.body.hits.some((entry) => entry.reason.length > 0));
  assert.ok(preview.body.misses.some((entry) => entry.reason.length > 0));
});
```

- [ ] **Step 2: Run the authoring spec and verify the failure**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`

Expected: FAIL because preview and routes are still missing.

- [ ] **Step 3: Implement the preview service**

```ts
export class RulePackagePreviewService {
  buildPreview(input: {
    candidate: RulePackageCandidate;
    sampleText: string;
  }): RulePackagePreview {
    return {
      hit_summary: summarizeHits(input),
      hits: explainHits(input),
      misses: explainMisses(input),
      decision: {
        automation_posture: input.candidate.automation_posture,
        needs_human_review: input.candidate.automation_posture !== "safe_auto",
        reason: buildDecisionReason(input.candidate),
      },
    };
  }
}
```

- [ ] **Step 4: Wire the API and HTTP server**

```ts
return {
  async generateRulePackageCandidates({ input }) {
    return { status: 200, body: service.generateCandidates(input) };
  },
  async previewRulePackage(input) {
    return { status: 200, body: service.previewCandidate(input) };
  },
};
```

- [ ] **Step 5: Run the authoring spec again**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit the preview/API layer**

```bash
git add apps/api/src/modules/editorial-rules/rule-package-preview-service.ts apps/api/src/modules/editorial-rules/editorial-rule-api.ts apps/api/src/modules/editorial-rules/index.ts apps/api/src/http/api-http-server.ts apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts
git commit -m "feat: add rule package preview api"
```

### Task 6: Add gold-case and anti-overfit regression coverage

**Files:**
- Modify: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Modify: `apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

- [ ] **Step 1: Add the real gold-case regression**

```ts
test("real gold case produces six candidates with expected postures and layers", async () => {
  const response = await api.generateRulePackageCandidates({
    input: buildRealSampleFixture(),
  });

  assert.equal(findCandidate(response.body, "three_line_table")?.automation_posture, "inspect_only");
  assert.equal(findCandidate(response.body, "front_matter")?.suggested_layer, "journal_template");
});
```

- [ ] **Step 2: Add a small front-matter synthetic case**

```ts
test("mini front matter fixture does not force unrelated packages", async () => {
  const response = await api.generateRulePackageCandidates({
    input: buildMiniFrontMatterFixture(),
  });

  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    ["front_matter"],
  );
});
```

- [ ] **Step 3: Add a small table/reference synthetic case**

```ts
test("mini table and reference fixture keeps the table package inspect_only", async () => {
  const response = await api.generateRulePackageCandidates({
    input: buildMiniTableReferenceFixture(),
  });

  assert.equal(findCandidate(response.body, "three_line_table")?.automation_posture, "inspect_only");
  assert.equal(findCandidate(response.body, "reference")?.suggested_layer, "template_family");
});
```

- [ ] **Step 4: Run the gold-case test file**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit the regression coverage**

```bash
git add apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts
git commit -m "test: add gold case regression coverage for rule packages"
```

### Task 7: Run the full editorial-rules checkpoint and polish docs

**Files:**
- Modify: `docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md`
- Test: `apps/api/test/editorial-rules/*.spec.ts`

- [ ] **Step 1: Re-read the spec and update any mismatched wording**

```md
- Confirm V1 scope still says: no UI, no publish-to-editorial-rule, backend-only outputs.
- Confirm the six supported package kinds match implementation names.
```

- [ ] **Step 2: Run the focused editorial-rules suite**

Run: `pnpm --filter @medical/api test -- editorial-rules`

Expected: PASS across the editorial-rules scope.

- [ ] **Step 3: Run API typecheck**

Run: `pnpm --filter @medical/api typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Record any intentionally deferred work in the spec**

```md
Deferred to Phase 2:
- semantic confirmation UI
- compile-to-editorial_rule
- knowledge projection
```

- [ ] **Step 5: Commit the checkpoint**

```bash
git add docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md
git add apps/api/src/modules/editorial-rules apps/api/test/editorial-rules packages/contracts/src
git commit -m "feat: complete backend-only example-driven rule package engine v1"
```

---

## Definition of Done

- The API can accept example-pair fixture input and return six future-UI-ready rule package candidates.
- Every candidate includes:
  - candidate list fields
  - five short card fields
  - preview explanation fields
- The real gold case plus two synthetic mini-cases pass.
- Table candidates stay `inspect_only`.
- No runtime `editorial_rule` publish path is added yet.
- The editorial-rules test scope and API typecheck both pass.

## Deferred Follow-Up

- Phase 2: semantic confirmation cards and advanced drawer UI
- Phase 2: compile confirmed packages into runtime `editorial_rule`
- Phase 2: project confirmed semantics into knowledge items
