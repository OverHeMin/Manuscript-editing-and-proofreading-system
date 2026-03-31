# Phase 8N Manuscript Workbench Feedback Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve operator confidence in the manuscript workbench by upgrading plain text success/error output into clear status banners and by adding inline validation guidance inside each operational panel.

**Architecture:** Keep controller logic and backend contracts unchanged. Add a small reusable notice component for success/error banners, compute panel-local validation guidance inside the controls component, and wire the page to prefer error banners over success banners when both states could otherwise overlap.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing manuscript workbench controls and page state.

---

## Scope Notes

- Do not alter upload, lookup, module, finalize, or export API behavior in this slice.
- Keep validation guidance informative and lightweight rather than introducing a full form library.
- Prefer progressive operator hints over blocking modal/error flows.

## Delivered Work

- Added a dedicated `ManuscriptWorkbenchNotice` component for success and error banners.
- Replaced the workbench page's plain paragraph status output with:
  - `Action Complete` success banners
  - `Action Error` error banners
- Added inline validation guidance for:
  - missing manuscript title or missing upload payload in submission intake
  - empty manuscript ID in workspace lookup
  - missing parent asset selection before module runs
  - missing proofreading draft before finalization
  - unavailable latest-job refresh before any workspace job exists
- Tightened operator affordances by disabling workspace load when the manuscript ID is blank.
- Added focused rendering tests for both banner states and validation guidance.

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-notice.spec.tsx ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-upload-file.spec.ts`
- `pnpm --filter @medsys/web typecheck`

## Next Recommended Follow-up

- Add field-level state styling for invalid inputs so warnings are visible before users read the helper copy.
- Split success messaging by action type so upload, run, finalize, and export outcomes can show richer context chips.
- Add browser QA coverage for banner transitions and disabled-state affordances when the local Playwright/Chrome environment is available.
