# Rule Center Knowledge Entry Boundary V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the legacy knowledge-library workbench and advanced rule authoring flow to the approved V1 boundary so executable rules stay in `规则中心` and retrievable evidence stays in `知识库`.

**Architecture:** Reuse the newer structured entry patterns that already exist in the knowledge ledger flow, then retrofit the legacy workbench form to stop relying on comma-separated free text. Extend the rule authoring draft/serialization contract with explicit linked knowledge item IDs so rules can reference evidence without exposing raw JSON editing.

**Tech Stack:** React 18, TypeScript, node:test, Vite workbench UI, shared `@medical/contracts`

---

### Task 1: Lock the regression surface with tests

**Files:**
- Modify: `apps/web/test/knowledge-library-workbench-page.spec.tsx`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`

- [x] **Step 1: Write the failing knowledge-library workbench tests**

Add assertions that the legacy workbench:
- defaults `knowledgeKind` to a non-`rule` value for normal creation
- renders structured manuscript-type / section controls instead of comma-separated placeholders
- renders tag-style repeated inputs for aliases / risk tags / discipline tags

- [x] **Step 2: Run the targeted knowledge-library test and verify it fails**

Run: `pnpm --filter @medsys/web test -- --test-name-pattern "knowledge library workbench"`
Expected: FAIL because the current page still defaults to `rule` and still renders plain text fields.

- [x] **Step 3: Write the failing rule-authoring tests**

Add assertions that:
- `RuleAuthoringForm` renders a `关联知识条目` control
- selected knowledge items are serialized into the rule payload/links
- hydration preserves linked knowledge item IDs

- [x] **Step 4: Run the targeted rule-authoring test and verify it fails**

Run: `pnpm --filter @medsys/web test -- --test-name-pattern "rule authoring"`
Expected: FAIL because the draft model and form do not yet expose linked knowledge items.

### Task 2: Retrofit the legacy knowledge-library workbench form

**Files:**
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-workbench.css` (only if styling is needed)

- [x] **Step 1: Change the form state from comma-separated strings to structured arrays / multi-select state**

Update `KnowledgeLibraryFormState` and duplicate-check draft fields so:
- `manuscriptTypes` becomes `ManuscriptType[] | "any"`
- `sections`, `riskTags`, `disciplineTags`, `aliases` become `string[]`
- default `knowledgeKind` becomes `reference`

- [x] **Step 2: Replace legacy text inputs with controlled structured inputs**

Implement:
- multi-select checkbox or `<select multiple>` style controls for manuscript type and section
- repeated tag-entry rows for aliases / risk tags / discipline tags
- helper functions for add/update/remove/toggle behavior

- [x] **Step 3: Keep submission and duplicate-check payloads backward-compatible**

Update the workbench conversion helpers so controller/API calls still receive normalized arrays and `"any"` semantics without changing the request contract.

- [x] **Step 4: Run the targeted knowledge-library tests and verify they pass**

Run: `pnpm --filter @medsys/web test -- apps/web/test/knowledge-library-workbench-page.spec.tsx`
Expected: PASS

### Task 3: Add explicit linked knowledge selection to rule authoring

**Files:**
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`

- [x] **Step 1: Extend the draft model with linked knowledge item IDs**

Add a `linkedKnowledgeItemIds: string[]` field to the common rule-authoring draft base so every rule object can opt into the same reference behavior.

- [x] **Step 2: Hydrate and serialize the linked IDs**

Use `linkage_payload.projected_knowledge_item_ids` as the stored source of truth so:
- existing rules can be hydrated back into the form
- newly created rules emit their selected knowledge item IDs without exposing raw payload editing

- [x] **Step 3: Wire the advanced authoring shell to available knowledge items**

Pass `overview.visibleKnowledgeItems` into `RuleAuthoringForm`, render a searchable/clear multi-select style list, and keep the form usable even when no knowledge items are available.

- [x] **Step 4: Run the targeted rule-authoring tests and verify they pass**

Run: `pnpm --filter @medsys/web test -- apps/web/test/template-governance-rule-authoring.spec.ts`
Expected: PASS

### Task 4: Verify the integrated surface

**Files:**
- Modify: `docs/superpowers/specs/2026-04-16-rule-center-and-knowledge-entry-boundary-v1-implementation-summary-design.md` (only if wording needs sync after implementation)

- [x] **Step 1: Run the focused test suite for both surfaces**

Run: `pnpm --filter @medsys/web test -- apps/web/test/knowledge-library-workbench-page.spec.tsx apps/web/test/template-governance-rule-authoring.spec.ts`
Expected: PASS

- [x] **Step 2: Run a typecheck for the web app**

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

- [x] **Step 3: Review the diff for boundary correctness**

Confirm the final diff does all of the following:
- removes normal-user defaulting to `knowledge_kind = rule` in the legacy knowledge workbench
- removes comma-separated primary entry for structured knowledge fields
- adds explicit linked knowledge selection in rule authoring
- does not revert unrelated dirty worktree files

- [x] **Step 4: Summarize verification evidence before claiming completion**

Report the exact commands run, their exit codes, and any residual gaps.

## Execution Notes

### Implemented and verified

- Legacy knowledge-library workbench now defaults normal creation to `knowledgeKind = "reference"` and uses structured controls for manuscript types, sections, aliases, risk tags, and discipline tags.
- Advanced rule authoring now supports explicit linked knowledge selection through `linkedKnowledgeItemIds`, including hydration and serialization via `linkage_payload.projected_knowledge_item_ids`.
- Rule wizard advanced routing fields now use structured multi-select and tag-list controls for `稿件类型`, `章节标签`, `风险标签`, and `规则包提示`.
- Rule wizard confirm step now also uses structured controls for `稿件类型` and `检索词`, so AI-confirmation no longer falls back to comma-text entry for those high-frequency fields.
- Rule wizard binding now supports explicit linked knowledge persistence through `knowledge_item` revision bindings, including binding-option loading, selection, save mapping, and edit-mode hydration.
- Rule wizard binding now uses a searchable grouped linked-knowledge picker that surfaces `知识类型 / 发布状态 / 模块` in operator-facing Chinese labels.
- Governed runtime now bridges authored linked knowledge into execution context in a minimal way: approved `template_family` bindings can be selected at runtime, and approved `knowledge_item` links can be expanded into governed `knowledgeSelections`.
- Knowledge ledger entry now explains the knowledge-vs-rule boundary and key fields (`分类`, `适用模块`, `必要标签`) directly in the create/edit board.
- Knowledge ledger entry now also uses structured repeated-tag input for `必要标签`, plus searchable multi-select controls for `稿件类型` and `章节标签`.
- Knowledge ledger entry now exposes `证据等级` and `来源类型` as controlled dropdowns with sensible defaults.
- Knowledge entry now no longer offers `rule` as a normal create-time category in the newer ledger board, while historical `rule` revisions are labeled as `规则投影（历史兼容）` in edit surfaces and `规则投影` in list surfaces.
- Core controlled vocabularies for `稿件类型`, `章节标签`, `证据等级`, `来源类型`, and key knowledge-kind labels are now shared across the newer ledger board, legacy knowledge workbench, rule wizard entry step, extraction task form, and rule-center display helpers.
- Table-proofreading guidance cards, rule-wizard linked-knowledge selectors, retrieval-signal cards, and instruction-operation summaries now prefer Chinese metadata labels over raw enum strings.
- Knowledge ledger composer defaults now carry `evidenceLevel = "unknown"` and `sourceType = "other"` explicitly, keeping local drafts aligned with the controlled dropdown defaults shown in the newer entry board.
- Rule wizard draft creation still intentionally persists `knowledgeKind = "rule"` because that flow is creating rule assets rather than general knowledge references.

### Explicitly out of scope for this V1 pass

- This pass stores lightweight `knowledge_item` bindings only; it does not add richer per-link metadata, ranking, or explanation fields.
- This pass does not redesign downstream analytics, explanation surfaces, or richer observability around the new linked-knowledge binding kind.
- Runtime provenance still keeps a single primary `matchSource`; when one item is both dynamically selected and linked, the linked reason is merged but multiple first-class sources are not yet emitted.

### Verification evidence

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/searchable-multi-select.spec.tsx ./test/knowledge-library-ledger-composer.spec.ts ./test/template-governance-rule-authoring.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medsys/web typecheck`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/shared/governed-module-context.spec.ts ./test/modules/governed-module-context-resolver.spec.ts ./test/database/schema.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api typecheck`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-composer.spec.ts ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-composer.spec.ts ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/template-governance-rule-authoring.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medsys/web typecheck`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/searchable-multi-select.spec.tsx`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`
  - Exit code: `0`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-workbench-page.spec.tsx`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/database/schema.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api typecheck`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/shared/governed-module-context.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/modules/governed-module-context-resolver.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/shared/governed-module-context.spec.ts ./test/modules/governed-module-context-resolver.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/execution-tracking/execution-tracking.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/modules/module-orchestration.spec.ts`
  - Exit code: `0`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-checker.spec.ts`
  - Exit code: `0`

### Verification limits

- `pnpm --filter @medical/api test` timed out locally after `124042 ms`, so it is not being used as a passing signal for this slice.

### Dirty worktree caution

- Unrelated pre-existing worktree changes remained untouched, including `.githooks/pre-push` and `scripts/local-pr-gate.mjs`.
