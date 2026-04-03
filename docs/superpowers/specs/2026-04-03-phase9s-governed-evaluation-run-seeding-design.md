# Phase 9S Governed Evaluation Run Seeding Design

**Date:** 2026-04-03  
**Status:** Approved for implementation under the current autonomous Phase 9 direction  
**Scope:** Turn runtime-binding verification and evaluation expectations into actionable governed evaluation runs by auto-seeding `verification-ops` run records from real module executions, then make `Evaluation Workbench` recognize and inspect those seeded runs even when no sample-set context exists.

## 1. Goal

Phase 9S closes the next missing loop after Phase 9R:

- Let governed module execution do more than record what verification or evaluation policy was expected.
- Automatically create evaluation-run records when a live governed execution finishes and its runtime binding declares evaluation or release-gate expectations.
- Let operators reopen those seeded runs from `Evaluation Workbench` using manuscript context, even when the run did not start from a reviewed-case sample set.

This slice is about creating governed run records, not about auto-running checks or auto-scoring them.

## 2. Current Gap

After Phase 9R, the repository already has:

- `RuntimeBinding` fields for:
  - `verification_check_profile_ids`
  - `evaluation_suite_ids`
  - `release_check_profile_id`
- `resolveGovernedAgentContext()` returning those expectation IDs.
- module services persisting immutable expectation traces into `AgentExecutionLog`.
- `verification-ops` already able to persist:
  - evaluation suites
  - evaluation runs
  - run items
  - evidence
  - evidence packs
  - promotion recommendations

What is still missing is the execution bridge:

- governed module runs do not automatically create any evaluation-run records
- the only way to enter `Evaluation Workbench` is still effectively manual
- `Evaluation Workbench` manuscript matching currently only looks through `sample_set_id -> sample_set_items -> manuscript_id`
- a governed execution that did not originate from a reviewed-case sample set is therefore invisible to manuscript-scoped evaluation history

This leaves Phase 9R in a half-closed state: the policy is visible, but operators still have to manually recreate the run object that policy was meant to trigger.

## 3. Options Considered

### Option A: Add a manual “create evaluation run from this execution” button

Pros:

- smaller implementation
- low schema risk

Cons:

- runtime-binding expectations still remain advisory rather than operational
- operators still have to remember to create the run
- does not actually close the governance loop

Not recommended.

### Option B: Auto-seed governed evaluation runs from completed module executions

When a governed module run completes and its runtime binding declares `evaluation_suite_ids`, create one queued evaluation run per suite, copy the `release_check_profile_id` onto each run, and attach immutable governed-source metadata so the run can be found later by manuscript or execution evidence.

Pros:

- directly builds on the 9R expectation fields
- keeps the automation bounded to record creation only
- gives `Evaluation Workbench` a real, operator-facing backlog of governed runs
- preserves human control over evidence entry, scoring, and finalization

Cons:

- requires additive `EvaluationRun` contract changes
- requires workbench UI to support runs that do not have sample-set context

Recommended.

### Option C: Full automatic background orchestration

Auto-create runs, auto-run checks, auto-generate evidence, auto-finalize release-gate outcomes.

Pros:

- closest to the long-term governance vision

Cons:

- drags scheduling, tool execution, retries, failure recovery, and evidence generation into one slice
- much higher risk than the current repository state supports

Out of scope.

## 4. Recommended Architecture

Phase 9S should introduce one new additive contract:

### 4.1 `EvaluationRun.governed_source`

Add an optional `governed_source` object to `EvaluationRunRecord` and its web view model:

```ts
{
  source_kind: "governed_module_execution";
  manuscript_id: string;
  source_module: "screening" | "editing" | "proofreading";
  agent_execution_log_id: string;
  execution_snapshot_id: string;
  output_asset_id: string;
}
```

This object is the stable trace from a seeded evaluation run back to the real governed execution that produced it.

### 4.2 Seeding behavior

When a governed module execution finishes successfully:

- inspect `governedContext.verificationExpectations.evaluation_suite_ids`
- for each configured suite ID:
  - create one queued evaluation run
  - set `release_check_profile_id` from the governed expectations when present
  - leave `sample_set_id` empty
  - leave `baseline_binding` and `candidate_binding` empty
  - set `run_item_count` to `0`
  - attach `governed_source`

This keeps seeded runs valid, traceable, and immediately visible to operators without pretending that scoring or sample-backed comparison already happened.

### 4.3 Workbench behavior

`Evaluation Workbench` should treat a run as manuscript-relevant when either condition is true:

- it matches through `sample_set_id -> sample_set_items -> manuscript_id`
- or `run.governed_source.manuscript_id === manuscriptId`

When a seeded run has no sample-set context:

- the selected-run detail should render a governed-source summary instead of linked sample details
- operators should still be able to:
  - see the source module
  - inspect the execution snapshot ID
  - inspect the agent execution log ID
  - download the output asset
- learning handoff remains unavailable because there is no reviewed-case snapshot binding

## 5. Intentional Boundaries

### 5.1 What gets seeded

Seed evaluation runs for:

- screening output (`screening_report`)
- editing output (`edited_docx`)
- proofreading final confirmation output (`final_proof_annotated_docx`)

### 5.2 What does not get seeded

Do not seed evaluation runs for:

- proofreading draft creation (`proofreading_draft_report`)
- human-final publication (`human_final_docx`)
- manually created knowledge or learning governance events

The proofreading draft is intentionally excluded because it is an intermediate report rather than the operator-facing final proofreading output. Seeding both draft and confirmed-final runs would create noisy duplicate governance work for the same proofreading cycle.

## 6. Why This Slice Does Not Create Sample Sets

It is tempting to synthesize a sample set or sample item from the live governed execution so every seeded run would look exactly like a reviewed-case evaluation run.

Phase 9S should not do that.

Reasons:

- current sample-set semantics are explicitly tied to `reviewed_case_snapshot`
- `evaluation_run_items.sample_set_item_id` is backed by a foreign key to `evaluation_sample_set_items`
- live governed executions are not automatically equivalent to reviewed, deidentified, reusable evaluation samples
- forcing that equivalence now would blur the line between release governance and reusable benchmark data

So the seeded run is intentionally “run-only”:

- valid for operator triage
- valid for evidence entry
- valid for finalization
- not automatically eligible for sample-backed scoring or learning handoff

## 7. Data Model Changes

### 7.1 API domain record

Extend `EvaluationRunRecord` with:

```ts
governed_source?: {
  source_kind: "governed_module_execution";
  manuscript_id: string;
  source_module: TemplateModule;
  agent_execution_log_id: string;
  execution_snapshot_id: string;
  output_asset_id: string;
};
```

### 7.2 Web view model

Extend `EvaluationRunViewModel` with the same optional shape.

### 7.3 Database

Add a nullable `governed_source jsonb` column to `evaluation_runs`.

This stays additive and backward compatible:

- older runs remain valid
- sample-set-backed runs do not need any migration logic beyond nullable decode
- manuscript history matching can support both sources at the same time

## 8. Module-Service Flow

### 8.1 Screening and editing

For `ScreeningService.run()` and `EditingService.run()`:

1. resolve governed context
2. create agent execution log
3. create output asset
4. record execution snapshot
5. complete execution log with the snapshot ID
6. seed governed evaluation runs using:
   - manuscript ID
   - module
   - execution log ID
   - snapshot ID
   - output asset ID
   - expectation suite IDs
   - release check profile ID
7. finish the module job normally

### 8.2 Proofreading

For `ProofreadingService`:

- `createDraft()` should keep current behavior and **not** seed runs
- `confirmFinal()` should seed runs from the final confirmed proofreading output
- the seeded run should point at:
  - the final confirmation snapshot
  - the final output asset
  - the reused draft-stage agent execution log ID

This preserves the existing draft-pinning model while still making the final governed proofreading output evaluable.

## 9. Evaluation Workbench Changes

### 9.1 Manuscript matching

`resolveEvaluationManuscriptContext()` should match runs by:

- sample-set manuscript context first
- governed-source manuscript context second

Both matches should contribute to:

- `matchedSuiteId`
- `matchedRunId`
- `matchedRunIdsBySuiteId`

### 9.2 Selected-run detail

The selected-run detail UI should support two modes:

- sample-backed run detail
- governed-source run detail

Governed-source mode should render:

- source module
- manuscript ID
- execution snapshot ID
- agent execution log ID
- output asset download link
- release check profile, when present

### 9.3 Learning handoff guard

If the selected run has no reviewed-case sample context:

- do not offer learning-candidate creation as if it were sample-backed
- instead explain that the run came from a governed live execution and needs reviewed snapshot context for learning handoff

## 10. Failure Policy

Phase 9S should be synchronous and explicit:

- seeding runs happens inside the same request flow as the successful module execution
- if a referenced suite or release profile can no longer accept runs, the existing `verification-ops` state-conflict errors should surface instead of silently dropping the seed

This is stricter than a background-retry model, but it keeps the slice honest:

- no fake success
- no hidden governance drift
- no invisible missed release-gate work

Later phases may add retry queues or softer degradation once a real orchestration layer exists.

## 11. Out Of Scope

Phase 9S does not include:

- automatic verification check execution
- automatic evidence generation
- automatic run-item creation for live executions
- synthetic sample-set or sample-item generation from live outputs
- automatic scoring
- automatic finalization
- automatic learning-candidate creation
- worker-side scheduling or background retries
- manuscript-workbench UI polish beyond what is needed to reopen the seeded run from existing evaluation links

## 12. Verification

### 12.1 API / service tests

Add or update tests to prove:

- screening creates one seeded run for each configured evaluation suite
- editing creates one seeded run for each configured evaluation suite
- proofreading draft does not create seeded runs
- proofreading final confirmation creates seeded runs
- seeded runs persist:
  - `release_check_profile_id`
  - `governed_source.manuscript_id`
  - `governed_source.source_module`
  - `governed_source.agent_execution_log_id`
  - `governed_source.execution_snapshot_id`
  - `governed_source.output_asset_id`
- seeded runs start with:
  - no `sample_set_id`
  - zero run items
  - `run_item_count = 0`

### 12.2 Persistence tests

Add or update tests to prove PostgreSQL persistence round-trips `governed_source`.

### 12.3 Workbench tests

Add or update tests to prove:

- manuscript-prefilled evaluation overview can select runs matched only through `governed_source.manuscript_id`
- selected-run detail renders governed-source context without sample-set context
- sample-linked actions degrade safely when no reviewed snapshot exists

### 12.4 Browser verification

Extend browser coverage to prove:

- a governed module run produces a seeded evaluation run visible from `Evaluation Workbench`
- manuscript-scoped history includes that seeded run
- the operator can inspect governed-source details and open the output asset download

## 13. Expected Outcome

After Phase 9S:

- runtime-binding expectations no longer stop at “recorded policy”
- real governed module executions automatically create the run records operators are supposed to evaluate
- `Evaluation Workbench` can reopen those runs by manuscript even when they did not start from a reviewed sample set
- the codebase has a real, bounded bridge between governed execution and future release-gate automation
