# Homepage Hero Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `医学稿件处理系统` the dominant homepage hero headline and demote the oversized long sentence into shorter supporting copy without changing the overall entrance layout.

**Architecture:** Keep the current `PersistentAuthShellView` structure, but reassign hero copy roles inside `AuthShellBrand`. Update the supporting markup and CSS only where necessary, and lock the new structure with a targeted server-render test.

**Tech Stack:** React 18, TypeScript, shared app CSS in `apps/web/src/app/app.css`, Node test runner with `tsx`.

---

## File Structure

- Modify: `apps/web/src/app/persistent-auth-shell.tsx`
- Modify: `apps/web/src/app/app.css`
- Modify: `apps/web/test/persistent-auth-shell.spec.tsx`
- Reference: `docs/superpowers/specs/2026-04-19-homepage-hero-hierarchy-design.md`

### Task 1: Lock The New Hero Copy Hierarchy

**Files:**
- Modify: `apps/web/test/persistent-auth-shell.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add a focused unauthenticated-shell assertion that checks:

- `医学稿件处理系统` is rendered as the main hero heading text
- `初筛、编辑、校对与知识入库的一体化工作台` is present as supporting copy
- the old oversized long sentence no longer appears in the hero markup

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx
```

Expected: FAIL because the current hero still renders the old long `h1`.

### Task 2: Implement The Approved Hero Hierarchy

**Files:**
- Modify: `apps/web/src/app/persistent-auth-shell.tsx`
- Modify: `apps/web/src/app/app.css`
- Modify: `apps/web/test/persistent-auth-shell.spec.tsx`

- [ ] **Step 1: Update the hero markup**

Change `AuthShellBrand` usage so:

- the product name becomes the title
- the shortened approved subtitle becomes the supporting description
- the existing explanatory paragraph remains below

- [ ] **Step 2: Update the hero typography**

Adjust the hero CSS so:

- the title is more prominent
- the subtitle is visibly smaller and calmer
- the copy block wraps more cleanly on desktop and mobile

- [ ] **Step 3: Re-run the focused test**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @medsys/web typecheck
```

Expected: PASS.
