# Phase 13 Manuscript Mainline Settlement View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing manuscript and job read paths with additive mainline settlement visibility for `screening`, `editing`, and `proofreading`.

**Architecture:** Add read-only repository helpers for manuscript-scoped jobs and snapshots, introduce a narrow manuscript settlement read-model layer, and reuse the existing snapshot and agent-execution enrichment pipeline to derive business-versus-orchestration settlement on current manuscript/job routes. Keep everything additive, fail-open, and local-first.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing manuscript/job/execution-tracking modules, demo/persistent HTTP runtimes.

---

## Scope Notes

- Do not add new routes.
- Do not change replay, recovery, or dispatch semantics.
- Do not change manuscript or job persistence schemas.
- Do not make workbench or harness tooling a synchronous dependency.
- Keep all new observation additive and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase13-manuscript-mainline-settlement-view-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase13-manuscript-mainline-settlement-view.md`
- Manuscript read model:
  - Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
  - Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
  - Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
  - Create: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Repository helpers:
  - Modify: `apps/api/src/modules/jobs/job-repository.ts`
  - Modify: `apps/api/src/modules/jobs/in-memory-job-repository.ts`
  - Modify: `apps/api/src/modules/jobs/postgres-job-repository.ts`
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
  - Modify: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
  - Modify: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- Snapshot enrichment reuse:
  - Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
  - Modify: `apps/api/src/modules/execution-tracking/index.ts`
- Runtime wiring:
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Tests:
  - Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Repository Read Helpers For Manuscript Settlement Aggregation

**Files:**
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/src/modules/jobs/job-repository.ts`
- Modify: `apps/api/src/modules/jobs/in-memory-job-repository.ts`
- Modify: `apps/api/src/modules/jobs/postgres-job-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`

- [ ] **Step 1: Write the failing repository-facing manuscript read assertions**

Add coverage that proves:

- manuscript reads can see multiple jobs for one manuscript
- manuscript reads can see multiple snapshots for one manuscript
- latest job and latest snapshot are independently discoverable per module

- [ ] **Step 2: Run the targeted manuscript lifecycle tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- manuscript-lifecycle.spec.ts
```

Expected: FAIL because the repository helpers do not exist yet.

- [ ] **Step 3: Implement additive repository list helpers**

Implementation rules:

- add `listByManuscriptId(...)` to `JobRepository`
- add `listSnapshotsByManuscriptId(...)` to `ExecutionTrackingRepository`
- keep ordering deterministic for latest-item selection
- preserve existing `findById(...)` and `listSnapshots()` contracts unchanged

- [ ] **Step 4: Re-run the targeted manuscript lifecycle tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- manuscript-lifecycle.spec.ts
```

Expected: PASS.

### Task 2: Add Manuscript And Job Settlement Read Models

**Files:**
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Create: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`

- [ ] **Step 1: Write the failing manuscript/job read-model tests**

Add coverage that proves:

- `getManuscript(...)` returns `module_execution_overview` for `screening`, `editing`, and `proofreading`
- modules with no activity return `not_started`
- modules with a newer failed/running job and an older successful snapshot expose both signals
- `getJob(...)` returns additive execution-tracking settlement when `payload.snapshotId` exists

- [ ] **Step 2: Run the targeted manuscript lifecycle tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- manuscript-lifecycle.spec.ts
```

Expected: FAIL because manuscript/job read models are still raw records only.

- [ ] **Step 3: Implement the settlement derivation layer**

Implementation rules:

- keep the derivation helper inside the manuscript module
- treat `latest_job` and `latest_snapshot` as separate evidence lanes
- reuse current snapshot-linked execution observation rather than re-deriving orchestration state from scratch
- keep missing evidence and observation failures fail-open

- [ ] **Step 4: Re-run the targeted manuscript lifecycle tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- manuscript-lifecycle.spec.ts
```

Expected: PASS.

### Task 3: Expose Settlement View Through Existing HTTP Routes

**Files:**
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Modify: `apps/api/src/modules/execution-tracking/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`

- [ ] **Step 1: Write the failing HTTP assertions**

Add coverage that proves:

- `GET /api/v1/manuscripts/:id` exposes per-module settlement overview
- `GET /api/v1/jobs/:id` exposes additive snapshot/execution settlement
- demo and persistent HTTP runtimes both expose the same fail-open contract

- [ ] **Step 2: Run the targeted HTTP tests to confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server.spec.ts
pnpm --filter @medical/api test -- persistent-governance-http.spec.ts
```

Expected: FAIL because current HTTP routes still return raw manuscript/job records.

- [ ] **Step 3: Implement route-level wiring**

Implementation rules:

- keep route paths unchanged
- keep existing manuscript/job fields intact
- inject only the read-only dependencies needed for settlement enrichment
- degrade to additive `failed_open` observation rather than returning route errors

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- http-server.spec.ts
pnpm --filter @medical/api test -- persistent-governance-http.spec.ts
```

Expected: PASS.

### Task 4: Record Phase 13 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 13 in the boundary docs**

Document this as the next fresh execution/orchestration continuation after
`Phase 12`, focused on mainline manuscript/job settlement visibility rather
than replay or control-plane expansion.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
pnpm --filter @medical/api typecheck
pnpm --filter @medical/api test -- manuscript-lifecycle.spec.ts
pnpm --filter @medical/api test -- http-server.spec.ts
pnpm --filter @medical/api test -- persistent-governance-http.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Review working tree and summarize**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the intended `Phase 13` files are changed.
