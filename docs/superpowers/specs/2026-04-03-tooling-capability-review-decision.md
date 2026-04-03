# Tooling And Capability Review Decision

**Date:** 2026-04-03  
**Status:** Approved decision baseline for long-term platform retention  
**Purpose:** Freeze which tooling-related platform capabilities must remain on the long-term roadmap, which concrete implementation routes are currently preferred, and which routes may change without deleting the underlying capability.

## 1. Why This Document Exists

The repository has reached a point where two different ideas must be separated:

- a long-term platform capability that the system must eventually implement
- a specific external tool, framework, or reference project that may be used to implement that capability

Historically, some early design documents mixed those two layers together.
That created a real risk:

- if the team stopped mentioning a specific tool name, the capability itself could quietly disappear
- if the team kept every tool name as if it were a hard promise, the roadmap could become bloated and ambiguous

This document resolves that ambiguity.

Its job is to prevent future planning from confusing:

- `must eventually exist`
- `currently preferred route`
- `can be replaced later`

## 2. Decision Summary

This review adopts one explicit rule:

> We preserve long-term platform capabilities as hard commitments.  
> We do not treat every historical tool name as an irreversible implementation lock.

From now on, every major tooling decision must be expressed in three layers:

1. `Long-term required capability`
2. `Current preferred implementation route`
3. `Replaceable or adjustable route`

This means:

- platform capability must not disappear just because a later phase does not mention a tool by name
- implementation routes can evolve, but only if the underlying capability remains preserved
- future plans should reference this document when adding, replacing, delaying, or narrowing tooling scope

## 3. The Three-Layer Commitment Model

### 3.1 Layer One: Long-Term Required Capability

This is the hard commitment layer.

If a capability is listed here, the system should eventually implement it.
It may be delivered in later phases, but it should not be silently dropped.

Examples:

- vector and hybrid retrieval capability
- medical knowledge operations capability
- agent runtime adapter capability
- tool or MCP gateway capability
- prompt and skill registry capability
- production operations and security capability

### 3.2 Layer Two: Current Preferred Implementation Route

This is the current default route.

It answers:

- what tool or implementation family we expect to use first
- what the repo should bias toward when the capability is eventually implemented

This layer is important, but it is not a permanent lock.

### 3.3 Layer Three: Replaceable Or Adjustable Route

This is the flexibility layer.

It allows implementation changes without deleting capability intent.

A route may change only if all of the following remain true:

- the capability remains explicitly preserved
- the replacement is named
- the reason for replacing the route is documented
- scope, risk, and migration impact are made explicit

This layer exists to keep the roadmap adaptable without losing strategic commitments.

## 4. Long-Term Required Capabilities

The following capability groups are now treated as long-term required platform commitments.

### 4.1 Knowledge Retrieval Stack

The system must eventually implement:

- structured filtering
- full-text retrieval
- vector retrieval
- hybrid retrieval
- reranking
- template knowledge-pack recall
- retrieval quality evaluation

This capability must survive even if the chosen vector backend changes later.

### 4.2 Medical Knowledge Ops

The system must eventually implement:

- knowledge draft creation and editing
- review and approval workflow
- version governance
- template binding
- source tracking
- deduplication
- expiry and supersession governance
- periodic review workflow
- bulk ingest support
- operations-facing knowledge workbench views

This capability is not optional because the knowledge layer is one of the system's long-term differentiators.

### 4.3 Agent Runtime Platform

The system must eventually implement:

- agent runtime adapter boundary
- tool or MCP gateway
- prompt registry
- skill registry
- runtime binding
- sandbox policy
- tool permission policy
- execution logging and audit evidence

This capability is already partially present and must continue to deepen rather than regress into local-tool dependence.

### 4.4 Evaluation And Verification Platform

The system must eventually implement:

- verification checks
- evaluation suites
- governed run creation and execution
- evidence packs
- release-gate verification
- benchmark and canary style verification surfaces
- comparison and long-term operator analysis

This capability should become a durable platform rather than a set of isolated commands.

### 4.5 Execution And Orchestration Platform

The system must eventually implement:

- asynchronous execution orchestration
- retry and recovery semantics
- durable long-running task handling
- restart-safe execution flows
- incident-friendly observability for execution state

This remains a required future platform layer even though the repository is not there yet.

### 4.6 Production Operations And Security Platform

The system must eventually implement:

- deploy gate discipline
- readiness and health contract
- rollback and restore discipline
- production maintenance workflows
- secret and key management hardening
- upgrade choreography
- migration automation
- security review and operational hardening

`Phase 10A` is only the first step in this longer required capability line.

## 5. Current Preferred Implementation Routes

The table below captures the current preferred routes.

| Capability Group | Current Preferred Route | Current Repo State | Decision |
|------|--------------------------|--------------------|----------|
| Knowledge Retrieval Stack | `PostgreSQL + pgvector` | Postgres is in place; pgvector retrieval is not yet implemented | Keep as preferred route |
| Medical Knowledge Ops | Yuxi-style knowledge workbench structure and ops flow, implemented inside the system's own governance surfaces | Knowledge review and governance exist; full knowledge ops depth is not finished | Keep as preferred reference route |
| Agent Runtime Platform | Internal governance registry plus adapter-based runtime integration inspired by `deepagents` | Registry, runtime binding, tool policy, and execution evidence are already partially live | Keep and continue |
| Prompt / Skill Platform | Keep the repo-owned Prompt / Skill Registry as the source of truth; absorb packaging ideas from `agency-agents` | Already implemented at registry level | Keep and deepen |
| Evaluation / Verification Platform | Continue extending the current verification-ops stack and release-gate path | Already partially live through Phase 9R / 9S / 9T | Keep and deepen |
| Execution And Orchestration Platform | Plan for durable orchestration with `Temporal` as the current preferred route | Not yet implemented at full platform depth | Keep as preferred future route |
| Human Review / Annotation Support | Keep core governance review inside the main system; use `Label Studio` only for specialized annotation scenarios | Core review surfaces exist; external annotation integration is not yet formalized | Keep as conditional route |
| Privacy And Compliance Gate | `Presidio` as the current preferred privacy gate route | Not yet integrated as a first-class system gate | Keep as preferred future route |
| Academic Structure And PDF Enhancement | `OCRmyPDF + PaddleOCR + GROBID` | OCR-related direction exists; full enhancement stack is not fully integrated | Keep as preferred route set |

## 6. Replaceable Or Adjustable Routes

The following rules define how flexibility should be interpreted.

### 6.1 `pgvector`

`pgvector` is the current preferred route for vector retrieval because the repository already centers on PostgreSQL.

Decision:

- keep `pgvector` as the preferred route
- do not treat it as the capability itself
- replacing it later is allowed only if vector and hybrid retrieval remain explicitly preserved

### 6.2 `Yuxi`

`Yuxi` is kept as a high-value reference route for:

- knowledge workbench structure
- RAG or knowledge-ops workflow design
- agent operations backstage thinking

Decision:

- keep `Yuxi` as a first-class reference route
- do not require direct whole-project embedding of Yuxi into the main system
- the hard commitment is to implement the capability that Yuxi currently represents well

### 6.3 `deepagents`

`deepagents` remains the current preferred inspiration for runtime adapter and bounded execution style.

Decision:

- keep it as a preferred runtime-integration route
- do not let it replace the repository's own governance truth
- allow later runtime substitution only if adapter boundaries remain intact

### 6.4 `agency-agents`

`agency-agents` remains useful mainly as a packaging and organization reference.

Decision:

- keep it as a reference route for role-card and skill-package structuring
- do not elevate it into the system's total control model

### 6.5 `Temporal`

`Temporal` remains the preferred orchestration route for the future durable execution platform.

Decision:

- keep it as the current preferred route
- delay implementation to a later orchestration-focused phase
- do not allow later planning to quietly delete async orchestration just because Temporal is not yet integrated

### 6.6 `Label Studio`

`Label Studio` remains useful for specialized human-review or annotation tasks.

Decision:

- keep it as a candidate route
- do not make it the required core knowledge-governance surface
- the hard commitment is human-review capability, not this exact product

### 6.7 `Presidio`

`Presidio` remains the preferred current route for privacy and de-identification checks.

Decision:

- keep it as the preferred route
- do not let privacy-gate capability disappear if Presidio integration is deferred

### 6.8 `GROBID`

`GROBID` remains a preferred academic-structure enhancement route.

Decision:

- keep it in the formal future route set
- treat it as replaceable if another academic-structure parser later proves better

## 7. What This Review Does Not Delete

This review does **not** delete the following strategic directions:

- vector retrieval
- hybrid retrieval
- medical knowledge operations workbench depth
- external runtime integration through adapters
- evaluation and verification platformization
- durable orchestration
- privacy gate hardening
- academic document-structure enhancement

In other words, this review is not a scope-reduction document.
It is a scope-preservation document with route clarification.

## 8. Delivery Implication

Choosing to retain and eventually implement all of the above capability groups has a real roadmap consequence.

This decision implies:

- the system is committing to a longer platform-building horizon
- `Phase 10A` should stay bounded to production operations baseline and should not absorb these deeper capability lines
- additional future phases will be required for:
  - retrieval stack completion
  - knowledge-ops depth
  - durable orchestration
  - privacy and compliance hardening
  - deeper verification and release operations

This is intentional.

The team is choosing:

- stronger long-term platform completeness

over:

- pretending these capabilities can stay forever as loose references

## 9. Governance Rule For Future Plans

Any future plan that touches tooling, integrations, agent runtime, retrieval, knowledge operations, evaluation, orchestration, or operational hardening should state which of the following it is doing:

1. implementing a long-term required capability
2. advancing the current preferred route
3. replacing the current preferred route
4. deferring work without deleting the capability

Plans should not silently collapse one category into another.

## 10. Expected Outcome

After this document lands, the repository should have a durable answer to the question:

> "If we stop mentioning this tool, are we also deleting the capability?"

The answer should be:

- `No`, if the capability is listed in Section 4
- `Maybe`, if only the implementation route changes and the replacement is documented

That is the intended outcome of this review.
