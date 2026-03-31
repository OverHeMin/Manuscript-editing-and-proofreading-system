# Phase 8R Manuscript Workbench Prefill Auto-Load

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the extra manual click after a manuscript handoff by automatically loading the target manuscript workspace when a downstream workbench opens with a prefilled manuscript ID.

**Architecture:** Keep backend contracts unchanged. Extract the prefilled workspace load into a testable helper, let the manuscript page auto-run that helper when `prefilledManuscriptId` is present, and keep the page's operator-facing success/error banner model consistent with manual lookup.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing manuscript workbench controller and handoff routing helpers.

---

## Scope Notes

- Do not add or change HTTP endpoints.
- Keep auto-load limited to read-only workspace hydration.
- Reuse the existing workbench notice/action-result presentation model rather than introducing a separate loading path.

## Delivered Work

- Added a `loadPrefilledWorkbenchWorkspace` helper that:
  - loads the manuscript workspace through the existing controller
  - produces a consistent operator-facing action result payload
  - keeps the auto-load logic directly testable without DOM-only integration coverage
- Updated `ManuscriptWorkbenchPage` so a handed-off `prefilledManuscriptId` now:
  - seeds the lookup field
  - clears stale local workbench state
  - automatically loads the target manuscript workspace
  - records an `Auto-loaded manuscript ...` success state
- Kept manual `Load Workspace` behavior aligned with the same helper so manual and automatic loads share one result shape.
- Added focused tests covering:
  - prefilled lookup rendering
  - helper-based workspace auto-load result generation
  - existing hash handoff parsing/formatting and next-step shortcut rendering

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts`
- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-summary.spec.tsx`
- `pnpm --filter @medsys/web run typecheck`
- `pnpm --filter @medsys/web run test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## QA Notes

- Real browser QA remains blocked in this environment because Playwright still fails to launch the local Chrome binary with `spawn UNKNOWN`.

## Next Recommended Follow-up

- Add a lightweight loading/skeleton treatment so the handed-off workbench makes auto-load progress more obvious while the workspace is hydrating.
- Once browser QA is available, verify hash handoff plus auto-load plus back-button behavior as one live flow.
- If operators need stronger auditability, surface a small “Opened from previous step” breadcrumb with source/target workbench labels.
