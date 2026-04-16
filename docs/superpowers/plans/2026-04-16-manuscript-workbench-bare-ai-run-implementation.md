# Manuscript Workbench Bare AI Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one extra bounded workbench action, `AI 自动处理（本次）`, to `初筛 / 编辑 / 校对` so operators can trigger a one-time no-template AI run without replacing the governed default flow.

**Architecture:** Keep the existing workbench routes, controller, and governed run family intact. Add one request-level `executionMode` branch that defaults to `governed`, wire one extra operator action in the shared workbench UI, and implement a bounded bare-run backend path that skips template-family governance but still creates normal stage outputs, preserves asset history, and leaves enough internal metadata for traceability and downstream proofreading closeout.

**Tech Stack:** React 18, TypeScript, Vite, existing `apps/web/src/features/manuscript-workbench`, existing screening/editing/proofreading API clients, Node/TS API services in `apps/api`, shared workspace types from `@medical/contracts`, existing manuscript/job/asset services and HTTP workbench tests.

---

## Scope And Status

This plan executes the approved design in:

- `docs/superpowers/specs/2026-04-16-manuscript-workbench-bare-ai-run-design.md`

This plan must stay aligned with the existing manuscript workbench phase rules in:

- `docs/superpowers/plans/2026-04-14-manuscript-workbench-final-desk-and-governed-intake-implementation.md`
- `docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md`

The product rules are fixed:

- keep governed execution as the default path
- add exactly one extra operator-facing action inside each of the three workbenches
- do not add a separate mode page, comparison dashboard, or new settings surface
- bare mode is one click only and must not rewrite manuscript governance state
- bare results become the current result, while older governed outputs remain in asset history
- proofreading closeout actions remain `确认校对定稿` and `发布人工终稿`
- internal traceability must exist, but customer-facing filenames and labels must stay simple

Out of scope for this plan:

- changing upload-title behavior to default to file name
- adding a global bare-run toggle
- exposing bare-run-only model/provider tuning in the workbench
- replacing governed execution summaries with a second parallel summary system

## File Structure

### Shared contract and request plumbing

- Modify: `packages/contracts/src/governed-execution.ts`
- Modify: `apps/web/src/features/screening/types.ts`
- Modify: `apps/web/src/features/editing/types.ts`
- Modify: `apps/web/src/features/proofreading/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/screening/screening-api.ts`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-api.ts`

### Web workbench surface

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

### Backend bare-run resolution and traceability

- Create: `apps/api/src/modules/shared/bare-module-context-resolver.ts`
- Create: `apps/api/src/modules/shared/bare-module-prompt-skeletons.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`

### Tests

- Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Create: `apps/api/test/shared/bare-module-context-resolver.spec.ts`
- Create: `apps/api/test/screening/screening-bare-run.spec.ts`
- Create: `apps/api/test/editing/editing-bare-run.spec.ts`
- Create: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

## Task 1: Introduce a shared one-click execution mode contract without changing the governed default

**Files:**
- Modify: `packages/contracts/src/governed-execution.ts`
- Modify: `apps/web/src/features/screening/types.ts`
- Modify: `apps/web/src/features/editing/types.ts`
- Modify: `apps/web/src/features/proofreading/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/screening/screening-api.ts`
- Modify: `apps/api/src/modules/editing/editing-api.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-api.ts`
- Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`

- [ ] **Step 1: Write the failing controller and request-shape tests**

Cover:

- `runModuleAndLoad()` accepts `executionMode?: "governed" | "bare"`
- existing calls still omit the field and behave as governed
- bare calls forward `executionMode: "bare"` to `/screening/run`, `/editing/run`, and `/proofreading/draft`
- response types can represent a bare result without inventing a user-facing mode page

- [ ] **Step 2: Run the focused controller test to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts
```

Expected: FAIL because the current controller and module request types do not expose an execution-mode branch.

- [ ] **Step 3: Add one shared execution-mode type and thread it through the request boundary**

Implement:

- shared type in `@medical/contracts`
- web request DTOs for screening/editing/proofreading
- workbench controller input
- API service input types and result metadata

Rules:

- default remains governed when `executionMode` is omitted
- do not rename existing routes, ids, or query keys
- do not create a second API family just for bare runs

- [ ] **Step 4: Re-run the focused controller test and typecheck**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts
pnpm --filter @medical/api run typecheck
pnpm --filter @medsys/web run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/governed-execution.ts apps/web/src/features/screening/types.ts apps/web/src/features/editing/types.ts apps/web/src/features/proofreading/types.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts apps/api/src/modules/shared/module-run-support.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/screening/screening-api.ts apps/api/src/modules/editing/editing-api.ts apps/api/src/modules/proofreading/proofreading-api.ts apps/web/test/manuscript-workbench-controller.spec.ts
git commit -m "feat: add one-time manuscript execution mode contract"
```

## Task 2: Add the extra `AI 自动处理（本次）` action inside the existing three workbenches

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing UI tests for the extra bounded action**

Cover:

- `初筛 / 编辑 / 校对` render a second run action labeled `AI 自动处理（本次）`
- `投稿` does not gain this action
- the original governed action remains the primary button
- clicking the extra action calls the same run family with `executionMode: "bare"`
- the action is local to the existing module panel, not a new tab, drawer, or page

- [ ] **Step 2: Run the focused workbench UI tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because the shared action panel currently supports only one module-run button.

- [ ] **Step 3: Extend the shared action panel with one secondary run path**

Implement:

- one extra action slot in `ActionPanel`
- localized label mapping for `AI 自动处理（本次）`
- page wiring that keeps the governed button unchanged and routes the extra button through `executionMode: "bare"`

Rules:

- do not turn this into a persistent toggle or manuscript-wide mode switch
- keep the operator copy lightweight and local
- do not add visible `裸跑 / raw-run` badges to the result area

- [ ] **Step 4: Re-run the focused workbench tests and web typecheck**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-page.spec.tsx
pnpm --filter @medsys/web run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-page.spec.tsx
git commit -m "feat: add one-time bare ai actions to manuscript workbenches"
```

## Task 3: Implement a bounded bare-run backend path for screening, editing, and proofreading

**Files:**
- Create: `apps/api/src/modules/shared/bare-module-context-resolver.ts`
- Create: `apps/api/src/modules/shared/bare-module-prompt-skeletons.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Create: `apps/api/test/shared/bare-module-context-resolver.spec.ts`
- Create: `apps/api/test/screening/screening-bare-run.spec.ts`
- Create: `apps/api/test/editing/editing-bare-run.spec.ts`
- Create: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`

- [ ] **Step 1: Write failing backend tests for bare runs**

Cover:

- bare screening succeeds without `current_template_family_id`
- bare editing succeeds without `current_template_family_id`
- bare proofreading draft succeeds without `current_template_family_id`
- governed runs still fail when the template family is missing
- bare resolution does not call governed module-context resolution
- bare runs resolve a model from centralized AI routing with `{ module }` scope only

- [ ] **Step 2: Run the new focused backend tests to verify RED**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/shared/bare-module-context-resolver.spec.ts ./test/screening/screening-bare-run.spec.ts ./test/editing/editing-bare-run.spec.ts ./test/proofreading/proofreading-bare-run.spec.ts
```

Expected: FAIL because all three services currently hard-depend on governed module resolution.

- [ ] **Step 3: Add one shared bare context resolver with generic prompt skeletons**

Implement a new shared helper that returns only what bare mode needs:

- current manuscript
- current module identity
- model selection from centralized AI routing defaults
- generic per-module prompt skeleton ids and text
- empty governed-only collections such as knowledge hits, skill packages, and template-bound rules when they are not required

Rules:

- no template-family lookup
- no execution-profile lookup
- no governed module-template lookup
- no governed retrieval preset lookup
- no governed manual-review policy lookup
- no governed runtime-binding requirement

- [ ] **Step 4: Branch each module service on `executionMode`**

Implementation rules:

- screening bare mode creates a normal `screening_report`
- editing bare mode still creates a normal `edited_docx`
- proofreading bare mode still creates a normal `proofreading_draft_report`
- the bare path must keep using the current manuscript asset selection and current output asset semantics
- older outputs must remain in asset history

Keep proofing simple:

- editing bare mode should reuse the existing deterministic output path with an empty governed rule set instead of inventing a second document pipeline
- proofreading bare mode should reuse the existing report-generation path with bounded generic findings input

- [ ] **Step 5: Re-run the focused bare-run tests and API typecheck**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/shared/bare-module-context-resolver.spec.ts ./test/screening/screening-bare-run.spec.ts ./test/editing/editing-bare-run.spec.ts ./test/proofreading/proofreading-bare-run.spec.ts
pnpm --filter @medical/api run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/shared/bare-module-context-resolver.ts apps/api/src/modules/shared/bare-module-prompt-skeletons.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/test/shared/bare-module-context-resolver.spec.ts apps/api/test/screening/screening-bare-run.spec.ts apps/api/test/editing/editing-bare-run.spec.ts apps/api/test/proofreading/proofreading-bare-run.spec.ts
git commit -m "feat: add bare ai execution path for manuscript modules"
```

## Task 4: Preserve traceability, workbench settlement, and proofreading closeout after bare runs

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Write failing integration tests for bare result semantics**

Cover:

- bare run results become the current result and stay downloadable from the existing path
- older governed outputs remain present in asset history
- proofreading `确认校对定稿` still works when the draft was created by bare mode
- workbench settlement does not stay stuck in a false follow-up-pending posture just because bare mode skipped governed orchestration
- internal metadata contains `executionMode: "bare"` plus input/output asset references

- [ ] **Step 2: Run the focused API integration tests to verify RED**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts
```

Expected: FAIL because the current HTTP and settlement flow assumes governed tracking for all successful module runs.

- [ ] **Step 3: Add minimal bare-run traceability and settlement handling**

Implement:

- `job.payload.executionMode = "bare"`
- `job.payload.parentAssetId`, `outputAssetId`, `outputAssetType`, and `modelId` remain filled
- proofreading bare drafts persist enough context for `confirmFinal()` to continue without re-resolving governed context
- manuscript mainline settlement recognizes a completed bare job with an output asset as a settled business result instead of a broken governed follow-up

Rules:

- do not add customer-facing bare badges or filename suffixes
- do not rewrite manuscript template selection when a bare run completes
- do not require a governed snapshot to reuse a bare proofreading draft

- [ ] **Step 4: Re-run the focused integration tests and API typecheck**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts
pnpm --filter @medical/api run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts apps/api/src/modules/shared/module-run-support.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts
git commit -m "feat: preserve bare run traceability and proofreading closeout"
```

## Task 5: Run the focused release gate and real-browser acceptance for the three workbenches

**Files:**
- No new source files

- [ ] **Step 1: Run the final focused automated checks**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/shared/bare-module-context-resolver.spec.ts ./test/screening/screening-bare-run.spec.ts ./test/editing/editing-bare-run.spec.ts ./test/proofreading/proofreading-bare-run.spec.ts ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-page.spec.tsx
pnpm --filter @medical/api run typecheck
pnpm --filter @medsys/web run typecheck
```

Expected: PASS.

- [ ] **Step 2: Start the current workspace and verify in a real browser**

Run:

```bash
pnpm --filter @medical/api run dev
pnpm --filter @medsys/web run dev -- --host 127.0.0.1 --port 4273
```

Then verify all of the following manually:

1. Open `http://127.0.0.1:4273/#screening` and confirm `AI 自动处理（本次）` appears beside the existing governed action.
2. Open `http://127.0.0.1:4273/#editing` and confirm the same behavior.
3. Open `http://127.0.0.1:4273/#proofreading` and confirm the same behavior.
4. Trigger one bare run per stage and confirm the new result becomes current and downloadable.
5. Confirm older governed outputs remain in the asset history instead of disappearing.
6. For proofreading, trigger `确认校对定稿` from a bare-created draft and confirm the closeout path still works.

- [ ] **Step 3: Only after all checks are green, mark the feature ready for execution handoff**

No phase expansion, no extra UX additions, and no filename-label inventions are allowed after this point unless the user explicitly approves a new plan.
