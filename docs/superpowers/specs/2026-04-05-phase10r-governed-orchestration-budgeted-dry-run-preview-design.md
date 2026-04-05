# Phase 10R Governed Orchestration Budgeted Dry-Run Preview Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 durable execution-orchestration mainline  
**Scope:** Extend the existing read-only governed orchestration inspection lane so operators can preview the exact bounded replay window selected by `--budget <n>` before mutating durable orchestration state.

## 1. Goal

`Phase 10L` through `10Q` established:

- read-only backlog inspection
- actionable focus ordering
- scoped replay and inspection
- bounded replay budgeting
- budgeted replay ordering alignment
- optional bounded boot recovery

The next narrow gap is preview fidelity.

Today operators can:

- inspect the full backlog with `--dry-run`
- replay only the next bounded slice with `--budget <n>`

But they still cannot ask the dry-run path to preview the exact replay window that the bounded recovery path would consume next.

This phase closes that gap without adding a new control plane.

## 2. Why This Slice Exists

The current read-only lane is close, but not yet exact for bounded recovery planning.

An operator can infer the next replay window from the full dry-run output, but that is still one step removed from what recovery will actually do under `--budget <n>`, especially after `10P` aligned budgeted replay ordering with the dry-run recoverable-priority model.

The right next step is not a dashboard, scheduler, or write surface.
It is one more read-only adapter on top of the same orchestration rules.

## 3. Hard Boundaries

### 3.1 Keep the feature read-only

This phase must not:

- mutate orchestration state in dry-run mode
- mark attempts as running, completed, retryable, or failed
- alter business completion or release state

### 3.2 Do not add a new control plane

This phase stays inside the existing CLI / ops inspection lane.
It must not add:

- new HTTP mutation APIs
- new admin-console controls
- routing, release, or learning authority

### 3.3 Reuse current budget semantics exactly

Budgeted dry-run preview must use the same rules as bounded replay:

- same scope filtering
- same retry-eligibility screening
- same stale-running reclaim ordering
- same recoverable priority order
- same `budget=0` behavior

### 3.4 Preserve existing no-budget inspection behavior

If `--dry-run` is called without `--budget <n>`:

- current inspection output stays unchanged
- current `--actionable-only` and `--limit <n>` semantics stay unchanged

## 4. Recommended Option

### Option A: Keep budget preview implicit

Pros:

- no new code

Cons:

- bounded replay still has no exact read-only preview
- operators must infer the next replay window manually

Not recommended.

### Option B: Let dry-run accept `--budget <n>` as a replay preview

Pros:

- minimal additive change
- strengthens read-only observability
- directly reuses the existing bounded replay rules

Cons:

- extends dry-run output with one more optional summary block

Recommended.

## 5. Core Design

### 5.1 Extend inspection options with an optional budget preview

Allow `inspectBacklog(...)` and `recover:governed-orchestration -- --dry-run` to accept the same optional `budget` input already used by replay mode.

When present in dry-run mode:

- compute the same recoverable candidate set that bounded replay would use
- sort it with the same budgeted replay priority
- select only the next bounded slice
- keep the operation read-only

### 5.2 Add explicit replay-preview metadata to the inspection report

The inspection report should expose a small additive replay-preview section such as:

- `budget`
- `eligible_count`
- `selected_count`
- `remaining_count`

This keeps existing summary and focus data intact while making the replay-preview contract explicit for both JSON and human-readable output.

### 5.3 Show the exact preview slice in dry-run items

When dry-run uses `--budget <n>`:

- `items` should show the same bounded slice that replay would process next
- full backlog category counts should remain in the report summary
- any remaining eligible backlog should be reported through preview metadata rather than by silently disappearing

This preserves read-only observability while avoiding ambiguity about what the next bounded replay pass would actually consume.

### 5.4 Keep `--limit <n>` as a display-only layer

If both `--dry-run --budget <n>` and `--limit <m>` are supplied:

- budget preview selects the replay window first
- limit only trims the displayed subset of that preview window
- preview metadata still reports the full selected and remaining counts

This keeps `budget` as an orchestration-preview concept and `limit` as a presentation concept.

## 6. Expected Outcomes

After this slice:

- operators can preview the exact next bounded replay window before mutating durable state
- bounded replay and dry-run stay aligned under the same scope and ordering rules
- read-only observability gets stronger without turning into a control plane

## 7. Out Of Scope

This phase does not add:

- category-specific replay controls
- new dashboards or workbenches
- automatic schedulers or background loops
- replay mutation from dry-run mode
- hosted workflow-engine depth

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md`
- `docs/superpowers/specs/2026-04-05-phase10n-governed-orchestration-scoped-replay-design.md`
- `docs/superpowers/specs/2026-04-05-phase10o-governed-orchestration-replay-budgeting-design.md`
- `docs/superpowers/specs/2026-04-05-phase10p-governed-orchestration-budgeted-replay-alignment-design.md`
- `docs/superpowers/specs/2026-04-05-phase10q-boot-recovery-budget-guardrail-design.md`
