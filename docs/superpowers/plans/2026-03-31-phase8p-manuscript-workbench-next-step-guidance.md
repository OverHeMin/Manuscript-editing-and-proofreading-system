# Phase 8P Manuscript Workbench Next-Step Guidance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce operator hesitation after a workspace loads by surfacing a mode-aware “what to do next” card directly inside the manuscript workbench summary area.

**Architecture:** Keep API and controller behavior unchanged. Extend `ManuscriptWorkbenchSummary` with a small derived guidance model that uses existing page inputs (`mode`, `workspace`, `latestJob`, `latestExport`) to explain the next governed action.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing manuscript workbench summary card layout.

---

## Scope Notes

- Do not add new backend endpoints or controller methods in this slice.
- Keep guidance purely derived from already available summary state.
- Prefer deterministic, mode-specific instructions over generic empty-state copy.

## Delivered Work

- Added a `Recommended Next Step` summary card to the manuscript workbench.
- Introduced mode-aware guidance for:
  - submission handoff into screening or export
  - screening execution before editing handoff
  - editing execution before proofreading handoff
  - proofreading draft creation, draft finalization, and finalized-proof export handoff
- Reused existing workspace facts such as:
  - current asset
  - recommended parent asset
  - latest proofreading draft asset
  - latest export storage key
  - latest completed module job
- Extended the summary debug snapshot to include the current workbench mode so operators and developers can reconcile UI guidance with state inputs.
- Added focused rendering tests for:
  - screening guidance before the first governed run
  - proofreading guidance when a human-reviewed draft exists but the final output has not yet been generated

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-summary.spec.tsx`
- `pnpm --filter @medsys/web run typecheck`

## Next Recommended Follow-up

- Add real interaction QA for each mode so guidance copy is validated against the live HTTP workbench flow, not only static rendering.
- Consider elevating recommended next-step labels into clickable shortcuts once route-to-route manuscript handoff UX is ready.
- If operators ask for denser guidance, add lightweight timestamps and actor attribution to the next-step card rather than expanding the control panels further.
