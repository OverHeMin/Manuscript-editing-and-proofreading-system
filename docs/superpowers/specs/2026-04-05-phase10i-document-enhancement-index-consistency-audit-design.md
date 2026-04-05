# Phase 10I Document Enhancement Index Consistency Audit Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Add a worker-only, read-only index consistency audit for local document enhancement artifacts so operators can inspect mismatches between `audit-index.json` and the local artifact directory without repairing or deleting anything.

## 1. Goal

The 10I lane now supports:

- advisory evidence generation
- local artifact persistence
- local history replay
- retention recommendations
- cleanup-plan generation

The next safe slice is to expose one dedicated view over local index consistency.

In this minimal continuation:

- operators can audit whether local artifact files and `audit-index.json` agree
- common drift cases such as missing artifacts, duplicate entries, invalid entries, and orphan artifacts become explicit issues
- the audit stays local-first, fail-open, and non-destructive
- the result can feed future human repair work without becoming an automatic maintenance path

In one sentence:

`Phase 10I` should show operators where local audit metadata has drifted before any future manual repair happens.

## 2. Why This Slice Exists

The new cleanup-plan layer can already emit `index_repair_review` as an action.
What remains missing is a dedicated audit answering:

- which index entries point at files that are gone
- which index entries are malformed or duplicated
- which local artifact JSON files are present but not indexed

Without this slice, operators can see that some cleanup work needs review, but they still lack one bounded place to inspect local index drift.

## 3. Recommended Option

### Option A: Add an automatic repair command

Pros:

- reduces manual work

Cons:

- writes to `audit-index.json`
- risks silently losing evidence or changing operator expectations

Not recommended.

### Option B: Add a read-only index consistency audit

Pros:

- keeps the lane advisory-only
- gives operators an explicit diagnostic surface
- complements cleanup-plan without mixing responsibilities

Cons:

- repair remains manual

Recommended.

### Option C: Fold consistency checks into cleanup-plan only

Pros:

- fewer commands

Cons:

- blurs the difference between cleanup decisions and index-health diagnostics
- makes later extension harder

Not recommended.

## 4. Hard Boundaries

### 4.1 Read-only only

This slice may:

- read `audit-index.json`
- read local artifact JSON files
- scan the local output directory for artifact drift

It must not:

- rewrite `audit-index.json`
- delete or move files
- add repair actions to the live worker path

### 4.2 Local-first and fail-open

If no index exists:

- return a degraded but structured audit result

If index entries are malformed or files cannot be parsed:

- surface issues in the JSON result
- avoid raising hard failures that would block worker use

### 4.3 Evidence surface only

This audit is an operator aid only.
It must not:

- become a control plane
- automatically trigger cleanup-plan generation
- automatically repair or archive artifacts

## 5. Core Objects

### 5.1 Index Consistency Issue

A read-only summary describing:

- issue type
- related artifact path or index position
- human-readable detail
- recommended manual follow-up

### 5.2 Index Consistency Audit Result

A read-only result describing:

- audit status
- local output directory and index path
- evaluated entry count
- issue count
- bounded issue list
- notes for degraded or empty cases

## 6. Recommended Architecture

### 6.1 Worker-side consistency module

Add one module:

- `index_consistency.py`

It should:

- read the existing local index
- inspect referenced artifact files
- scan the output directory for unindexed artifact JSON files
- skip `audit-index.json` and non-artifact helper directories such as `plans/`

### 6.2 Separate consistency CLI

Add one dedicated CLI module:

- `index_consistency_cli.py`

Recommended flags:

- `--output-dir <local-dir>`

The CLI should always emit JSON.

### 6.3 Safe issue types

Recommended initial issue labels:

- `missing_artifact`
- `duplicate_index_entry`
- `invalid_index_entry`
- `orphan_artifact`

This keeps the first slice narrow and easy to verify while still covering the most useful local drift classes.

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- deciding whether an index entry should be removed
- deciding whether an orphan artifact should be re-indexed or archived
- deciding whether duplicate entries should collapse into one canonical item

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-document-enhancement-cleanup-plan-design.md`

It explicitly does not absorb:

- automatic repair
- API persistence
- workbench UI
- routing, release, or verification control-plane behavior
