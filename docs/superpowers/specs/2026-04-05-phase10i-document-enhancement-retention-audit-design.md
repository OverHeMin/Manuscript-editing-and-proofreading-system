# Phase 10I Document Enhancement Retention Audit Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Add a worker-only, read-only retention audit for local document enhancement artifacts so operators can see which local reports are safe candidates for cleanup without deleting anything or introducing broader governance coupling.

## 1. Goal

The previous 10I slices made advisory reports durable and browseable.
The next safe slice is to assess local artifact sprawl without performing cleanup.

In this minimal continuation:

- operators can evaluate local artifact retention candidates from the known local index
- the retention result stays advisory and read-only
- configurable guardrails such as `keep last N` and optional `max age days` remain local-only
- missing index or malformed entries degrade into structured advisory output

In one sentence:

`Phase 10I` should tell operators what could be cleaned up before it ever attempts to remove local files.

## 2. Why This Slice Exists

The local artifact lane now supports:

- advisory report generation
- local artifact persistence
- list and replay over local history

What still remains missing is a bounded answer to:

- which local files are recent enough to keep
- which files are stale enough to review for cleanup
- how to surface those suggestions without turning the worker into a destructive maintenance tool

This slice exists to close that gap while keeping 10I fully local-first and fail-open.

## 3. Recommended Option

### Option A: Jump directly to prune/delete support

Pros:

- immediate disk cleanup

Cons:

- introduces destructive behavior too early
- increases risk around accidental data loss

Not recommended.

### Option B: Add a read-only retention audit

Pros:

- keeps the boundary safe and operator-owned
- provides clear next-step recommendations
- complements the new history CLI without widening system contracts

Cons:

- still requires manual cleanup afterward

Recommended.

### Option C: Push retention into API or centralized governance

Pros:

- could centralize policy later

Cons:

- far too early for the current 10I boundary
- couples local worker evidence to broader persistence/control-plane work

Out of scope.

## 4. Hard Boundaries

### 4.1 Read-only only

This slice may:

- inspect the local index
- inspect artifact metadata
- recommend retention or cleanup candidates

It must not:

- delete artifact files
- rewrite the local index
- update API persistence

### 4.2 Local-first and fail-open

If no index exists:

- return a degraded but structured retention result

If entries are malformed or files are already missing:

- mark them in the advisory output
- do not crash the worker command path

### 4.3 Operator-owned guidance

The result may recommend:

- keep
- review for cleanup

It must not:

- auto-apply retention policy
- claim the recommendation is authoritative across machines or worktrees

## 5. Core Objects

### 5.1 Retention Candidate

A read-only summary describing:

- artifact path
- created timestamp
- age in days
- recommendation
- reason

### 5.2 Retention Audit Result

A read-only result describing:

- audit status
- output directory
- evaluated item count
- keep count
- cleanup-review count
- bounded candidate entries
- degradation notes when local data is incomplete

## 6. Recommended Architecture

### 6.1 Worker-side retention module

Add one module:

- `retention.py`

It should:

- read local history through the existing local index contract
- evaluate each entry against `keep_last` and optional `max_age_days`
- return structured candidates rather than mutate files

### 6.2 Separate retention CLI

Add one dedicated CLI module:

- `retention_cli.py`

Recommended flags:

- `--keep-last <n>`
- `--max-age-days <n>`
- optional `--output-dir <local-dir>`

The CLI should always emit JSON.

### 6.3 Safe defaults

Recommended defaults:

- `keep_last=20`
- `max_age_days` optional, not required

If no explicit age rule is provided, the audit should still mark entries beyond the keep window as cleanup-review candidates.

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- deciding whether to delete any local artifact
- deciding whether artifacts should be archived elsewhere
- deciding whether a machine-local retention suggestion applies to another environment or teammate

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-document-enhancement-history-cli-design.md`

It explicitly does not absorb:

- destructive cleanup operations
- API persistence
- workbench UI
- runtime blocking behavior
