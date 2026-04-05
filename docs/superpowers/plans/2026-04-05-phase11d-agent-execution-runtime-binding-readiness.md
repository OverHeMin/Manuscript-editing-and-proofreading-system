# Phase 11D Agent Execution Runtime Binding Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach runtime-binding readiness observation to the `agent-execution` API read path without changing execution-log storage or orchestration behavior.

**Architecture:** Keep persisted execution-log records unchanged, add an additive API view shape with `runtime_binding_readiness`, and reuse the existing readiness service through optional API wiring so create/get/list/complete all remain fail-open.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` module, existing runtime-binding readiness service, current demo and persistent HTTP runtimes.

---

## Scope Notes

- Do not change `agent_execution_logs` schema.
- Do not add migrations.
- Do not change orchestration semantics.
- Keep the new observation fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase11d-agent-execution-runtime-binding-readiness-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase11d-agent-execution-runtime-binding-readiness.md`
- Agent execution:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Runtime wiring:
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
  - Modify: `apps/api/test/http/http-server.spec.ts`
  - Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

## Planned Tasks

### Task 1: Add Agent-Execution Readiness Observation View

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`

- [ ] **Step 1: Write the failing agent-execution tests**

Add coverage that proves:

- create/get/list/complete responses include `runtime_binding_readiness.observation_status = reported` when readiness succeeds
- the readiness report is derived from the log's `runtime_binding_id`
- readiness observation exceptions degrade to `failed_open` without failing the API response

- [ ] **Step 2: Run the targeted agent-execution tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
```

Expected: FAIL because `agent-execution` responses do not yet expose readiness observation.

- [ ] **Step 3: Implement the minimal additive API view**

Implementation rules:

- persisted log record shape remains backward compatible
- readiness dependency remains optional
- all readiness failures are caught inside the API view assembly

- [ ] **Step 4: Re-run the targeted agent-execution tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
```

Expected: PASS.

### Task 2: Wire The Existing Demo And Persistent HTTP Runtimes

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP assertions**

Add coverage that proves:

- demo `agent-execution` responses include `runtime_binding_readiness`
- persistent `agent-execution` responses include `runtime_binding_readiness`
- existing create/complete/get/list success semantics remain unchanged

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: FAIL because `agent-execution` HTTP responses do not yet expose readiness observation.

- [ ] **Step 3: Implement the minimal runtime wiring**

Implementation rules:

- reuse the already-wired readiness service
- do not add new routes
- do not mutate stored execution logs

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
```

Expected: PASS.

### Task 3: Run Final Serial Verification

**Files:**
- No additional file changes

- [ ] **Step 1: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
pnpm --filter @medical/api test -- http-server
pnpm --filter @medical/api test -- persistent-governance-http
pnpm --filter @medical/api typecheck
```

Expected: PASS.
