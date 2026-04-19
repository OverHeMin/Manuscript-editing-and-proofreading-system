# Rule Execution Governance Platform Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining rule execution, governance, and observability work so the system can run live governed rule hits through human decision, governed writeback, scoped release, metrics, and Harness-backed online regression.

**Architecture:** Build on the existing governed execution, `review-items`, learning writeback, and Harness backbones in three phases. Keep manuscript workbench as execution intake, unified review as the formal decision desk, rule center as the downstream governance surface, and Harness / verification ops as the validation and regression authority.

**Tech Stack:** TypeScript, React, Postgres SQL migrations, Node test runner with `tsx`, existing governed execution, learning-governance, rule-center, and Harness modules

---

## File Structure

### Backend: execution activation and review intake

- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/src/modules/editorial-execution/deterministic-format-rule-executor.ts`
- Modify: `apps/api/src/modules/editorial-execution/editorial-rule-expectation.ts`
- Modify: `apps/api/src/modules/editorial-execution/proofreading-rule-checker.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/review-items/review-item-record.ts`
- Modify: `apps/api/src/modules/review-items/review-item-mapper.ts`
- Modify: `apps/api/src/modules/review-items/review-items-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Create: `apps/api/src/database/migrations/0047_rule_execution_hit_posture.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`

### Backend: rule platform scope, precedence, conflict, and release

- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-conflict-service.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-release-service.ts`
- Create: `apps/api/src/database/migrations/0048_rule_platform_scope_release_governance.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`

### Backend: metrics and Harness online regression

- Create: `apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-activation-metrics-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Create: `apps/api/src/database/migrations/0049_rule_activation_metrics.sql`
- Create: `apps/api/src/database/migrations/0050_online_execution_regression.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`

### Frontend: manuscript workbench and unified review

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/review-items/types.ts`
- Modify: `apps/web/src/features/review-items/review-items-api.ts`
- Modify: `apps/web/src/features/review-items/review-items-workbench-state.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-state.ts`

### Frontend: rule center platform and observability

- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-explainability.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Create: `apps/web/src/features/template-governance/rule-platform-scope-panel.tsx`
- Create: `apps/web/src/features/template-governance/rule-platform-conflict-panel.tsx`
- Create: `apps/web/src/features/template-governance/rule-platform-release-panel.tsx`
- Create: `apps/web/src/features/template-governance/rule-platform-metrics-panel.tsx`

### Frontend: Harness and evaluation workbench

- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-activation-gate.tsx`

### Focused tests

- Modify: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Modify: `apps/api/test/review-items/review-items-service.spec.ts`
- Modify: `apps/api/test/review-items/review-items-http.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`
- Modify: `apps/api/test/verification-ops/governed-run-check-execution.spec.ts`
- Create: `apps/api/test/verification-ops/online-execution-regression.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Modify: `apps/web/test/learning-review-workbench-page.spec.tsx`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`
- Create: `apps/web/test/template-governance-rule-platform-panels.spec.tsx`
- Create: `apps/web/test/evaluation-workbench-online-regression.spec.tsx`

---

## Phase 1: Shippable Main Chain

### Task 1: Lock live execution-hit posture in API and web tests

**Files:**
- Modify: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Modify: `apps/api/test/review-items/review-items-service.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Modify: `apps/web/test/learning-review-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing API tests for `candidate_change` and `inspect_only` posture**

Add focused expectations that live editing and proofreading execution findings expose:

```ts
candidate_posture: "candidate_change" | "inspect_only";
evidence_pack: {
  location: Record<string, unknown>;
  excerpt?: string;
  suggestion?: string;
  rationale?: string;
};
```

- [ ] **Step 2: Run the focused API tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-rule-execution.spec.ts ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts ./test/review-items/review-items-service.spec.ts`

Expected: FAIL because the current execution payloads and review-item records do not consistently expose posture and provenance fields.

- [ ] **Step 3: Write failing web tests for posture-aware high-risk cards**

Lock that the manuscript workbench and unified review surfaces render:

- candidate modification wording for `candidate_change`
- inspect-only wording for `inspect_only`
- evidence, location, and rationale without inventing an auto-apply flow

- [ ] **Step 4: Run the focused web tests and verify they fail**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/learning-review-workbench-page.spec.tsx`

Expected: FAIL because the current web state does not yet model posture as a first-class property.

- [ ] **Step 5: Commit the red tests**

```bash
git add apps/api/test/editing/editing-rule-execution.spec.ts apps/api/test/proofreading/proofreading-rule-checker.spec.ts apps/api/test/proofreading/proofreading-rule-report.spec.ts apps/api/test/review-items/review-items-service.spec.ts apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx apps/web/test/learning-review-workbench-page.spec.tsx
git commit -m "test: lock governed execution hit posture"
```

### Task 2: Implement shared execution-hit contract and deepen the first bounded rule families

**Files:**
- Modify: `apps/api/src/modules/editorial-execution/types.ts`
- Modify: `apps/api/src/modules/editorial-execution/deterministic-format-rule-executor.ts`
- Modify: `apps/api/src/modules/editorial-execution/editorial-rule-expectation.ts`
- Modify: `apps/api/src/modules/editorial-execution/proofreading-rule-checker.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-recognizers.ts`

- [ ] **Step 1: Add the shared execution-hit contract**

Introduce a reusable execution-hit shape in `types.ts`:

```ts
export type GovernedExecutionHitPosture = "candidate_change" | "inspect_only";

export interface GovernedExecutionHitRecord {
  rule_id: string;
  module: "screening" | "editing" | "proofreading";
  candidate_posture: GovernedExecutionHitPosture;
  risk_level: "low" | "medium" | "high" | "critical";
  location?: Record<string, unknown>;
  excerpt?: string;
  suggestion?: string;
  rationale?: string;
  semantic_hit?: Record<string, unknown>;
}
```

- [ ] **Step 2: Extend the first-wave deterministic families**

Deepen only the highest-value structural families in this phase:

- table title / table note / table semantic target hits
- structural abstract label presence
- statistical-expression normalization checks
- reference-entry formatting checks

Keep the family list bounded; do not attempt every editorial rule family in one pass.

- [ ] **Step 3: Thread the shared hit contract through editing and proofreading**

Ensure both services emit the new hit records into their execution payloads and preserve:

- location
- excerpt
- suggestion
- rationale
- semantic evidence

- [ ] **Step 4: Run the focused API tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-rule-execution.spec.ts ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: PASS

- [ ] **Step 5: Run API typecheck**

Run: `pnpm --filter @medical/api typecheck`

Expected: exit 0

- [ ] **Step 6: Commit the execution-hit implementation**

```bash
git add apps/api/src/modules/editorial-execution/types.ts apps/api/src/modules/editorial-execution/deterministic-format-rule-executor.ts apps/api/src/modules/editorial-execution/editorial-rule-expectation.ts apps/api/src/modules/editorial-execution/proofreading-rule-checker.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/editorial-rules/editorial-rule-table-hit-service.ts apps/api/src/modules/editorial-rules/rule-package-recognizers.ts
git commit -m "feat: unify governed execution hit posture"
```

### Task 3: Persist posture-aware governed-hit review intake and provenance

**Files:**
- Create: `apps/api/src/database/migrations/0047_rule_execution_hit_posture.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/src/modules/review-items/review-item-record.ts`
- Modify: `apps/api/src/modules/review-items/review-item-mapper.ts`
- Modify: `apps/api/src/modules/review-items/review-items-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/review-items/review-items-service.spec.ts`
- Modify: `apps/api/test/review-items/review-items-http.spec.ts`

- [ ] **Step 1: Write the failing persistence and HTTP tests**

Lock that governed-hit review items persist:

- `candidate_posture`
- `decision_source = "execution_hit"`
- execution evidence payload
- manuscript / snapshot lineage

- [ ] **Step 2: Run the focused review-item tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/review-items/review-items-service.spec.ts ./test/review-items/review-items-http.spec.ts`

Expected: FAIL because the current record shape does not store the new posture and provenance fields.

- [ ] **Step 3: Add the migration and update the review-item contract**

Extend the governed-hit review-item persistence shape rather than inventing a second table. The migration should add bounded columns for posture and provenance, not another generic JSON blob for everything.

- [ ] **Step 4: Keep the decision API backward compatible**

Any existing client that does not send the new fields should still function. New fields should be additive, not breaking.

- [ ] **Step 5: Run the focused review-item tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/review-items/review-items-service.spec.ts ./test/review-items/review-items-http.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit the review-intake changes**

```bash
git add apps/api/src/database/migrations/0047_rule_execution_hit_posture.sql apps/api/src/database/migration-ledger.ts apps/api/src/modules/review-items/review-item-record.ts apps/api/src/modules/review-items/review-item-mapper.ts apps/api/src/modules/review-items/review-items-service.ts apps/api/src/http/api-http-server.ts apps/api/test/review-items/review-items-service.spec.ts apps/api/test/review-items/review-items-http.spec.ts
git commit -m "feat: persist governed hit posture and provenance"
```

### Task 4: Wire manuscript workbench, unified review, and rule writeback to the completed Phase 1 main chain

**Files:**
- Modify: `apps/web/src/features/review-items/types.ts`
- Modify: `apps/web/src/features/review-items/review-items-api.ts`
- Modify: `apps/web/src/features/review-items/review-items-workbench-state.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-state.ts`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`

- [ ] **Step 1: Update the web view-models for posture-aware governed hits**

Add the new fields to the web review-item types and ensure the workbench state can distinguish:

- candidate modification
- inspect-only finding
- already-routed rule candidate

- [ ] **Step 2: Add the first-pass operator actions in manuscript workbench**

The manuscript workbench should allow:

- submit for formal review
- record manual handling without routing into rule center
- inspect evidence and location

Do not add final rule-authoring controls to this page.

- [ ] **Step 3: Keep unified review as the formal decision desk**

Learning review should own the authoritative route decisions and refresh downstream `editorial_rule_draft` state after rule-directed approval.

- [ ] **Step 4: Run the focused web and learning tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/learning-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts`

Expected: PASS

- [ ] **Step 5: Run the focused API learning-governance test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/learning-governance/learning-governance.spec.ts`

Expected: PASS

- [ ] **Step 6: Run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`

Expected: exit 0

- [ ] **Step 7: Commit the Phase 1 end-to-end chain**

```bash
git add apps/web/src/features/review-items/types.ts apps/web/src/features/review-items/review-items-api.ts apps/web/src/features/review-items/review-items-workbench-state.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/learning-review/learning-review-workbench-page.tsx apps/web/src/features/learning-review/learning-review-workbench-state.ts apps/web/src/features/template-governance/rule-learning-pane.tsx apps/api/src/modules/learning-governance/learning-governance-service.ts apps/api/test/learning-governance/learning-governance.spec.ts apps/web/test/rule-center-learning-review.spec.ts
git commit -m "feat: complete governed execution main chain"
```

---

## Phase 2: Rule Platform Completion

### Task 5: Formalize rule scope and precedence in persistence, resolution, and authoring

**Files:**
- Create: `apps/api/src/database/migrations/0048_rule_platform_scope_release_governance.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Modify: `apps/api/test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`

- [ ] **Step 1: Write failing tests for the six-dimensional scope model**

Lock that authored rules can carry:

- module
- manuscript type
- template family
- journal
- section
- object granularity

and that resolution still remains deterministic.

- [ ] **Step 2: Run the focused scope and persistence tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-resolution.spec.ts ./test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`

Expected: FAIL because the current rule record and repository layer do not formalize the full scope model.

- [ ] **Step 3: Add the precedence model**

Introduce explicit precedence tiers and same-tier `priority` ordering. Keep resolution deterministic and inspectable; do not bury precedence in ad hoc `if` branches.

- [ ] **Step 4: Update the authoring form to expose scope intentionally**

Expose bounded fields for:

- journal override
- section targeting
- object granularity
- same-tier priority

Do not fall back to raw JSON editing.

- [ ] **Step 5: Run the focused API and web tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-resolution.spec.ts ./test/editorial-rules/postgres-editorial-rule-persistence.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-authoring.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit the scope and precedence layer**

```bash
git add apps/api/src/database/migrations/0048_rule_platform_scope_release_governance.sql apps/api/src/database/migration-ledger.ts apps/api/src/modules/editorial-rules/editorial-rule-record.ts apps/api/src/modules/editorial-rules/postgres-editorial-rule-repository.ts apps/api/src/modules/editorial-rules/editorial-rule-service.ts apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts apps/api/src/modules/editorial-rules/editorial-rule-api.ts apps/web/src/features/template-governance/rule-authoring-types.ts apps/web/src/features/template-governance/rule-authoring-form.tsx apps/web/src/features/template-governance/rule-authoring-serialization.ts apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts apps/api/test/editorial-rules/postgres-editorial-rule-persistence.spec.ts apps/web/test/template-governance-rule-authoring.spec.ts
git commit -m "feat: formalize rule scope and precedence"
```

### Task 6: Add conflict classification and explainability for hit, miss, override, and manual-review reasons

**Files:**
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-conflict-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts`
- Modify: `apps/api/src/modules/editorial-execution/editorial-rule-expectation.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-explainability.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-preview.tsx`
- Create: `apps/web/src/features/template-governance/rule-platform-conflict-panel.tsx`
- Modify: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Create: `apps/web/test/template-governance-rule-platform-panels.spec.tsx`

- [ ] **Step 1: Write failing tests for `override`, `merge`, and `exclusive_conflict`**

Lock the three conflict classes and make sure `exclusive_conflict` does not silently resolve into a final manuscript mutation.

- [ ] **Step 2: Run the focused preview and governance tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-preview.spec.ts ./test/editorial-rules/editorial-rule-governance.spec.ts`

Expected: FAIL because conflict outcomes are not yet a first-class model.

- [ ] **Step 3: Implement conflict classification in resolution**

Keep conflict evaluation separate from rule record persistence. The new conflict service should take resolved candidate rules and emit:

```ts
type RuleConflictKind = "override" | "merge" | "exclusive_conflict";
```

- [ ] **Step 4: Expose explainability panels in rule center**

Show:

- why the rule hit
- why it missed
- why it was overridden
- why it requires human confirmation

- [ ] **Step 5: Run the focused API and web tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-preview.spec.ts ./test/editorial-rules/editorial-rule-governance.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-platform-panels.spec.tsx`

Expected: PASS

- [ ] **Step 6: Commit the conflict and explainability layer**

```bash
git add apps/api/src/modules/editorial-rules/editorial-rule-conflict-service.ts apps/api/src/modules/editorial-rules/editorial-rule-resolution-service.ts apps/api/src/modules/editorial-rules/editorial-rule-preview-service.ts apps/api/src/modules/editorial-execution/editorial-rule-expectation.ts apps/web/src/features/template-governance/rule-authoring-explainability.tsx apps/web/src/features/template-governance/rule-authoring-preview.tsx apps/web/src/features/template-governance/rule-platform-conflict-panel.tsx apps/api/test/editorial-rules/editorial-rule-preview.spec.ts apps/api/test/editorial-rules/editorial-rule-governance.spec.ts apps/web/test/template-governance-rule-platform-panels.spec.tsx
git commit -m "feat: add rule conflict classification and explainability"
```

### Task 7: Add candidate/canary/active/rolled-back release posture and rule-center controls

**Files:**
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-release-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Create: `apps/web/src/features/template-governance/rule-platform-scope-panel.tsx`
- Create: `apps/web/src/features/template-governance/rule-platform-release-panel.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`
- Modify: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`

- [ ] **Step 1: Write failing tests for rule release states and rollback posture**

Lock the release lifecycle:

```ts
type EditorialRuleReleaseStatus =
  | "draft"
  | "candidate"
  | "canary"
  | "active"
  | "archived"
  | "rolled_back";
```

- [ ] **Step 2: Run the focused release tests and verify they fail**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-overview-page.spec.tsx`

Expected: FAIL because the current rule center does not yet expose a release lifecycle beyond draft/publish posture.

- [ ] **Step 3: Implement bounded canary and rollback operations**

Scope canary and rollback by:

- module
- manuscript type
- template family
- optional journal override

Keep the release API separate from generic rule edit operations.

- [ ] **Step 4: Surface release controls in rule center**

Add controls for:

- promote draft to candidate
- canary activation
- active promotion
- rollback to last good release

- [ ] **Step 5: Run the focused web tests and Harness rollback sanity tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-overview-page.spec.tsx`

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/harness-control-plane/harness-control-plane-service.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit the release posture layer**

```bash
git add apps/api/src/modules/editorial-rules/editorial-rule-release-service.ts apps/api/src/modules/editorial-rules/editorial-rule-service.ts apps/api/src/modules/editorial-rules/editorial-rule-api.ts apps/api/src/http/api-http-server.ts apps/web/src/features/template-governance/rule-platform-scope-panel.tsx apps/web/src/features/template-governance/rule-platform-release-panel.tsx apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts apps/web/test/template-governance-rule-ledger-page.spec.tsx apps/web/test/template-governance-overview-page.spec.tsx
git commit -m "feat: add rule release posture and rollback controls"
```

---

## Phase 3: Observability And Online Regression

### Task 8: Persist rule activation metrics and writeback outcomes

**Files:**
- Create: `apps/api/src/database/migrations/0049_rule_activation_metrics.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/postgres-editorial-rule-activation-metrics-repository.ts`
- Create: `apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/review-items/review-items-service.ts`
- Modify: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`

- [ ] **Step 1: Write failing tests for activation, quality, and writeback metrics**

Lock storage and aggregation for:

- hit counts
- false-positive outcomes
- human-confirmation outcomes
- rule-candidate routing counts
- writeback creation and apply success

- [ ] **Step 2: Run the focused metrics tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/learning-governance/learning-governance.spec.ts ./test/review-items/review-items-service.spec.ts`

Expected: FAIL because rule-level operational metrics are not yet persisted.

- [ ] **Step 3: Implement the metrics write points**

Write metrics when:

- a governed rule hit is emitted
- a review-item decision is recorded
- a writeback is created
- a writeback is applied

Keep write-side instrumentation inside the existing services; do not build a sidecar event bus for this phase.

- [ ] **Step 4: Run the focused metrics tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/learning-governance/learning-governance.spec.ts ./test/review-items/review-items-service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit the metrics persistence layer**

```bash
git add apps/api/src/database/migrations/0049_rule_activation_metrics.sql apps/api/src/database/migration-ledger.ts apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-repository.ts apps/api/src/modules/editorial-rules/postgres-editorial-rule-activation-metrics-repository.ts apps/api/src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/review-items/review-items-service.ts apps/api/src/modules/learning-governance/learning-governance-service.ts apps/api/test/learning-governance/learning-governance.spec.ts
git commit -m "feat: persist rule activation and writeback metrics"
```

### Task 9: Add rule-center dashboards for global, rule-level, and release-comparison views

**Files:**
- Create: `apps/web/src/features/template-governance/rule-platform-metrics-panel.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-platform-panels.spec.tsx`

- [ ] **Step 1: Write failing web tests for the three dashboard views**

Lock:

- global operations overview
- single-rule detail metrics
- release comparison summary

- [ ] **Step 2: Run the focused dashboard tests and verify they fail**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-platform-panels.spec.tsx`

Expected: FAIL because rule center does not yet surface the required effect metrics.

- [ ] **Step 3: Add the dashboard panels without creating a new workbench**

Rule center should gain:

- effect overview cards in the overview page
- rule-level metrics panel in the rule ledger
- release comparison summary next to release controls

- [ ] **Step 4: Run the focused web tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-rule-platform-panels.spec.tsx`

Expected: PASS

- [ ] **Step 5: Commit the rule-center observability UI**

```bash
git add apps/web/src/features/template-governance/rule-platform-metrics-panel.tsx apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-overview-page.tsx apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx apps/web/src/features/template-governance/rule-learning-pane.tsx apps/web/test/template-governance-overview-page.spec.tsx apps/web/test/template-governance-rule-ledger-page.spec.tsx apps/web/test/template-governance-rule-platform-panels.spec.tsx
git commit -m "feat: add rule center observability dashboards"
```

### Task 10: Extend verification ops and Harness for online execution regression suites

**Files:**
- Create: `apps/api/src/database/migrations/0050_online_execution_regression.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- Create: `apps/api/test/verification-ops/online-execution-regression.spec.ts`
- Create: `apps/web/test/evaluation-workbench-online-regression.spec.tsx`

- [ ] **Step 1: Write failing API tests for online execution regression suite types**

Lock support for:

- `module_regression_suite`
- `scope_regression_suite`
- `rule_family_regression_suite`

and bind them to governed execution replay evidence instead of generic benchmark output.

- [ ] **Step 2: Run the focused verification-ops tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/online-execution-regression.spec.ts`

Expected: FAIL because verification ops does not yet model online execution regression suites.

- [ ] **Step 3: Add repository and service support for online execution regression**

Keep online regression within `verification-ops`; do not fork a second Harness evaluation module.

- [ ] **Step 4: Surface the new suites in Harness UI**

The evaluation workbench should let operators:

- select regression suite type
- compare canary vs baseline
- inspect degradation reasons

- [ ] **Step 5: Run the focused API and web tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/online-execution-regression.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/evaluation-workbench-online-regression.spec.tsx`

Expected: PASS

- [ ] **Step 6: Commit the online regression layer**

```bash
git add apps/api/src/database/migrations/0050_online_execution_regression.sql apps/api/src/database/migration-ledger.ts apps/api/src/modules/verification-ops/verification-ops-record.ts apps/api/src/modules/verification-ops/verification-ops-repository.ts apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts apps/api/src/modules/verification-ops/verification-ops-service.ts apps/api/src/modules/verification-ops/verification-ops-api.ts apps/api/src/http/api-http-server.ts apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/src/features/evaluation-workbench/harness-operator-section.tsx apps/api/test/verification-ops/online-execution-regression.spec.ts apps/web/test/evaluation-workbench-online-regression.spec.tsx
git commit -m "feat: add harness online execution regression"
```

### Task 11: Gate canary promotion and rollback recommendations with Harness evidence

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-release-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/web/src/features/template-governance/rule-platform-release-panel.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-activation-gate.tsx`
- Modify: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Modify: `apps/web/test/template-governance-rule-platform-panels.spec.tsx`

- [ ] **Step 1: Write failing tests for evidence-gated canary promotion**

Lock that:

- candidate -> canary requires candidate validation evidence
- canary -> active requires online execution regression evidence
- degraded metrics or regression failures produce a blocked promotion or rollback recommendation

- [ ] **Step 2: Run the focused release-gate tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-governance.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-platform-panels.spec.tsx`

Expected: FAIL because release transitions are not yet gated by Harness evidence.

- [ ] **Step 3: Implement the release-gate policy**

Keep the gate policy declarative and local to the release service. Avoid spreading release checks across the controller and UI.

- [ ] **Step 4: Surface blocked-state reasons in the release panel**

The UI should explain:

- missing validation evidence
- regression degradation
- rollback recommendation trigger

- [ ] **Step 5: Run the focused API and web tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-governance.spec.ts`

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-platform-panels.spec.tsx`

Expected: PASS

- [ ] **Step 6: Commit the gated release flow**

```bash
git add apps/api/src/modules/editorial-rules/editorial-rule-release-service.ts apps/api/src/modules/editorial-rules/editorial-rule-service.ts apps/api/src/modules/verification-ops/verification-ops-service.ts apps/web/src/features/template-governance/rule-platform-release-panel.tsx apps/web/src/features/admin-governance/harness-activation-gate.tsx apps/api/test/editorial-rules/editorial-rule-governance.spec.ts apps/web/test/template-governance-rule-platform-panels.spec.tsx
git commit -m "feat: gate rule release with harness evidence"
```

### Task 12: Run the final cross-phase verification suite

**Files:**
- Test: `apps/api/test/editing/editing-rule-execution.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Test: `apps/api/test/review-items/review-items-service.spec.ts`
- Test: `apps/api/test/review-items/review-items-http.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-resolution.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-preview.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-governance.spec.ts`
- Test: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Test: `apps/api/test/verification-ops/governed-run-check-execution.spec.ts`
- Test: `apps/api/test/verification-ops/online-execution-regression.spec.ts`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Test: `apps/web/test/learning-review-workbench-page.spec.tsx`
- Test: `apps/web/test/rule-center-learning-review.spec.ts`
- Test: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`
- Test: `apps/web/test/template-governance-overview-page.spec.tsx`
- Test: `apps/web/test/template-governance-rule-platform-panels.spec.tsx`
- Test: `apps/web/test/evaluation-workbench-online-regression.spec.tsx`

- [ ] **Step 1: Run the focused API regression suite**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editing/editing-rule-execution.spec.ts ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts ./test/review-items/review-items-service.spec.ts ./test/review-items/review-items-http.spec.ts ./test/editorial-rules/editorial-rule-resolution.spec.ts ./test/editorial-rules/editorial-rule-preview.spec.ts ./test/editorial-rules/editorial-rule-governance.spec.ts ./test/learning-governance/learning-governance.spec.ts ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/online-execution-regression.spec.ts`

Expected: PASS

- [ ] **Step 2: Run API typecheck**

Run: `pnpm --filter @medical/api typecheck`

Expected: exit 0

- [ ] **Step 3: Run the focused web regression suite**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/learning-review-workbench-page.spec.tsx ./test/rule-center-learning-review.spec.ts ./test/template-governance-rule-ledger-page.spec.tsx ./test/template-governance-overview-page.spec.tsx ./test/template-governance-rule-platform-panels.spec.tsx ./test/evaluation-workbench-online-regression.spec.tsx`

Expected: PASS

- [ ] **Step 4: Run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`

Expected: exit 0

- [ ] **Step 5: Perform manual acceptance spot-checks**

Verify all of the following manually before claiming completion:

- a live editing run produces a posture-aware governed hit
- the manuscript workbench can submit that hit into formal review
- a rule-directed review outcome materializes an `editorial_rule_draft`
- a rule in canary state shows release evidence and gate status
- Harness can show an online execution regression result for a release candidate

- [ ] **Step 6: Commit the final verification evidence**

```bash
git add docs/superpowers/specs/2026-04-19-rule-execution-governance-platform-completion-design.md docs/superpowers/plans/2026-04-19-rule-execution-governance-platform-completion.md
git commit -m "docs: finalize rule execution governance completion plan"
```
