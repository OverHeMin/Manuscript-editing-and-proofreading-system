# Phase 8H Agent Tooling Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the persisted agent-tooling governance runtime through the existing admin governance workbench so operators can create, promote, and inspect the runtime assets that Phase 8G moved into PostgreSQL-backed HTTP APIs.

**Architecture:** Reuse the current admin governance controller and page instead of creating a separate surface. Extend the controller overview to include agent-tooling registries and recent execution logs, add focused create/activate/publish helpers for the runtime-governance lifecycle, then attach a dedicated agent-tooling section to the admin console.

**Tech Stack:** TypeScript, React/Vite, existing browser HTTP client, current admin governance workbench shell, node:test via `tsx`.

---

## Scope Notes

- Keep the existing admin console route and session model unchanged.
- Reuse the HTTP routes already shipped in Phase 8G; do not redesign API contracts in this phase.
- Focus on the operator path: create registry entries, promote draft assets, create runtime bindings, inspect recent execution logs.
- Do not add real-time execution controls, queue runners, or manuscript-triggered orchestration UI in this phase.

## Delivered Work

- Extended `AdminGovernanceOverview` with Tool Gateway, Sandbox Profiles, Agent Profiles, Agent Runtimes, Tool Permission Policies, Runtime Bindings, and recent Agent Execution logs.
- Added controller mutation helpers for:
  - Tool Gateway creation
  - Sandbox Profile creation and activation
  - Agent Profile creation and publish
  - Agent Runtime creation and publish
  - Tool Permission Policy creation and activation
  - Runtime Binding creation and activation
- Added `agent-tooling-governance-section.tsx` and mounted it into the existing admin governance workbench.
- Updated the admin console summary cards and description so the runtime-governance surface is visible from the main workbench.
- Added controller-level tests covering overview loading plus create/promote flows for the agent-tooling registry chain.
- Synced `README.md` and `docs/OPERATIONS.md` so docs match the shipped console capabilities.

## Verification

- `pnpm --filter @medsys/web typecheck`
- `pnpm --filter @medsys/web test`

## Next Recommended Follow-up

- Add execution-run initiation and evidence drill-down from the admin console.
- Add route/component tests for the rendered agent-tooling section, not only controller-level HTTP contract coverage.
- Connect manuscript-facing execution entrypoints to active runtime bindings and persisted execution logs.
