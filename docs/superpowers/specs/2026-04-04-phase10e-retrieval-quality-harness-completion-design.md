# Phase 10E Retrieval Quality Harness Completion Design

**Date:** 2026-04-04  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Complete the repository retrieval substrate with `PostgreSQL + pgvector`, retrieval snapshots, template knowledge-pack recall, and local-first Ragas-backed retrieval evaluation without making cloud embeddings or cloud evaluation platforms required.

## 1. Goal

Phase 10E is the phase that makes retrieval quality explicit, testable, and governable.

Its job is not to replace knowledge review.
Its job is to let the repository answer:

- what the retriever saw
- why it returned those knowledge items
- whether retrieval quality is improving or regressing

In one sentence:

`Phase 10E` should complete the retrieval substrate and pair it with local retrieval-quality harnesses so the system can improve knowledge grounding with evidence instead of intuition.

## 2. Current Baseline

The repository already has:

- governed knowledge items
- template bindings
- learning writeback
- provenance and review history
- phase mapping that explicitly reserves `PostgreSQL + pgvector` for retrieval completion

What is still missing is the actual retrieval-quality platform:

- no vector storage
- no hybrid retrieval layer
- no reranking
- no retrieval snapshot object
- no local retrieval-eval runner
- no first-class retrieval-quality history tied to curated gold data

That means the knowledge layer exists, but the retrieval layer is still mostly conceptual.

## 3. Recommended Option

### Option A: Add vector retrieval only

Pros:

- smaller first step

Cons:

- does not prove whether retrieval is actually better
- leaves evaluation and grounding quality implicit

Not recommended.

### Option B: Ship retrieval substrate and local evaluation together

Pros:

- lets retrieval improvements be measured immediately
- matches the repository's governed-evidence direction
- keeps retrieval quality local-first

Cons:

- wider first implementation slice

Recommended.

### Option C: Use an external hosted retrieval platform

Pros:

- can move quickly if using a managed vendor stack

Cons:

- conflicts with local-first and portability goals
- would blur data-boundary rules

Out of scope.

## 4. Hard Boundaries

### 4.1 Local-first only

This phase may use locally hosted or self-managed embedding and evaluation services.
It must not require cloud embedding APIs or cloud evaluation platforms.

### 4.2 Retrieval is evidence, not policy

Retrieval-quality results may later inform template, knowledge, or routing decisions.
They do not directly activate production changes in this phase.

### 4.3 Knowledge publication remains separate

Poor retrieval quality may produce recommendations.
It must not auto-publish knowledge changes.

### 4.4 Snapshot before score

Every retrieval evaluation must be tied to a reproducible retrieval snapshot:

- query context
- retrieved items
- rerank ordering
- scores and metadata

### 4.5 Human grounding remains authoritative

Ragas and local metrics can help detect drift.
They do not replace later human review of high-risk grounding failures.

## 5. Core Objects

### 5.1 Retrieval Index Entry

Represents an embedded, searchable representation of a knowledge item or bounded passage.

### 5.2 Retrieval Snapshot

Captures one retrieval attempt, including:

- manuscript context
- module and template scope
- query payload
- retrieved candidates
- reranked order

### 5.3 Retrieval Quality Run

A local evaluation run over published gold data that records:

- dataset version
- retriever configuration
- reranker configuration
- metric outputs

### 5.4 Retrieval Recommendation

A bounded recommendation object that can later point operators toward:

- missing template bindings
- weak embeddings
- reranking regressions
- stale knowledge packs

## 6. Tooling Direction

This phase should prefer:

- `PostgreSQL + pgvector`
- local embedding providers
- local reranking where available
- `Ragas` as the primary retrieval-evaluation harness

This phase may additionally prepare export hooks for later harness tools, but `Ragas` is the primary driver here.

## 7. Manual Work That Remains Human

Even after Phase 10E lands, these still require human judgment:

- deciding which retrieval misses matter clinically or editorially
- deciding whether a missed item reflects a data, ranking, or rubric problem
- deciding which knowledge-pack changes should be published

## 8. Related Capability Lane

This phase advances:

- `Knowledge Retrieval Stack`

It builds directly on:

- `Phase 10D` gold-set and rubric operations

It prepares later work in:

- `Phase 10F` harness adapter and judge reliability hardening
