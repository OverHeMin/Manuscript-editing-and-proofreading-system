# Phase 8Q Manuscript Workbench Handoff Links

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the manuscript workbench's next-step guidance from passive copy into actionable cross-workbench handoff links that preserve the current manuscript ID.

**Architecture:** Keep backend contracts unchanged. Extend the lightweight web host with hash-based workbench routing, let manuscript summary cards emit handoff links for role-accessible downstream modules, and let manuscript pages prefill lookup state from the handoff target hash.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, existing workbench host/router state, manuscript workbench summary/page components.

---

## Scope Notes

- Do not introduce a full router library in this slice.
- Keep handoff behavior inside the existing web shell and manuscript workbench UI.
- Only render downstream handoff links when the current role can actually reach that target workbench.

## Delivered Work

- Added hash-based workbench location helpers for:
  - formatting workbench handoff links
  - resolving active workbench plus `manuscriptId` from the location hash
- Updated `WorkbenchHost` to:
  - honor hash-based workbench selection
  - react to browser `hashchange`
  - pass accessible manuscript workbench targets into the active manuscript page
  - remount manuscript workbench pages when switching modules so state does not leak across `screening/editing/proofreading`
- Updated `ManuscriptWorkbenchSummary` so the recommended-next-step card can render a real handoff link such as:
  - `Open Editing Workbench`
  - `Open Proofreading Workbench`
- Updated `ManuscriptWorkbenchPage` to accept a prefilled manuscript ID from the handoff target and seed the lookup field with a visible handoff note.
- Added focused tests covering:
  - workbench handoff hash formatting/parsing
  - summary link rendering for downstream workbench handoff
  - page lookup prefill from handoff context

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts`
- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-summary.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx`
- `pnpm --filter @medsys/web run typecheck`
- `pnpm --filter @medsys/web run test`

## QA Notes

- Real browser QA is still blocked in this environment because Playwright fails to launch the local Chrome binary with `spawn UNKNOWN`, even though the local demo API and Vite web server can be started successfully.

## Next Recommended Follow-up

- Auto-load the handed-off manuscript workspace after the target workbench opens, once we decide the preferred balance between immediacy and explicit operator confirmation.
- Add browser-level QA for hash handoff, back-button behavior, and repeated manuscript-to-manuscript switching when the local Chrome launch issue is resolved.
- Consider promoting hash handoff into a more explicit route model later if the workbench shell grows beyond the current single-host navigation pattern.
