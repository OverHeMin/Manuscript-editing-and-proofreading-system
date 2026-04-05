# Phase 10M Governed Orchestration Focus Ordering Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add bounded actionable focus ordering and top-N limiting to the Phase 10L dry-run orchestration inspection path so operators can see the most urgent backlog items first without mutating recovery state.

## 1. Goal

`Phase 10L` introduced a read-only dry-run inspection path for governed orchestration recovery.

The next narrow mainline gap is not new mutation power.
It is operator focus:

- full backlog classification is useful, but large dry-run outputs can still bury the most urgent items
- operators need a bounded way to surface the highest-priority actionable backlog first
- the system should preserve full summary counts while reducing item-list noise

This slice closes that gap with ordering and bounded limits only.

## 2. Hard Boundaries

### 2.1 Still read-only

This phase must not:

- claim orchestration attempts
- trigger recovery
- add new write APIs
- add operator retry buttons

### 2.2 No new control plane

This phase must not add:

- a new panel
- a scheduler
- targeted replay actions
- orchestration state mutation surfaces

The entire slice stays inside the existing CLI dry-run inspection path.

### 2.3 Full counts remain authoritative

Even when item output is filtered or limited:

- the report summary must still describe the full backlog
- focus controls only shape the displayed item list

## 3. Recommended Option

### Option A: Keep dry-run unsorted and unlimited

Pros:

- no additional complexity

Cons:

- urgent items can be buried in long outputs
- operators still need manual scanning before deciding on replay

Not recommended.

### Option B: Add category-priority ordering plus explicit `--actionable-only` and `--limit <n>`

Pros:

- keeps the slice local-first, explicit, and bounded
- helps operators inspect urgent backlog first
- avoids introducing a recovery control surface

Cons:

- requires one more focus read model and CLI flag parse path

Recommended.

## 4. Core Design

### 4.1 Add focus metadata alongside the existing summary

The inspection report should keep existing category counts, and add a separate focus block such as:

- `actionable_count`
- `displayed_count`
- `omitted_count`
- `actionable_only`
- optional `limit`

This makes it clear that:

- the backlog summary is global
- the item list is a focused view

### 4.2 Use a fixed urgency order

For the minimal slice, inspection items should be ordered by urgency:

1. `attention_required`
2. `stale_running`
3. `recoverable_now`
4. `deferred_retry`
5. `not_recoverable`

This keeps output deterministic and operator-friendly.

### 4.3 Add bounded focus controls

The service and CLI should support:

- `actionableOnly`
  - exclude `not_recoverable` rows from the item list
- `limit`
  - keep only the top `n` rows after ordering/filtering

These controls shape the item list only.
They must not change category counts.

### 4.4 Keep JSON and human output aligned

Human-readable dry-run output should show:

- the full backlog counts
- focus metadata such as `actionable`, `displayed`, and `omitted`

JSON output should carry the same structure so automation can rely on it.

## 5. Expected Outcomes

After this slice:

- operators can inspect the most urgent orchestration backlog items first
- dry-run remains read-only, local-first, and fail-open
- no targeted replay or mutation controls are introduced

## 6. Out Of Scope

This phase does not add:

- targeted replay by log id or category
- orchestration mutation APIs
- a dashboard or queue UI
- automatic prioritization into replay actions

## 7. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md`
- `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
