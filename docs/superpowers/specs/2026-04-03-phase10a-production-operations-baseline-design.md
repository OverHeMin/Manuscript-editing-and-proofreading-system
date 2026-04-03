# Phase 10A Production Operations Baseline Design

**Date:** 2026-04-03  
**Status:** Approved for planning under the current production-baseline direction  
**Scope:** Establish the minimum production-operations baseline for the current persistent runtime so the repository can be deployed, checked, rolled back, and handed off with one clear operating contract.

## 1. Goal

Phase 10A is not a business-feature phase.

Its job is to turn the repository's current "persistent but still mixed-mode" runtime into a system that is operationally legible:

- configuration mistakes should fail before the service starts listening
- deployment should follow one standard preflight and verification path
- operators should be able to distinguish "process is alive" from "service is ready"
- schema changes, backups, rollback steps, and recovery expectations should stop living only in human memory
- another maintainer should be able to deploy and verify the system by following repository-owned docs and commands

This phase is the production-operations baseline for the system that already exists.

It is **not** the phase that adds deeper worker orchestration, automatic learning loops, or a full secret-management platform.

## 2. Current Gap

The repository already has important production-facing ingredients:

- a PostgreSQL-backed persistent API runtime
- real manuscript, governance, evaluation, and workbench HTTP paths
- `smoke:boot` checks for local environment readiness
- a reusable `pnpm verify:manuscript-workbench` browser gate
- `docs/OPERATIONS.md` documenting migration, backup, rollback, and remote maintenance expectations

What is still missing is an enforceable and standardized operations boundary.

Today:

- `apps/api/src/http/prod-server.ts` resolves config and starts listening, but it does not yet enforce one explicit startup preflight that proves the runtime is truly ready to serve
- the API exposes `/healthz`, but not a dependency-aware readiness surface
- migration, backup, and rollback guidance exists in docs, but it is not yet tightened into one standard release contract
- release verification exists, but the repository still relies on operators to know which checks belong before deploy versus after deploy
- the system can still be interpreted too loosely as "already production-ready" when the actual state is "persistent foundation plus partial operating discipline"

Phase 10A closes that gap by standardizing the operational contract around the existing runtime.

## 3. Options Considered

### Option A: Documentation-only cleanup

Strengthen `README.md` and `docs/OPERATIONS.md`, but do not add new runtime or verification behavior.

Pros:

- smallest implementation surface
- minimal risk of changing runtime behavior

Cons:

- leaves operations discipline dependent on human memory
- does not prevent half-valid startup states
- does not give deploy tooling a real readiness signal

Not recommended.

### Option B: Add a bounded production-operations baseline around the existing runtime

Introduce a small set of enforceable runtime checks, readiness surfaces, deploy gates, and runbook-aligned scripts while keeping the current application architecture intact.

Pros:

- directly addresses the shortest path to "locally and remotely operable"
- keeps scope bounded to production hygiene rather than feature growth
- builds on existing commands such as `smoke:boot`, `db:migrate`, and `verify:manuscript-workbench`
- creates a clean foundation for later phases like worker orchestration and deeper security automation

Cons:

- touches startup behavior and operator workflows
- requires careful distinction between "required now" and "defer to later production-hardening phases"

Recommended.

### Option C: Solve full productionization in one phase

Combine startup guardrails, readiness, deployment automation, secret rotation, async recovery, observability stack, and migration automation into one large phase.

Pros:

- ambitious and comprehensive

Cons:

- too broad for one bounded phase
- would mix operations baseline with later infrastructure and platform concerns
- risks repeating the same boundary dilution that Phase 10A is meant to avoid

Out of scope.

## 4. Recommended Architecture

Phase 10A should be implemented as four bounded sublayers that tighten the current runtime without redefining the product.

### 4.1 Runtime Contract Layer

The repository already documents critical environment variables and mode constraints.
Phase 10A should make those constraints executable and authoritative.

This layer should define:

- which environment variables are required for persistent runtime startup
- which values are invalid for `staging` or `production`
- which runtime modes are allowed for `local` versus persistent environments
- which local directories must exist or be creatable before service start
- which external dependencies are mandatory versus optional

Key rule:

- `serve` / persistent startup should fail fast when the environment contract is violated

This should not become a giant infrastructure abstraction.
It is a bounded startup contract for the current API and workbench runtime.

### 4.2 Startup Guard And Preflight Layer

Phase 10A should add one internal preflight boundary that both operators and the persistent server can trust.

Recommended shape:

- a reusable startup-preflight helper for the API runtime
- reuse or extension of the current `smoke:boot` checks rather than a second unrelated validation stack
- fail-before-listen semantics for:
  - required environment presence and format
  - database reachability
  - upload root writability when configured or implied
  - runtime mode safety checks
  - mandatory dependency URL validation

This layer is responsible for ensuring the process never advertises itself as live when it is only partially configured.

### 4.3 Service Health Layer

The current `/healthz` endpoint is a basic liveness signal.
Phase 10A should split health into two operator meanings:

- `healthz`: process is up and can answer
- `readyz`: the runtime is actually ready to serve the persistent workflow

Recommended readiness coverage:

- database connectivity
- startup contract already resolved successfully
- upload root accessibility for the configured runtime
- key runtime dependencies needed by the persistent path

Recommended behavior:

- `healthz` stays simple and cheap
- `readyz` returns success only when the service is truly usable
- `readyz` should provide a compact component summary without leaking secrets

This gives deploy and maintenance flows a truthful service gate.

### 4.4 Data Change And Recovery Layer

The repository already has `db:migrate` plus strong documentation around backups and rollback.
Phase 10A should standardize that into one repo-owned operating sequence.

This layer should define:

- what must be backed up before schema-changing deploys
- the minimum manifest recorded for a backup or release action
- when `db:migrate` is allowed to run
- how operators decide between code-only rollback and data rollback
- what checks must run immediately after migration or rollback

Important boundary:

- Phase 10A standardizes the procedure and repo-owned helpers
- it does not need to build a full backup platform or managed snapshot service

### 4.5 Release And Maintenance Layer

Phase 10A should turn today's scattered validation knowledge into one standard release contract.

That contract should separate:

- pre-deploy validation
- deploy/startup validation
- post-deploy verification
- rollback and initial incident handling

Recommended verification chain:

1. static and repository-wide checks
2. startup preflight and dependency checks
3. migration path when applicable
4. service liveness and readiness confirmation
5. the existing operator-grade workbench gate for higher-confidence release validation

The outcome should be a documented and scriptable flow, not a loose checklist remembered differently by each maintainer.

## 5. Component Boundaries

Phase 10A should be read through four concrete responsibility boundaries.

### 5.1 Runtime Contract

Responsibility:

- validate environment shape and mode safety before startup

Should own:

- parsing and validation of production-facing env requirements
- persistent-runtime safety checks
- upload-root path expectations

Should not own:

- deployment orchestration
- business-domain feature flags

### 5.2 Data Change

Responsibility:

- standardize schema-change, backup, restore, and rollback rules

Should own:

- migration execution contract
- backup manifest expectations
- rollback decision sequence

Should not own:

- full disaster-recovery platform automation

### 5.3 Service Health

Responsibility:

- expose truthful service status to operators and deploy tooling

Should own:

- liveness and readiness endpoints
- dependency-aware readiness semantics

Should not own:

- deep observability dashboards
- long-term metrics storage

### 5.4 Release Operations

Responsibility:

- define one standard release and recovery flow for the current system

Should own:

- pre-deploy and post-deploy gate ordering
- repo-owned runbook updates
- maintenance handoff expectations

Should not own:

- asynchronous job recovery
- full secret-rotation or platform-migration automation

## 6. Operational Flow

Phase 10A should standardize the repository's production-facing run sequence as follows.

### 6.1 Deploy Preparation

Before deployment:

- verify required environment variables and runtime mode contract
- verify database connectivity
- verify upload root directory policy and writeability
- verify external dependency configuration shape

`staging` and `production` must not accidentally run through demo-only assumptions.

### 6.2 Change Gate

Before code or schema changes are applied:

- run the standard pre-deploy checks
- determine whether the deploy is schema-affecting
- capture the required backup manifest and restore point

If preflight fails, deployment stops.

### 6.3 Startup

During startup:

- run the persistent-runtime preflight before the server listens
- abort immediately if contract or dependency checks fail
- only begin listening after the runtime can responsibly claim readiness

### 6.4 Health Exposure

After process start:

- `healthz` answers whether the process is up
- `readyz` answers whether the service is usable for the persistent runtime

Operators and deploy tooling should use `readyz` for release gating, not just `healthz`.

### 6.5 Post-Deploy Verification

After the new version is running:

- confirm readiness
- run the standard post-deploy verification chain
- run the existing workbench gate when the release requires operator-grade confidence

This phase should clearly define which checks are mandatory for every persistent deployment versus which checks are escalation-grade but still repo-owned.

### 6.6 Failure Handling

If post-deploy verification fails:

- stop treating the release as complete
- determine whether the failure is code-only, configuration, or schema/data related
- use the standard rollback decision order
- rerun readiness and post-rollback checks before declaring recovery

The system should never rely on "we think it is back" as a sufficient recovery state.

## 7. Acceptance Criteria

Phase 10A is successful when all of the following are true:

- a new environment can be brought up by following repository-owned docs and commands
- startup blocks on missing critical configuration instead of entering a half-valid listening state
- the API exposes distinct liveness and readiness behavior
- release flow explicitly connects preflight, migration, startup, readiness, and post-deploy verification
- backup, restore, and rollback procedure is defined tightly enough that another maintainer can execute it
- `README.md` and `docs/OPERATIONS.md` describe the same operational contract that the runtime and scripts enforce
- the output of this phase is a clean baseline for later work, not a mixed operations-plus-feature batch

## 8. Out Of Scope

Phase 10A explicitly does not include:

- new manuscript, screening, editing, or proofreading product features
- asynchronous worker orchestration, retries, leases, or recovery queues
- automatic scoring, auto-finalization, or deeper evaluation automation
- advanced Evaluation Workbench operator analytics
- complete secret-management platformization or key-rotation automation
- full platform migration automation
- deep metrics, dashboards, or alerting infrastructure beyond the bounded health/readiness surface

Those belong to later productionization phases after the baseline is stable.

## 9. Verification Strategy

Phase 10A should add verification at three levels.

### 9.1 Runtime Contract Tests

Add focused tests proving:

- persistent startup rejects missing required environment variables
- invalid runtime-mode combinations fail clearly
- upload-root validation behaves correctly
- preflight reports actionable failure reasons

### 9.2 API Health Tests

Add focused tests proving:

- `healthz` returns success when the process is alive
- `readyz` returns success only when required dependencies are ready
- dependency failure or startup-contract failure keeps readiness false

### 9.3 Operations Flow Verification

Add repository-owned verification proving:

- migration flow and startup checks can be run in the documented order
- post-deploy verification calls the right readiness and workbench gates
- rollback and recovery docs align with the actual scripts and commands in the repo

This does not require destructive disaster drills in CI.
It does require that the documented flow be executable and internally consistent.

## 10. Expected Outcome

After Phase 10A:

- the repository will still be the same product, but it will behave more like a maintainable service
- deployment and rollback will stop depending on one maintainer's memory
- readiness will become a real operator-facing contract instead of an implied assumption
- later phases such as worker orchestration, security hardening, and deeper production automation will have a clean baseline to build on

That is the right next step for the project because it improves operability without reopening the already-reconciled historical phase boundaries.
