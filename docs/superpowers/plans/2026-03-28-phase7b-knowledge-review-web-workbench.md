# Phase 7B Knowledge Review Web Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real Web knowledge-review workbench page so `knowledge_reviewer` and `admin` users can review live pending knowledge items in a master-detail desk, approve or reject them with notes, and auto-advance through the queue.

**Architecture:** Promote `apps/web` from a typed-client package into a minimal React + Vite runtime without attempting a full admin console. Keep business behavior in pure `knowledge-review` state/controller modules that consume the Phase 7A typed clients, then render one role-aware workbench host with a queue pane, detail pane, review history, and inline actions.

**Tech Stack:** TypeScript, React, React DOM, Vite, existing typed `knowledge` clients, existing typed `auth` workbench registry, plain CSS for the first reviewer desk shell.

---

## Scope Notes

- This phase creates the first runnable Web shell because `apps/web` currently has no runtime.
- Keep the page single-workbench and single-route for now; do not introduce a full router, global state library, or design-system migration in this phase.
- Reuse the Phase 7A `knowledge` typed clients directly instead of creating a second Web API abstraction layer.
- Filter changes should re-fetch the pending-review queue data source in v1, then apply the current filter state over the refreshed queue payload. This preserves the approved interaction model without forcing a broader backend list API in the same phase.
- The `status` filter should remain constrained to pending-review semantics until a broader review-list API exists, but it still participates in the same queue refresh flow as the other filters.
- Preserve the fixed responsibility split: `superpowers` owns plan/spec, `subagent` owns bounded execution, and `gstack` can validate the shipped page later.

## Planned File Structure

- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/.env.example`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/app.css`
- Create: `apps/web/src/app/dev-session.ts`
- Create: `apps/web/src/app/workbench-host.tsx`
- Create: `apps/web/src/lib/browser-http-client.ts`
- Modify: `apps/web/src/features/auth/workbench.ts`
- Create: `apps/web/src/features/knowledge-review/index.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-state.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-state.type-test.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-controller.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-controller.type-test.ts`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- Modify: `apps/web/src/features/knowledge/index.ts`
- Test: `apps/web/src/features/knowledge-review/workbench-state.type-test.ts`
- Test: `apps/web/src/features/knowledge-review/workbench-controller.type-test.ts`

### Task 1: Bootstrap The Minimal Web Runtime Shell

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/.env.example`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/app.css`
- Test: `apps/web/package.json`

- [ ] **Step 1: Confirm the current Web package cannot build a real page**

Run: `pnpm --filter @medsys/web build`
Expected: FAIL because `apps/web` does not yet define a Vite build script or a browser entry point

- [ ] **Step 2: Add the runtime dependencies and shell scripts**

Update `apps/web/package.json` to add:

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`
- `@types/react`
- `@types/react-dom`

Also add scripts for:

- `dev`
- `build`
- `preview`
- keep `typecheck` and `smoke:boot`

- [ ] **Step 3: Add the minimal browser shell**

Create:

- `index.html` with a single `#root`
- `vite.config.ts`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/app.css`
- `src/vite-env.d.ts`

Implementation rules:

- keep the first shell intentionally small
- do not add routing libraries yet
- use plain CSS, not a component framework, for this phase
- make `App.tsx` render an obvious placeholder host so later tasks can plug in the workbench

- [ ] **Step 4: Update TypeScript and environment support**

Update `apps/web/tsconfig.json` so the package supports:

- `.tsx` files
- DOM libs
- React JSX transform

Update `.env.example` with a reviewer-friendly dev role variable such as:

- `VITE_DEV_ROLE=knowledge_reviewer`

- [ ] **Step 5: Install and verify the runtime shell**

Run: `pnpm install`

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

Run: `pnpm --filter @medsys/web build`
Expected: PASS and Vite emits a production bundle

Run: `pnpm --filter @medsys/web dev`
Expected: PASS and Vite serves the first Web shell on a local browser URL such as `http://127.0.0.1:5173`

Run: `pnpm --filter @medsys/web smoke:boot`
Expected: PASS with the existing environment validation output

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/.env.example apps/web/index.html apps/web/vite.config.ts apps/web/src
git commit -m "feat: bootstrap web runtime shell"
```

### Task 2: Add A Pure Knowledge Review Desk State Model

**Files:**
- Create: `apps/web/src/features/knowledge-review/index.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-state.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-state.type-test.ts`
- Test: `apps/web/src/features/knowledge-review/workbench-state.type-test.ts`

- [ ] **Step 1: Write the failing state-model type test**

Add compile-time examples for:

- initial selection chooses the first queue item
- clicking a queue item updates the active selection
- applying filters removes non-matching items from the visible queue
- if the active item disappears after filtering, selection falls back to the first remaining item
- after approve or reject success, the current item is removed and the next visible item becomes active
- if no items remain, the detail panel state becomes empty

- [ ] **Step 2: Run typecheck to verify the state model is missing**

Run: `pnpm --filter @medsys/web typecheck`
Expected: FAIL because `workbench-state.ts` and its exported helpers do not exist yet

- [ ] **Step 3: Implement the minimal pure state helpers**

Create `workbench-state.ts` with focused helpers for:

- filter state shape
- local queue filtering
- queue refresh result reconciliation
- active item resolution
- auto-advance after successful review
- empty-state detection

Implementation rules:

- keep the functions pure and framework-agnostic
- do not embed fetch logic here
- make room for controller-driven queue refreshes by separating "refresh payload received" from "visible queue resolved"
- include a short comment near the auto-advance rule because it is a business-critical reviewer behavior

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/knowledge-review
git commit -m "feat: add knowledge review desk state model"
```

### Task 3: Wire Browser Data Loading And Review Actions

**Files:**
- Create: `apps/web/src/lib/browser-http-client.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-controller.ts`
- Create: `apps/web/src/features/knowledge-review/workbench-controller.type-test.ts`
- Modify: `apps/web/src/features/knowledge/index.ts`
- Test: `apps/web/src/features/knowledge-review/workbench-controller.type-test.ts`

- [ ] **Step 1: Write the failing controller type test**

Add expectations for:

- loading the pending review queue through the Phase 7A typed clients
- loading review history for the active item
- preserving the current review note when an approve or reject action fails
- clearing the note only after a successful action
- reloading history and queue state after a successful review action

- [ ] **Step 2: Run typecheck to confirm the controller contract is missing**

Run: `pnpm --filter @medsys/web typecheck`
Expected: FAIL because the browser HTTP adapter and controller exports do not exist yet

- [ ] **Step 3: Implement the browser HTTP adapter**

Create `browser-http-client.ts` with:

- a thin `fetch`-based implementation of the existing `KnowledgeHttpClient` contract
- JSON request/response handling
- clear error objects for non-2xx responses
- request URL resolution based on `VITE_API_BASE_URL`

Implementation rules:

- keep the adapter generic enough for later workbenches
- normalize relative `/api/v1/...` paths against `VITE_API_BASE_URL` so the first runtime shell does not depend on an implicit dev proxy
- do not add auth token storage or interceptors in this phase

- [ ] **Step 4: Implement the knowledge review controller**

Create `workbench-controller.ts` with focused async functions for:

- `loadKnowledgeReviewDesk`
- `loadKnowledgeReviewHistory`
- `approveKnowledgeReviewItem`
- `rejectKnowledgeReviewItem`

Implementation rules:

- consume the existing `knowledge` typed client exports directly
- re-fetch the pending-review queue whenever filter state changes, then resolve the visible queue from the refreshed payload in the controller/state layer
- keep review-note preservation explicit so action failures do not erase reviewer input

- [ ] **Step 5: Re-run typecheck**

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/browser-http-client.ts apps/web/src/features/knowledge/index.ts apps/web/src/features/knowledge-review
git commit -m "feat: add knowledge review browser controller"
```

### Task 4: Build The Master-Detail Knowledge Review Workbench Page

**Files:**
- Create: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-queue-pane.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-detail-pane.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-action-panel.tsx`
- Create: `apps/web/src/features/knowledge-review/knowledge-review-workbench.css`
- Test: `apps/web/package.json`

- [ ] **Step 1: Make the page wiring fail before implementation**

Update imports in `apps/web/src/features/knowledge-review/index.ts` so the feature expects:

- the page component
- the queue pane
- the detail pane
- the action panel

Run: `pnpm --filter @medsys/web build`
Expected: FAIL because the page components do not exist yet

- [ ] **Step 2: Implement the queue pane**

Create `knowledge-review-queue-pane.tsx` to render:

- keyword search
- status filter
- knowledge kind filter
- module filter
- queue count
- clickable queue items

Implementation rules:

- keep the status filter constrained to pending-review semantics in this phase
- show explicit empty and no-results states
- keep metadata compact and reviewer-oriented
- each queue item must show at least title, knowledge kind, module scope, and evidence level, plus manuscript type and template/risk hints when present

- [ ] **Step 3: Implement the detail and action panels**

Create:

- `knowledge-review-detail-pane.tsx`
- `knowledge-review-action-panel.tsx`

Render:

- title
- canonical text
- summary
- evidence level
- source type
- source link
- routing scope
- template bindings
- review history
- review event type
- review event timestamp
- review actor role label
- review note
- review note input
- approve and reject buttons
- loading, success, and error feedback

Implementation rules:

- history load failures must not hide the knowledge detail
- action failures must keep the current note in place
- rejection remains allowed without a note, but the UI should gently encourage a note before rejecting
- add a short comment near the rejection-note handling if the logic is not self-evident

- [ ] **Step 4: Implement the composed page**

Create `knowledge-review-workbench-page.tsx` and `knowledge-review-workbench.css` to assemble the master-detail desk:

- left queue column
- right detail/history/action column
- initial load state
- recoverable queue error state
- queue-load failure fallback that keeps the last stable detail selection when present, otherwise shows a neutral empty panel
- auto-selection of the first item
- auto-advance after approve or reject success
- manual recovery when auto-advance cannot resolve the next visible item after a successful action

- [ ] **Step 5: Re-run build and typecheck**

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

Run: `pnpm --filter @medsys/web build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/knowledge-review
git commit -m "feat: add knowledge review master detail page"
```

### Task 5: Attach The Workbench To A Role-Aware App Host

**Files:**
- Create: `apps/web/src/app/dev-session.ts`
- Create: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/features/auth/workbench.ts`
- Test: `apps/web/package.json`

- [ ] **Step 1: Make app-host integration fail before implementation**

Update `App.tsx` to import a workbench host and a dev session source.

Run: `pnpm --filter @medsys/web build`
Expected: FAIL because the app host files do not exist yet

- [ ] **Step 2: Implement the dev session source**

Create `dev-session.ts` to derive a local session from environment variables using the existing typed auth session builder.

Implementation rules:

- default to `knowledge_reviewer` when no override is provided
- keep this as a development-only bootstrap helper, not a production auth implementation

- [ ] **Step 3: Implement the workbench host**

Create `workbench-host.tsx` to:

- render the current session context
- display the visible workbench entries from the typed registry
- mount the knowledge review page only when the active role can access `knowledge-review`
- show a neutral placeholder for workbenches not implemented yet

Implementation rules:

- do not expose admin-only workbench surfaces to non-admin users
- use the existing typed registry as the source of truth for visibility

- [ ] **Step 4: Verify and, if needed, correct workbench registry exposure**

Review `apps/web/src/features/auth/workbench.ts` and ensure:

- `knowledge-review` remains visible to `admin` and `knowledge_reviewer`
- `knowledge-review` stays hidden from all other roles
- the runtime host consumes the same typed entry instead of re-declaring visibility rules locally

- [ ] **Step 5: Finalize `App.tsx`**

Wire `App.tsx` to the new host and keep the shell intentionally small:

- session header
- left-side workbench navigation
- primary content region

- [ ] **Step 6: Run the final Web package checks**

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

Run: `pnpm --filter @medsys/web build`
Expected: PASS

Run: `pnpm --filter @medsys/web smoke:boot`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app apps/web/src/features/auth/workbench.ts apps/web/.env.example
git commit -m "feat: expose role aware knowledge review workbench"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm --filter @medsys/web build`
- [ ] Run: `pnpm --filter @medsys/web smoke:boot`
- [ ] Run: `pnpm --filter @medical/api test -- knowledge`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- `apps/web` boots as a real browser application with a minimal React + Vite shell.
- `knowledge_reviewer` and `admin` can see and open the knowledge review workbench from the role-aware host.
- The left queue supports keyword, status, knowledge-kind, and module filters over the live pending-review dataset.
- The right panel shows knowledge detail, review history, and inline review actions in one place.
- Approve and reject remove the current item from the queue and auto-advance to the next visible item.
- Failed actions preserve the typed review note and keep the current item selected.
- Empty, filtered-empty, queue-error, and history-error states are explicit and recoverable.
- The implementation stays small enough to act as the reusable page pattern for later workbenches without introducing a full admin console rewrite.
