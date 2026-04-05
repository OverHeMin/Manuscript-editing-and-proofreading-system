# Phase 10I Document Enhancement Operator Summary Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Add a worker-only, read-only operator summary snapshot for local document enhancement artifacts so operators can review the current 10I evidence lane in one bounded JSON result without turning it into a control plane or repair executor.

## 1. Goal

The 10I lane now supports:

- advisory evidence generation
- local artifact persistence
- local history replay
- retention recommendations
- cleanup-plan generation
- index-consistency auditing
- repair handoff generation

The next safe slice is to close the phase with one bounded operator summary.

In this minimal continuation:

- operators can inspect recent local audit history, status breakdowns, retention pressure, consistency drift, and repair-handoff attention items in one JSON envelope
- the summary remains local-first, fail-open, and advisory-only
- an optional local summary snapshot may be written for manual maintenance sessions
- the feature does not repair metadata, delete files, or integrate with API / workbench / routing surfaces

In one sentence:

`Phase 10I` should end with one read-only local operator snapshot that summarizes the document-enhancement evidence lane without promoting it into a control plane.

## 2. Why This Slice Exists

The current commands are individually useful, but an operator still has to manually combine several outputs to answer:

- how much local evidence exists right now
- whether the latest history trends look healthy or degraded
- whether cleanup or repair attention is accumulating
- what should be reviewed next in a bounded way

That manual composition is acceptable during build-out, but it is a poor phase-closeout surface.

This slice exists to close that gap while preserving the same 10I rules:

- local-first
- fail-open
- worker-only
- no live manuscript-path dependency
- no automatic repair or cleanup

## 3. Recommended Option

### Option A: Stop at the existing individual commands

Pros:

- zero implementation risk

Cons:

- leaves the phase without a bounded closeout surface
- forces operators to manually merge history, retention, consistency, and handoff outputs

Not recommended.

### Option B: Add a read-only operator summary snapshot

Pros:

- finishes the phase with a bounded evidence surface
- reuses existing worker evaluators instead of inventing a new policy source
- stays easy to verify and safe to run locally

Cons:

- still requires separate commands for deep investigation

Recommended.

### Option C: Add an automatic maintenance runner

Pros:

- could reduce manual work later

Cons:

- crosses into repair / cleanup execution
- risks turning 10I into a local maintenance control plane

Out of scope.

## 4. Hard Boundaries

### 4.1 Read-only summary first

This slice may:

- read the local audit index
- read bounded recent history
- reuse retention, cleanup-plan, index-consistency, and repair-handoff evaluators
- optionally write one local summary snapshot JSON file

It must not:

- rewrite `audit-index.json`
- delete or move files
- auto-repair orphan or duplicate entries
- auto-launch cleanup or archive flows

### 4.2 Local-first and fail-open

If no local index exists:

- return a degraded but structured summary result

If the optional summary snapshot cannot be written:

- keep the computed summary on stdout
- degrade the status instead of throwing a hard failure

This slice must not block worker startup, manuscript execution, routing, or verification flows.

### 4.3 Evidence surface only

The summary is an operator aid.
It must not:

- become a routing control plane
- become a release control plane
- auto-switch models
- auto-publish evidence into workbenches
- auto-write learning or governance state

### 4.4 Helper manifests must stay outside index drift

Summary snapshots, cleanup plans, and repair handoff manifests are helper outputs rather than indexed audit artifacts.

This slice should preserve that distinction so helper JSON files are not misreported as orphan audit artifacts.

## 5. Core Objects

### 5.1 Operator Summary Result

A read-only result describing:

- summary status
- local output directory and index path
- optional summary snapshot path
- total indexed artifact count
- bounded recent-history entries
- privacy and academic-structure status breakdowns
- retention review count
- cleanup action count
- consistency issue count
- bounded attention items from repair handoff
- bounded next-step guidance
- degradation notes

### 5.2 Operator Attention Item

Reuse the existing repair-handoff item shape as the human attention surface for:

- cleanup review
- index repair review
- orphan artifact review

## 6. Recommended Architecture

### 6.1 Worker-side operator summary module

Add one module:

- `operator_summary.py`

It should:

- read the local audit index for total counts and status breakdowns
- reuse the history reader for bounded recent entries
- reuse retention and repair-handoff evaluators for operational pressure signals
- derive short bounded next steps from the current evidence
- optionally persist one local summary snapshot under a helper subdirectory

### 6.2 Separate operator summary CLI

Add one dedicated CLI module:

- `operator_summary_cli.py`

Recommended flags:

- `--output-dir <local-dir>`
- `--keep-last <n>`
- `--max-age-days <n>`
- `--history-limit <n>`
- `--attention-limit <n>`
- `--write-summary`
- `--summary-output-dir <local-dir>`

The CLI should always emit JSON.

### 6.3 Helper-directory exclusions

The index-consistency helper-directory list should treat local helper manifests as non-artifact lanes, including:

- `plans/`
- `repair-handoffs/`
- the new operator-summary snapshot directory

This keeps the summary lane from creating false orphan-artifact drift.

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- deciding whether a cleanup or repair item requires action
- deciding whether local helper manifests should be archived
- performing any actual index repair or file cleanup
- deciding whether 10I evidence should later inform a governed integration

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-document-enhancement-history-cli-design.md`
- `2026-04-05-phase10i-document-enhancement-retention-audit-design.md`
- `2026-04-05-phase10i-document-enhancement-index-consistency-audit-design.md`
- `2026-04-05-phase10i-document-enhancement-repair-handoff-design.md`

It explicitly does not absorb:

- automatic cleanup
- automatic repair
- API persistence
- workbench UI
- routing, release, or verification control-plane behavior
