# Example-Driven Rule Package V2E Controlled Knowledge Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade package-first compilation so confirmed semantic drafts compile into richer rule explainability and projection metadata, while published knowledge projections still flow only through the existing `Publish Rule Set` path.

**Architecture:** Extend the current package compile bridge instead of adding a new knowledge workflow. The backend will compile confirmed semantic fields into `explanation_payload`, `projection_payload`, `linkage_payload`, and conservative `evidence_level`, and the web workbench will show a lightweight projection-readiness summary without adding a second publish surface.

**Tech Stack:** TypeScript, React 18, Node `node:test`, `tsx`, existing editorial-rule services, existing knowledge projection service, template-governance workbench.

---

## File Structure

### Modified files

- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - Compile confirmed semantic drafts into richer rule metadata and projection-readiness explanations.
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - Extend compile result types with projection-readiness preview data.
- `packages/contracts/src/editorial-rule-packages.ts`
  - Mirror the projection-readiness contract additions for web/API consumers.
- `packages/contracts/src/index.ts`
  - Re-export the expanded rule-package contracts.
- `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
  - Add failing tests for semantic-to-rule metadata compilation and conservative evidence-level mapping.
- `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`
  - Add failing tests proving package-compiled rules publish into richer knowledge projections.
- `apps/web/src/features/editorial-rules/types.ts`
  - Add view models for projection-readiness explanations.
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - Keep web compile responses aligned with the backend contract.
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Preserve projection-readiness data through the workbench controller.
- `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
  - Show projection kinds, confirmation gaps, and post-publish knowledge expectations without exposing a second publish action.
- `apps/web/test/template-governance-rule-package-controller.spec.ts`
  - Add failing coverage for the expanded compile result.
- `apps/web/test/template-governance-rule-package-compile-panel.spec.tsx`
  - Add failing coverage for the projection-readiness summary.
- `docs/superpowers/specs/2026-04-11-example-driven-rule-package-v2e-controlled-knowledge-projection-design.md`
  - Keep implementation status in sync once V2E lands.
- `docs/superpowers/specs/2026-04-08-medical-rule-library-v2-design.md`
  - Mark V2 knowledge-projection scope as landed if V2E closes successfully.

## Test Commands

- Backend focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-projection.spec.ts`
- Web focused:
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx`
- Checkpoints:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/http/editorial-rule-package-compile-http.spec.ts ./test/editorial-rules/rule-package-compile-service.spec.ts ./test/editorial-rules/editorial-rule-package-authoring.spec.ts ./test/editorial-rules/example-source-session-service.spec.ts ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts ./test/editorial-rules/editorial-rule-projection.spec.ts`
  - `pnpm --filter @medical/api test -- editorial-rules`
  - `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts ./test/template-governance-rule-package-compile-panel.spec.tsx ./test/template-governance-rule-package-compile-flow.spec.tsx ./test/template-governance-rule-package-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx`
  - `pnpm --filter @medsys/web test`

## Task 1: Compile confirmed semantic drafts into richer rule metadata

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`

- [ ] **Step 1: Write a failing test for semantic draft compilation into explainability fields**

```ts
test("compile-to-draft writes confirmed semantic fields into explanation, projection, linkage, and evidence metadata", async () => {
  const harness = createRulePackageCompileHarness();
  await seedCompileContext(harness);

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);
  assert.equal(rules[0]?.projection_payload?.summary, "...");
  assert.equal(rules[0]?.explanation_payload?.incorrect_example, "...");
  assert.equal(rules[0]?.linkage_payload?.source_snapshot_asset_id, "session-demo-1");
  assert.equal(rules[0]?.evidence_level, "low");
});
```

- [ ] **Step 2: Write a failing test for conservative downgrade when semantic confirmation is incomplete**

```ts
test("compile-to-draft does not promote unconfirmed semantic fields into high-confidence projection metadata", async () => {
  const harness = createRulePackageCompileHarness();
  await seedCompileContext(harness);
  const packageDraft = buildFrontMatterPackageDraft();
  packageDraft.semantic_draft = {
    ...packageDraft.semantic_draft!,
    confirmed_fields: ["summary", "applicability"],
  };

  const result = await harness.service.compileToDraft(...);
  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);

  assert.equal(rules[0]?.projection_payload?.incorrect_example, undefined);
  assert.equal(rules[0]?.evidence_level, "unknown");
});
```

- [ ] **Step 3: Run the focused compile-service test to verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: FAIL because compiled rules do not yet persist rich explainability/projection metadata.

- [ ] **Step 4: Implement the minimal semantic-to-rule compilation**

```ts
explanation_payload: buildExplanationPayload(packageDraft, source)
projection_payload: buildProjectionPayload(packageDraft)
linkage_payload: buildLinkagePayload(packageDraft, source)
evidence_level: classifyEvidenceLevel(packageDraft, source)
```

- [ ] **Step 5: Re-run the focused compile-service test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts`
Expected: PASS.

## Task 2: Prove published package-compiled rules produce richer knowledge projections

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-projection.spec.ts`

- [ ] **Step 1: Write a failing projection test for package-compiled rules**

```ts
test("publishing a package-compiled rule set projects confirmed semantic rationale, examples, and boundaries", async () => {
  const harness = await seedPublishedPackageCompiledRuleSet();
  const projectedRule = (await harness.knowledgeRepository.list()).find(
    (record) => record.projection_source?.projection_kind === "rule",
  );

  assert.match(projectedRule?.summary ?? "", /front matter/i);
  assert.match(projectedRule?.canonical_text ?? "", /Rationale:/i);
  assert.match(projectedRule?.canonical_text ?? "", /Incorrect example detail/i);
  assert.equal(
    projectedRule?.projection_source?.projection_context.not_applicable_boundary,
    "..."
  );
});
```

- [ ] **Step 2: Run the focused projection test to verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-projection.spec.ts`
Expected: FAIL because package-compiled rules do not yet feed rich projection fields into publish-time projection.

- [ ] **Step 3: Add the minimal compile metadata needed for the existing projection service to emit richer knowledge**

```ts
projection_payload.summary ??= derivedSemanticSummary;
explanation_payload.rationale ??= derivedRationale;
```

- [ ] **Step 4: Re-run the focused projection test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-projection.spec.ts`
Expected: PASS.

## Task 3: Expose lightweight projection-readiness explanations in the workbench

**Files:**
- Modify: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
- Test: `apps/web/test/template-governance-rule-package-controller.spec.ts`
- Test: `apps/web/test/template-governance-rule-package-compile-panel.spec.tsx`

- [ ] **Step 1: Write a failing controller test for projection-readiness fields**

```ts
test("controller returns projection readiness alongside publish readiness", async () => {
  const result = await controller.compileRulePackagesToDraft(buildCompileInput());
  assert.deepEqual(result.projection_readiness.projected_kinds, [
    "rule",
    "checklist",
    "prompt_snippet",
  ]);
});
```

- [ ] **Step 2: Write a failing compile-panel render test for the projection summary**

```tsx
test("compile panel explains post-publish knowledge projections without rendering a second publish action", () => {
  const markup = renderToStaticMarkup(
    <RulePackageCompilePanel compileResult={buildCompileResultWithProjectionReadiness()} ... />,
  );

  assert.match(markup, /Knowledge Projection Preview/);
  assert.match(markup, /rule, checklist, prompt_snippet/);
  assert.match(markup, /confirmed semantic fields/);
  assert.doesNotMatch(markup, /Publish Knowledge/);
});
```

- [ ] **Step 3: Run the focused web tests to verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx
```

Expected: FAIL because the projection-readiness view model does not exist yet.

- [ ] **Step 4: Implement the minimal projection-readiness contract and panel summary**

```ts
projection_readiness: {
  projected_kinds: ["rule", "checklist", "prompt_snippet"],
  confirmed_semantic_fields: [...],
  withheld_semantic_fields: [...],
  reasons: [...]
}
```

- [ ] **Step 5: Re-run the focused web tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-compile-panel.spec.tsx
```

Expected: PASS.

## Task 4: Run V2E checkpoints and sync docs

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-example-driven-rule-package-v2e-controlled-knowledge-projection-design.md`
- Modify: `docs/superpowers/specs/2026-04-08-medical-rule-library-v2-design.md`

- [ ] **Step 1: Add implementation status notes to the V2E design doc**

```md
Implemented in V2E:
- confirmed semantic fields compile into explainability/projection metadata
- published package-compiled rules project richer knowledge
- package-first compile panel explains post-publish knowledge expectations

Still deferred on purpose:
- package-native approval workflow
- manuscript ingestion
- second publish path
```

- [ ] **Step 2: Run focused backend and web verification**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-package-compile-service.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-projection.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-package-controller.spec.ts ./test/template-governance-rule-package-compile-panel.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run package-level checkpoints**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/editorial-rule-package-compile-http.spec.ts ./test/editorial-rules/rule-package-compile-service.spec.ts ./test/editorial-rules/editorial-rule-package-authoring.spec.ts ./test/editorial-rules/example-source-session-service.spec.ts ./test/editorial-rules/reviewed-case-rule-package-source-service.spec.ts ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts ./test/editorial-rules/editorial-rule-projection.spec.ts
pnpm --filter @medical/api test -- editorial-rules
pnpm --filter @medsys/web test
```

Expected: PASS.

## Definition Of Done

- Package-first compile writes confirmed semantic meaning into `explanation_payload`, `projection_payload`, `linkage_payload`, and conservative `evidence_level`.
- Publishing package-compiled rules through the existing rule-set flow yields richer `rule / checklist / prompt_snippet` projections.
- The package-first compile panel explains post-publish knowledge expectations without creating a second publish path.
- No package-native approval workflow or manuscript-ingestion scope is introduced.
- Focused and package-level API/web tests pass, and V2 can be closed on the stable route.
