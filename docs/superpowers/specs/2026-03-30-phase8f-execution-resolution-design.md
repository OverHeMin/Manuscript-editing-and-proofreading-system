# Phase 8F Execution Resolution Design

## Goal

Turn governed execution configuration into a real runtime input by connecting execution profiles, model routing, knowledge binding rules, and execution snapshots through persistent APIs and a small admin workbench surface.

## Approaches Considered

### Option 1: Narrow Closed Loop

- Persist `execution_governance` and `execution_tracking`.
- Add an execution resolution endpoint that expands the active profile into a runnable bundle.
- Add a minimal admin workbench section for execution profiles and resolution preview.

This is the recommended option. It closes the most important runtime gap without dragging agent orchestration and manuscript mainline delivery into the same phase.

### Option 2: Medium Closed Loop

- Everything in Option 1.
- Also persist `agent_execution` and expose end-to-end execution log management in the same phase.

This produces a more complete runtime surface, but it increases migration, HTTP, and UI scope enough that the phase stops being tight.

### Option 3: Full Runtime Center

- Everything in Option 2.
- Add full execution dashboards, manuscript-triggered runs, verification evidence workflows, and runtime policy editing.

This would create too many moving parts for one phase and make validation noisy.

## Chosen Direction

Use Option 1.

The system already has service-layer contracts for:

- execution profile governance
- knowledge binding rules
- execution snapshots
- knowledge hit logs
- model routing policy

The missing piece is the runtime bridge. This phase adds that bridge and keeps the UI focused on governance and preview, not on building a full operator console.

## Scope

- Persist execution governance records in PostgreSQL:
  - execution profiles
  - knowledge binding rules
- Persist execution tracking records in PostgreSQL:
  - execution snapshots
  - knowledge hit logs
- Expose HTTP routes for execution governance and execution tracking.
- Add an execution resolution endpoint that returns:
  - active execution profile
  - bound published template / prompt / skill assets
  - resolved model from routing policy
  - applicable active knowledge binding rules
  - resolved approved knowledge items
- Extend the admin governance workbench with:
  - execution profile list and create/publish controls
  - execution resolution preview for the selected template family and module
- Keep knowledge binding rule UI out of scope unless needed for a minimal preview flow.

## API Design

### Persistent Storage

Add PostgreSQL tables for:

- `execution_profiles`
- `knowledge_binding_rules`
- `execution_snapshots`
- `knowledge_hit_logs`

The schema should preserve arrays and status/version fields in a way that mirrors the existing in-memory contracts, so the service layer stays additive.

### Runtime Contract

Extend `ApiServerRuntime` with:

- `executionGovernanceApi`
- `executionTrackingApi`

Additive routes:

- `POST /api/v1/execution-governance/profiles`
- `GET /api/v1/execution-governance/profiles`
- `POST /api/v1/execution-governance/profiles/:profileId/publish`
- `POST /api/v1/execution-governance/profiles/:profileId/archive`
- `POST /api/v1/execution-governance/knowledge-binding-rules`
- `GET /api/v1/execution-governance/knowledge-binding-rules`
- `POST /api/v1/execution-governance/knowledge-binding-rules/:ruleId/activate`
- `POST /api/v1/execution-governance/resolve`
- `POST /api/v1/execution-tracking/snapshots`
- `GET /api/v1/execution-tracking/snapshots/:snapshotId`
- `GET /api/v1/execution-tracking/snapshots/:snapshotId/knowledge-hit-logs`

### Resolution Surface

Add a resolved execution bundle payload that includes:

- `profile`
- `moduleTemplate`
- `promptTemplate`
- `skillPackages`
- `resolvedModel`
- `knowledgeBindingRules`
- `knowledgeItems`

Resolution order for model routing:

1. template override
2. module default
3. system default

If no compatible production-approved model exists, resolution should fail clearly instead of returning a partial bundle.

## Web Design

Reuse the existing admin governance workbench instead of creating a separate page.

Add one new execution section that:

- lists existing execution profiles
- creates a draft execution profile from the currently selected family and published assets
- publishes draft profiles
- previews the resolved execution bundle for the currently selected family + module

The preview is the important part. It proves that backend governance configuration now drives a real runtime decision.

## Boundaries

- Do not implement manuscript-triggered execution jobs in this phase.
- Do not make agent execution logs part of the persistent runtime yet.
- Do not build a full knowledge binding rule management UI if it threatens the phase boundary.
- Do not redesign the workbench host or nav structure.

## Verification

- schema tests for the new execution tables
- PostgreSQL repository tests for execution governance and execution tracking
- HTTP tests for demo runtime execution governance/tracking routes
- persistent restart tests proving execution records survive server restart
- web controller tests for execution profile loading and resolution preview
- repo-level `pnpm lint`, `pnpm typecheck`, `pnpm test`
