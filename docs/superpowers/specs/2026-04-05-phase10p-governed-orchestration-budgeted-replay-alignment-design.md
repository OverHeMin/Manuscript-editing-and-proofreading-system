# Phase 10P Governed Orchestration Budgeted Replay Alignment Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Align budgeted governed orchestration replay with the existing dry-run recoverable priority ordering so bounded replay consumes stale-running work before plain recoverable work inside the same scope.

## 1. Goal

`Phase 10L` through `10O` now provide:

- read-only dry-run backlog inspection
- actionable-first inspection ordering
- scoped replay and inspection filters
- bounded replay budgeting

The remaining small but important gap is alignment:

- dry-run already highlights the most urgent actionable backlog items first
- budgeted replay still consumes eligible logs in repository list order
- this means a human can inspect one top actionable slice, but budgeted replay may process a different slice

This phase closes the recoverable-order mismatch without broadening the control surface.

## 2. Why This Slice Exists

`10O` made limited replay possible.
That immediately makes ordering matter.

If replay order and dry-run preview order differ, operators lose one of the main benefits of the current lane:

- read-only observation no longer predicts bounded replay accurately
- restart-safe incremental progress becomes less explainable
- the execution/orchestration lane drifts toward "operator must guess the actual replay set"

The right next step is not a new preview flag or dashboard.
It is to make the current budgeted replay path honor the ordering the system already exposes read-only.

## 3. Hard Boundaries

### 3.1 Only budgeted replay changes

This phase should change ordering only when a replay `budget` is supplied.

It must not:

- change full-sweep replay semantics when no budget is given
- add new replay override flags
- change retry eligibility, stale-running reclaim, or terminal-failure rules
- add new mutation surfaces

### 3.2 Dry-run stays read-only

Dry-run already exposes the ordering model we want.
This phase must not:

- make dry-run claim or mutate orchestration state
- add dry-run side effects
- turn dry-run into a replay trigger

### 3.3 Reuse existing ordering semantics

This phase should not invent a second priority model.
Budgeted replay should reuse the same actionable ordering already encoded in dry-run:

- `stale_running` before `recoverable_now`
- existing timestamp tie-breaks
- stable log-id fallback ordering

### 3.4 Keep local-first and fail-open

This slice must remain:

- repository-owned
- additive
- free of cloud or hosted scheduler dependencies

## 4. Recommended Option

### Option A: Leave replay and preview loosely related

Pros:

- no new code

Cons:

- budgeted replay remains harder to predict
- dry-run loses part of its operational value

Not recommended.

### Option B: Align only budgeted replay with existing actionable ordering

Pros:

- smallest behavior change
- makes `--dry-run --actionable-only --limit <n>` a truthful preview of `--budget <n>`
- keeps full replay untouched

Cons:

- replay ordering remains split between budgeted and unbudgeted modes

Recommended.

### Option C: Switch all replay to actionable ordering

Pros:

- one universal ordering model

Cons:

- broader behavior change than this slice needs
- higher stability risk for the existing full-sweep recovery path

Not recommended for this phase.

## 5. Core Design

### 5.1 Budgeted replay reuses dry-run ordering

When `budget` is present, recovery should:

1. scope logs as today
2. classify deferred and recoverable logs as today
3. sort recoverable logs using the same actionable ordering rules already used by dry-run
4. slice to the first `budget` logs
5. dispatch that bounded subset

### 5.2 No-budget replay stays unchanged

When `budget` is absent:

- recovery keeps the current repository list order
- boot recovery behavior remains unchanged
- this phase stays a narrow adaptation rather than a broad replay-policy rewrite

### 5.3 Dry-run remains the read-only source of recoverable priority context

After this slice:

- dry-run category ordering still shows `stale_running` ahead of plain `recoverable_now`
- budgeted replay will now honor that same recoverable priority ordering

This keeps read-only observation and replay behavior better aligned without adding new flags or changing dry-run semantics.

## 6. Expected Outcomes

After this slice:

- budgeted replay becomes predictable from the current dry-run lane
- restart-safe incremental replay is easier to reason about
- no new control plane or mutation surface is introduced
- unbudgeted replay remains stable

## 7. Out Of Scope

This phase does not add:

- new CLI flags
- new replay summary fields
- dry-run mutation behavior
- full replay ordering changes
- new dashboards, workbenches, or control-plane authority

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md`
- `docs/superpowers/specs/2026-04-05-phase10n-governed-orchestration-scoped-replay-design.md`
- `docs/superpowers/specs/2026-04-05-phase10o-governed-orchestration-replay-budgeting-design.md`
