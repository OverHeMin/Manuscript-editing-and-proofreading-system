# Harness Minimal Alignment Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing singular Harness page feel like one true operator workspace by tightening layout ownership, exposing manuscript-type scope switching, and integrating dataset ownership more intentionally.

**Architecture:** Keep the existing `evaluation-workbench` route and the current Harness control APIs, but refactor page composition into explicit left/center/right working regions. Let the left region own section switching, dataset entry, suite selection, and history; let the center region own comparison/evidence or embedded datasets; let the right region own the governed control plane and scope summary. Keep `Template Family` derived while making `Manuscript Type` selectable from the available scope profiles.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing evaluation-workbench/admin-governance/harness-datasets features, Node test runner with `tsx`.

---

## Scope And Status

This plan implements:

- [2026-04-16-harness-unified-page-alignment-design.md](/C:/医学稿件处理系统V1/.worktrees/harness-unified-minimal-package-v1/docs/superpowers/specs/2026-04-16-harness-unified-page-alignment-design.md)
- [2026-04-17-harness-minimal-alignment-package-design.md](/C:/医学稿件处理系统V1/.worktrees/harness-unified-minimal-package-v1/docs/superpowers/specs/2026-04-17-harness-minimal-alignment-package-design.md)

## File Structure

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- `apps/web/src/features/admin-governance/harness-environment-editor.tsx`
- `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- `apps/web/src/features/harness-datasets/harness-datasets-workbench.css`
- `apps/web/test/evaluation-workbench-page.spec.tsx`
- `apps/web/test/harness-datasets-workbench-page.spec.tsx`

## Task 1: Lock the unified workspace shape in tests

**Files:**
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Modify: `apps/web/test/harness-datasets-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing test**

Cover:

- the Harness page renders an explicit unified workspace layout instead of only stacked regions
- the left-side Harness area still owns section switching and dataset ownership entry
- the right-side control plane exposes `Manuscript Type` as a selectable scope field
- the right-side control plane exposes the active template-family boundary
- the embedded datasets mode renders as a Harness-owned workspace section without the standalone hero

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
```

Expected: FAIL because the current page still uses the older stacked composition and `Manuscript Type` is read-only.

- [ ] **Step 3: Write minimal implementation**

Refactor the page composition and editor props just enough to satisfy the layout and scope-boundary expectations.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
```

Expected: PASS.

## Task 2: Implement selectable scope boundaries in the control plane

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-environment-editor.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that prove:

- `Manuscript Type` renders as a `<select>`
- the available manuscript-type options come from the current module scope
- the active template family is visible to the operator

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx
```

Expected: FAIL because the current editor renders a read-only input for manuscript type and does not surface the template-family scope.

- [ ] **Step 3: Write minimal implementation**

Use the existing execution-profile overview data to:

- derive manuscript-type options for the chosen module
- switch the active Harness scope when manuscript type changes
- show the derived template family without making it editable in this slice

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx
```

Expected: PASS.

## Task 3: Recompose the page into a clearer left/center/right operator workspace

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- Modify: `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- Modify: `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- Modify: `apps/web/src/features/harness-datasets/harness-datasets-workbench.css`

- [ ] **Step 1: Write the failing test**

Add assertions that prove:

- left region contains Harness sections, dataset ownership entry, suite selection, and history
- center region contains comparison/release/evidence content or embedded datasets
- right region contains the real control plane

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
```

Expected: FAIL because the current layout still places the control plane after the main workbench content rather than inside a unified operator workspace.

- [ ] **Step 3: Write minimal implementation**

Keep all existing data flows, but:

- move the Harness section switcher and dataset entry into the left region
- keep comparison and selected-run evidence in the center region
- render the control plane as a dedicated right rail
- make embedded datasets feel like part of the same Harness workspace

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
pnpm typecheck
```

Expected: PASS.

## Verification Checklist

- [ ] Harness still exposes one singular management destination
- [ ] `Manuscript Type` is selectable in the control plane
- [ ] active template-family scope is visible
- [ ] datasets still render in embedded mode without the standalone hero
- [ ] page composition now reads as one unified Harness workspace
- [ ] no rule-center, knowledge-library, or manuscript-workbench behavior changes are required
