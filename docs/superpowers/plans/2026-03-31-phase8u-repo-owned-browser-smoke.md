# Phase 8U Repo-Owned Browser Smoke

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the successful Phase 8T handoff validation out of local `output/runtime` scaffolding and into a repo-owned browser smoke entry that future contributors can run directly from `apps/web`.

**Architecture:** Keep browser QA separate from the fast `node:test` suite. Add a dedicated Playwright config under `apps/web`, store browser smoke specs outside the `./test/**/*.spec.ts` path used by `node:test`, and let Playwright start or reuse the local demo API and Vite workbench servers automatically.

**Tech Stack:** TypeScript, `@playwright/test`, Vite dev server, demo API runtime.

---

## Scope Notes

- Do not fold browser smoke into the default `pnpm --filter @medsys/web run test` path yet; keep it explicit so routine local feedback stays fast.
- Reuse the existing local demo shell assumptions (`admin` web role, demo password, loopback API) instead of inventing a new QA-only auth path.
- Avoid storing permanent screenshots or traces in the repo; rely on Playwright output directories at runtime.

## Delivered Work

- Added `@playwright/test` to `apps/web` dev dependencies with explicit scripts:
  - `pnpm --filter @medsys/web run test:browser:install`
  - `pnpm --filter @medsys/web run test:browser`
- Added repo-owned Playwright config in `apps/web/playwright.config.ts` that:
  - reuses or starts the demo API runtime
  - reuses or starts the Vite web workbench
  - injects the local demo web-shell environment needed for admin QA
- Added a repo-owned browser smoke spec in `apps/web/playwright/manuscript-handoff.spec.ts` that validates:
  - upload of a new `clinical_study` manuscript
  - template-family auto-assignment on upload
  - screening to editing handoff
  - editing to proofreading handoff
  - explicit prefill loading-state visibility
  - proofreading draft-first behavior and finalization
- Corrected the initial test-layout mistake by keeping Playwright specs outside the `node:test` glob, so browser QA no longer pollutes the unit-test lane.

## Verification

- `pnpm --filter @medsys/web run test:browser:install`
- `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/manuscript-handoff.spec.ts`
- `pnpm --filter @medsys/web run test`
- `pnpm --filter @medsys/web run typecheck`

## Next Recommended Follow-up

- Add one more browser smoke covering download/export once the operator-facing export flow is finalized.
- Consider a root-level convenience script after the browser suite grows beyond one or two specs.
- If CI is introduced for browser QA, pin the install/cache path for Chromium so the run remains deterministic.
