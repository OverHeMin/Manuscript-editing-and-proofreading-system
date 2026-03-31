# Phase 8T Real Browser QA And Template Family Mainline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the handoff-driven manuscript workbench loop by validating the real browser flow end-to-end, then fix any mainline blocker uncovered by that validation without regressing the persistent HTTP workbench stack.

**Architecture:** Keep the production-facing behavior aligned with the governed manuscript pipeline. Newly uploaded manuscripts should auto-bind an active template family when the manuscript type has exactly one active match, while HTTP tests should stop relying on random loopback ports that Node `fetch` may reject. Use bundled Chromium for browser QA because the local system Chrome runtime is currently broken.

**Tech Stack:** TypeScript, node:test via `tsx`, Playwright with bundled Chromium, existing API HTTP runtime, React/Vite workbench.

---

## Scope Notes

- Do not loosen governed module requirements just to make the demo flow pass.
- Keep auto-assignment conservative: bind a template family only when exactly one active family matches the uploaded manuscript type.
- Treat browser QA failures as either product bugs or stale QA expectations; fix the real issue, not just the symptom.
- Stabilize the HTTP test harness so this branch does not fail randomly on blocked loopback ports.

## Delivered Work

- Fixed manuscript upload mainline template binding:
  - `ManuscriptLifecycleService.upload()` now looks up active template families by manuscript type
  - uploads auto-assign `current_template_family_id` only when exactly one active family matches
  - uploads intentionally leave the family unset when zero or multiple active matches exist
- Wired template-family lookup into both runtime entrypoints:
  - demo HTTP runtime now passes `templateFamilyRepository` into manuscript upload
  - persistent governance runtime now passes `templateFamilyRepository` into manuscript upload
  - demo seed data now includes an active `clinical_study` template family so new uploads can flow straight into screening
- Added regression coverage for the new mainline behavior:
  - upload assigns the active family for a unique match
  - upload leaves the family unset when multiple active matches exist
  - demo HTTP upload can be screened immediately after upload because the seeded family is bound
- Stabilized the HTTP test harness:
  - added a shared `http-test-server` helper that avoids Fetch-spec blocked ports on loopback
  - updated the in-memory and persistent HTTP specs to use the safe-port helper instead of raw `listen(0)`
- Completed real browser QA of the operator handoff flow:
  - used Playwright bundled Chromium because local Chrome failed to launch with a Windows side-by-side configuration error
  - validated `screening -> editing -> proofreading` handoff auto-load behavior in a real browser
  - corrected the QA expectation so proofreading draft creation asserts the intended draft-first behavior before finalization

## Verification

- `pnpm --filter @medical/api run typecheck`
- `pnpm --filter @medical/api run test`
- `pnpm dlx playwright test -c playwright.config.ts playwright-smoke.spec.ts --browser=chromium --output ..\\playwright\\phase8t-results`
  - run from `output/runtime`

## QA Notes

- Real browser QA passed after updating the smoke assertion to reflect the intended proofreading rule:
  - create draft first
  - human confirm/finalize second
- The browser environment still cannot use the local system Chrome installation. Bundled Chromium remains the reliable workaround for this machine until Chrome is repaired.

## Next Recommended Follow-up

- Promote the temporary Phase 8T Playwright smoke flow into a repo-owned browser QA path so it is not trapped in local `output/runtime` scaffolding.
- Expand workbench operator coverage around export/download behavior and clearer final-proofreading confirmation evidence.
- If branch hygiene becomes the next priority, retry remote push once the GitHub TLS handshake issue clears so this commit is not stranded locally.
