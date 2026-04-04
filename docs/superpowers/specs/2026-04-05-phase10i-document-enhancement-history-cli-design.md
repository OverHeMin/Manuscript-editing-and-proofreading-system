# Phase 10I Document Enhancement History CLI Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Add a worker-only, read-only history CLI for local document enhancement audit artifacts so operators can list and replay persisted advisory reports without touching API persistence, workbench contracts, or the live manuscript path.

## 1. Goal

The previous 10I slice made local audit artifacts durable.
The next safe slice is to make those artifacts discoverable and replayable.

In this minimal continuation:

- operators can list local audit artifacts from the local index manifest
- operators can replay one persisted artifact by local file path
- missing indexes or missing artifact files degrade into bounded read-only results
- history inspection stays local-first and worker-only

In one sentence:

`Phase 10I` should add read-only artifact history access before it considers any API or workbench integration.

## 2. Why This Slice Exists

The local artifact lane now persists:

- additive JSON reports
- a local `audit-index.json`

But operators still have to inspect those files manually.
That creates avoidable friction:

- no bounded list command for recent audit history
- no stable replay command for one artifact
- no clear fail-open history contract when local files are missing or partially corrupted

This slice exists to close that operational gap without pulling 10I into API persistence or UI scope.

## 3. Recommended Option

### Option A: Extend the existing audit CLI with history flags

Pros:

- one executable surface

Cons:

- mixes write and read responsibilities into one growing command
- makes the main advisory command harder to reason about

Not recommended.

### Option B: Add a separate read-only history CLI

Pros:

- clearer boundary
- easier to keep fail-open and local-only
- avoids inflating the main audit command

Cons:

- one additional script entry

Recommended.

### Option C: Jump to API-backed history endpoints or workbench views

Pros:

- richer operator UX later

Cons:

- too early for the next safe slice
- risks coupling a worker-local lane to broader governance contracts

Out of scope.

## 4. Hard Boundaries

### 4.1 Read-only only

This slice may:

- read the local index
- read local artifact JSON files
- return structured history data

It must not:

- rewrite old artifacts
- delete artifacts
- publish history into API persistence

### 4.2 Local-first and fail-open

If the local index is missing:

- listing should degrade with a structured empty result

If a referenced artifact is missing:

- replay should degrade with an explanatory status

These conditions must not raise hard failures for normal operator use.

### 4.3 No promotion into governance control planes

History inspection may expose evidence only.

It must not:

- become a routing control plane
- become a release control plane
- auto-promote advisory evidence into governed decisions

## 5. Core Objects

### 5.1 Audit History Entry

A compact read-model entry describing:

- timestamp
- document path
- artifact file
- privacy status
- academic-structure status

### 5.2 Audit History Listing Result

A read-only result describing:

- listing status
- output directory
- index path
- bounded history entries
- degradation notes when index data is missing

### 5.3 Audit Replay Result

A read-only result describing:

- replay status
- artifact path
- the loaded advisory report, if available
- degradation notes when the artifact cannot be read

## 6. Recommended Architecture

### 6.1 Worker-side history module

Add one new module:

- `history.py`

It should provide:

- one function to list artifact history from `audit-index.json`
- one function to replay a single artifact JSON file

### 6.2 Separate history CLI

Add a dedicated CLI module:

- `history_cli.py`

Recommended commands:

- `--list`
- `--limit <n>`
- `--artifact-path <local-file>`
- optional `--output-dir <local-dir>`

The CLI should always emit JSON to stdout.

### 6.3 Bounded defaults

Recommended behavior:

- default output directory stays `.local-data/document-enhancement-audits/manual`
- default listing limit stays small, such as `10`
- no recursive directory scans beyond the known local index

## 7. Manual Work That Remains Human

Even after this slice lands, these stay human-owned:

- deciding whether a historical advisory report is meaningful
- curating or archiving local artifact files
- choosing whether any later governed flow should consume the evidence

## 8. Related Capability Lane

This continuation advances:

- `Privacy And Compliance Gate`
- `Academic Structure And OCR Enhancement`

It builds directly on:

- `2026-04-05-phase10i-document-enhancement-audit-artifacts-design.md`

It explicitly does not absorb:

- API persistence
- workbench UI
- routing governance
- runtime blocking contracts
