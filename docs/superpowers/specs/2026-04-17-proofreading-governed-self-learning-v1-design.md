# 2026-04-17 Proofreading Governed Self-Learning V1 Design

**Date**

2026-04-17

**Status**

Approved in conversation as the V1 baseline for governed self-learning in proofreading, with a shared backbone that later modules can reuse.

**Goal**

Add a first production-safe self-learning loop to the manuscript system without turning production execution into a black-box auto-evolving model system.

The V1 outcome is:

- proofreading keeps its current governed execution path
- the system adds one bounded residual-discovery pass after baseline governance execution
- newly found residual issues become structured evidence objects
- only validated and reviewed issues can become learning candidates
- learned value strengthens governed assets, not model parameters

## 1. Locked Product Decisions

### 1.1 Terminology

For this product, the following terms are locked:

- `system self-learning` means the system discovers new residual issues during execution, validates them, and writes approved value back into governed assets such as rules, knowledge, prompts, templates, or manual-review policy
- `model self-training` means feeding model outputs back into model training or automatic parameter updates

V1 includes `system self-learning`.

V1 explicitly excludes `model self-training`.

One sentence:

`V1 要做的是系统经验沉淀，不是模型参数自我训练。`

### 1.2 V1 ownership boundary

The self-learning loop sits between governed module execution and existing learning governance.

It does not replace:

- execution profiles
- runtime bindings
- model routing governance
- retrieval presets
- manual review policies
- rule center
- knowledge review

It adds one bounded layer:

- detect residual issues not already covered by current governance assets
- normalize them into structured issues
- score and route them
- validate them through Harness
- bridge approved value into the existing learning candidate and writeback path

### 1.3 First-wave module scope

V1 only activates residual self-learning for `proofreading`.

However, V1 must build the shared backbone in a module-agnostic way so later `editing` and `screening` can attach dedicated adapters instead of forcing a rewrite.

One sentence:

`V1 先在校对落地，但骨架不是校对私有实现。`

### 1.4 Runtime principle

Production execution remains two-stage:

1. run normal governed execution with current templates, rules, packages, prompt, and approved knowledge
2. run a bounded residual-discovery pass only on what the first stage did not already cover

The residual pass must not repeat already known hits as if they were new learning.

### 1.5 Learning boundary

Residual findings never auto-publish to live assets.

The maximum V1 automation is:

- create structured residual issues
- create routed learning candidates when thresholds are met
- prepare candidate-ready evidence for reviewers

The following still require governance approval:

- knowledge drafts
- rule drafts
- prompt or template drafts
- any live activation

## 2. Why This Design Exists

The product needs both governed execution and model freedom, but in different roles.

Current governed execution is strong at handling:

- known format rules
- approved medical knowledge
- bounded prompt guidance
- package-based quality checks
- manual review triggers

What it does not yet productize is a controlled way for the model to say:

`I found a meaningful problem that the current governed assets did not already cover.`

This design adds exactly that ability while keeping:

- auditability
- replayability
- rollback
- approval gates
- Harness-controlled validation

## 3. Final Architecture

V1 adds six shared backbone components.

### 3.1 Residual Discovery Runner

This component runs after proofreading completes its governed baseline pass.

It receives:

- source manuscript fragments or resolved blocks
- proofreading output artifacts
- quality findings
- failed checks
- manual review items
- knowledge hits
- applied or inspected rule context

Its only job is to ask:

`What meaningful issues remain that were not already covered by the current governed assets?`

It must not output direct live mutations.

### 3.2 Issue Normalizer

This component converts model findings into a stable `ResidualIssue` contract.

It prevents free-form suggestions from leaking directly into governance.

### 3.3 Confidence Engine

This component computes a system confidence band for every residual issue.

It must use more than model self-reported confidence.

It combines:

- model confidence
- evidence quality
- conflict signals
- repeatability
- risk level
- Harness validation result

### 3.4 Issue Router

This component decides where a residual issue belongs:

- rule candidate
- knowledge candidate
- prompt or template candidate
- manual-only handling
- evidence-only retention

### 3.5 Harness Gate

Harness becomes the validation gate for residual self-learning, not just a restriction surface.

It decides whether a residual issue is:

- too weak to learn from
- reviewable but not reusable
- reusable enough to become a governed candidate

### 3.6 Learning Bridge

This component bridges routed residual issues into the existing learning candidate and governed writeback path.

It must reuse the current learning lifecycle instead of introducing a second approval system.

## 4. Shared Backbone And Module Adapters

The backbone is shared.

The module logic is not.

Each mainline module will eventually provide its own adapter:

- `ProofreadingResidualAdapter`
- `EditingResidualAdapter`
- `ScreeningResidualAdapter`

Each adapter defines:

- issue taxonomy
- evidence extraction rules
- allowable routing targets
- module-specific confidence thresholds
- high-risk escalation rules

V1 implements only `ProofreadingResidualAdapter`.

## 5. Proofreading V1 End-To-End Flow

The proofreading self-learning loop should be:

1. resolve governed proofreading context
2. execute normal proofreading checks and quality packages
3. produce standard proofreading findings and artifacts
4. collect already-known governance hits from this run
5. invoke residual discovery with source blocks plus known-hit context
6. normalize raw findings into `ResidualIssue[]`
7. compute system confidence bands
8. route each issue to manual handling, evidence retention, or candidate creation
9. run Harness validation for candidate-eligible issues
10. create governed learning candidates only for validated routes
11. keep all candidate approval and writeback review-gated

The system should learn from the residue, not from the entire run indiscriminately.

## 6. ResidualIssue Contract

V1 should add a dedicated issue contract for learning-time decisions instead of overloading the runtime quality issue model.

Recommended fields:

| Field | Meaning |
| --- | --- |
| `id` | stable issue id |
| `module` | proofreading in V1 |
| `source_stage` | quality_engine / rule_residual / model_residual |
| `snapshot_id` | execution snapshot reference |
| `job_id` | source job reference |
| `asset_id` | output asset reference when relevant |
| `issue_type` | proofreading residual taxonomy key |
| `excerpt` | local text or table evidence |
| `location` | paragraph / sentence / table coordinate |
| `suggestion` | normalized fix or reviewer-facing suggestion |
| `rationale` | why the issue matters |
| `related_hits` | already-hit rules, knowledge, quality issues |
| `novelty_key` | dedupe and recurrence grouping key |
| `model_confidence` | raw model confidence |
| `system_confidence_band` | L0 / L1 / L2 / L3 |
| `risk_level` | low / medium / high / critical |
| `recommended_route` | rule / knowledge / prompt_template / manual_only / evidence_only |

### 6.1 Proofreading residual taxonomy

V1 proofreading issue types should stay narrow and operator-readable.

Recommended initial categories:

- `terminology_gap`
- `table_annotation_gap`
- `unit_expression_gap`
- `style_consistency_gap`
- `uncovered_local_language_issue`
- `medical_meaning_risk`
- `ambiguous_reviewer_escalation`

These are learning-time categories, not user-facing product marketing labels.

## 7. Confidence Model

### 7.1 Confidence inputs

System confidence must combine multiple signals:

- model self-confidence
- evidence specificity
- whether the issue conflicts with approved rules or knowledge
- whether the same novelty key appears across multiple runs
- whether Harness replay confirms similar behavior
- whether the issue affects medical meaning or high-risk scope

### 7.2 Confidence bands

V1 should use four system bands:

- `L0 observation`
  - weak evidence or one-off signal
  - retain only as evidence or operator note
- `L1 review_pending`
  - plausible issue but not reusable enough yet
  - route to manual review
- `L2 candidate_ready`
  - sufficiently evidenced and potentially reusable
  - may become a learning candidate
- `L3 strongly_reusable`
  - repeated, validated, low-conflict pattern
  - may auto-create a candidate draft, but still not auto-publish

### 7.3 High-risk override

Any proofreading residual issue that touches medical meaning, numerical meaning, or potentially unsafe semantic change must be forced upward to manual review even when model confidence is high.

One sentence:

`高置信度不等于高可自动化度。`

## 8. Routing Rules

Residual issues must not all be forced into rule center or knowledge review.

V1 routing options:

- `rule_candidate`
  - for executable, repeatable, operationalized proofreading behaviors
- `knowledge_candidate`
  - for reusable evidence, terminology rationale, or reviewer guardrail knowledge
- `prompt_or_template_candidate`
  - for guidance improvements that should influence model behavior but not become hard rules
- `manual_only`
  - for one-off, contextual, or high-risk cases
- `evidence_only`
  - for storage, clustering, and later analysis without immediate candidate creation

### 8.1 Rule candidate fit

Residual issues fit rule candidates when they are:

- structurally repeatable
- low-context
- operationally checkable
- likely to recur across manuscripts

### 8.2 Knowledge candidate fit

Residual issues fit knowledge candidates when they are:

- evidence-like
- explanation-heavy
- exception-sensitive
- useful as reference or guardrail

### 8.3 Prompt or template fit

Residual issues fit prompt or template candidates when they are:

- valuable but not stable enough for executable rules
- recurring model-behavior gaps
- better solved through instruction framing than hard enforcement

### 8.4 Manual-only fit

Residual issues stay manual-only when they are:

- high medical semantic risk
- strongly case-specific
- not repeatable
- under-evidenced

## 9. Harness Responsibilities

Harness is the controlled validator for self-learning V1.

### 9.1 Harness controls remain active

Residual self-learning must continue to respect:

- execution profile
- runtime binding
- model routing policy version
- retrieval preset
- manual review policy

### 9.2 Harness as validator

Harness should validate candidate-eligible residual issues by:

- replaying them against bounded datasets
- checking recurrence and stability
- comparing outcomes under current and candidate environments
- surfacing rollback-safe environment previews

### 9.3 Harness thresholds

Proofreading V1 should keep conservative thresholds.

Examples:

- lower confidence issues should stop at evidence-only or manual review
- repeated low-risk issues may become rule candidates
- medical meaning risk should remain manual-first regardless of recurrence

## 10. V1 Scope

### 10.1 Included

V1 includes:

- shared governed self-learning backbone
- proofreading-only residual adapter
- structured `ResidualIssue`
- multi-signal confidence bands
- Harness-gated validation
- review-gated candidate creation
- routes for rule candidate, knowledge candidate, manual-only, and evidence-only

### 10.2 Excluded

V1 does not include:

- editing residual self-learning activation
- screening residual self-learning activation
- model fine-tuning or any parameter update loop
- auto-publishing live rules or live knowledge
- full cross-module residual sharing
- mandatory auto-routing of every issue into a governed asset

## 11. Growth Path After V1

The expected order after V1 is:

1. reuse the same backbone for `editing`
2. add an editing-specific taxonomy and Harness thresholds
3. later add `screening` with stricter medical-risk routing

This sequence minimizes risk while preserving one learning architecture.

## 12. Acceptance Criteria

The design is satisfied when V1 can truthfully claim:

- proofreading executes normal governed behavior first
- a bounded residual-discovery pass runs second
- residual findings are stored as structured issues rather than loose prose
- system confidence is derived from multiple signals, not model confidence alone
- Harness can validate candidate-eligible residual findings
- only validated and reviewed findings become governed candidates
- no step in the loop updates model parameters
- no step in the loop auto-publishes live governance assets

## 13. One-Sentence Product Definition

`Proofreading governed self-learning V1` means:

`系统在校对执行后，对现有规则、知识和质量包未覆盖的残差问题进行模型发现，经结构化提炼、组合置信度分级、Harness 验证和人工审核后，沉淀为受治理的候选资产。`
