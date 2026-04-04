# Phase 10C Evaluation Workbench Operations Depth Design

**Date:** 2026-04-04  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Deepen `Evaluation Workbench` into a stronger read-only operator surface for `verification-ops` history, centered on suite-level delta reading, multi-run comparison, and historical evidence/recommendation signals.

## 1. Goal

Phase 10C is not the phase that adds more governance decisions.

Its job is to make the existing evaluation history understandable and operationally useful without introducing a new control plane.

By the end of this slice, an operator should be able to open `Evaluation Workbench`, select a suite, and answer three questions quickly:

- did the latest finalized run get better, worse, or stay flat compared with the previous finalized run
- where did the change come from across evidence-pack, recommendation, and failure signals
- which recent historical runs deserve closer review next

In one sentence:

`Phase 10C` should turn existing `verification-ops` history into an operator-readable suite operations view, not a new governance workflow.

## 2. Current Baseline

The repository already has the core building blocks that Phase 10C should build on:

- Phase 6A introduced governed evaluation sample sets, suites, runs, evidence packs, and recommendations
- Phase 9A made `verification-ops` persistent through the real HTTP runtime
- Phase 9Q preserved sample-context handoff between `Evaluation Workbench` and manuscript workbenches
- Phase 9S seeded governed evaluation runs from live governed module execution
- Phase 9T executed governed verification checks inline, wrote machine evidence, and added the finalize-only path for machine-completed governed runs
- Phase 10B linked model-routing governance to runtime and kept `Evaluation Workbench` explicitly positioned as an evidence surface rather than a control plane

The current workbench already supports:

- suite selection
- run selection
- finalized history loading
- previous-run comparison hints
- selected evidence viewing
- sample-backed and governed-source detail modes
- finalize recommendation for machine-completed runs

What is still missing is operations depth:

- the workbench does not yet foreground the delta between the latest and previous finalized runs
- historical comparison remains too close to raw record viewing instead of operator summary
- there is no strong first-screen summary of whether the suite is improving or regressing
- historical evidence-pack and recommendation signals are not yet synthesized into a usable operator-facing view

This means the repository can already store the right information, but not yet present it in the right operational shape.

## 3. Options Considered

### Option A: Delta-first suite operations

Make `suite` the primary entry point, default the view to `latest finalized run` versus `previous finalized run`, and present the first-screen answer as:

- better
- worse
- flat

with explicit reasons grounded in evidence-pack, recommendation, and failure signals.

Pros:

- matches the current repository structure with minimal boundary risk
- gives operators the fastest answer to the most common question
- builds directly on existing finalized-history primitives instead of inventing a new operations object

Cons:

- does not prioritize queue management or long-horizon analytics first

Recommended.

### Option B: Review-queue-first operations view

Prioritize `needs_review` and suspicious historical runs ahead of direct delta reading.

Pros:

- can support triage workflows well

Cons:

- starts to drift toward queue management semantics
- does not answer the primary suite health question as directly

Not recommended for Phase 10C v1.

### Option C: Analytics-board-first operations view

Lead with distributions, trend charts, and longer-horizon history summaries before emphasizing direct run comparison.

Pros:

- useful for reporting and long-term monitoring

Cons:

- heavier first-screen experience
- more likely to expand into a wider analytics platform before the core operator loop is strong

Not recommended for the first slice.

## 4. Hard Boundaries

Phase 10C should stay inside five explicit boundaries.

### 4.1 Read-only operations depth

This phase supports:

- historical evaluation reading
- multi-run comparison
- filtering, sorting, and signal summarization
- stronger operator-facing historical evidence views

This phase does **not** support:

- activation
- approval
- rollback
- baseline pinning
- saved comparison presets
- operator notes or labels
- any other new write operation

### 4.2 Evaluation Workbench remains evidence-first

The only surface deepened in this phase is:

- `Evaluation Workbench`

It remains:

- a read-oriented evidence and comparison surface

It should not become:

- a control plane for routing governance
- a release orchestration surface
- a cross-system operations dashboard

### 4.3 `verification-ops` only

The primary domain objects for this slice remain:

- `EvaluationSuite`
- `EvaluationRun`
- `FinalizeEvaluationRunResult`
- `VerificationEvidence`

Supporting context such as sample-set items and governed-source metadata may still be shown, but only as context around those core objects.

This phase explicitly excludes new cross-domain aggregation over:

- `AgentExecutionLog`
- module execution history outside governed-source context already attached to runs
- knowledge review
- learning review
- model routing governance

### 4.4 Suite-first navigation

The default operator entry point is:

- one suite

This phase may still preserve manuscript context where it already exists, but manuscript context remains secondary.

The workbench should not be redesigned around:

- manuscript-first browsing
- evidence-pack-first browsing
- recommendation-first browsing

for this slice.

### 4.5 Default comparison contract

The default baseline for Phase 10C v1 is:

- latest finalized run
- compared against the previous finalized run in the same suite

The top-level `better / worse / flat` classification must be deterministic.

For Phase 10C v1, the comparison should use this ordered rule set:

1. compare `recommendation.status` severity first using:
   - `recommended` = best
   - `needs_review` = middle
   - `rejected` = worst
2. if recommendation severity is equal, compare finalized `run.status` using:
   - `passed` = better
   - `failed` = worse
3. if both are equal, classify the pair as `flat`

The first-screen label should therefore be decided by structured finalized-result fields, not by free-text summary parsing.

Signal-level explanations may still describe:

- recommendation changes
- evidence-pack summary changes
- failure or regression signal presence

but those supporting explanations do not override the v1 top-level classification rule.

This phase should not introduce:

- best-ever baseline semantics
- pinned baseline semantics
- governance-weighted baseline selection

If a suite has fewer than two finalized runs, the workbench should degrade honestly instead of inventing a comparison.

Honest degradation for fewer than two finalized runs means:

- still show the latest finalized run when one exists
- show explicit copy such as `Comparison unavailable until this suite has at least two finalized runs`
- hide or disable delta-only comparison affordances
- keep the historical list and summary signals available for the visible history window

### 4.6 Default history window contract

Phase 10C v1 should use a bounded default history window so operator summaries remain deterministic and planning stays scoped.

The default visible history window is:

- the latest 10 finalized results for the selected suite
- ordered by finalization timestamp descending

For v1 planning, finalization timestamp should be represented by:

- `recommendation.created_at`

This timestamp is the authoritative ordering/filtering timestamp for Phase 10C v1 because finalized results already guarantee a recommendation record.

If a future dedicated `finalized_at` field is introduced, it may replace this proxy without changing the operator-facing contract.

This same timestamp should drive:

- default recency ordering
- optional time-window filtering
- visible-window signal summaries

Phase 10C v1 may add read-only time filters such as:

- last 7 days
- last 30 days
- all finalized history for the selected suite

but the initial load should still clamp to the latest 10 finalized results unless the operator expands the view.

This phase should not introduce:

- unbounded history fetch on first load
- preference persistence for custom history windows
- cross-suite historical aggregation

## 5. Core Experience

The intended experience should be read as one strengthened suite page inside the existing `Evaluation Workbench`.

### 5.1 First-screen answer: delta summary

The first screen after suite selection should answer:

- is the latest finalized run better, worse, or flat compared with the previous finalized run
- which signal changed
- what the operator should look at next

The summary should be grounded in existing stored facts, not speculation.

Candidate inputs include:

- recommendation status changes
- evidence-pack summary changes
- run status differences
- new or removed failure/regression signals
- meaningful evidence composition changes

For v1, the top-level label must be derived only from the deterministic rule in Section 4.5.

The rest of the delta summary should explain why that label was produced by surfacing supporting differences, but it should not apply a second hidden weighting system.

### 5.2 Side-by-side finalized run comparison

The workbench should retain a detailed comparison view for:

- the current latest finalized run
- the previous finalized run

But it should move beyond raw record display by explicitly calling out:

- what changed
- what stayed stable
- which signals became worse
- which signals improved

This keeps the current comparison path but gives it stronger operator meaning.

### 5.3 Historical suite operations lane

The finalized-history lane should remain available, but with stronger operator controls such as:

- time-window filtering
- recommendation-status filtering
- failure-heavy sorting
- newest-first sorting
- quick visibility into which entries belong to the current comparison pair

Unless the operator changes the filter, the lane should render only the default visible history window defined in Section 4.6.

The historical list should support choosing a different finalized run for inspection without changing the default latest-versus-previous contract.

### 5.4 Signals summary

The page should also summarize recurring historical signals at suite level, such as:

- recommendation distribution across the visible history window
- failure and regression recurrence
- evidence-pack outcome mix

Those summaries should be computed only from the currently visible finalized-history window, not from hidden older entries outside the active filter.

This summary is still read-only. It should help an operator understand whether the suite is stabilizing or getting noisier, without becoming a governance decision engine.

## 6. Data And View-Model Strategy

Phase 10C should prefer derived read models over new persistent business objects.

Recommended approach:

- keep persistence centered on existing `verification-ops` entities
- add controller-level derivation for operations summaries
- expand web view models only where the current read contract is too thin for an operator summary

This slice should avoid introducing a new persisted object such as:

- `suite_dashboard`
- `comparison_baseline`
- `operator_signal_snapshot`

The preferred pattern is:

- derive suite operations summaries from finalized results already returned by the current API
- add read-only API expansion only when it materially reduces client-side N+1 cost or clarifies boundaries

Possible derived read-model concepts include:

- suite operations overview
- latest-versus-previous delta summary
- suite signal summary
- historical visibility summary

These should remain read-side constructs, not governance records.

## 7. API Boundary

Phase 10C should keep the API boundary narrow and read-oriented.

Preferred direction:

- reuse existing `verification-ops` list/read endpoints where practical
- add read-only summary endpoints only if the current workbench would otherwise need excessive fan-out or unstable client-side derivation

If new endpoints are added, they should remain clearly read-side and suite-scoped, for example:

- suite history summary
- suite comparison summary
- suite signal summary

This phase should not add:

- mutation endpoints
- operator preference storage
- pinned baseline APIs

## 8. Overlap Prevention With Adjacent Phases

Phase 10C must stay explicitly separate from nearby capability lanes.

### 8.1 Versus Phase 10B

`Phase 10B` governs:

- model-routing decisions
- policy lifecycle
- runtime routing audit

`Phase 10C` only reads evaluation history that may inform those decisions.

It must not add:

- routing activation
- routing approval
- routing rollback
- new policy editing actions

### 8.2 Versus Phase 9T

`Phase 9T` governs:

- how seeded governed runs execute checks
- how machine evidence is written
- how machine-completed runs enter the finalize-only state

`Phase 10C` only governs:

- how that already-existing history is read, compared, filtered, and summarized

It must not reopen:

- governed check orchestration
- machine evidence generation semantics
- run execution state transitions

### 8.3 Versus Phase 10D and Phase 10E

`Phase 10D` deepens knowledge operations.

`Phase 10E` completes retrieval infrastructure.

Phase 10C should not absorb:

- knowledge-workbench depth
- retrieval quality tooling
- vector search or hybrid retrieval features

### 8.4 Versus future release-facing work

Phase 10C may show release-relevant verification history when that history already exists in `verification-ops`.

It should not introduce:

- release orchestration
- canary automation
- deployment automation
- asynchronous workflow handling

Those remain future platform concerns.

## 9. Verification Strategy

Phase 10C should prove that the operator experience has improved without changing governance semantics.

### 9.1 Controller and read-model tests

Add coverage proving:

- latest finalized run and previous finalized run are selected correctly
- `better / worse / flat` classification follows the ordered rule in Section 4.5
- delta summaries are derived deterministically
- the default history window is limited to the latest 10 finalized results by `recommendation.created_at`
- historical filtering and sorting remain stable
- suite-level signal summaries match the visible history window

### 9.2 Page tests

Add coverage proving the page visibly answers:

- better, worse, or flat
- where the change happened
- which historical entries are the comparison pair
- what honest degradation looks like when fewer than two finalized runs exist

The page should not merely re-render existing cards in a different order.

### 9.3 Browser verification

Add at least one browser flow proving an operator can:

- open a suite
- see the default latest-versus-previous summary
- adjust history filters and sorting
- inspect a finalized comparison
- understand evidence-pack and recommendation deltas

without encountering any new mutation actions.

### 9.4 Boundary checks

Tests and browser assertions should also prove what is absent:

- no new write controls
- no governance lifecycle controls
- no cross-system operations panel leakage

## 10. Main Risks

The biggest risks in Phase 10C are not storage risks, but boundary and UX risks.

### 10.1 Control-plane drift

Risk:

- the workbench starts accumulating write actions and turns into a second governance console

Mitigation:

- keep all new additions read-only
- reject baseline pinning, labels, and other light-write temptations in this slice

### 10.2 Phase-overlap drift

Risk:

- the phase quietly starts carrying model governance, release automation, or cross-system operations

Mitigation:

- keep scope fixed to `verification-ops` history only
- explicitly document out-of-scope adjacent lanes in the plan

### 10.3 Analytics-before-operators drift

Risk:

- the page becomes a generic analytics board that is less actionable for actual operators

Mitigation:

- keep the first-screen contract focused on latest-versus-previous delta
- treat broader analytics as supporting context, not the primary screen

## 11. Out Of Scope

Phase 10C explicitly excludes:

- new governance write actions
- new policy objects
- baseline pinning or saved presets
- cross-system operations dashboards
- `agent-execution`-level historical analytics
- release orchestration and canary automation
- asynchronous job systems
- knowledge-ops deepening
- retrieval-stack work

## 12. Expected Outcome

After Phase 10C:

- `Evaluation Workbench` will answer suite health questions much faster
- operators will be able to compare the latest finalized run against the previous finalized run by default
- historical evidence-pack and recommendation signals will be easier to read in context
- the repository will gain meaningful operations depth without creating another overloaded control plane

That is the intended scope of this phase.
