# Current Workbench UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the authenticated web UI around the current workbench structure so the shell highlights `初筛 / 编辑 / 校对 / 知识库`, governance surfaces become visually secondary, and each page family inherits the approved black-gold system without changing route or API contracts.

**Architecture:** Keep the existing `WorkbenchHost` + hash-routing model and express the new IA through richer shell metadata, grouped navigation rendering, and page-family styling. Centralize shell grouping and visual tokens first, then restyle manuscript, knowledge, and governance families in separate passes so each slice can be tested independently.

**Tech Stack:** React 18, TypeScript, Vite, CSS, Node test runner with `tsx`, Playwright

---

### Task 1: Define Shell IA Metadata And Role-Aware Grouping

**Files:**
- Create: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write the failing shell grouping test**

Create `apps/web/test/workbench-host.spec.tsx` with static render coverage for:

```tsx
assert.match(html, /初筛/);
assert.match(html, /编辑/);
assert.match(html, /校对/);
assert.match(html, /知识库/);
assert.match(html, /管理区/);
assert.doesNotMatch(userHtml, /管理区/);
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: FAIL because the host still renders one flat `Workbenches` list.

- [ ] **Step 3: Add navigation metadata without breaking route IDs**

Add shell-facing metadata in `apps/web/src/features/auth/workbench.ts`:

- keep existing `id`, `placement`, and role contracts
- add fields such as `navLabel`, `navGroup`, and optional `navDescription`
- change `DEFAULT_WORKBENCH_BY_ROLE.admin` from `admin-console` to `screening`

Suggested shape:

```ts
type WorkbenchNavGroup = "mainline" | "knowledge" | "governance" | "general";
```

- [ ] **Step 4: Implement grouped navigation rendering**

Create `apps/web/src/app/workbench-navigation.ts` to translate visible entries into shell groups:

- primary pillars: `screening`, `editing`, `proofreading`, `knowledge-review`
- knowledge subitems: `knowledge-review`, `learning-review`
- governance group: `admin-console`, `template-governance`, `evaluation-workbench`, `harness-datasets`, `system-settings`
- general group: `submission`

Update `apps/web/src/app/workbench-host.tsx` so the shell:

- renders groups instead of one flat list
- shows Chinese pillar labels for shell navigation
- keeps route navigation and render kinds unchanged

- [ ] **Step 5: Update the demo shell fallbacks**

Update `apps/web/src/app/App.tsx` so demo loading and unavailable states use the same shell framing and no longer imply the old flat host.

- [ ] **Step 6: Re-run the shell grouping test**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the IA metadata slice**

```bash
git add apps/web/src/app/workbench-navigation.ts apps/web/src/features/auth/workbench.ts apps/web/src/app/workbench-host.tsx apps/web/src/app/App.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: group workbench navigation by current product structure"
```

### Task 2: Build Shared Shell Tokens, Auth Framing, And Motion Guardrails

**Files:**
- Modify: `apps/web/src/app/app.css`
- Modify: `apps/web/src/app/persistent-auth-shell.tsx`
- Test: `apps/web/test/persistent-auth-shell.spec.tsx`

- [ ] **Step 1: Extend auth shell tests for the refreshed framing**

Add expectations in `apps/web/test/persistent-auth-shell.spec.tsx` for:

- editorial-facing sign-in copy
- presence of the updated auth shell landmark text
- no regression in bootstrap and retry states

- [ ] **Step 2: Run the auth shell test and verify the new expectations fail**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx
```

Expected: FAIL on the new copy and shell framing assertions.

- [ ] **Step 3: Replace global shell tokens in `app.css`**

Refactor `apps/web/src/app/app.css` to define:

- black-gold shell tokens
- paper surface tokens
- shell group styles
- shared card, badge, and summary primitives
- reduced-motion handling via `@media (prefers-reduced-motion: reduce)`

- [ ] **Step 4: Refresh the auth shell markup**

Update `apps/web/src/app/persistent-auth-shell.tsx` so login, bootstrap, and retry states:

- match the new editorial workbench tone
- use the shell identity instead of generic admin-card framing
- keep all current auth logic untouched

- [ ] **Step 5: Re-run the auth shell test**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the shared shell slice**

```bash
git add apps/web/src/app/app.css apps/web/src/app/persistent-auth-shell.tsx apps/web/test/persistent-auth-shell.spec.tsx
git commit -m "feat: apply shared editorial shell styling"
```

### Task 3: Restyle The Manuscript Mainline Family

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Add failing assertions for the new family framing**

Update the existing manuscript tests to assert presence of:

- a stronger page header or summary region
- retained action labels such as `Run Screening`, `Run Editing`, `Create Draft`
- no regression in existing workflow affordances

- [ ] **Step 2: Run the manuscript test subset and verify at least one assertion fails**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because the current family still uses generic placeholder framing.

- [ ] **Step 3: Introduce manuscript-family hero and summary styling**

Update `manuscript-workbench-page.tsx` and CSS so the family gains:

- a real hero/header zone
- warmer editorial summary styling
- clearer separation between controls and operational summary

- [ ] **Step 4: Restyle panels without changing control logic**

Use `manuscript-workbench.css` to:

- keep forms and tables light
- elevate key summary cards
- add subtle hover and status emphasis
- avoid dark backgrounds behind dense form controls

- [ ] **Step 5: Re-run the manuscript test subset**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the manuscript-family slice**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx
git commit -m "feat: refresh manuscript workbench family styling"
```

### Task 4: Restyle The Knowledge Family Around Review-First Work

**Files:**
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench.css`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Create: `apps/web/test/knowledge-review-workbench-page.spec.tsx`
- Test: `apps/web/test/learning-review-workbench-page.spec.tsx`

- [ ] **Step 1: Write a missing static render test for knowledge review**

Create `apps/web/test/knowledge-review-workbench-page.spec.tsx` with assertions for:

- the queue pane
- the detail pane
- the action panel
- the new family header or shell cue

- [ ] **Step 2: Add a learning-review assertion that utilities stay secondary**

Extend `apps/web/test/learning-review-workbench-page.spec.tsx` to assert:

- the review queue and selected candidate render ahead of utility affordances
- the utility panel remains present but secondary

- [ ] **Step 3: Run the knowledge-family test subset and verify failures**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/learning-review-workbench-page.spec.tsx
```

Expected: FAIL because the new family framing does not exist yet.

- [ ] **Step 4: Refresh `knowledge-review` as a dense review desk**

Adjust page structure and CSS so the page:

- keeps queue/detail/action layout intact
- uses clearer section headers
- adds restrained shell-consistent emphasis for active review state

- [ ] **Step 5: Refresh `learning-review` as a bridge desk**

Adjust page structure and CSS so:

- queue, selected candidate, and review decision are the primary reading order
- writeback handoff remains visible
- the admin utility panel is clearly secondary

- [ ] **Step 6: Re-run the knowledge-family test subset**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/knowledge-review-workbench-page.spec.tsx ./test/learning-review-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the knowledge-family slice**

```bash
git add apps/web/src/features/knowledge-review/knowledge-review-workbench.css apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx apps/web/src/features/learning-review/learning-review-workbench.css apps/web/src/features/learning-review/learning-review-workbench-page.tsx apps/web/test/knowledge-review-workbench-page.spec.tsx apps/web/test/learning-review-workbench-page.spec.tsx
git commit -m "feat: refresh knowledge review and learning review styling"
```

### Task 5: Restyle Governance And Operations As A Quieter Management Zone

**Files:**
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench.css`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench.css`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- Modify: `apps/web/src/features/harness-datasets/harness-datasets-workbench.css`
- Test: `apps/web/test/harness-datasets-workbench-page.spec.tsx`
- Test: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Test: `apps/web/test/template-governance-workbench-page.spec.tsx`
- Test: `apps/web/playwright/admin-governance.spec.ts`

- [ ] **Step 1: Add targeted expectations for management-zone framing**

Update existing tests to look for:

- consistent family headers
- calmer metric cards
- grouped operational panels
- retained control labels and headings used by Playwright

- [ ] **Step 2: Run the governance-family test subset and verify failures**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/harness-datasets-workbench-page.spec.tsx ./test/evaluation-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: FAIL on the new framing assertions.

- [ ] **Step 3: Refresh the admin console family styling**

Update governance-family CSS so these pages:

- share quieter panel rhythm
- keep summary cards compact and operational
- use black-gold accents sparingly

- [ ] **Step 4: Preserve automation-heavy pages while reducing visual noise**

Ensure `template-governance`, `evaluation-workbench`, and `harness-datasets`:

- keep current dense structures intact
- inherit the same tokens
- do not become visually louder than the manuscript and knowledge families

- [ ] **Step 5: Re-run the governance-family unit tests**

Run:

```bash
pnpm --dir apps/web exec node --import tsx --test ./test/harness-datasets-workbench-page.spec.tsx ./test/evaluation-workbench-page.spec.tsx ./test/template-governance-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Run the governance Playwright smoke**

Run:

```bash
pnpm --dir apps/web test:browser -- --grep "governance console|template governance|journal-scoped|editing workbench saves a journal template context"
```

Expected: PASS with existing action flows intact.

- [ ] **Step 7: Commit the governance-family slice**

```bash
git add apps/web/src/features/admin-governance/admin-governance-workbench.css apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/src/features/template-governance/template-governance-workbench.css apps/web/src/features/evaluation-workbench/evaluation-workbench.css apps/web/src/features/harness-datasets/harness-datasets-workbench.css apps/web/test/harness-datasets-workbench-page.spec.tsx apps/web/test/evaluation-workbench-page.spec.tsx apps/web/test/template-governance-workbench-page.spec.tsx apps/web/playwright/admin-governance.spec.ts
git commit -m "feat: refresh governance and operations workbench styling"
```

### Task 6: Run Cross-Surface Verification And Polish

**Files:**
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts`
- Modify: `apps/web/playwright/knowledge-review-handoff.spec.ts`
- Modify: `apps/web/playwright/learning-review-flow.spec.ts`
- Optional Modify: `apps/web/src/app/app.css`

- [ ] **Step 1: Update browser assertions for the new shell hierarchy**

Adjust the Playwright specs so they assert:

- the four priority pillars are visible for admin
- management-zone links remain available but separated
- general or single-role flows still land in the correct workbench

- [ ] **Step 2: Run focused browser flows for manuscript and knowledge work**

Run:

```bash
pnpm --dir apps/web test:browser -- --grep "screening|proofreading|knowledge review|learning review"
```

Expected: PASS.

- [ ] **Step 3: Run app-level typecheck**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: PASS with no TypeScript regressions.

- [ ] **Step 4: Run the app test suite**

Run:

```bash
pnpm --dir apps/web test
```

Expected: PASS.

- [ ] **Step 5: Run the repo-level checks that touch this surface**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: PASS, or document unrelated failures before merging.

- [ ] **Step 6: Commit the verification and polish slice**

```bash
git add apps/web/playwright/manuscript-handoff.spec.ts apps/web/playwright/knowledge-review-handoff.spec.ts apps/web/playwright/learning-review-flow.spec.ts apps/web/src/app/app.css
git commit -m "test: verify refreshed editorial workbench UI flows"
```

### Notes

- Do not change route IDs or `resolveWorkbenchRenderKind`.
- Do not replace current page ownership boundaries.
- Do not introduce a new proofreading-specific review surface in this pass.
- Shell-level Chinese labels are allowed for navigation emphasis, but deep page copy does not need a full localization sweep in the same slice.
- If a page needs a structural wrapper for styling, prefer a small wrapper change over refactoring business logic.
