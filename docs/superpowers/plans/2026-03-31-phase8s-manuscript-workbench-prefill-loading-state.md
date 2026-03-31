# Phase 8S Manuscript Workbench Prefill Loading State

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make downstream handoff auto-load feel intentional by showing operators an explicit loading state before the handed-off manuscript workspace finishes hydrating.

**Architecture:** Keep this slice entirely in the web page layer. Add a dedicated prefill-loading state in `ManuscriptWorkbenchPage`, render a loading card/skeleton when a `prefilledManuscriptId` is auto-loading, and reuse the existing controls with a combined disabled state so operators do not race the hydration flow.

**Tech Stack:** TypeScript, React/Vite, CSS, node:test via `tsx`, existing manuscript workbench controller.

---

## Scope Notes

- Do not change HTTP routes, controller contracts, or persistence behavior.
- Keep the new loading state specific to handoff-driven auto-load, not every workbench action.
- Preserve the existing notice/action-result model for success and failure after hydration completes.

## Delivered Work

- Added an explicit `isPrefillLoading` state to `ManuscriptWorkbenchPage` so handed-off workspaces:
  - render a loading state immediately on first paint
  - keep loading semantics separate from generic module/action `busy` state
  - disable workbench controls until auto-load finishes
- Added a dedicated loading card that shows:
  - `Loading manuscript ...` status copy
  - handoff-focused helper text
  - animated skeleton bars so the transition feels intentional instead of blank
- Added focused regression coverage proving a prefilled workbench now renders the loading state before hydration resolves.

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx`
- `pnpm --filter @medsys/web run typecheck`
- `pnpm --filter @medsys/web run test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## QA Notes

- Real browser QA is still blocked in this environment because Playwright/Chrome launch continues to fail with `spawn UNKNOWN`.

## Next Recommended Follow-up

- Add a slightly richer loading progression if operators need to distinguish `resolving manuscript`, `loading asset chain`, and `ready`.
- When browser QA is available again, verify the full handoff flow visually so we can confirm the loading card disappears cleanly once the workspace summary renders.
