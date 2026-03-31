# Phase 8I Execution Evidence Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the admin governance console from registry management into execution observability by letting operators inspect the frozen snapshot and knowledge-hit evidence behind recent governed runs.

**Architecture:** Reuse the Phase 8H admin console shell. Add a controller-level evidence loader that joins `agent-execution` with `execution-tracking` snapshot and knowledge-hit APIs, then render the joined evidence through a dedicated presentational component inside the agent-tooling governance section.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing browser HTTP client and admin governance workbench.

---

## Scope Notes

- Do not redesign API contracts; reuse the HTTP routes already shipped for `agent-execution` and `execution-tracking`.
- Keep this phase read-only from the evidence perspective. No real-time run control, retry, or orchestration UI in this cut.
- Treat missing snapshots as a first-class state because running executions may not have frozen evidence yet.

## Delivered Work

- Added `loadExecutionEvidence(logId)` to the admin governance controller.
- Introduced `AdminGovernanceExecutionEvidence` as the joined view model for:
  - execution log
  - frozen execution snapshot
  - knowledge-hit records
- Added `agent-execution-evidence-view.tsx` to render frozen snapshot context, knowledge-hit reasons, and verification evidence IDs.
- Extended the agent-tooling governance section so recent execution logs can be selected and inspected inline.
- Added controller tests for:
  - completed log + snapshot + knowledge-hit drilldown
  - running log without snapshot
- Added rendering tests for the execution evidence view.
- Synced `README.md` and `docs/OPERATIONS.md` so shipped observability capability is documented.

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/admin-governance-controller.spec.ts ./test/agent-execution-evidence-view.spec.tsx`
- `pnpm --filter @medsys/web typecheck`
- `pnpm --filter @medsys/web test`

## Next Recommended Follow-up

- Expose real manuscript/module execution HTTP routes so the web layer can trigger governed screening/editing/proofreading runs instead of only inspecting completed evidence.
- Add manuscript/job/asset drilldown next to the evidence panel so operators can trace output assets without leaving the governance console.
- Add API/web QA coverage for the fully rendered execution observability flow in a browser.
