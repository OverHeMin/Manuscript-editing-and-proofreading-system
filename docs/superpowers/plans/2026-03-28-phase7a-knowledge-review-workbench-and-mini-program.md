# Phase 7A Knowledge Review Workbench And Mini-Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first governed knowledge-review workbench slice so Web and WeChat clients can query pending review items, submit approval or rejection with notes, and inspect review history without exposing raw admin tooling.

**Architecture:** Extend the existing `knowledge` module instead of creating a parallel review subsystem. Keep `KnowledgeRecord` as the source of truth, make review actions explicit and queryable, then expose page-less typed web clients and role-scoped workbench contracts that future UI shells can consume.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, in-memory repository pattern, existing `knowledge`, `auth`, and typed web feature-client modules.

---

## Scope Notes

- This phase stays governance-first and queue-first.
- Knowledge review remains available only to `knowledge_reviewer` and `admin`.
- Rejection returns the item to editable `draft` status instead of introducing a second rejected state.
- Review notes are audit data and must be preserved in history.
- Web and WeChat continue to use the same `/api/v1/...` knowledge contract.
- Do not build actual pages yet; keep the web layer typed-client first.

## Planned File Structure

- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Modify: `apps/web/src/features/knowledge/types.ts`
- Modify: `apps/web/src/features/knowledge/knowledge-api.ts`
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/features/auth/session.ts`
- Create: `apps/web/src/features/knowledge-review-workbench.type-test.ts`

### Task 1: Add Note-Aware Knowledge Review Actions And Rejection Flow

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Test: `apps/api/test/knowledge/knowledge-governance.spec.ts`

- [ ] **Step 1: Write the failing backend tests**

Add expectations for:

- `knowledge_reviewer` can reject a pending-review item back to `draft`
- rejection and approval both persist optional review notes
- pending-review queue can be listed without pulling every knowledge item
- review history can be queried per knowledge item for WeChat audit views

- [ ] **Step 2: Run the failing backend tests**

Run: `pnpm --filter @medical/api test -- knowledge`  
Expected: FAIL because rejection, note-aware actions, and queue/history queries do not exist yet

- [ ] **Step 3: Implement the minimal backend support**

Implementation rules:

- keep all additions additive to the current `knowledge` slice
- extend `KnowledgeReviewActionRecord` instead of creating a second audit table
- allow `review_note` on review actions
- add a `rejected` review action that transitions the item back to `draft`
- add dedicated repository/service queries for pending-review items and action history

- [ ] **Step 4: Re-run the backend tests**

Run: `pnpm --filter @medical/api test -- knowledge`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/knowledge apps/api/test/knowledge/knowledge-governance.spec.ts
git commit -m "feat: add governed knowledge review queue and history"
```

### Task 2: Extend Typed Knowledge Clients For Web And WeChat Review Workflows

**Files:**
- Modify: `apps/web/src/features/knowledge/types.ts`
- Modify: `apps/web/src/features/knowledge/knowledge-api.ts`
- Create: `apps/web/src/features/knowledge-review-workbench.type-test.ts`

- [ ] **Step 1: Write the failing web type test**

Add expectations for:

- pending-review queue item view models
- review action history view models
- reject input with note support
- client functions for queue list, review history, approve, and reject

- [ ] **Step 2: Run web typecheck to verify failure**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: FAIL because the new knowledge review client contracts do not exist yet

- [ ] **Step 3: Implement the minimal typed clients**

Implementation rules:

- keep the existing `knowledge` feature as the single entry point
- align request bodies with the current typed-client pattern
- make the contracts usable by both Web workbench pages and WeChat list/detail flows

- [ ] **Step 4: Re-run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/knowledge apps/web/src/features/knowledge-review-workbench.type-test.ts
git commit -m "feat: add knowledge review workbench clients"
```

### Task 3: Replace Loose Workbench Strings With Typed Role-Scoped Entry Definitions

**Files:**
- Modify: `apps/web/src/features/auth/workbench.ts`
- Modify: `apps/web/src/features/auth/session.ts`
- Test: `apps/web/src/features/knowledge-review-workbench.type-test.ts`

- [ ] **Step 1: Extend the failing type test**

Add expectations for:

- explicit `WorkbenchId` unions instead of loose strings
- role-visible workbench entries with labels and placement
- admin-only review-governance entry points staying hidden from business roles

- [ ] **Step 2: Run web typecheck to verify failure**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: FAIL because workbench contracts are still string arrays

- [ ] **Step 3: Implement the typed workbench registry**

Implementation rules:

- keep `AuthSessionViewModel` backward compatible where possible
- add typed workbench entry definitions instead of replacing with UI-only route config
- model only the workbenches that already exist in the approved spec set

- [ ] **Step 4: Re-run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/features/knowledge-review-workbench.type-test.ts
git commit -m "feat: add typed workbench entry registry"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api test -- knowledge`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- Knowledge reviewers and admins can query a dedicated pending-review queue.
- Approval and rejection can both capture a review note and preserve it in review history.
- Rejected knowledge items return to `draft` for editing without losing prior audit history.
- Typed web clients support the first WeChat knowledge review slice without adding pages yet.
- Role workbench exposure is represented by typed entry definitions instead of loose strings.
