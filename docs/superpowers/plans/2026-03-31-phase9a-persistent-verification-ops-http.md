# Phase 9A Persistent Verification Ops HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `verification-ops` a real PostgreSQL-backed HTTP capability so evaluation governance can survive restarts and support a future Evaluation Workbench without demo-only scaffolding.

**Architecture:** Reuse the existing Phase 6A service contracts and Phase 8 persistent runtime pattern. Add one PostgreSQL repository plus one migration, then wire the existing API surface into both in-memory and persistent HTTP runtimes without redesigning the web typed-client contract.

**Tech Stack:** TypeScript, PostgreSQL, raw SQL migrations, node:test via `tsx`, existing HTTP runtime/router pattern, existing `verification-ops`, `learning`, and `feedback-governance` services.

---

## Scope Notes

- Do not redesign `verification-ops` request or response shapes in this slice.
- Do not build the `Evaluation Workbench` UI yet.
- Preserve demo runtime behavior; add persistent runtime behavior in parallel.
- Keep the evaluation-to-learning handoff reusing the current governed learning pipeline.

## Planned Tasks

### Task 1: Add Persistent Storage For Verification Ops Records

**Files:**
- Create: `apps/api/src/database/migrations/0011_verification_ops_persistence.sql`
- Create: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/index.ts`

- [ ] Add failing persistence coverage for verification/evaluation records.
- [ ] Verify the failures come from the lack of a PostgreSQL repository.
- [ ] Add tables for sample sets, sample set items, check profiles, release check profiles, suites, evidence, runs, run items, evidence packs, and recommendations.
- [ ] Store nested array/object fields additively in JSONB so current record shapes stay stable.
- [ ] Re-run the targeted repository or persistent tests.

### Task 2: Wire Verification Ops Into Demo And Persistent HTTP Runtime

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

- [ ] Add failing HTTP tests for the `verification-ops` route family.
- [ ] Extend `ApiServerRuntime` with `verificationOpsApi`.
- [ ] Construct `VerificationOpsService` in the in-memory runtime.
- [ ] Construct `VerificationOpsService` in the persistent runtime with the new PostgreSQL repository and transaction manager.
- [ ] Re-run the targeted HTTP tests.

### Task 3: Add Route Matching And Request Handling

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`

- [ ] Add failing route-level coverage for create/list/publish/activate/finalize/handoff paths.
- [ ] Extend the route union and matcher with the full `verification-ops` HTTP surface.
- [ ] Add authenticated request handlers that reuse the existing permission model and server-side actor context.
- [ ] Re-run the targeted HTTP tests.

### Task 4: Prove Persistent Restart And Learning Handoff

**Files:**
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`

- [ ] Add a restart-spanning test that creates an evaluation run, finalizes it, restarts the server, and verifies the run evidence still exists.
- [ ] Add a restart-spanning test that creates a learning candidate from evaluation evidence and verifies governed provenance after restart.
- [ ] Re-run the targeted HTTP tests.

### Task 5: Sync Docs With The New Persistent Boundary

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] Update runtime boundary docs to include persistent `verification-ops`.
- [ ] Document that Evaluation Workbench UI is still a follow-up phase on top of the new runtime foundation.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api exec node --import tsx --test test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts`
- [ ] Run: `pnpm --filter @medical/api run typecheck`
- [ ] Run: `pnpm verify:manuscript-workbench`

## Acceptance Criteria

- `verification-ops` routes are reachable through the real HTTP server.
- Persistent runtime stores and restores evaluation governance data across restarts.
- Evaluation evidence can still hand off into governed learning candidates with restart-safe provenance.
- README and operations docs describe the new boundary correctly.
