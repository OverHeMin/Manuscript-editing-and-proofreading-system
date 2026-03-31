# Phase 8Y Human Final Learning Handoff

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between proofreading finalization and the governed learning loop by publishing a real `human_final_docx` asset and handing the manuscript into Learning Review with useful prefilled context.

**Architecture:** Add one explicit manual publication action after proofreading finalization that creates a `human_final_docx` asset, records the action as a manual job, and advances the manuscript's current proofreading pointer. Then extend the proofreading workbench and learning review workbench so an operator can publish the human-final asset, jump into Learning Review, and see the manuscript/snapshot form prefilled from the current asset chain instead of retyping IDs by hand.

**Tech Stack:** TypeScript, node:test via `tsx`, React/Vite, Playwright, existing manuscript workbench and learning review APIs.

---

## Scope Notes

- Keep proofreading's existing draft-then-confirm flow unchanged; `human_final_docx` is a downstream manual publication step, not a replacement for `final_proof_annotated_docx`.
- Reuse the existing manuscript asset model and learning review forms rather than introducing a new learning wizard in this slice.
- Treat the manual publish action as governed operator evidence by creating a real job record and asset record.

## Planned Tasks

### Task 1: Manual Human-Final Publish Route

**Files:**
- Modify: `apps/api/src/modules/assets/document-asset-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Modify: `apps/api/test/http/support/workbench-runtime.ts`

- [x] Add failing HTTP tests for publishing a proofreading final into `human_final_docx`.
- [x] Verify the failures are caused by the missing route/handler.
- [x] Implement a proofreading-adjacent publish action that creates a manual job plus `human_final_docx`.
- [x] Update pointer behavior so the published human-final asset becomes the manuscript current proofreading asset.
- [x] Re-run the targeted API tests.

### Task 2: Proofreading Workbench Publish Action

**Files:**
- Modify: `apps/web/src/features/proofreading/types.ts`
- Modify: `apps/web/src/features/proofreading/proofreading-api.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [x] Add failing web/controller tests for the new publish-human-final action and updated proofreading guidance.
- [x] Verify the failures.
- [x] Add a proofreading utility action that publishes the current final proof into a human-final asset and reloads the workspace.
- [x] Update summary/next-step messaging so the human-final state clearly points toward Learning Review.
- [x] Re-run the targeted web tests.

### Task 3: Learning Review Prefill Handoff

**Files:**
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/test/learning-review-workbench-page.spec.tsx`
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts`

- [x] Add failing tests for a `manuscriptId` handoff into Learning Review.
- [x] Verify the failures are due to missing prefill wiring.
- [x] Pass the hash `manuscriptId` into Learning Review and prefill manuscript type / human-final asset / snapshot storage defaults from the manuscript asset chain.
- [x] Extend browser QA so the operator can publish a human-final asset and land in Learning Review with the manuscript prefilled.
- [x] Re-run the targeted browser and UI tests.

## Final Verification Gate

- [x] Run: `pnpm --filter @medical/api exec node --import tsx --test test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts`
- [x] Run: `pnpm --filter @medical/api run typecheck`
- [x] Run: `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-controller.spec.ts test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-summary.spec.tsx test/learning-review-workbench-page.spec.tsx`
- [x] Run: `pnpm --filter @medsys/web run typecheck`
- [x] Run: `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/manuscript-handoff.spec.ts`
- [x] Run: `pnpm verify:manuscript-workbench`

## Acceptance Criteria

- A proofreading final can be explicitly published into a governed `human_final_docx` asset.
- The published human-final asset becomes visible as the current downstream manuscript asset.
- The proofreading workbench makes the next step toward Learning Review obvious.
- Learning Review can open with manuscript-prefilled context, including the human-final asset reference needed for snapshot creation.
