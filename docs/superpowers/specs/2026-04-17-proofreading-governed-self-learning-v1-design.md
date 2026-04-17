# 2026-04-17 Proofreading Governed Self-Learning V1 Design

**Date**

2026-04-17

**Status**

Regenerated on a clean branch after the final product discussion. This is the agreed V1 baseline for governed self-learning in proofreading.

**Goal**

Add a first production-safe self-learning loop to proofreading so the system can discover meaningful issues beyond the current rule, knowledge, and quality-package coverage, without turning the product into a black-box self-training model system.

**V1 Promise**

Proofreading keeps its current governed execution path, adds one bounded residual-discovery pass after that governed pass, stores those findings as structured residual issues, validates reusable findings through Harness, and only then lets approved findings enter the existing governed learning and writeback path.

## 1. Locked Product Decisions

### 1.1 System self-learning, not model self-training

For this product:

- `system self-learning` means the system discovers residual issues during governed execution, validates them, and writes approved value back into governed assets such as rules, knowledge, prompts, templates, or manual-review policy
- `model self-training` means feeding model outputs back into model training or automatic parameter updates

V1 includes `system self-learning`.

V1 explicitly excludes `model self-training`.

### 1.2 Proofreading only for activation, shared backbone for architecture

V1 activates self-learning only for `proofreading`.

V1 still builds the backbone in a shared way so `editing` and `screening` can later add their own adapters instead of forcing a rewrite.

### 1.3 Governed execution remains first-class

Self-learning does not replace:

- execution profiles
- runtime bindings
- model routing governance
- retrieval presets
- manual review policies
- rule center
- knowledge library
- learning governance writebacks

It adds one bounded layer after governed execution:

- detect residual issues not already covered by current governed assets
- normalize them into stable records
- score and route them
- validate candidate-eligible findings through Harness
- bridge only approved value into the existing learning-governance flow

### 1.4 No auto-publish to live assets

Residual findings may produce evidence, queues, and draft candidates.

Residual findings must not:

- publish live rules
- publish live knowledge
- update live prompt templates
- update live module templates
- alter model parameters

All writeback remains review-gated.

### 1.5 Harness is a validation gate, not a decoration layer

Harness is not only a constraint surface for runtime selection.

In V1, candidate-eligible residual findings must pass through a Harness-backed validation path before the system can create governed learning candidates from them.

## 2. Why This Design Exists

The current system is strongest when a problem is already covered by:

- deterministic or authored rules
- approved knowledge
- governed prompts and skill packages
- quality packages
- manual review policy

What the product still lacks is a controlled way for the model to say:

`There is still a meaningful proofreading problem here, and the current governed assets did not already cover it.`

That missing lane matters because the user wants the system to do two things at once:

- stay governed and auditable
- still benefit from the model's residual problem-finding ability outside the current asset envelope

This design adds exactly that lane, while keeping:

- traceability
- replayability
- rollback
- review gates
- truthful system boundaries

## 3. Existing Repo Anchors

This design is intentionally additive. The repo already contains the core governance building blocks we need.

### 3.1 Governed context resolution already exists

`apps/api/src/modules/shared/governed-agent-context-resolver.ts` already resolves:

- execution profile
- runtime binding
- runtime
- sandbox profile
- agent profile
- tool permission policy
- retrieval snapshot
- runtime-binding readiness

V1 must reuse that governed context instead of inventing a separate self-learning runtime context.

### 3.2 Proofreading already records governed execution evidence

`apps/api/src/modules/proofreading/proofreading-service.ts` already:

- resolves governed proofreading context
- runs proofreading inspection and quality packages
- records execution snapshots
- records knowledge hits
- links agent execution logs to execution snapshots

This is the natural insertion point for the proofreading residual-learning hook.

### 3.3 Execution tracking already stores the baseline snapshot

`apps/api/src/modules/execution-tracking/execution-tracking-service.ts` already stores:

- execution snapshot identity
- template and prompt lineage
- skill package lineage
- model lineage
- knowledge-hit logs
- quality-finding summary

Residual learning should reference this snapshot, not duplicate it.

### 3.4 Learning governance already owns reviewed writeback

The current learning stack already supports:

- governed learning candidate creation in `apps/api/src/modules/learning/learning-service.ts`
- governed provenance links in `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- review-gated writeback in `apps/api/src/modules/learning-governance/learning-governance-service.ts`

V1 must bridge into this path rather than creating a second approval system.

### 3.5 Harness already owns environment control and evaluation operations

The current Harness stack already supports:

- environment preview and activation in `apps/api/src/modules/harness-control-plane/harness-control-plane-service.ts`
- governed evaluation seeding and evidence packs in `apps/api/src/modules/verification-ops/verification-ops-service.ts`

V1 should reuse this platform, but it must honestly add the missing residual-validation capability instead of pretending current verification check types already cover proofreading residual issues.

## 4. Truthful Gap Assessment

The repo is close enough to support V1, but three gaps are real and must be modeled explicitly.

### 4.1 There is no first-class residual-issue store yet

Today the system records governed execution snapshots and learning candidates, but not the intermediate residual observations that sit between them.

V1 must add a dedicated persistent residual-issue ledger.

### 4.2 The current learning candidate path does not truthfully represent residual provenance

Today governed learning provenance supports:

- `human_feedback`
- `evaluation_experiment`
- `reviewed_case_snapshot`

Residual issues discovered directly from live proofreading execution are none of those.

V1 must add a new provenance kind for residual observations instead of pretending they were reviewed snapshots or human feedback.

### 4.3 The current Harness verification types do not validate proofreading residual issues

Today verification check types are oriented around:

- browser QA
- benchmark
- deploy verification
- retrieval quality

That is not enough to validate whether a proofreading residual issue is reproducible, well-evidenced, and safe to learn from.

V1 must add a dedicated residual-validation check type for Harness.

## 5. Final V1 Architecture

V1 adds six backbone components.

### 5.1 Residual Discovery Runner

Runs after the normal governed proofreading pass completes.

It receives:

- resolved source blocks
- proofreading failed checks
- manual-review items
- risk items
- quality findings
- knowledge hits
- governed context identifiers
- execution snapshot identifiers

Its question is narrowly scoped:

`What meaningful proofreading issues remain that were not already covered by the current governed assets or baseline findings?`

It must not mutate live governed assets.

### 5.2 Issue Normalizer

Converts model output into a stable `ResidualIssueRecord`.

This prevents free-form AI prose from flowing directly into governance.

### 5.3 Confidence Engine

Computes a system confidence band from multiple signals, not only model self-confidence.

### 5.4 Issue Router

Routes each residual issue into one of five destinations:

- `rule_candidate`
- `knowledge_candidate`
- `prompt_template_candidate`
- `manual_only`
- `evidence_only`

### 5.5 Harness Gate

Runs residual validation on candidate-eligible issues and records whether the issue is reusable enough to learn from.

### 5.6 Learning Bridge

Creates governed learning candidates only after routing and Harness validation succeed.

It reuses the current learning and writeback flow, but extends it with truthful residual provenance.

## 6. New Core Contracts

### 6.1 Residual issue record

V1 adds a dedicated persistent record instead of overloading the runtime quality issue contract or the learning candidate contract.

Recommended shape:

| Field | Meaning |
| --- | --- |
| `id` | stable residual issue id |
| `module` | `proofreading` in V1 |
| `manuscript_id` | manuscript reference |
| `manuscript_type` | manuscript type at discovery time |
| `job_id` | source job reference |
| `execution_snapshot_id` | governed execution snapshot reference |
| `agent_execution_log_id` | governed agent log reference when available |
| `output_asset_id` | output asset tied to the governed source |
| `execution_profile_id` | execution profile lineage |
| `runtime_binding_id` | runtime binding lineage |
| `prompt_template_id` | prompt template lineage |
| `retrieval_snapshot_id` | retrieval snapshot lineage when available |
| `issue_type` | proofreading residual taxonomy key |
| `source_stage` | `quality_engine`, `rule_residual`, or `model_residual` |
| `excerpt` | localized evidence text |
| `location` | paragraph, sentence, or table coordinates |
| `suggestion` | normalized reviewer-facing suggestion |
| `rationale` | why the issue matters |
| `related_rule_ids` | already-hit or nearby rule ids |
| `related_knowledge_item_ids` | already-used knowledge ids |
| `related_quality_issue_ids` | baseline quality issue ids |
| `novelty_key` | dedupe and recurrence grouping key |
| `recurrence_count` | how often the same novelty key recurs |
| `model_confidence` | raw model confidence |
| `signal_breakdown` | multi-signal confidence inputs |
| `system_confidence_band` | `L0`, `L1`, `L2`, `L3` |
| `risk_level` | `low`, `medium`, `high`, `critical` |
| `recommended_route` | rule, knowledge, prompt template, manual only, evidence only |
| `status` | observed lifecycle state |
| `harness_validation_status` | not_required, queued, passed, failed |
| `harness_run_id` | Harness run reference when used |
| `harness_evidence_pack_id` | evidence pack reference when created |
| `learning_candidate_id` | downstream learning candidate when created |
| `created_at` | creation time |
| `updated_at` | update time |

### 6.2 Residual confidence bands

V1 uses four bands:

- `L0_observation`
- `L1_review_pending`
- `L2_candidate_ready`
- `L3_strongly_reusable`

These are system bands, not model-reported labels.

### 6.3 Residual provenance kind

V1 adds a new governed provenance kind:

- `residual_issue`

This is required so learning candidates created from live residual observations do not masquerade as human feedback or reviewed snapshots.

### 6.4 First-class knowledge candidate type

The current learning candidate model has no truthful first-class `knowledge_candidate`.

Using `case_pattern_candidate` for residual knowledge writeback would blur the product boundary again.

V1 therefore adds:

- `knowledge_candidate`

This keeps routing, review copy, and writeback targets honest.

## 7. Proofreading Residual Taxonomy

V1 keeps the initial taxonomy narrow and operator-readable.

Recommended issue types:

- `terminology_gap`
- `table_annotation_gap`
- `unit_expression_gap`
- `style_consistency_gap`
- `uncovered_local_language_issue`
- `medical_meaning_risk`
- `ambiguous_reviewer_escalation`

These are learning-time issue types, not user-facing marketing labels.

## 8. Proofreading V1 End-To-End Flow

The end-to-end flow is:

1. resolve governed proofreading context
2. run the current governed proofreading pass
3. record the normal execution snapshot and baseline findings
4. collect known-governed coverage from rules, knowledge hits, and quality findings
5. run the proofreading residual discovery pass on the same governed source
6. normalize the output into `ResidualIssueRecord[]`
7. dedupe by `novelty_key` and update recurrence counts
8. compute system confidence bands
9. route each issue into rule, knowledge, prompt-template, manual-only, or evidence-only
10. send candidate-eligible issues through Harness residual validation
11. create governed learning candidates only for routed issues that satisfy the V1 gate
12. leave approval and writeback on the existing review path

The system learns from the residual delta, not from the entire run indiscriminately.

## 9. Confidence Model

### 9.1 Confidence inputs

System confidence must combine:

- model self-confidence
- evidence specificity
- conflict with approved rules or approved knowledge
- recurrence of the same `novelty_key`
- whether the same issue was already covered by the baseline governed pass
- Harness validation result
- issue risk level

### 9.2 High-risk override

Any residual issue that may affect:

- medical meaning
- numeric meaning
- unsafe semantic change

must be forced to `manual_only` or `evidence_only`, even if the model is confident.

High confidence is not the same thing as safe automation.

## 10. Routing Rules

### 10.1 Rule candidate

Use when the issue is:

- repeatable
- operationally checkable
- low-context
- likely to recur across manuscripts

Bridge target:

- learning candidate type `rule_candidate`
- writeback target `editorial_rule_draft`

### 10.2 Knowledge candidate

Use when the issue is:

- explanation-heavy
- exception-sensitive
- better represented as reusable knowledge than as an executable rule

Bridge target:

- learning candidate type `knowledge_candidate`
- writeback target `knowledge_item`

### 10.3 Prompt-template candidate

Use when the issue is:

- useful but not stable enough for a hard rule
- a recurring model-behavior gap
- better solved through instruction framing than through executable logic

Bridge target in V1:

- route family `prompt_template_candidate`
- materialized learning candidate type `prompt_optimization_candidate`
- writeback target `prompt_template`

### 10.4 Manual-only

Use when the issue is:

- high-risk
- strongly case-specific
- under-evidenced
- not reusable enough to justify learning

### 10.5 Evidence-only

Use when the issue should be retained for clustering and later analysis but is not ready for immediate action.

## 11. Harness Responsibilities

### 11.1 Harness environment governance still applies

Residual self-learning continues to respect the active:

- execution profile
- runtime binding
- model routing policy version
- retrieval preset
- manual review policy

### 11.2 V1 adds a residual-validation check type

V1 must add one Harness verification check type dedicated to residual validation.

Its purpose is to answer:

- is this residual issue reproducible on the governed source?
- is the evidence specific enough to review?
- does the issue conflict with already-approved governed assets?
- is the issue reusable enough to become a governed candidate?

### 11.3 Harness output in V1

For candidate-eligible residual issues, Harness should produce:

- a verification run reference
- an evidence pack or equivalent verification evidence
- a validation outcome that the confidence engine can consume

V1 does not require automatic environment cutover or automatic promotion from Harness into live governed assets.

## 12. Learning Bridge

### 12.1 Candidate creation remains review-gated

The bridge may create governed learning candidates, but only after:

- residual issue normalization
- confidence scoring
- route selection
- Harness validation, when required by the route

### 12.2 Learning candidate bridge must stay truthful

The bridge must not:

- fake a reviewed case snapshot
- fake a human-feedback source
- skip provenance links

It must create candidates with:

- truthful residual provenance
- source execution snapshot reference
- source output asset reference
- Harness evidence pack reference when present

### 12.3 Writeback remains unchanged in principle

Approved learning candidates continue through:

- learning review approval
- learning-governance writeback creation
- draft asset generation
- existing publish gates for each governed registry

V1 strengthens the existing learning loop. It does not replace it.

## 13. Scope

### 13.1 Included in V1

V1 includes:

- shared residual-learning backbone
- proofreading-only activation
- persistent residual issue ledger
- proofreading residual adapter
- multi-signal confidence scoring
- route families for rule, knowledge, prompt-template, manual-only, and evidence-only
- truthful residual provenance for learning candidates
- first-class `knowledge_candidate`
- Harness residual validation check type
- review-gated learning candidate creation

### 13.2 Explicitly excluded from V1

V1 does not include:

- editing activation
- screening activation
- model fine-tuning
- model parameter updates
- automatic live publication of rules or knowledge
- automatic live prompt activation
- cross-module residual sharing
- full autonomous issue clustering and trend dashboards

## 14. Acceptance Criteria

The design is satisfied when V1 can truthfully claim:

- proofreading still executes the normal governed flow first
- a bounded residual-discovery pass runs second
- residual findings are stored as first-class persistent records
- residual findings carry governed execution lineage and truthful provenance
- system confidence is computed from multiple signals, not only model confidence
- candidate-eligible residual findings pass through Harness validation
- the system can create rule, knowledge, and prompt-optimization learning candidates from residual findings without faking reviewed-snapshot provenance
- approved candidates still use the existing learning-governance writeback path
- no part of the loop updates model parameters
- no part of the loop auto-publishes live governed assets

## 15. Growth Path After V1

The next safe expansion order is:

1. harden proofreading residual validation thresholds with real operational data
2. add `EditingResidualAdapter`
3. add `ScreeningResidualAdapter` with stricter medical-risk routing
4. add residual clustering and operator trend analysis
5. later consider broader cross-module learning reuse if the evidence justifies it

This sequence preserves one shared backbone while keeping activation risk controlled.
