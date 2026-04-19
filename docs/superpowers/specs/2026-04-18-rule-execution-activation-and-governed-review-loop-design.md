# 2026-04-18 Rule Execution Activation And Governed Review Loop Design

**Date**

2026-04-18

**Status**

Approved in conversation, implementation starting in the same session.

**Goal**

Make rule-center governance start from real editing and proofreading execution hits instead of only from downstream review queues, while keeping the rollout bounded and truthful.

## 1. Why This Design Exists

The current codebase already has three important foundations:

- governed execution can resolve active rules, prompts, knowledge, model routing, and runtime bindings
- editing already records deterministic rule changes and `tableInspectionFindings`
- proofreading already records `failedChecks`, `manualReviewItems`, `qualityFindings`, and residual issues

What is still incomplete is the bridge between those execution results and the operator-facing governance loop:

- some real rule hits are stored in job payloads but do not become first-class high-risk review entries
- editing-side table hits are especially under-exposed
- proofreading-side nested quality findings are not consistently surfaced as review-ready evidence
- the next-stage governance story therefore still feels more queue-first than execution-first

## 2. Next-Stage Scope Map

The full next stage is divided into five buckets:

### 2.1 Execution Layer

- rules must actually hit during editing and proofreading execution
- structured table and format rules must be recognized by deterministic services, not only by downstream review copy
- execution outputs must preserve machine-usable evidence, location, and suggested action

### 2.2 Table And Format Recognition Layer

- table semantic hits must stay structured
- format hits must be explainable and traceable
- risky table findings must route to human confirmation instead of pretending to be safely auto-applied

### 2.3 Governance Loop Layer

- high-risk hits should produce candidate modifications or inspect-only findings
- operators should be able to confirm, reject, or route those findings
- approved value should continue into learning candidate creation and governed writeback

### 2.4 Rule-Center Platform Layer

- rule center needs stronger rule-engine explainability, draft writeback continuity, and clearer governance operating posture

### 2.5 Activation And Observability Layer

- once rules start firing in production workflows, the system needs activation scope, rollback posture, metrics, and Harness-backed regression confidence

## 3. This Iteration's Boundaries

This session starts with the smallest truthful P0 slice that unlocks the later buckets:

- promote real execution hits into the manuscript workbench high-risk review flow
- treat editing `tableInspectionFindings` as first-class governed review evidence
- treat proofreading nested `qualityFindings` as first-class governed review evidence
- preserve document location, semantic hit coordinates, suggestion, rationale, and related rule ids so the existing review submission path can use them

This iteration does **not** yet do the following:

- auto-create review-item records in the database from execution hits
- auto-route execution hits directly into rule-center unified review without operator confirmation
- expand the deterministic rule DSL beyond the currently shipped trigger/action families
- add new rule-center dashboards or online Harness regression panels

## 4. Locked Product Decisions For P0

### 4.1 Execution Payload Is The First Activation Source

For this phase, the canonical source of truth is the latest module job payload:

- editing payload fields such as `manualReviewItems`, `contentRuleCandidates`, `qualityFindings`, `appliedChanges`, and `tableInspectionFindings`
- proofreading payload fields under `proofreadingFindings`

We do not need a new queue to prove the activation path. We first need the workbench to stop dropping real hits on the floor.

### 4.2 Editing Table Inspection Hits Are High-Risk Review Inputs

`tableInspectionFindings` are not passive metadata. They are real governed findings that should become operator-visible review cards with:

- title
- excerpt or matched evidence
- semantic location
- related rule ids
- suggestion and rationale when present

### 4.3 Proofreading Nested Quality Findings Must Surface Uniformly

If proofreading stores `qualityFindings` inside `proofreadingFindings`, the workbench should treat them the same way it already treats top-level high-risk review sources.

### 4.4 Manual Review Submission Remains The Gate In P0

The existing review-item submission flow remains human-triggered in this slice:

- workbench shows the hit
- operator chooses `提交复核` or `仅记录人工处理`
- downstream rule-center and learning review continue unchanged

This keeps the rollout safe while making the execution layer truthful.

## 5. Implementation Shape

P0 changes only three areas:

### 5.1 Manuscript Workbench High-Risk Extraction

- extend high-risk extraction to include editing `tableInspectionFindings`
- extend high-risk extraction to include proofreading nested `qualityFindings`

### 5.2 Manuscript Workbench Evidence Summary

- include those same sources when summarizing rule-hit evidence so operators can see that a run actually triggered governed checks

### 5.3 Test Locking

- add focused web tests that fail before implementation and prove these sources now surface correctly

## 6. Acceptance Criteria

This P0 slice is complete when all of the following are true:

- editing runs with `tableInspectionFindings` show high-risk review cards in the manuscript workbench
- those cards include semantic location when available
- proofreading runs with nested `qualityFindings` also produce high-risk review cards
- operator-facing evidence summaries no longer hide those sources
- existing review submission actions continue to work without new UI branching

## 7. Follow-On Work After P0

The next safe order after this slice is:

1. auto-persist execution-born governed hits into review-items
2. deepen deterministic rule recognition for richer format and table families
3. add writeback/rollback/metrics/Harness observability around live rule activation
