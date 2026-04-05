# Phase 10I Document Enhancement Repair Handoff Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Add a worker-only, read-only repair handoff layer for local document enhancement artifacts so operators can turn cleanup and index-consistency findings into one bounded local checklist and optional handoff manifest without performing any repair.

## 1. Goal

The 10I lane now supports:

- advisory evidence generation
- local artifact persistence
- local history replay
- retention recommendations
- cleanup-plan generation
- index-consistency auditing

The next safe slice is to package those signals into one human-facing repair handoff.

In this minimal continuation:

- operators can generate a bounded repair checklist from existing local evidence
- cleanup actions and consistency issues are merged into one local handoff result
- an optional local handoff manifest can be written for manual maintenance sessions
- the feature stays local-first, fail-open, and non-destructive

In one sentence:

`Phase 10I` should hand local cleanup and index-repair work to a human operator before any future manual repair happens.

## 2. Why This Slice Exists

Today operators can see:

- which artifacts are cleanup-review candidates
- which local index entries or files have drifted

What is still missing is one bounded answer to:

- what should I review first
- which local targets need archive review versus index repair review
- how do I save that manual to-do list without re-running the reasoning by hand

This slice exists to create that handoff while keeping 10I advisory-only.

## 3. Recommended Option

### Option A: Add an automatic repair executor

Pros:

- reduces manual work

Cons:

- writes local metadata
- risks crossing the line from evidence surface into maintenance tooling

Not recommended.

### Option B: Add a read-only repair handoff manifest

Pros:

- keeps operators in control
- reuses existing cleanup and consistency logic
- produces a portable local checklist for later manual action

Cons:

- repair remains manual

Recommended.

### Option C: Reuse cleanup-plan manifest only

Pros:

- fewer commands

Cons:

- cleanup-plan does not cover all consistency issues
- mixes evidence packaging with one specific maintenance perspective

Not recommended.

## 4. Hard Boundaries

### 4.1 No automatic repair

This slice may:

- read cleanup-plan output
- read index-consistency output
- merge those signals into a handoff checklist
- optionally write one local JSON handoff manifest

It must not:

- rewrite `audit-index.json`
- re-index orphan artifacts
- delete or move files

### 4.2 Local-first and fail-open

If no index exists:

- return a degraded but structured handoff result

If the optional handoff manifest cannot be written:

- keep the computed handoff available on stdout
- degrade the status instead of throwing a hard failure

### 4.3 Evidence surface only

The handoff result is an operator aid.
It must not:

- become a control plane
- auto-trigger repair or cleanup commands
- block manuscript execution or verification flows

## 5. Core Objects

### 5.1 Repair Handoff Item

A read-only summary describing:

- handoff type
- contributing sources such as `cleanup_plan` or `index_consistency`
- related document path or artifact path
- merged summary
- manual follow-up steps

### 5.2 Repair Handoff Result

A read-only result describing:

- handoff status
- local output directory and index path
- optional handoff manifest path
- cleanup action count
- consistency issue count
- actionable handoff item count
- bounded handoff items
- degradation notes when local evidence or manifest persistence is incomplete

## 6. Recommended Architecture

### 6.1 Worker-side repair handoff module

Add one module:

- `repair_handoff.py`

It should:

- call the existing cleanup-plan evaluator without writing cleanup manifests
- call the existing index-consistency evaluator
- merge actionable results into one handoff list keyed by local target when possible
- keep the merge logic bounded and deterministic

### 6.2 Separate repair handoff CLI

Add one dedicated CLI module:

- `repair_handoff_cli.py`

Recommended flags:

- `--keep-last <n>`
- `--max-age-days <n>`
- `--output-dir <local-dir>`
- `--write-handoff`
- `--handoff-output-dir <local-dir>`

The CLI should always emit JSON.

### 6.3 Safe handoff types

Recommended initial handoff labels:

- `archive_then_cleanup_review`
- `index_repair_review`
- `orphan_artifact_review`

This keeps the result focused on human follow-up rather than low-level implementation details.

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- deciding whether a file should be archived before deletion
- deciding whether duplicate or invalid index entries should be edited manually
- deciding whether orphan artifacts should be indexed, archived, or deleted

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-document-enhancement-cleanup-plan-design.md`
- `2026-04-05-phase10i-document-enhancement-index-consistency-audit-design.md`

It explicitly does not absorb:

- automatic repair
- API persistence
- workbench UI
- routing, release, or verification control-plane behavior
