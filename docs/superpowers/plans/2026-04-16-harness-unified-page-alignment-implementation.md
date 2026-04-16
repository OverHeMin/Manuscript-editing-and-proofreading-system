# Harness Unified Page Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `管理总览` lightweight while consolidating real Harness controls, run history, comparison context, and dataset entry back into one Harness-owned experience.

**Architecture:** Reuse the current `evaluation-workbench` route as the singular Harness home, then compose the existing read-only evaluation surface with the already-built Harness control components and the dataset surface inside that same owned page. Preserve legacy `harness-datasets` and `harnessSection=datasets` entry compatibility, but make all user-facing links prefer the singular Harness route so operators stay mentally inside one product.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing `evaluation-workbench`, `admin-governance`, and `harness-datasets` features, Node test runner with `tsx`.

---

## Scope And Status

This plan implements the approved spec:

- [2026-04-16-harness-unified-page-alignment-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-16-harness-unified-page-alignment-design.md)

The implementation rules are fixed:

- keep `管理总览` as a lightweight gateway page
- keep one singular management nav target for Harness
- move real Harness control actions into the owned Harness page
- keep run history and dataset work discoverable from the same Harness-owned page
- preserve compatibility for old dataset entry hashes if they already exist
- keep changes bounded to Harness pages, admin entry links, and shared routing/navigation where Harness depends on them

This plan does **not**:

- redesign rule center, knowledge library, or manuscript workbench internals
- replace existing backend Harness APIs with new contracts
- introduce a brand-new top-level workbench family

## File Structure

### Shared routing and entry surfaces

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/features/auth/workbench.ts`
- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`

### Harness-owned pages and supporting composition

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/src/features/evaluation-workbench/index.ts`
- `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- `apps/web/src/features/admin-governance/harness-environment-editor.tsx`
- `apps/web/src/features/admin-governance/harness-quality-lab.tsx`
- `apps/web/src/features/admin-governance/harness-activation-gate.tsx`
- `apps/web/src/features/admin-governance/admin-governance-controller.ts`

### Focused tests

- `apps/web/test/admin-governance-workbench-page.spec.tsx`
- `apps/web/test/workbench-host.spec.tsx`
- `apps/web/test/evaluation-workbench-page.spec.tsx`
- `apps/web/test/harness-datasets-workbench-page.spec.tsx`

## Task 1: Lock the unified Harness IA in routing and entry tests

**Files:**
- Modify: `apps/web/test/admin-governance-workbench-page.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing tests for the preferred singular Harness route**

Cover:

- the lightweight `管理总览` Harness card still points primary traffic to `#evaluation-workbench?harnessSection=overview`
- the inline dataset link now points to `#evaluation-workbench?harnessSection=datasets` instead of preferring `#harness-datasets`
- `#evaluation-workbench?harnessSection=datasets` still keeps governance navigation focused on the singular Harness target
- direct `#harness-datasets` compatibility still opens a Harness-owned experience instead of a disconnected sibling feeling

- [ ] **Step 2: Run the focused routing tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
```

Expected: FAIL because current links still prefer the standalone dataset workbench and the host still renders a separate dataset page for dataset hashes.

- [ ] **Step 3: Implement the bounded routing and entry-link changes**

Apply these rules:

- keep one management nav target for Harness
- prefer `evaluation-workbench` plus `harnessSection` for overview, runs, and datasets
- keep `harness-datasets` as a compatibility route only
- do not add new top-level nav items

- [ ] **Step 4: Re-run the focused routing tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/workbench-host.tsx apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/test/admin-governance-workbench-page.spec.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: align harness entry routes to a singular workbench"
```

## Task 2: Compose the owned Harness page with real controls and dataset ownership

**Files:**
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Modify: `apps/web/test/harness-datasets-workbench-page.spec.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- Modify: `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/index.ts`

- [ ] **Step 1: Write failing Harness page tests for the unified operator loop**

Cover:

- the owned Harness page still renders run overview, comparison posture, and bounded history
- the same page now renders the real control-plane components:
  - environment selection
  - candidate preview
  - candidate run launch
  - activate / rollback
- the same page clearly exposes dataset ownership through an embedded dataset section or embedded dataset entry surface
- the `runs` and `datasets` section hashes stay inside the same Harness page rather than switching to a different product shell
- the standalone dataset page component can still render as a full page when used directly, but can also render in an embedded Harness-owned mode without duplicating its hero

- [ ] **Step 2: Run the Harness page tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
```

Expected: FAIL because the current evaluation page is still results-only and the dataset page only exists as its own standalone surface.

- [ ] **Step 3: Implement the unified Harness page composition**

Apply these rules:

- keep the current evaluation/results/history logic intact where possible
- add a small internal Harness section switcher so overview, runs, and datasets feel like subviews of the same page
- compose the existing `HarnessEnvironmentEditor`, `HarnessQualityLab`, and `HarnessActivationGate` into the owned page
- load Harness control scope from the existing admin controller APIs without moving the control plane back into `管理总览`
- render the dataset surface inside Harness ownership, using an embedded mode when appropriate to avoid nested page heroes
- keep any new helper component boundaries small and purpose-specific

- [ ] **Step 4: Re-run the Harness page tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/src/features/evaluation-workbench/evaluation-workbench.css apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx apps/web/src/features/evaluation-workbench/index.ts apps/web/test/evaluation-workbench-page.spec.tsx apps/web/test/harness-datasets-workbench-page.spec.tsx
git commit -m "feat: unify harness controls history and datasets on one page"
```

## Task 3: Wire live Harness mutations through the owned page without broad regressions

**Files:**
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`

- [ ] **Step 1: Write failing tests for Harness control-plane behavior wiring**

Cover:

- scope defaults come from an existing execution-profile scope instead of requiring new user setup
- preview requests use the current five governed selections
- candidate run launch uses the previewed candidate binding instead of detached placeholder state
- activate and rollback actions surface bounded success or error feedback inside the Harness page
- no assertions require knowledge-library, rule-center, or manuscript-workbench behavior to change

- [ ] **Step 2: Run the focused Harness behavior tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx
```

Expected: FAIL because the current Harness page does not yet own the mutation wiring.

- [ ] **Step 3: Implement minimal mutation wiring and local feedback**

Apply these rules:

- keep state local to the Harness page or a tiny Harness helper layer
- reuse the existing admin-governance controller APIs as-is unless a tiny adapter is strictly needed
- refresh only the Harness-owned data that needs to update after preview, run creation, activation, or rollback
- avoid broad controller or type churn outside the Harness-owned flow

- [ ] **Step 4: Re-run focused tests and then the combined Harness suite to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx ./test/admin-governance-workbench-page.spec.tsx ./test/workbench-host.spec.tsx ./test/harness-datasets-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/src/features/admin-governance/admin-governance-controller.ts apps/web/test/evaluation-workbench-page.spec.tsx apps/web/test/admin-governance-workbench-page.spec.tsx apps/web/test/workbench-host.spec.tsx apps/web/test/harness-datasets-workbench-page.spec.tsx
git commit -m "feat: wire harness operator actions into the owned workbench"
```

## Verification Checklist

- [ ] `管理总览` remains lightweight and does not embed the real control plane
- [ ] Harness navigation still shows one singular management target
- [ ] `#evaluation-workbench?harnessSection=overview|runs|datasets` all stay inside the owned Harness experience
- [ ] legacy `#harness-datasets` hashes still work as compatibility entry points
- [ ] the owned Harness page exposes the real five-part governed control set
- [ ] the owned Harness page still renders run history and comparison posture
- [ ] dataset work is clearly presented as part of Harness ownership
- [ ] no unrelated knowledge-library, rule-center, or manuscript-workbench behavior changes are required
