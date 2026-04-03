# Phase 4, 7B, and 8 Boundary Reconciliation

**Date:** 2026-04-03  
**Status:** Approved for repository documentation reconciliation

## Why This Document Exists

Several historical delivery containers in this repository do not map cleanly to
a single phase name.

The project still has strong phase planning discipline at the document level,
but three implementation windows ended up broader than their branch or PR names
suggest:

- `phase4`
- `phase7b`
- `phase8`

This document normalizes how those phases should be interpreted going forward.

## Non-Goals

- Do not rewrite Git history.
- Do not rename old branches, merge commits, or PR titles.
- Do not change implementation code solely to make phase history look cleaner.
- Do not create synthetic one-PR-per-phase narratives after the fact.

## Decision Summary

- `phase4` should be interpreted as a cumulative delivery container for Phase 2,
  Phase 3, and Phase 4 work.
- `phase7b` should be interpreted as a cumulative delivery container for Phase
  6A, Phase 7A, and Phase 7B work.
- `phase8` should be interpreted as an umbrella delivery phase spanning many
  sub-slices from `8a` through `8z`, plus closely adjacent `9a`
  infrastructure delivered in the same implementation window.
- Future planning, handoff, and README updates should rely on phase plan/spec
  files as the canonical scope boundaries.

## Phase 4 Reconciliation

### Planned Boundary

Canonical scope file:

- `docs/superpowers/plans/2026-03-28-phase4-agent-runtime-integration.md`

Intended Phase 4 goal:

- wire screening, editing, and proofreading through the governed `Agent Runtime`
  layer
- add module-level runtime bindings, sandbox/tool permission policies, execution
  logging, and governed runtime orchestration

### Actual Delivery Vehicle

Primary merge vehicle:

- merge `51fde95` from `codex/phase4-agent-runtime-integration`

Observed reality:

- the merge also carried substantial Phase 2 and Phase 3 implementation
- this makes the merge vehicle broader than the Phase 4 name implies

### Normalized Interpretation

Going forward:

- use the Phase 4 plan/spec to define what Phase 4 means
- treat merge `51fde95` as a cumulative implementation batch, not as a pure
  one-phase artifact
- when discussing Phase 2 or Phase 3 completion history, it is acceptable to
  cite implementation that landed through the Phase 4 merge window

## Phase 7B Reconciliation

### Planned Boundary

Canonical scope file:

- `docs/superpowers/plans/2026-03-28-phase7b-knowledge-review-web-workbench.md`

Intended Phase 7B goal:

- build the first real Web knowledge review workbench page
- expose a master-detail reviewer desk for pending review knowledge items

### Actual Delivery Vehicle

Primary merge vehicle:

- merge `e0f578b` from `codex/phase7b-knowledge-review-web`

Observed reality:

- the merge also included substantial Phase 6A and Phase 7A work
- the PR title already hints at this broader scope by referring to both
  knowledge review web workbench and learning review stabilization

### Normalized Interpretation

Going forward:

- use the Phase 7B plan/spec to define what Phase 7B means
- treat merge `e0f578b` as a cumulative implementation batch covering adjacent
  late-Phase-6 and Phase-7 work
- do not infer that every commit in that merge belongs only to the web
  knowledge review desk

## Phase 8 Reconciliation

### Planned Boundary

Canonical scope family:

- `docs/superpowers/plans/2026-03-30-phase8a-auth-persistent-http.md`
- `docs/superpowers/plans/2026-03-30-phase8b-governed-governance-persistence.md`
- `docs/superpowers/plans/2026-03-30-phase8c-persistent-workbench-auth.md`
- `docs/superpowers/plans/2026-03-30-phase8d-admin-governance-console.md`
- `docs/superpowers/plans/2026-03-30-phase8f-execution-resolution.md`
- `docs/superpowers/plans/2026-03-30-phase8g-agent-tooling-persistence.md`
- `docs/superpowers/plans/2026-03-30-phase8h-agent-tooling-admin-console.md`
- `docs/superpowers/plans/2026-03-31-phase8aa...` through `phase8z...`
- closely adjacent `docs/superpowers/plans/2026-03-31-phase9a-persistent-verification-ops-http.md`

Intended Phase 8 family goal:

- move core governance and workbench surfaces from demo-only or in-memory
  behavior into persistent HTTP-backed, operator-usable runtime
- deepen manuscript workbench usability, evidence visibility, handoff flow,
  browser QA, and release gating

### Actual Delivery Vehicles

Primary broad implementation vehicles:

- merge `d61f8e1` from `codex/phase8c-persistent-workbench-auth`
- merge `b12d3ea` from `codex/phase8c-persistent-workbench-auth`

Adjacent follow-up topic merges that still belong to the same general Phase 8
maturity window:

- merge `cedff21` from `codex/template-governance-draft-editing`
- merge `7afe7de` from `codex/template-governance-draft-editing`

Observed reality:

- the `phase8c` branch name no longer represented only workbench auth
- the implementation window absorbed a large number of adjacent slices,
  including governance persistence, admin console, execution evidence,
  manuscript workbench completion, browser release gate work, learning or
  knowledge handoff durability, and verification-ops persistence
- `phase9a` infrastructure was effectively delivered during this same broad
  window

### Phase 8 Inventory

The repository currently contains 29 Phase 8 plan slices:

- single-letter slices: `8a, 8b, 8c, 8d, 8f, 8g, 8h, 8i, 8j, 8k, 8l, 8m, 8n,
  8o, 8p, 8q, 8r, 8s, 8t, 8u, 8v, 8w, 8x, 8y, 8z`
- continuation slices after `8z`: `8aa, 8ab, 8ac, 8ad`
- currently unused single-letter label: `8e`

For architectural reading, Phase 8 should be grouped by capability instead of
naive lexical order:

- persistent runtime and auth foundation:
  `8a, 8b, 8c`
- admin governance, execution governance, and observability:
  `8d, 8f, 8g, 8h, 8i`
- learning review and knowledge-review handoff durability:
  `8aa, 8ab, 8ac, 8ad, 8y, 8z`
- manuscript workbench mainline and operator UX:
  `8j, 8k, 8l, 8m, 8n, 8o, 8p, 8q, 8r, 8s, 8v, 8x`
- browser QA and release gating:
  `8t, 8u, 8w`

This grouping is the preferred future interpretation because it matches the
system architecture more closely than the historical delivery containers.

### Normalized Interpretation

Going forward:

- `phase8` should be treated as an umbrella delivery phase, not a single narrow
  branch story
- each `phase8x` plan/spec file remains the canonical source for that slice's
  intended scope
- `phase8c` should be read as a historical delivery container name, not as a
  reliable scope label
- `phase9a` should be documented as phase-9-designated work that was delivered
  during the broader Phase 8 umbrella implementation window

## Repository-Wide Interpretation Rule After Reconciliation

After this document lands:

- the phrase "what Phase X means" should resolve to the relevant phase
  plan/spec file
- the phrase "how Phase X landed" should resolve to the merge history plus this
  reconciliation note
- phase boundary cleanup should remain documentation-only unless a future
  implementation bug requires real code correction

## README Follow-Up Required

After this document lands, `README.md` should be updated so that the "next batch
of work" section no longer implies that several already-shipped governance,
workbench, and evaluation capabilities are still untouched.

In particular:

- evaluation workbench depth should no longer be described as mostly future work
- persistent workbench or governance wiring should no longer be described as
  though it were largely undone
- execution evidence and governance observability should be reflected as
  partially shipped, not merely aspirational

## Review Guidance For Future Contributors

When opening a new phase:

- prefer one phase design file
- one phase implementation plan
- one focused implementation branch or PR
- one verification story tied to the new slice

The Phase 9Q / 9R / 9S / 9T pattern is the preferred model going forward.
