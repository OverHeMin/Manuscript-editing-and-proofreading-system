# Shared Shell And Entrance Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the premium login entrance, compact shared workbench shell, stable left-navigation grouping, and route defaults that all later redesign pages depend on.

**Architecture:** Keep the authenticated shell and global left navigation as the permanent product frame, but simplify the shell so it stops competing with the working pages. Reuse the existing workbench host, route parsing, and session bootstrap model, while tightening the entrance posture, navigation IA, compact header, and default workbench resolution so later page-level redesigns can land inside one stable frame.

**Tech Stack:** React 18, TypeScript, Vite app shell CSS, existing persistent auth runtime in `apps/web/src/app`, Node test runner with `tsx`.

---

## Scope And Status

This child plan implements the shell and entrance baseline defined in:

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

This plan only covers cross-cutting frame behavior:

- login entrance
- shared shell header
- left navigation grouping and labels
- route defaults and compatibility

This plan does **not** implement the internal content redesign for:

- rule center
- knowledge library
- knowledge review
- manuscript workbenches
- management overview

Those page-level surfaces should land through their own child plans after this baseline is stable.

## File Structure

### Entrance and app frame

- `apps/web/src/app/App.tsx`
- `apps/web/src/app/app.css`
- `apps/web/src/app/persistent-auth-shell.tsx`

### Shared shell and routing

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-shell-header.tsx`
- `apps/web/src/app/workbench-navigation-menu.tsx`
- `apps/web/src/app/workbench-shell-layout.ts`

### Tests

- `apps/web/test/persistent-auth-shell.spec.tsx`
- `apps/web/test/workbench-host.spec.tsx`

## Task 1: Lock the premium login entrance and bootstrap states as the approved public face

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/app.css`
- Modify: `apps/web/src/app/persistent-auth-shell.tsx`
- Modify: `apps/web/test/persistent-auth-shell.spec.tsx`

- [ ] **Step 1: Write failing tests for the final entrance posture**

Cover:

- unauthenticated users see a premium Chinese-first entrance
- the page still uses a left visual area plus right login card
- bootstrap, error, and login-pending states keep the same premium shell instead of collapsing into plain placeholders
- safe user-facing English copy in the entrance is translated to Chinese

- [ ] **Step 2: Run the entrance-focused tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx
```

Expected: FAIL if any of the auth states still expose stale plain placeholders, inconsistent copy, or weaker-than-approved presentation.

- [ ] **Step 3: Implement the final entrance shell**

Apply these rules:

- keep the premium entrance direction already approved
- keep the split `visual hero + login card` structure
- keep the entrance Chinese-first
- make bootstrap and error states feel like part of the same entrance product instead of separate bare utility screens
- preserve the existing authentication behavior and session bootstrap semantics

- [ ] **Step 4: Align demo-mode placeholder shells with the same voice**

`App.tsx` development and demo fallbacks should feel compatible with the final product shell, even if they remain simpler than the authenticated entrance.

- [ ] **Step 5: Re-run the entrance-focused tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/App.tsx apps/web/src/app/app.css apps/web/src/app/persistent-auth-shell.tsx apps/web/test/persistent-auth-shell.spec.tsx
git commit -m "feat: finalize premium entrance and auth shell states"
```

## Task 2: Finalize the left-navigation IA and role-based group posture

**Files:**
- Modify: `apps/web/src/app/workbench-navigation.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing tests for the final navigation grouping and labels**

Cover:

- the admin navigation groups are exactly:
  - `核心流程`
  - `协作与回收区`
  - `管理区`
- `知识审核 / 规则中心 / 质量优化` sit in `协作与回收区`
- management labels stay:
  - `管理总览`
  - `AI 接入`
  - `账号与权限`
  - `Harness 控制`
- no duplicated `首页` group remains in the normal admin shell

- [ ] **Step 2: Run the navigation tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: FAIL if the current group model, labels, or ordering still reflect stale IA assumptions.

- [ ] **Step 3: Implement the final grouped navigation model**

Apply these rules:

- keep the left navigation
- remove unnecessary extra home grouping from operator-facing roles where it no longer serves the IA
- keep role-based visibility rules intact
- preserve existing workbench ids and target routing
- use Chinese-first labels approved in the redesign conversation

- [ ] **Step 4: Keep navigation semantics stable for non-admin roles**

The simplified IA must still respect current role access boundaries:

- general users should not see management navigation
- core operators should not inherit admin-only groups
- knowledge and governance destinations should remain visible only where allowed

- [ ] **Step 5: Re-run the navigation tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/workbench-navigation.ts apps/web/src/app/workbench-host.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: finalize shared workbench navigation groups"
```

## Task 3: Tighten route defaults and shell render decisions around the final IA

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing tests for the final route-default posture**

Cover:

- bare `#template-governance` still lands on the approved rule-center default child surface
- bare `#knowledge-library` lands on the final knowledge-library operator surface selected by its child plan
- settings and Harness split targets still resolve correctly through query parameters
- route compatibility survives for existing hashes already used in tests or handoffs

- [ ] **Step 2: Run the route-default tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: FAIL if route defaults or target resolution still disagree with the approved shell IA.

- [ ] **Step 3: Simplify route resolution without renaming existing ids or query keys**

Apply these rules:

- keep existing workbench ids
- keep existing query-key compatibility where possible
- use route-default behavior to express the final operator IA
- do not introduce new top-level workbench ids just to localize or reorganize

- [ ] **Step 4: Ensure host focus labels and active navigation state stay in sync**

The shell header focus card and active nav item must continue to reflect:

- the routed child view
- split settings targets
- split Harness targets
- rule-center child views

- [ ] **Step 5: Re-run the route-default tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-host.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: settle route defaults for the final shell IA"
```

## Task 4: Compact the shell header so it supports pages instead of competing with them

**Files:**
- Modify: `apps/web/src/app/workbench-shell-header.tsx`
- Modify: `apps/web/src/app/app.css`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing tests for the compact shell-header posture**

Cover:

- the shell header remains present
- it shows the active workbench and group clearly
- it does not rely on large hero-like prose blocks
- it keeps responsive navigation controls and logout behavior
- the public shell copy is Chinese-first

- [ ] **Step 2: Run the shell-header tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
```

Expected: FAIL if the current shell header still behaves like a large presentation band instead of a compact frame.

- [ ] **Step 3: Implement the compact shell-header baseline**

Apply these rules:

- keep a clear brand row
- keep the current-workbench focus card
- keep responsive nav toggle behavior
- reduce oversized descriptive copy and decorative competition
- let the page body own the main visual weight

- [ ] **Step 4: Re-run the shell-header tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/workbench-host.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/workbench-shell-header.tsx apps/web/src/app/app.css apps/web/test/workbench-host.spec.tsx
git commit -m "feat: compact the shared shell header"
```

## Task 5: Verify the shell baseline before downstream page redesigns begin

**Files:**
- Verify touched files only

- [ ] **Step 1: Run the shell regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-auth-shell.spec.tsx ./test/workbench-host.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 2: Perform browser acceptance on the shell baseline**

Manual checklist:

- login entrance looks premium and Chinese-first
- bootstrap and error states still feel like the same product
- left navigation groups match the approved IA
- route defaults land on the expected work areas
- shell header is compact and readable
- shell chrome does not overwhelm the working pages

- [ ] **Step 3: Commit only if the acceptance pass required source adjustments**

```bash
git add apps/web/src/app/App.tsx apps/web/src/app/app.css apps/web/src/app/persistent-auth-shell.tsx apps/web/src/app/workbench-host.tsx apps/web/src/app/workbench-navigation.ts apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-shell-header.tsx apps/web/test/persistent-auth-shell.spec.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "test: verify shared shell and entrance baseline"
```

Skip the commit if verification is green and the acceptance pass required no extra edits.

## Master-Plan Alignment

This child plan fills the first execution dependency in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

It should be completed before:

- centralized AI access cleanup
- knowledge-library rollout
- knowledge-review simplification
- manuscript workbench redesign

Because those modules all depend on one stable shell, stable route defaults, and final navigation grouping.

## Execution Gate

Do not start implementation from this document yet.

Current user instruction is:

- continue finishing the total planning set
- do not begin implementation until the remaining plans are finished

When execution is eventually approved, follow the tasks in order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
