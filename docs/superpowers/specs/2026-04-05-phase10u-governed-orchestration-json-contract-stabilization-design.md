# Phase 10U Governed Orchestration JSON Contract Stabilization Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 durable execution-orchestration mainline  
**Scope:** Stabilize the machine-readable `recover:governed-orchestration -- --json` contract by adding explicit report metadata and requested-option echo fields without changing current replay or inspection semantics.

## 1. Goal

`Phase 10J` through `10T` established:

- durable governed follow-up orchestration
- read-only dry-run inspection
- scoped replay and dry-run filtering
- bounded replay budgeting
- budgeted replay preview
- item-level readiness windows
- summary-level readiness rollups

The next narrow gap is machine-readable contract clarity.

Today `--json` already emits useful raw objects for:

- replay recovery summary
- dry-run inspection report

But machine consumers still have to infer:

- what report kind they received
- which request options produced it
- whether they are parsing the intended contract revision

This phase closes that gap without changing the existing replay or inspection payload fields.

## 2. Why This Slice Exists

The current JSON output is adequate for humans and ad hoc scripts, but still looser than it should be for durable local tooling.

The existing objects do not yet explicitly tell consumers:

- `replay` vs `dry_run`
- contract version
- which `--module`, `--log-id`, `--budget`, `--limit`, or `--actionable-only` options were applied

The right next step is not a new API, dashboard, or control surface.
It is one small additive JSON metadata layer on top of the same repo-owned CLI.

## 3. Hard Boundaries

### 3.1 Keep existing payload fields intact

This phase must not:

- remove current count or item fields
- rename current fields
- change replay or dry-run semantics

### 3.2 Do not add a new control plane

This phase stays inside the existing local CLI / JSON lane.
It must not add:

- new HTTP APIs
- new admin-console controls
- mutation authority

### 3.3 Keep the contract additive and fail-open

Existing machine consumers that only read current fields should continue to work.

New metadata must be additive, such as:

- `report_kind`
- `contract_version`
- `requested_options`

### 3.4 Reuse current CLI option parsing exactly

The echoed request metadata must reflect the same already-parsed options:

- replay `budget`
- inspection `budget`
- repeated `module`
- repeated `log-id`
- `actionable-only`
- `limit`

This phase records the request context; it does not reinterpret it.

## 4. Recommended Option

### Option A: Keep JSON output as raw result objects only

Pros:

- no new code

Cons:

- machine consumers still infer report type and request context implicitly
- local automation contracts remain looser than necessary

Not recommended.

### Option B: Add explicit additive metadata to JSON output

Pros:

- minimal additive change
- keeps current fields intact
- improves local-first machine consumption and scripting stability

Cons:

- adds a few top-level metadata fields

Recommended.

## 5. Core Design

### 5.1 Add explicit metadata to replay JSON output

Replay JSON should gain additive top-level fields such as:

- `report_kind: "governed_execution_orchestration_recovery"`
- `contract_version: 1`
- `requested_options`

`requested_options` should echo the already-parsed replay flags:

- `budget`
- `modules`
- `log_ids`

### 5.2 Add explicit metadata to dry-run JSON output

Inspection JSON should gain additive top-level fields such as:

- `report_kind: "governed_execution_orchestration_inspection"`
- `contract_version: 1`
- `requested_options`

`requested_options` should echo:

- `budget`
- `modules`
- `log_ids`
- `actionable_only`
- `limit`

### 5.3 Keep human-readable output unchanged

The human-readable summary and item lines already serve operators well.
This phase only stabilizes the JSON lane.

## 6. Expected Outcomes

After this slice:

- local scripts can distinguish replay vs dry-run outputs explicitly
- consumers can tell which CLI options produced a given JSON payload
- the CLI JSON contract becomes easier to extend without guesswork

## 7. Out Of Scope

This phase does not add:

- HTTP JSON APIs
- new mutation controls
- remote service dependencies
- replay semantics changes
- non-additive JSON breaking changes

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview-design.md`
- `docs/superpowers/specs/2026-04-05-phase10s-governed-orchestration-readiness-windows-design.md`
- `docs/superpowers/specs/2026-04-05-phase10t-governed-orchestration-readiness-summary-rollup-design.md`
