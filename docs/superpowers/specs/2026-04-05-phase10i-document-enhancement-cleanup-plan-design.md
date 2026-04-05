# Phase 10I Document Enhancement Cleanup Plan Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Add a worker-only, read-only cleanup-plan layer for local document enhancement artifacts so operators can turn retention recommendations into a bounded local action list and optional manifest without deleting anything or widening system contracts.

## 1. Goal

The previous 10I slices now cover:

- advisory privacy and OCR evidence
- local artifact persistence
- history list and replay
- read-only retention recommendations

The next safe slice is to convert retention output into an operator-facing cleanup plan.

In this minimal continuation:

- operators can generate a local cleanup plan from the existing retention audit
- the plan stays advisory and non-destructive
- an optional local manifest can be written for later human handling
- missing local files or manifest-write failures degrade into bounded evidence instead of blocking the worker flow

In one sentence:

`Phase 10I` should tell operators how to review local cleanup work before it ever removes or rewrites anything.

## 2. Why This Slice Exists

Retention answers which artifacts are inside or outside the local guardrails.
What still remains missing is a bounded operator handoff for the next question:

- which items should stay untouched for now
- which items should be archived or reviewed before manual cleanup
- which items already have local drift and should trigger index-repair review

This slice exists to make retention output actionable while preserving the same local-first, fail-open, worker-only boundary.

## 3. Recommended Option

### Option A: Add an automatic prune command

Pros:

- immediate disk cleanup

Cons:

- introduces destructive behavior
- risks deleting evidence that still needs human review

Not recommended.

### Option B: Add a read-only cleanup plan with optional local manifest

Pros:

- keeps decisions human-owned
- reuses the retention lane instead of creating a second policy source
- creates a portable local JSON manifest without affecting API or runtime contracts

Cons:

- manual cleanup still happens later

Recommended.

### Option C: Move cleanup planning into API, workbench, or release operations

Pros:

- could centralize policy eventually

Cons:

- widens the boundary too early
- risks turning evidence tooling into a control surface

Out of scope.

## 4. Hard Boundaries

### 4.1 Worker-only and local-first

This slice may:

- read the local index and artifact files
- derive a cleanup plan from retention recommendations
- optionally write one local JSON manifest

It must not:

- add API endpoints
- add database persistence
- depend on cloud services

### 4.2 Non-destructive and fail-open

This slice must not:

- delete artifact files
- rewrite `audit-index.json`
- mutate retention results in place

If no local index exists:

- return degraded cleanup-plan output with bounded notes

If the optional manifest cannot be written:

- keep the in-memory cleanup plan available on stdout
- mark the write result as degraded instead of failing the command

### 4.3 Evidence surface only

The optional manifest is a local handoff artifact only.
It must not:

- become a release control plane
- become a routing control plane
- auto-launch archive, cleanup, or verification actions

## 5. Core Objects

### 5.1 Cleanup Plan Action

A read-only summary describing:

- artifact timestamp
- document path
- artifact path
- derived action
- supporting reason
- manual operator steps

### 5.2 Cleanup Plan Result

A read-only result describing:

- cleanup-plan status
- source output directory and index path
- optional local manifest path
- evaluated item count
- planned action count
- bounded action list
- degradation notes when local data is incomplete or manifest persistence fails

## 6. Recommended Architecture

### 6.1 Worker-side cleanup-plan module

Add one module:

- `cleanup_plan.py`

It should:

- call the existing retention evaluator
- map retention candidates into bounded operator actions
- keep `keep` items visible while marking actionable review items explicitly
- optionally persist a separate local manifest under a subdirectory such as `plans/`

### 6.2 Separate cleanup-plan CLI

Add one dedicated CLI module:

- `cleanup_plan_cli.py`

Recommended flags:

- `--keep-last <n>`
- `--max-age-days <n>`
- `--output-dir <local-dir>`
- `--write-plan`
- `--plan-output-dir <local-dir>`

The CLI should always emit JSON.

### 6.3 Safe action mapping

Recommended action labels:

- `keep`
- `archive_then_cleanup_review`
- `index_repair_review`

This keeps the plan narrow:

- normal retained items stay visible
- cleanup candidates remain human-reviewed
- already-missing files become index-repair review instead of silent drift

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- deciding whether a local artifact needs archival before deletion
- performing any actual file deletion
- deciding whether the local index should be repaired
- deciding whether a machine-local cleanup recommendation applies elsewhere

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-document-enhancement-retention-audit-design.md`

It explicitly does not absorb:

- destructive cleanup operations
- API persistence
- workbench UI
- routing or release activation behavior
