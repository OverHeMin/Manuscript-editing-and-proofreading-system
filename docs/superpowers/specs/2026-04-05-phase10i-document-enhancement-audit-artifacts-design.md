# Phase 10I Document Enhancement Audit Artifacts Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Extend the worker-only document enhancement advisory baseline with local artifact persistence so operators can keep auditable JSON reports under a repository-owned local path without writing into API persistence or the live manuscript mainline.

## 1. Goal

The first 10I slice established advisory privacy and academic-structure evidence.
The next safe slice is to make that evidence durable in a bounded local path.

In this minimal continuation:

- the CLI may optionally persist a JSON audit artifact under a local repository-owned directory
- the CLI may maintain a local index manifest for later replay and inspection
- stdout JSON remains available even when artifact writing is skipped or degraded
- artifact persistence stays manual, local-first, fail-open, and independent from API persistence

In one sentence:

`Phase 10I` should let operators keep local audit artifacts without turning document enhancement into a control plane, database contract, or manuscript-path dependency.

## 2. Why This Slice Exists

The existing baseline can already produce a useful advisory report, but it still has two practical gaps:

- the report disappears unless the operator manually redirects stdout
- there is no stable local landing zone or index for replaying previous audits

That means the current baseline is inspectable but not yet comfortably auditable over time.

This slice exists to close that gap while preserving the strict 10I boundaries:

- no API persistence writes
- no production runtime dependency
- no automatic OCR or privacy mutation

## 3. Recommended Option

### Option A: Keep stdout-only output

Pros:

- smallest implementation

Cons:

- weak repeatability
- operators must manage file naming and output history by hand

Not recommended.

### Option B: Add bounded local artifact persistence and an index manifest

Pros:

- local-first and repository-owned
- preserves advisory behavior while making evidence reusable
- keeps persistence outside live business-path contracts

Cons:

- adds one more local file-management surface

Recommended.

### Option C: Persist audit artifacts through API or PostgreSQL

Pros:

- stronger centralization later

Cons:

- too large for the next safe step
- risks coupling 10I advisory work to persistent governance contracts too early

Out of scope.

## 4. Hard Boundaries

### 4.1 Local path only

Default artifact persistence should write under:

- `.local-data/document-enhancement-audits/manual`

An explicit local output directory override may still be allowed.

This slice must not require:

- cloud storage
- hosted audit sinks
- database writes

### 4.2 Fail-open artifact writing

If the operator does not request artifact writing:

- the CLI should still return stdout JSON

If artifact writing is requested but the local path cannot be created or written:

- the CLI should still return the advisory report
- the artifact section should degrade and explain the failure

It must not block worker startup or manuscript execution.

### 4.3 Advisory state remains advisory

Persisting the artifact does not change the meaning of the report.

It must not:

- auto-promote the report into a governed decision
- auto-publish evidence into API workbenches
- auto-run OCR or privacy tools

### 4.4 Additive local history only

Artifact persistence should be additive:

- new reports create new JSON files
- the local index appends or rewrites the latest view over additive history

This slice should not delete older artifacts automatically.

## 5. Core Objects

### 5.1 Audit Artifact Write Result

A bounded result describing:

- whether artifact persistence was skipped, written, or degraded
- which output path was targeted
- which local artifact file was written, if any

### 5.2 Audit Artifact Index Entry

A compact manifest entry describing:

- artifact file name
- document path
- privacy status
- academic-structure status
- creation timestamp

### 5.3 Document Enhancement Audit Envelope

The existing advisory report extended with:

- an `artifact` section describing local persistence outcome

## 6. Recommended Architecture

### 6.1 Worker-side artifacts module

Add one new module inside `document_enhancement`:

- `artifacts.py`

This module should:

- resolve the default output directory
- build stable artifact file names
- write JSON artifacts
- maintain a local index manifest

### 6.2 CLI persistence behavior

The CLI should add explicit flags such as:

- `--write-artifact`
- `--output-dir <local-dir>`

Recommended behavior:

- default remains stdout-only
- when `--write-artifact` is present, write the report to the default local path unless `--output-dir` overrides it
- include the artifact outcome inside the emitted JSON

### 6.3 Local index manifest

Maintain one index file in the chosen output directory, for example:

- `audit-index.json`

The index should stay simple and local-first:

- array of compact entries
- newest-first ordering
- no external locking or multi-process orchestration

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- deciding whether the advisory report matters
- moving or archiving local audit artifacts
- deciding whether a later governed flow should consume this evidence

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-privacy-evidence-and-academic-structure-baseline-design.md`

It explicitly does not absorb:

- API persistence
- workbench read models
- routing governance
- runtime blocking gates
