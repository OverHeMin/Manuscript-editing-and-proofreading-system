# Phase 10D Gold Set And Harness Ops Design

**Date:** 2026-04-04  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Deepen medical knowledge operations by turning reviewed snapshots, final human assets, and high-value governed evidence into curated gold sets, scoring rubrics, and reusable local harness datasets without changing live routing or making harness tools part of the production write path.

## 1. Goal

Phase 10D is the phase that makes later harness work trustworthy.

Its job is not to add more model automation.
Its job is to give the repository governed human-owned assets that later harness tools can evaluate against:

- gold-set families
- gold-set versions
- rubric definitions
- dataset publication history
- sampling and review queues

In one sentence:

`Phase 10D` should make human judgment legible and reusable so later local harness runs measure something real instead of scoring against accidental or drifting examples.

## 2. Why This Phase Exists

The repository already has important ingredients:

- reviewed case snapshots
- human final assets
- learning review and knowledge review governance
- `verification-ops` sample sets and evidence packs
- manuscript, template, and knowledge provenance

What is still missing is the operational layer between those ingredients and any serious harness program:

- there is no first-class gold-set object
- there is no versioned editorial rubric asset
- there is no governed publication flow from reviewed evidence to harness dataset
- there is no explicit distinction between:
  - learning candidates
  - knowledge-review candidates
  - harness-evaluation gold data

Without that layer, later Promptfoo, Ragas, or judge-reliability runs would still be evaluating against ad hoc exports rather than governed reference assets.

## 3. Recommended Option

Three approaches were considered.

### Option A: Keep harness datasets implicit inside `verification-ops` sample sets

Pros:

- smallest immediate schema surface

Cons:

- mixes human-governed reference assets with experiment execution assets
- makes rubric governance awkward
- weakens reuse across retrieval, prompt, and judge calibration flows

Not recommended.

### Option B: Add a dedicated gold-set and rubric governance layer

Pros:

- matches the repository's existing governed-asset pattern
- lets later harness tools consume one stable source of truth
- keeps human curation separate from automated experiment execution

Cons:

- adds a new module and operator workflow

Recommended.

### Option C: Rely on external dataset tooling as the source of truth

Pros:

- can move quickly if using a cloud or external evaluation platform

Cons:

- conflicts with the repository's local-first direction
- creates portability and compliance risk
- would let tool choice define governance shape

Out of scope.

## 4. Hard Boundaries

Phase 10D should stay inside five boundaries.

### 4.1 Human-governed assets first

This phase supports:

- gold-set curation
- rubric authoring and publication
- review queues
- dataset publication history

This phase does **not** support:

- automatic routing activation
- automatic model promotion
- autonomous learning writeback

### 4.2 Local-first only

The gold-set and rubric source of truth lives inside the repository runtime and storage.

This phase does **not** require:

- cloud dataset platforms
- cloud tracing platforms
- external annotation platforms as the primary system of record

### 4.3 No live production dependency

Production module execution must not depend on:

- a gold-set publication succeeding
- a rubric publication succeeding
- a later harness dataset export succeeding

This phase builds future harness inputs.
It does not become a runtime dependency for manuscript execution.

### 4.4 Evidence and learning remain separate

Gold-set governance may source from:

- reviewed case snapshots
- evaluation evidence
- human final assets

But it does not replace:

- learning-governance
- knowledge-review
- `verification-ops`

Those systems remain distinct lanes with explicit handoffs.

### 4.5 Human judgment remains authoritative

Phase 10D may store rubric structure and example anchors.
It must not claim that rubric publication removes the need for later human calibration.

## 5. Core Objects

Phase 10D should introduce a dedicated governed-asset layer for harness operations.

### 5.1 Gold Set Family

Groups a stable evaluation intent such as:

- screening decision quality
- proofreading issue detection
- template-family editing conformance
- retrieval grounding for a bounded domain slice

It answers:

- what kind of quality this gold set is meant to measure
- which module and manuscript-type scope it belongs to

### 5.2 Gold Set Version

A versioned, immutable published dataset payload containing:

- referenced snapshot or asset ids
- de-identification status
- manuscript type and risk tags
- optional expected structured outputs
- publication notes and provenance

### 5.3 Rubric Definition

A versioned scoring rubric that can be reused across local harness tools.

It should at minimum describe:

- scoring dimensions
- failure anchors
- pass/fail hard gates
- optional judge prompts
- examples of borderline decisions

### 5.4 Harness Dataset Publication

Audit records that show:

- which gold-set version was exported
- which tool format it targeted
- whether de-identification and publication gates passed

### 5.5 Review Sampling Batch

A bounded operator workload object that helps curate:

- candidate additions
- candidate removals
- stale examples
- conflict-resolution examples that need a stronger rubric

## 6. Phase Outcome

At the end of Phase 10D, the repository should have:

- governed gold-set families and versions
- governed rubric definitions
- a bounded workbench for curating and publishing those assets
- publication-ready local harness dataset exports

It should still **not** have:

- cloud-dependent harness operations
- automatic score-driven production changes
- a claim that harness metrics replace expert review

## 7. Manual Work That Remains Intentionally Human

Even after Phase 10D lands, the following remain human-owned:

- deciding what "good enough" means for a module
- resolving borderline medical or editorial disagreements
- deciding which reviewed examples deserve gold-set promotion
- recalibrating rubrics when model behavior or manuscript mix changes

That is intentional.
Phase 10D is meant to productize those human decisions, not erase them.

## 8. Related Capability Lane

This phase advances:

- `Medical Knowledge Ops`

It prepares later work in:

- `Phase 10E` retrieval-quality harness
- `Phase 10F` local-first harness adapter platform
