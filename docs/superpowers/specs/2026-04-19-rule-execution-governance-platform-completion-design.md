# 2026-04-19 Rule Execution Governance Platform Completion Design

**Date**

2026-04-19

**Status**

Approved section-by-section in conversation as the baseline for the remaining rule execution, governance, and observability work.

**Goal**

Complete the remaining rule-system work in a truthful order so the product moves from:

- rules can be authored and partially reviewed
- some execution hits can be surfaced
- some learning and writeback paths already exist

to:

- rules truly participate in live editing and proofreading execution
- high-risk hits can produce candidate changes or inspect-only findings
- operators can confirm, reject, or route those findings through one governed chain
- approved value can write back into governed assets and feed learning
- rule activation can be scoped, explained, versioned, canaried, rolled back, measured, and regression-checked through Harness

## 1. Why This Design Exists

The repository already contains important foundations:

- governed execution resolution for runtime, retrieval, bindings, and model routing
- editorial rule authoring, rule package preview, semantic hit preview, and rule draft writeback
- manuscript workbench high-risk review cards for some execution evidence
- unified `review-items` decision entry for governed hits, residual issues, and learning candidates
- residual learning, learning writeback, and `editorial_rule_draft` as a governed target
- Harness control-plane activation and rollback at the environment scope level

What is still incomplete is the remaining system-level product shape across five layers:

1. rules truly hitting in live editing and proofreading execution
2. structural recognition for table and format families beyond the currently shipped bounded slice
3. a complete high-risk-hit to candidate modification to human decision to writeback to learning loop
4. a full rule-center platform for scope, precedence, explainability, release posture, and operator control
5. observability and Harness-backed online execution regression after live rule activation

The work should now be completed in one coherent roadmap instead of continuing as disconnected patches.

## 2. Truthful Current-State Assessment

This design intentionally starts from the shipped reality, not from the ideal end state.

### 2.1 Already true today

- editing and proofreading can already surface some governed evidence into the manuscript workbench
- table semantic hits and bounded structural format hits already have real execution pathways
- the operator already has a unified decision path through `review-items`
- rule-routed learning can already materialize an `editorial_rule_draft` writeback
- residual issues already support Harness-backed validation before candidate creation
- rule center already exposes some explainability, semantic preview, and writeback continuity

### 2.2 Not yet complete today

- execution hits are not yet a complete and always-on source of first-class review records
- structural table and format coverage is still partial, not a complete deterministic rule family layer
- candidate modifications are not yet a fully normalized operator concept across all high-risk rule hits
- rule scope, precedence, conflict handling, release posture, and rollback are not yet a complete rule-platform model
- rule effect dashboards and online execution regression are not yet complete product surfaces

This design therefore treats the remaining work as a completion program, not as a greenfield redesign.

## 3. Final Product Decisions

The validated decisions for the remaining work are:

- use a **main-chain-first** rollout
- complete the work in three phases, not in one large undifferentiated implementation
- do not create a fourth operator workbench
- keep:
  - manuscript workbench for execution-time discovery and first handling
  - unified review / learning review for formal operator decisions
  - rule center for downstream rule governance and draft materialization
  - Harness for validation and regression evidence
- keep human confirmation as the release gate for high-risk rule outcomes
- reuse the existing `review-items`, learning candidate, writeback, and `editorial_rule_draft` backbones instead of creating a second governance stack

## 4. Recommended Delivery Strategy

The remaining work should ship in three phases.

### Phase 1: Shippable Main Chain

Primary purpose:

- make rules truly participate in production editing and proofreading work
- complete the shortest trustworthy chain from execution hit to operator decision to governed writeback

### Phase 2: Rule Platform Completion

Primary purpose:

- make the running main chain controllable and explainable at scale

### Phase 3: Observability And Online Regression

Primary purpose:

- make the running platform measurable, safe to expand, and evidence-gated through Harness

This order is mandatory for this program. It prioritizes product truth over architectural neatness.

## 5. Phase 1: Shippable Main Chain

Phase 1 completes the operational chain from execution to governed asset routing.

### 5.1 Phase 1 Product Promise

After Phase 1:

- editing and proofreading runs can produce real governed high-risk hits during execution
- those hits can be shown as either candidate modifications or inspect-only findings
- operators can make explicit decisions on those findings
- approved value can route into rule, knowledge, or prompt candidates
- rule-directed value can materialize a governed `editorial_rule_draft`
- the system can trace the whole loop from manuscript run to governed writeback

### 5.2 Activation Sources

Phase 1 treats live execution output as the canonical upstream activation source.

The activation source remains the latest execution payload and snapshot lineage, including:

- editing-side deterministic changes and table inspection findings
- proofreading-side failed checks, risk items, manual review items, and quality findings
- any later bounded structural rule-hit families added during this phase

This phase does not redefine the system around a queue-first model. The first truth must remain:

`the rule really hit during this manuscript run`

### 5.3 Operator Outcome Model

High-risk governed hits should be normalized into two operator-facing classes:

- `candidate_change`
  - the system can suggest a bounded candidate modification or candidate structural correction
  - the system must still avoid silent application for high-risk objects
- `inspect_only`
  - the system highlights the issue, location, rationale, and evidence
  - the operator decides the correction manually

This distinction is essential. It prevents risky table and format findings from pretending to be safely auto-applicable.

### 5.4 Phase 1 Decision Model

Phase 1 uses a small, explicit operator decision vocabulary:

- accept change only
- route to rule candidate
- route to knowledge candidate
- route to prompt candidate
- reject as false positive
- archive as evidence only

This decision model stays shared across governed hits and residual issues wherever possible.

### 5.5 Phase 1 End-To-End Flow

The Phase 1 main chain is fixed as follows:

1. live execution hits a rule
2. execution output preserves structured evidence:
   - `ruleId`
   - module
   - manuscript id
   - snapshot id
   - location
   - excerpt
   - suggestion
   - rationale
   - risk level
   - machine-usable evidence
3. manuscript workbench shows the high-risk finding in the current run context
4. the system classifies the hit as `candidate_change` or `inspect_only`
5. the operator either handles it locally or submits it into unified review
6. unified review records the formal operator decision
7. approved value routes into learning candidate creation and governed writeback
8. if the route is rule-directed, the system materializes or updates an `editorial_rule_draft`
9. the manuscript, hit, decision, candidate, and writeback remain provenance-linked

### 5.6 Phase 1 Page Responsibilities

#### Manuscript Workbench

Responsibilities:

- show real execution-time governed hits
- show candidate modification vs inspect-only posture
- show location and evidence
- let the operator submit to formal review or record manual handling

Non-responsibilities:

- final rule authoring
- full candidate drafting
- release management

#### Unified Review / Learning Review

Responsibilities:

- receive formal review items
- let the operator make the authoritative decision
- route approved value into governed candidates

Non-responsibilities:

- direct execution-time highlighting
- heavy rule authoring

#### Rule Center

Responsibilities:

- receive already-confirmed rule-directed value
- materialize and govern downstream `editorial_rule_draft` assets

Non-responsibilities:

- first-pass triage of execution hits

### 5.7 Phase 1 Acceptance Criteria

Phase 1 is complete only when all of the following are true:

- editing and proofreading both produce live governed high-risk hits during real execution
- high-risk hits clearly distinguish candidate modification from inspect-only posture
- the operator can complete formal decisions without leaving the governed workflow
- rule-directed approved value can materialize an `editorial_rule_draft`
- provenance links are preserved from manuscript run through decision and writeback

## 6. Phase 2: Rule Platform Completion

Phase 2 upgrades rule center from a usable workbench into a controllable platform.

### 6.1 Phase 2 Product Promise

After Phase 2:

- every live rule can clearly state where it applies
- precedence and override behavior are explicit
- conflicts are surfaced instead of guessed away
- release posture supports draft, candidate, canary, active, archive, and rollback
- operators can explain why a rule hit, missed, or was overridden

### 6.2 Scope Model

Phase 2 should formalize rule scope into six platform dimensions:

- `module`
- `manuscript_type`
- `template_family`
- `journal`
- `section`
- `object_granularity`

Examples of object granularity include:

- paragraph
- table
- table header
- table cell
- reference entry
- declaration block

This scope model must become the canonical platform vocabulary across authoring, execution, explainability, release, metrics, and Harness regression.

### 6.3 Precedence Model

Phase 2 should formalize precedence in two layers:

#### Precedence tier

- manual disable / special approval
- journal override rule
- template-family formal rule
- system default rule
- fallback guidance rule

#### Same-tier ordering

Within the same precedence tier, compare:

1. explicit `priority`
2. narrower scope specificity
3. stable deterministic tie-breaking

This keeps release behavior interpretable and auditable.

### 6.4 Conflict Model

Phase 2 should formalize three conflict classes:

- `override`
  - a higher rule explicitly replaces a lower rule
- `merge`
  - two rules can both apply because they target different aspects
- `exclusive_conflict`
  - two rules attempt incompatible actions on the same target

`exclusive_conflict` must not silently auto-resolve into a final manuscript change.

Instead, the system should:

- preserve conflict evidence
- surface the conflict in the governed review flow
- let the operator decide which route wins or whether a new rule should be authored

### 6.5 Version, Canary, And Rollback Model

Phase 2 should expand rule governance beyond a simple draft/published model.

Recommended lifecycle:

- `draft`
- `candidate`
- `canary`
- `active`
- `archived`
- `rolled_back`

Release posture should support:

- canary activation at a bounded scope
- promotion from canary to active
- rollback to the last known-good governed snapshot

The rollback model should align conceptually with existing Harness environment rollback posture, while remaining rule-centric rather than environment-centric.

### 6.6 Explainability Model

Phase 2 should expose four explainability questions:

1. why did the rule hit
2. why did the rule miss
3. why was the rule overridden
4. why did the system require human confirmation

This explainability is for:

- rule authors
- governance operators
- review operators
- release owners

not only for internal engineering diagnostics.

### 6.7 Phase 2 Rule Center Surface

Rule center should gain three platform-grade operator areas:

- scope and activation panel
- override and conflict panel
- version and release panel

The rule center should remain the place that answers:

`what is active, where, why, and under which release posture`

### 6.8 Phase 2 Acceptance Criteria

Phase 2 is complete only when all of the following are true:

- any rule can clearly state its activation scope
- precedence and override behavior are explicit and inspectable
- incompatible rule outcomes are surfaced as governed conflicts
- release posture supports candidate, canary, active, and rollback states
- rule center can explain hit, miss, override, and manual-review reasons

## 7. Phase 3: Observability And Online Regression

Phase 3 makes the running platform measurable and safe to expand.

### 7.1 Phase 3 Product Promise

After Phase 3:

- rule activation quality can be measured
- one rule, one scope, or one release can be evaluated through evidence
- Harness no longer validates only candidate artifacts; it also validates live execution behavior before wider rollout

### 7.2 Metrics Taxonomy

Phase 3 should group metrics into four categories.

#### Activation Metrics

- rule hit count
- manuscript hit count
- object hit distribution
- scope distribution

#### Quality Metrics

- false-positive rate
- human-confirmation rate
- evidence-only archive rate
- candidate-change acceptance rate

#### Writeback Metrics

- routed rule candidate count
- routed knowledge candidate count
- routed prompt candidate count
- writeback creation success rate
- writeback apply success rate

#### Impact Metrics

- recurrence rate of the same issue after writeback
- residual issue reduction trend
- canary-versus-baseline effect difference

These metrics should evaluate value, not only activity.

### 7.3 Dashboard Surfaces

Phase 3 should expose three dashboard views:

#### Global Operations Overview

For leadership and governance operations:

- module view
- template-family view
- journal view
- release-risk summary

#### Single Rule Detail

For authors and governance operators:

- hit history
- false-positive history
- review outcomes
- writeback history
- canary and rollback events

#### Release Comparison View

For release decisions:

- baseline versus canary
- pre-change versus post-change
- pass/fail and degradation summary

### 7.4 Harness Expansion Model

Harness should become a two-layer validation system.

#### Candidate Validation Layer

Continue to validate:

- residual issues
- learning candidates
- rule draft candidates

#### Online Execution Regression Layer

Add regression for:

- canaried rule sets
- newly activated rule versions
- scope-bound release candidates

This layer should replay representative manuscript execution cases and compare:

- hit behavior
- candidate-change posture
- review demand
- regression risk

### 7.5 Regression Suite Types

Online execution regression should support at least:

- `module_regression_suite`
- `scope_regression_suite`
- `rule_family_regression_suite`

Examples:

- editing regression
- proofreading regression
- template-family-specific release regression
- journal-specific release regression
- table-rule-family regression
- statistical-expression regression

### 7.6 Release Gates

Phase 3 should formalize release gating:

- candidate to canary requires candidate validation evidence
- canary to active requires online execution regression evidence
- degraded quality or unstable writeback metrics should block promotion or recommend rollback

This prevents release decisions from becoming intuition-only decisions.

### 7.7 Phase 3 Page Responsibilities

#### Rule Center

Owns:

- effect overview
- rule-level performance visibility
- release-risk summary

#### Harness

Owns:

- validation suites
- regression suites
- release comparison evidence
- promotion and rollback evidence posture

#### Unified Review

Still owns:

- human adoption decisions

It should not become the long-term observability console.

### 7.8 Phase 3 Acceptance Criteria

Phase 3 is complete only when all of the following are true:

- rule-level and scope-level quality metrics are visible
- release candidates can be linked to Harness regression evidence
- canary promotion decisions are evidence-gated
- rollback posture is tied to metrics and regression evidence, not only to manual operator judgment

## 8. Out Of Scope

This completion program intentionally does not include:

- direct model self-training or parameter updates
- fully automatic publication of live rules without human confirmation
- full deterministic coverage of every conceivable rule family in one pass
- replacing the existing workbench family layout with a brand-new operator surface
- rewriting the existing learning or Harness backbones from scratch

## 9. Delivery Order

The delivery order is locked:

1. Phase 1 main chain
2. Phase 2 platform completion
3. Phase 3 observability and online regression

The system should not attempt Phase 2 or Phase 3 completeness by delaying Phase 1 main-chain truth.

## 10. Risks And Mitigations

### Risk 1: The program expands into too many rule families too early

Mitigation:

- keep Phase 1 focused on the highest-value execution families first
- expand deterministic coverage in bounded rule-family increments

### Risk 2: Rule center becomes a second review desk

Mitigation:

- keep first-pass review in manuscript workbench and unified review
- keep rule center downstream and governance-focused

### Risk 3: Release complexity grows faster than operator understanding

Mitigation:

- keep scope, precedence, and lifecycle vocabulary explicit
- expose explainability before adding heavier release automation

### Risk 4: Harness becomes overloaded with unrelated validation duties

Mitigation:

- keep a clean distinction between candidate validation and online execution regression
- reuse the existing Harness ownership model instead of scattering regression into multiple pages

## 11. Success Definition

This program is successful only when the product can truthfully claim all of the following:

- rules really fire during live editing and proofreading work
- high-risk hits can be governed from detection through decision through writeback
- rule activation is scoped, explainable, and releasable with rollback posture
- rule value can be measured instead of guessed
- Harness can protect live rule activation, not only offline candidate creation
