# Phase 8J Manuscript Workbench HTTP Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing submission, screening, editing, and proofreading web workbench entries into real operator surfaces that can call the manuscript upload, asset lookup, module execution, job refresh, and export HTTP routes instead of rendering a phase placeholder.

**Architecture:** Reuse the existing `WorkbenchHost` navigation and add a shared manuscript workbench feature that composes the already-shipped browser API clients for manuscripts, screening, editing, and proofreading. Keep the first cut intentionally thin: metadata-based upload, manuscript workspace lookup, role-scoped module actions, and JSON-backed operator visibility into the refreshed manuscript asset chain.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing browser HTTP client and workbench host shell.

---

## Scope Notes

- Do not redesign the HTTP contracts. Reuse the routes already shipped in Phase 8 persistent workbench HTTP.
- Keep this cut focused on real triggerability and refreshed asset visibility, not final visual polish.
- Support admin end-to-end operation and role-specific module execution without inventing new auth rules in the web layer.

## Delivered Work

- Added a shared `manuscript-workbench` feature for:
  - manuscript workspace hydration
  - metadata-based upload into the real intake route
  - screening/editing/proofreading route execution
  - proofreading finalize flow
  - latest job refresh
  - current asset export
- Promoted `submission`, `screening`, `editing`, and `proofreading` from placeholder routing into an implemented `manuscript-workbench` render surface.
- Wired `WorkbenchHost` so those navigation entries now render a real page instead of the phase placeholder copy.
- Added controller tests for:
  - upload + workspace hydration
  - proofreading draft + finalize + workspace refresh
- Added routing tests proving the four manuscript-processing workbenches are now implemented surfaces.
- Synced `README.md` so the shipped web capability is reflected in repo status docs.

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-routing.spec.ts`
- `pnpm --filter @medsys/web typecheck`
- `pnpm --filter @medsys/web test`

## Next Recommended Follow-up

- Replace metadata-only intake with a real browser file selection/upload flow once the backend storage contract is ready.
- Add browser QA coverage for cross-role manuscript execution flows and export behavior.
- Add richer manuscript/job/asset visual presentation so operators no longer need the JSON snapshot block for inspection.
