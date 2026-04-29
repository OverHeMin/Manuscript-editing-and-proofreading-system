# Rule Center Workbench V2 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the rule center into one visibly new, unified workbench while preserving rules, templates, packages, extraction, AI intake, learning recovery, binding, review, and release behavior.

**Architecture:** Keep backend APIs, contracts, permissions, runtime rule resolution, model routing, and `knowledge_kind = "rule"` compatibility unchanged. Build a V2 React workbench with its own route mapper, shell, lazy section loaders, work queue, and action panels; only replace the visible old entry after action parity tests pass.

**Tech Stack:** React 18, TypeScript, Vite, Playwright, Node test runner with `tsx`, existing `@medsys/web` controller/view-model layer.

---

## Subagent Review Result

Three review agents checked the plan from different angles. The V2 direction is feasible, but the original task order and data assumptions must be corrected before implementation.

- Functionality coverage review: original plan did not prove complete preservation of rule ledger categories, `reviewItemId` recovery deep links, extraction candidate writeback, template/package CRUD, package authoring/compile, and release evidence gates.
- Technical feasibility review: V2 can be built without first splitting the whole monolith, but it needs lazy section loaders, stable route state fields, V2 CSS import, command parity, and helper extraction to avoid circular imports.
- Conflict/sequence review: do not replace the default visible entry before action parity tests pass; avoid knowledge-library, table-evidence, Harness, host/navigation, backend, contracts, and migrations while other branches are active.

## Execution Boundary

Worktree:

```powershell
C:\Users\Administrator\.config\superpowers\worktrees\Manuscript-editing-and-proofreading-system\rule-center-workbench-v2
```

Branch:

```powershell
codex/rule-center-workbench-v2
```

Do not edit these areas in Phase 1 or Phase 2:

- `apps/web/src/features/knowledge-library/*`
- `apps/web/src/features/table-evidence/*`
- `apps/web/src/features/harness-*`
- `apps/web/src/features/evaluation-workbench/*`
- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/features/auth/workbench.ts`
- backend modules, migrations, contracts, model routing, permissions, runtime binding

Before every phase, run:

```powershell
git worktree list --porcelain
git status --short --branch --untracked-files=all
git diff --name-status origin/main...HEAD
```

Expected for this branch before implementation: only V2 plan or V2 rule-center files are dirty.

## Product Requirements

- The first screen of the rule center must become a new workbench: section rail, center work queue/table, and right operation panel/drawer.
- Old hashes remain valid, but they select V2 sections instead of rendering separate old ledger pages.
- All explain/teaching text blocks are removed from the main surface. Keep operational labels, statuses, errors, blocking reasons, evidence, provenance, and button text.
- `classic` remains reachable as an advanced compatibility section, not the default product surface.
- No backend behavior changes are allowed for this rebuild.
- Browser screenshots must show a clearly different `.rule-center-v2` layout on desktop and mobile.

## Phase Gates

| Phase | Can Start Now | Scope | Replacement Allowed |
| --- | --- | --- | --- |
| Phase 0 | Yes | Final plan, branch checks, implementation checklist | No |
| Phase 1 | Yes | V2 route mapper, shell, CSS, command bar, local tests | No |
| Phase 2 | Yes, after Phase 1 | V2 lazy loaders, helper extraction, section UI, action parity tests | No |
| Phase 2A | After table-evidence branch lands | Consume merged table-evidence public entry points | No |
| Phase 2B | After Harness branch lands | Host/navigation test updates if needed | No |
| Phase 3 | After Phase 2 parity passes and 2A/2B gates are resolved | Delegate visible rule center entry to V2 | Yes |
| Phase 4 | After Phase 3 | Real browser acceptance and visual proof | Already replaced |

## Existing Functionality Migration Matrix

| Existing function | V2 section/panel | Data source or component | Required test |
| --- | --- | --- | --- |
| Overview posture | `dashboard` | `controller.loadOverview()` | dashboard count/status render test |
| Rule ledger categories | `rules` | `controller.loadRuleLedger()` | categories `rule`, `large_template`, `journal_template`, `general_package`, `medical_package`, `recycled_candidate` render with metrics |
| Rule deep link by `assetId` | `rules` detail panel | V2 route state `selectedKind="rule-ledger-row"` | raw hash route test preserves selected row |
| New rule | `rules` drawer | `TemplateGovernanceRuleWizard` | command opens wizard and saves entry draft |
| AI manual rule input | `ai-intake` panel | `createRuleAiIntakeDraft`, `parseManualRuleWithAi`, `TemplateGovernanceRuleWizard` | parsed draft applies into wizard |
| Learning candidate recovery | `recovery` panel | `loadLearningCandidates`, `RuleLearningPane` | `learningCandidateId` selects candidate and exposes rule draft writeback |
| Review item recovery | `recovery` panel | `loadReviewItems`, `RuleLearningPane.initialSelectedReviewItemId` | `reviewItemId` selects review item |
| Large template ledger | `templates` | `loadTemplateLedger`, `createTemplateCompositionDraftAndReload`, `updateTemplateCompositionDraftAndReload` | create/edit/archive flow test |
| Journal template ledger | `templates` subtype `journal` | `loadOverview().journalTemplateProfiles`, journal profile controller actions | create/edit/activate/archive flow test |
| Module templates | `templates` detail panel | `loadOverview().moduleTemplates`, module template controller actions | create/update/publish flow test |
| General content modules | `packages` subtype `general` | `loadContentModuleLedger({ moduleClass: "general" })` | create/edit/archive/default-rule edit test |
| Medical content modules | `packages` subtype `medical` | `loadContentModuleLedger({ moduleClass: "medical_specialized" })` | create/edit/archive/default-rule edit test |
| Rule wizard package binding | `rules` wizard binding step | `loadRuleWizardBindingOptions()` | binding options show `general_style_package` and `medical_analyzer_package` |
| Rule package authoring/compile | `packages` advanced panel | `RulePackageAuthoringShell`, `loadRulePackageWorkspace`, preview/compile controller actions | preview, compile-to-draft, open draft rule set |
| Extraction task ledger | `extraction` | `loadExtractionLedger` | task list and selected task detail render |
| Extraction candidate decisions | `extraction` detail panel | `updateExtractionTaskCandidateAndReload` and extracted candidate action helper | hold/reject/confirm and duplicate guard tests |
| Extraction candidate to draft | `extraction` detail panel | `createTemplateCompositionDraftFromCandidateAndReload`, `createContentModuleDraftFromCandidateAndReload` | candidate creates large template/general/medical draft |
| Release track | `release` panel | `RulePlatformReleasePanel`, `transitionRuleSetAndReload` | candidate/canary/active blocked without required evidence |
| Rule wizard evidence gate | `rules` wizard | `createRuleWizardEvidenceGateSummary` from rule wizard API | publish blocked until evidence requirements pass |
| Classic advanced compatibility | `advanced` section | extracted advanced compatibility panel reusing old advanced editor, package authoring, release panel, instruction/template/knowledge actions | `classic` route lands in V2 shell with advanced section active |

## Route Mapping Contract

Create V2 route state with stable fields. Do not use optional missing keys in tests.

```ts
export type TemplateGovernanceV2Section =
  | "dashboard"
  | "rules"
  | "templates"
  | "packages"
  | "extraction"
  | "ai-intake"
  | "recovery"
  | "release"
  | "advanced";

export type TemplateGovernanceV2Panel =
  | "none"
  | "rule-detail"
  | "rule-wizard"
  | "ai-intake"
  | "candidate-detail"
  | "review-item-detail"
  | "template-detail"
  | "package-detail"
  | "extraction-detail"
  | "release-check"
  | "advanced-compatibility";

export type TemplateGovernanceV2SelectedKind =
  | "none"
  | "rule-ledger-row"
  | "learning-candidate"
  | "review-item"
  | "template"
  | "package"
  | "extraction-task";

export interface TemplateGovernanceV2RouteState {
  section: TemplateGovernanceV2Section;
  panel: TemplateGovernanceV2Panel;
  selectedKind: TemplateGovernanceV2SelectedKind;
  selectedId: string | undefined;
  subtype: "large" | "journal" | "general" | "medical" | undefined;
}
```

Route matrix:

| Hash intent | V2 route state |
| --- | --- |
| `overview` | `dashboard`, `none` |
| `rule-ledger` | `rules`, optional `rule-detail` if `assetId` exists |
| `authoring` or `ruleCenterMode=authoring` | `rules`, `rule-wizard` |
| `ruleCenterMode=ai-intake` | `ai-intake`, `ai-intake` |
| `ruleCenterMode=learning&learningCandidateId=:id` | `recovery`, `candidate-detail`, selected candidate |
| `ruleCenterMode=learning&reviewItemId=:id` | `recovery`, `review-item-detail`, selected review item |
| `large-template-ledger` or old alias `template-ledger` | `templates`, subtype `large` |
| `journal-template-ledger` | `templates`, subtype `journal` |
| `general-package-ledger` or old alias `general-module-ledger` | `packages`, subtype `general` |
| `medical-package-ledger` or old alias `medical-module-ledger` | `packages`, subtype `medical` |
| `extraction-ledger` | `extraction`, `none` or selected task detail |
| `classic` | `advanced`, `advanced-compatibility` |

## File Plan

Create:

- `apps/web/src/features/template-governance/template-governance-v2-types.ts`
- `apps/web/src/features/template-governance/template-governance-v2-route.ts`
- `apps/web/src/features/template-governance/template-governance-v2-data.ts`
- `apps/web/src/features/template-governance/template-governance-v2-workbench-page.tsx`
- `apps/web/src/features/template-governance/template-governance-v2-shell.tsx`
- `apps/web/src/features/template-governance/template-governance-v2-section-rail.tsx`
- `apps/web/src/features/template-governance/template-governance-v2-command-bar.tsx`
- `apps/web/src/features/template-governance/template-governance-v2-work-queue.tsx`
- `apps/web/src/features/template-governance/template-governance-v2-detail-panel.tsx`
- `apps/web/src/features/template-governance/template-governance-v2-advanced-panel.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-handoff.ts`
- `apps/web/src/features/template-governance/template-governance-extraction-candidate-actions.ts`
- `apps/web/src/features/template-governance/template-governance-v2-workbench.css`
- `apps/web/test/template-governance-v2-route.spec.ts`
- `apps/web/test/template-governance-v2-data.spec.ts`
- `apps/web/test/template-governance-v2-shell.spec.tsx`
- `apps/web/test/template-governance-v2-workbench-page.spec.tsx`
- `apps/web/playwright/template-governance-workbench-v2.spec.ts`

Modify only after parity tests exist:

- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/src/features/template-governance/index.ts`
- `apps/web/playwright/template-governance-unified-workbench.spec.ts`
- `apps/web/test/workbench-host.spec.tsx`

## Task 0: Freeze The Final Plan And Branch Baseline

**Files:**

- Modify: `docs/superpowers/plans/2026-04-29-rule-center-workbench-v2-rebuild.md`

- [ ] **Step 1: Confirm branch and diff**

Run:

```powershell
git status --short --branch --untracked-files=all
git diff --name-status origin/main...HEAD
```

Expected: the plan file is the only dirty file before implementation.

- [ ] **Step 2: Commit the plan if requested**

Run only after user approval:

```powershell
git add docs/superpowers/plans/2026-04-29-rule-center-workbench-v2-rebuild.md
git commit -m "docs: plan rule center workbench v2 rebuild"
```

## Task 1: Lock V2 Route Mapping

**Files:**

- Create: `apps/web/src/features/template-governance/template-governance-v2-types.ts`
- Create: `apps/web/src/features/template-governance/template-governance-v2-route.ts`
- Create: `apps/web/test/template-governance-v2-route.spec.ts`

- [ ] **Step 1: Write route tests before implementation**

The test must cover:

- canonical views;
- old aliases normalized by `resolveWorkbenchLocation`;
- `assetId`;
- `learningCandidateId`;
- `reviewItemId`;
- `classic`;
- `ruleCenterMode` priority over `templateGovernanceView` when mode is `learning` or `ai-intake`.

Use this assertion pattern so missing fields cannot hide bugs:

```ts
assert.deepEqual(resolveTemplateGovernanceV2RouteState(input), {
  section: "recovery",
  panel: "review-item-detail",
  selectedKind: "review-item",
  selectedId: "review-item-42",
  subtype: undefined,
});
```

- [ ] **Step 2: Implement types and mapper**

Implement the route contract from this plan. For old aliases, write tests through `resolveWorkbenchLocation("#template-governance?templateGovernanceView=template-ledger")`, then pass the normalized location into the V2 mapper.

- [ ] **Step 3: Verify**

Run:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-v2-route.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/features/template-governance/template-governance-v2-types.ts apps/web/src/features/template-governance/template-governance-v2-route.ts apps/web/test/template-governance-v2-route.spec.ts
git commit -m "test: lock rule center v2 route mapping"
```

## Task 2: Build V2 Shell And Command Bar

**Files:**

- Create: `apps/web/src/features/template-governance/template-governance-v2-shell.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-v2-section-rail.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-v2-command-bar.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-v2-workbench.css`
- Create: `apps/web/test/template-governance-v2-shell.spec.tsx`

- [ ] **Step 1: Write shell test**

Assert that static render contains:

- `.rule-center-v2`;
- `.rule-center-v2__rail`;
- `.rule-center-v2__work-area`;
- `.rule-center-v2__detail-panel`;
- commands `new-rule`, `new-ai-rule`, `import-extraction`, `review-candidates`, `release-check`;
- no old primary page class such as `.template-governance-overview-page`.

- [ ] **Step 2: Implement command union**

Use this command set:

```ts
export type TemplateGovernanceV2Command =
  | "new-rule"
  | "new-ai-rule"
  | "import-extraction"
  | "review-candidates"
  | "release-check";
```

- [ ] **Step 3: Implement shell**

The shell renders only operational UI. Do not add instructional copy. The empty panel text can be `未选择项目`; errors and loading states are allowed.

- [ ] **Step 4: Add scoped CSS**

All selectors must start with `.rule-center-v2` except reused existing operational classes. The CSS file is imported by `template-governance-v2-workbench-page.tsx` with the same dynamic pattern used by the existing workbench:

```ts
if (typeof document !== "undefined") {
  void import("./template-governance-v2-workbench.css");
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-v2-shell.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/features/template-governance/template-governance-v2-shell.tsx apps/web/src/features/template-governance/template-governance-v2-section-rail.tsx apps/web/src/features/template-governance/template-governance-v2-command-bar.tsx apps/web/src/features/template-governance/template-governance-v2-workbench.css apps/web/test/template-governance-v2-shell.spec.tsx
git commit -m "feat: add rule center v2 shell"
```

## Task 3: Add Lazy Section Data Loaders

**Files:**

- Create: `apps/web/src/features/template-governance/template-governance-v2-data.ts`
- Create: `apps/web/test/template-governance-v2-data.spec.ts`

- [ ] **Step 1: Write loader tests**

Mock a `TemplateGovernanceWorkbenchController` and assert exact controller methods per section:

| Section | Expected controller calls |
| --- | --- |
| `dashboard` | `loadOverview()` |
| `rules` | `loadOverview()` and `loadRuleLedger({ selectedRowId })` |
| `templates` large | `loadTemplateLedger({ selectedTemplateId })` |
| `templates` journal | `loadOverview()` for `journalTemplateProfiles` |
| `packages` general | `loadContentModuleLedger({ moduleClass: "general", selectedModuleId })` |
| `packages` medical | `loadContentModuleLedger({ moduleClass: "medical_specialized", selectedModuleId })` |
| `extraction` | `loadExtractionLedger({ selectedTaskId })` |
| `recovery` | `loadLearningCandidates()` and `loadReviewItems()` |
| `release` | `loadOverview()` |
| `advanced` | `loadOverview()` plus package workspace only when the package authoring panel is opened |

- [ ] **Step 2: Implement V2 data result types**

Use a discriminated union:

```ts
export type TemplateGovernanceV2SectionData =
  | { section: "dashboard"; overview: TemplateGovernanceWorkbenchOverview }
  | { section: "rules"; overview: TemplateGovernanceWorkbenchOverview; ledger: TemplateGovernanceRuleLedgerViewModel }
  | { section: "templates"; subtype: "large"; ledger: TemplateGovernanceTemplateLedgerViewModel }
  | { section: "templates"; subtype: "journal"; overview: TemplateGovernanceWorkbenchOverview }
  | { section: "packages"; subtype: "general" | "medical"; ledger: TemplateGovernanceContentModuleLedgerViewModel }
  | { section: "extraction"; ledger: TemplateGovernanceExtractionLedgerViewModel }
  | { section: "recovery"; candidates: LearningCandidateViewModel[]; reviewItems: ReviewItemViewModel[] }
  | { section: "release"; overview: TemplateGovernanceWorkbenchOverview }
  | { section: "advanced"; overview: TemplateGovernanceWorkbenchOverview };
```

- [ ] **Step 3: Implement lazy loader**

Create `loadTemplateGovernanceV2SectionData(controller, routeState)`. It must not read `overview.journalTemplates` or `overview.contentModules`; those fields do not exist.

- [ ] **Step 4: Verify**

Run:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-v2-data.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/features/template-governance/template-governance-v2-data.ts apps/web/test/template-governance-v2-data.spec.ts
git commit -m "feat: add rule center v2 section data loaders"
```

## Task 4: Extract Shared Handoff And Extraction Actions

**Files:**

- Create: `apps/web/src/features/template-governance/template-governance-rule-wizard-handoff.ts`
- Create: `apps/web/src/features/template-governance/template-governance-extraction-candidate-actions.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Test: existing rule wizard and extraction tests, plus V2 page tests after Task 5

- [ ] **Step 1: Move rule wizard handoff helpers**

Move these helpers out of the monolith so V2 can import them without importing `template-governance-workbench-page.tsx`:

- `createRuleWizardEntryFormStateFromRuleLedgerRow`
- `createRuleWizardEntryFormStateFromAiDraft`
- `createRuleWizardEntryFormStateFromLearningCandidate`
- the small candidate handoff view-model helper used by those conversions

The old workbench must import the helpers from the new file after the move.

- [ ] **Step 2: Move extraction candidate action helper**

Move `executeExtractionCandidateAction` into `template-governance-extraction-candidate-actions.ts`. Preserve:

- hold;
- reject;
- confirm;
- candidate to large-template draft;
- candidate to general content module draft;
- candidate to medical content module draft;
- intake payload writeback;
- duplicate-entry guard.

- [ ] **Step 3: Verify old behavior still passes**

Run the focused existing tests that cover rule wizard and extraction ledger behavior:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/features/template-governance/template-governance-rule-wizard-handoff.ts apps/web/src/features/template-governance/template-governance-extraction-candidate-actions.ts apps/web/src/features/template-governance/template-governance-workbench-page.tsx
git commit -m "refactor: extract rule center handoff helpers"
```

## Task 5: Build V2 Page, Work Queue, Detail Panel, And Action Parity

**Files:**

- Create: `apps/web/src/features/template-governance/template-governance-v2-workbench-page.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-v2-work-queue.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-v2-detail-panel.tsx`
- Create: `apps/web/src/features/template-governance/template-governance-v2-advanced-panel.tsx`
- Create or update: `apps/web/test/template-governance-v2-workbench-page.spec.tsx`

- [ ] **Step 1: Write V2 page tests**

The test suite must assert these behaviors before implementation:

- page imports V2 CSS dynamically;
- route state selects the correct active section;
- `new-rule` opens `TemplateGovernanceRuleWizard`;
- `new-ai-rule` opens AI intake and applies parsed result into the wizard via extracted handoff helper;
- `import-extraction` opens extraction task creation panel;
- `review-candidates` opens recovery with `RuleLearningPane`;
- `release-check` opens `RulePlatformReleasePanel`;
- `reviewItemId` is passed to `RuleLearningPane.initialSelectedReviewItemId`;
- `learningCandidateId` is passed to `RuleLearningPane.initialSelectedCandidateId`;
- selected rule ledger row opens detail with binding and release actions;
- advanced route renders inside `.rule-center-v2`, not as the default old page.

- [ ] **Step 2: Implement V2 page state**

Use a reducer or explicit state object for:

- `routeState`;
- `activeSection`;
- `activePanel`;
- `selectedKind`;
- `selectedId`;
- `loadedSectionData`;
- command-driven panel overrides.

Do not add global routing for every drawer in this rebuild.

- [ ] **Step 3: Implement work queue**

The center area renders section rows from the lazy loader:

- `rules`: rule ledger rows with category, status, effect metrics, source provenance;
- `templates`: large template rows or journal profile rows based on subtype;
- `packages`: content module rows based on subtype;
- `extraction`: task rows and candidate counts;
- `recovery`: review queue rows;
- `release`: selected rule set release posture;
- `advanced`: advanced operation entries.

- [ ] **Step 4: Implement detail panel**

The right panel must expose operational controls:

- rule detail, binding summary, evidence state, edit, submit, publish;
- template create/edit/archive and journal activate/archive;
- package create/edit/archive/default-rule edit;
- extraction candidate hold/reject/confirm/create-draft;
- recovery writeback to rule draft;
- release transition controls and evidence pack fields.

- [ ] **Step 5: Implement advanced compatibility panel**

The advanced panel must be explicit. It may reuse existing leaf components, but it must be rendered inside V2:

- `RulePackageAuthoringShell`;
- `RulePlatformReleasePanel`;
- advanced rule editor block extracted from the monolith;
- instruction template operations;
- template family/module template/knowledge actions that still lack a first-class V2 row action.

Do not render old ledger route pages as the primary body of `rules`, `templates`, `packages`, or `extraction`.

- [ ] **Step 6: Verify V2 unit tests**

Run:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-v2-workbench-page.spec.tsx ./test/template-governance-v2-route.spec.ts ./test/template-governance-v2-data.spec.ts ./test/template-governance-v2-shell.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/features/template-governance/template-governance-v2-workbench-page.tsx apps/web/src/features/template-governance/template-governance-v2-work-queue.tsx apps/web/src/features/template-governance/template-governance-v2-detail-panel.tsx apps/web/src/features/template-governance/template-governance-v2-advanced-panel.tsx apps/web/test/template-governance-v2-workbench-page.spec.tsx
git commit -m "feat: build rule center v2 action surface"
```

## Task 6: Resolve Phase 2A And Phase 2B Gates

**Files:**

- Modify only if merged upstream work requires it.

- [ ] **Step 1: Rebase or merge latest main**

Run after table-evidence and Harness work land:

```powershell
git fetch origin
git merge origin/main
git status --short --branch --untracked-files=all
```

Expected: conflicts, if any, are limited to rule-center V2 files or explicitly reviewed host tests.

- [ ] **Step 2: Table evidence gate**

If merged `table-evidence` exposes public components or APIs required by rule center, consume them only from the merged public entry point. Do not create a second table-evidence implementation under template governance.

- [ ] **Step 3: Harness gate**

Only after Harness branch lands, update host/navigation tests that fail because the visible rule center changes. Keep host production edits minimal.

- [ ] **Step 4: Verify focused tests**

Run:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-v2-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
```

Expected: PASS.

## Task 7: Replace Visible Rule Center Entry

**Files:**

- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/index.ts`
- Modify: `apps/web/playwright/template-governance-unified-workbench.spec.ts`
- Create or update: `apps/web/playwright/template-governance-workbench-v2.spec.ts`
- Modify only if needed after Harness gate: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write browser route preservation tests**

The Playwright test must cover:

- canonical hashes for overview, rule ledger, authoring, AI intake, learning, large template, journal template, general package, medical package, extraction, classic;
- old aliases `template-ledger`, `general-module-ledger`, `medical-module-ledger`;
- `learningCandidateId`;
- `reviewItemId`;
- `assetId`;
- no old separated ledger page as primary product.

Expected assertion shape:

```ts
await expect(page.locator(".rule-center-v2")).toBeVisible();
await expect(page.locator(".rule-center-v2__rail .is-active")).toContainText("规则");
await expect(page.locator(".template-governance-overview-page")).toHaveCount(0);
```

- [ ] **Step 2: Delegate visible entry**

Change `TemplateGovernanceWorkbenchPage` so all non-legacy visible routes render `TemplateGovernanceV2WorkbenchPage`. `classic` must still render inside V2 advanced section.

- [ ] **Step 3: Update existing tests**

Update existing assertions in:

- `apps/web/playwright/template-governance-unified-workbench.spec.ts`;
- `apps/web/test/workbench-host.spec.tsx` if Phase 2B allows host test updates.

- [ ] **Step 4: Verify**

Run:

```powershell
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-v2-route.spec.ts ./test/template-governance-v2-data.spec.ts ./test/template-governance-v2-shell.spec.tsx ./test/template-governance-v2-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-workbench-v2.spec.ts playwright/template-governance-unified-workbench.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/src/features/template-governance/index.ts apps/web/playwright/template-governance-workbench-v2.spec.ts apps/web/playwright/template-governance-unified-workbench.spec.ts apps/web/test/workbench-host.spec.tsx
git commit -m "feat: route rule center into v2 workbench"
```

## Task 8: Real Browser Acceptance

**Files:**

- No production files expected unless acceptance finds defects.

- [ ] **Step 1: Run typecheck and unit tests**

```powershell
pnpm --filter @medsys/web typecheck
pnpm --filter @medsys/web test
```

Expected: PASS.

- [ ] **Step 2: Run browser regression**

```powershell
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/template-governance-workbench-v2.spec.ts playwright/template-governance-unified-workbench.spec.ts playwright/template-governance-rule-wizard.spec.ts playwright/learning-review-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run real browser acceptance**

Start the web app and inspect these routes in desktop and mobile viewports:

- dashboard;
- rules;
- rule wizard;
- AI intake;
- recovery with `learningCandidateId`;
- recovery with `reviewItemId`;
- templates large;
- templates journal;
- packages general;
- packages medical;
- extraction;
- release;
- advanced classic compatibility.

Acceptance criteria:

- `.rule-center-v2` is visible.
- Desktop shows section rail, center work queue, and right operation panel.
- Mobile stacks without overlapping text.
- Old separated ledger shells are not the primary product surface.
- Teaching/explanatory copy blocks are absent.
- Operational labels, statuses, errors, blocking reasons, evidence, provenance, bindings, and buttons remain visible.
- AI parsed draft can reach the rule wizard.
- Recovery candidates and review items can reach writeback actions.
- Extraction candidates can be held, rejected, confirmed, or converted to drafts.
- Release gate blocks transition when required evidence is missing.

- [ ] **Step 4: Final verification**

```powershell
git status --short --branch --untracked-files=all
git diff --stat origin/main...HEAD
```

Expected: V2 branch contains only planned rule-center V2 files, allowed tests, and approved entry delegation.

## Completion Definition

The rebuild is complete only when all of these are true:

- route compatibility tests pass for canonical hashes and old aliases;
- V2 section data tests prove every section uses the correct controller method;
- action parity tests pass for rules, AI intake, recovery, templates, packages, extraction, release, and advanced compatibility;
- existing host and unified workbench tests are updated after Phase 2B gate;
- Playwright proves every old route lands inside `.rule-center-v2`;
- real browser acceptance proves the UI is visibly rebuilt;
- no knowledge-library, table-evidence, Harness, backend, contracts, runtime binding, model routing, or permission changes are included without explicit approval.

## Residual Risks

- `template-governance-workbench-page.tsx` is a large monolith. Keep edits surgical: extract helpers first, then add a small delegation change after parity tests pass.
- Advanced/classic contains many legacy operations. The advanced V2 panel is the compatibility safety net until each advanced action earns a first-class V2 row action.
- Table evidence and Harness branches can change integration points. The plan deliberately gates those touchpoints instead of guessing their final shape.
