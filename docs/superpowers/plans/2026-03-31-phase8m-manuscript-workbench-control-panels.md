# Phase 8M Manuscript Workbench Control Panels

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the manuscript workbench control area from a sequence of ad hoc paragraphs into a structured operator console with clear intake, lookup, module-action, finalize, and utility panels.

**Architecture:** Keep all workbench controller calls and HTTP contracts unchanged. Extract a presentational control-panel component that receives the existing page state and callbacks, and render it as a grid of focused operational cards that compose cleanly with the manuscript summary area.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing manuscript workbench controller/state.

---

## Scope Notes

- Do not change upload/module/export logic in this slice.
- Preserve the current permission behavior for admin and submission-specific intake.
- Keep the control component presentation-first so later UX improvements can land without adding more page-level complexity.

## Delivered Work

- Added a dedicated `ManuscriptWorkbenchControls` component that groups actions into:
  - `Submission Intake`
  - `Workspace Lookup`
  - module-specific action panel
  - proofreading finalize panel
  - `Workspace Utilities`
- Replaced the paragraph-based controls in the manuscript workbench page with the new panel-driven layout.
- Added manuscript-workbench-specific form/button styling to support the new operator console layout.
- Added rendering tests that lock in the control-panel information architecture.
- Synced `README.md` to reflect that the manuscript workbench now has an operator-style control surface, not just lower-level trigger controls.

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-upload-file.spec.ts`
- `pnpm --filter @medsys/web typecheck`

## Next Recommended Follow-up

- Replace the generic success/error paragraphs with richer banner components and inline per-panel validation states.
- Add module-specific context chips such as selected parent asset status, current template lineage, and latest export readiness.
- Add real browser QA coverage for the full operator flow once the local Playwright/Chrome launch issue is resolved.
