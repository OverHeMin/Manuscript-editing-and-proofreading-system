# Phase 10I Privacy Evidence And Academic Structure Baseline Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Establish a local-first, worker-only advisory evidence baseline for privacy prechecks and academic-structure enhancement readiness without turning OCR or privacy tooling into synchronous business-path dependencies.

## 1. Goal

Phase 10I should begin by creating the missing boundary layer, not by forcing full OCR or privacy tooling into the manuscript mainline.

In this minimal slice:

- the repository gains one worker-owned advisory evidence contract for privacy prechecks
- the repository gains one worker-owned advisory readiness contract for OCR and academic-structure enhancement
- operators can run one local-first audit command against a local document path and optional text extract
- missing adapters degrade into advisory evidence instead of blocking screening, editing, proofreading, routing, or existing verification-ops flows

In one sentence:

`Phase 10I` should start by making privacy and OCR readiness inspectable, auditable, and replaceable before they are ever considered for tighter governed-flow integration.

## 2. Why This Phase Exists

The repository already has some privacy-adjacent governance signals:

- `deidentification_passed` exists in learning, verification, and harness governance
- reviewed and human-governed assets already respect de-identification expectations
- the worker already contains a bounded PDF pipeline contract surface

What still remains missing is the actual integration boundary for the next retained capability lane:

- there is no first-class privacy evidence hook that explains what a local privacy precheck observed
- there is no local-first readiness surface for `OCRmyPDF`, `PaddleOCR`, or `GROBID`
- there is no bounded worker-side command that says "for this document shape, here is the privacy / OCR advisory state"
- the repository has not yet drawn a safe line between "privacy or OCR evidence" and "business-path runtime dependency"

Phase 10I exists to create that line without overreaching into deploy automation, routing policy, or production manuscript gating.

## 3. Recommended Option

### Option A: Keep 10I as future-only documentation

Pros:

- zero implementation risk

Cons:

- no auditable landing zone for privacy evidence hooks
- no testable adapter boundary for OCR or academic-structure tooling

Not recommended.

### Option B: Add a worker-only advisory evidence layer

Pros:

- local-first and bounded
- uses replaceable adapter contracts instead of hardwiring tools into the mainline
- creates verifiable behavior now without making privacy or OCR a synchronous runtime dependency

Cons:

- only advisory in this first slice
- does not yet publish governed evidence into API persistence

Recommended.

### Option C: Integrate `Presidio`, `OCRmyPDF`, `PaddleOCR`, and `GROBID` directly into the live manuscript path

Pros:

- could provide deeper end-to-end automation later

Cons:

- too broad for the next safe slice
- risks destabilizing worker behavior and introducing non-local operational assumptions
- violates the current "smallest edge adapter first" rule

Out of scope.

## 4. Hard Boundaries

### 4.1 Local-first and adapter-based

This phase may add:

- worker-side advisory contracts
- local command / endpoint configuration discovery
- local heuristic prechecks
- read-only audit commands

It must not require:

- hosted privacy services
- cloud OCR services
- remote control planes

### 4.2 Fail-open by default

If `Presidio`, `OCRmyPDF`, `PaddleOCR`, or `GROBID` are unavailable:

- the advisory audit may mark results as degraded
- the command may still return a structured report

It must not:

- block manuscript execution
- block routing resolution
- block verification-ops execution
- fail the worker simply because an optional adapter is missing

### 4.3 No live control-plane promotion

This phase may emit evidence.
It must not:

- become the routing control plane
- auto-switch models
- auto-publish knowledge or templates
- auto-write learning feedback
- auto-run OCR or privacy mutation in the manuscript mainline

### 4.4 Privacy evidence remains advisory

This phase may surface:

- heuristic findings
- configured adapter availability
- operator next steps

It must not pretend that:

- a heuristic precheck replaces human review
- this slice alone is a final privacy gate for publication

### 4.5 OCR and academic-structure enhancement remain operator-launched

This phase may recommend:

- when OCR is likely needed
- when `GROBID`-style structure extraction is likely viable

It must not:

- rewrite source files automatically
- auto-launch enhancement tools as part of screening, editing, or proofreading

## 5. Core Objects

### 5.1 Privacy Advisory Result

A read-only result describing:

- whether text was available for a local heuristic precheck
- whether heuristic sensitive markers were found
- whether local `Presidio`-style endpoints are configured
- why the result is advisory-only, degraded, or needs review

### 5.2 Academic Structure Advisory Result

A read-only result describing:

- document kind
- whether a text layer is known to exist
- whether local OCR and structure adapters appear available
- which bounded operator path is recommended next

### 5.3 Document Enhancement Audit Report

A single JSON envelope that combines:

- document identity metadata
- privacy advisory evidence
- academic-structure advisory evidence
- explicit notes that this report is local-first, fail-open, and non-blocking

## 6. Recommended Architecture

### 6.1 Worker-side document-enhancement package

Create a new worker package that stays independent from the manuscript execution contracts:

- `contracts.py` for report shapes
- `privacy.py` for bounded heuristic prechecks
- `academic_structure.py` for OCR / structure readiness assessment
- `cli.py` for one operator-owned JSON audit command

This package should live alongside the existing worker pipeline modules rather than altering them.

### 6.2 Privacy evidence hook

The privacy slice should:

- accept optional extracted text from a local file
- run bounded heuristic scans for clearly machine-detectable markers such as email, phone, and ID-like tokens
- surface `Presidio` adapter configuration state if present
- always explain that human de-identification review remains authoritative

This intentionally stops short of full automated anonymization.

### 6.3 Academic-structure readiness hook

The academic-structure slice should:

- infer the document kind from the local path
- accept an explicit `text layer` hint (`present`, `missing`, `unknown`)
- inspect local adapter readiness for `OCRmyPDF`, `PaddleOCR`, and `GROBID`
- return the next recommended operator sequence without mutating the source document

### 6.4 CLI audit surface

Expose one worker-owned command that:

1. reads a local document path
2. optionally reads a local text file for privacy precheck input
3. emits one JSON envelope to stdout

Important rule:

- the command is an evidence surface, not a release gate or execution orchestrator

## 7. Manual Work That Remains Human

Even after this slice lands, these stay human-owned:

- final de-identification judgment
- deciding whether a document is safe to reuse in governed flows
- choosing when to launch OCR or structure extraction
- deciding whether advisory findings justify escalation or rejection

## 8. Related Capability Lane

This phase advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds on:

- `08-security-auth-and-compliance.md`
- `06-pdf-consistency-and-ocr.md`
- existing de-identification governance signals already present in learning, verification, and harness flows

It explicitly does not absorb:

- release automation
- routing governance
- durable orchestration
- hosted privacy or OCR platform dependency
