# Phase 9R Runtime Binding Verification Linkage Design

**Date:** 2026-04-03  
**Status:** Approved for implementation under the current autonomous Phase 9 direction  
**Scope:** Connect `Runtime Binding` governance to existing `verification-ops` assets so governed module execution can declare expected verification/evaluation hooks, carry them through governed context resolution, and expose them in admin execution evidence.

## 1. Goal

Phase 9R closes one missing governance loop:

- Let admins bind existing verification assets to a live governed runtime binding.
- Let governed module execution resolve those expectations together with runtime, sandbox, prompt, and tool-policy context.
- Let execution evidence show what verification or evaluation was expected, what was actually recorded, and what is still missing.

This slice does not build a new verification runner. It makes the current governance and evidence surfaces speak the same language.

## 2. Current Gap

The repository already has the main ingredients:

- `verification-ops` persists check profiles, release check profiles, suites, runs, evidence packs, and evidence.
- `runtime-bindings` governs the live runtime, sandbox, agent profile, prompt template, skill packages, and optional execution profile for a module scope.
- `governed-agent-context-resolver` already defines `verificationExpectations`.
- `AgentExecutionLog` and Admin Governance evidence drilldown already expose execution evidence.

What is still missing is the linkage:

- `RuntimeBindingRecord` does not carry any verification or evaluation expectation IDs.
- `resolveGovernedAgentContext()` always returns empty verification expectations.
- module runs cannot persist which verification/evaluation expectations governed the execution.
- Admin Governance evidence can show recorded evidence IDs, but not whether the run satisfied the configured expectations.

This means “execution governance” and “evaluation / verification governance” are both present, but they are not yet joined into one operator-facing loop.

## 3. Options Considered

### Option A: Extend runtime bindings with explicit verification expectations

Add optional fields to runtime bindings for:

- `verification_check_profile_ids`
- `evaluation_suite_ids`
- `release_check_profile_id`

Resolve and persist those expectations as part of governed agent context and execution evidence.

Pros:

- Reuses the current admin-governed scope object that already defines the live runtime bundle.
- Keeps evaluation linkage explicit and inspectable.
- Avoids guessing verification policy from model routing or execution profiles.
- Gives Admin Governance one place to reason about “this runtime bundle is supposed to satisfy these checks.”

Cons:

- Requires additive persistence and UI changes across API, web, and tests.

Recommended.

### Option B: Infer verification expectations from execution profiles or evaluation suites only

Attach verification expectations somewhere else and derive them indirectly during execution.

Pros:

- Fewer fields on runtime bindings.

Cons:

- Blurs responsibility between business execution selection and operational runtime governance.
- Makes evidence drilldown harder to explain because the expectation source is indirect.
- Risks conflicting sources of truth.

Not recommended.

### Option C: Keep expectations transient and only show them in the evaluation workbench

Do not persist them on live runtime bindings. Let operators manage them manually elsewhere.

Pros:

- Smaller scope.

Cons:

- Does not close the governance loop.
- Leaves execution evidence without a policy baseline.
- Does not satisfy the “execution governance + evaluation linkage” roadmap direction.

Out of scope.

## 4. Recommended Architecture

Phase 9R should treat verification expectations as additive runtime-binding metadata:

1. Extend `RuntimeBindingRecord` and `RuntimeBindingViewModel` with optional verification expectation fields.
2. Validate those references during runtime-binding creation and activation:
   - verification check profiles must exist and be `published`
   - evaluation suites must exist and be `active`
   - release check profile, when present, must exist and be `published`
3. Resolve those fields in `resolveGovernedAgentContext()` and return a non-empty `verificationExpectations` object.
4. Persist the resolved expectations into `AgentExecutionLog` so each governed run has an immutable expectation trace.
5. Surface expectation coverage in Admin Governance evidence:
   - expected check profiles
   - expected evaluation suites
   - expected release check profile
   - recorded evidence IDs
   - unresolved or missing expected coverage

This keeps runtime binding as the live operational bundle while preserving the existing separation:

- `ExecutionProfile` remains the canonical business-context source.
- `RuntimeBinding` remains the canonical operational execution-policy source.
- `verification-ops` remains the canonical registry of reusable verification/evaluation assets.

## 5. Data Model Changes

### 5.1 Runtime Binding

Add fields:

- `verification_check_profile_ids: string[]`
- `evaluation_suite_ids: string[]`
- `release_check_profile_id?: string`

Rules:

- all fields are optional so current bindings remain valid
- arrays should be deduplicated while preserving order
- activation must reject references to missing or non-published/non-active verification assets

### 5.2 Agent Execution Log

Add matching immutable trace fields:

- `verification_check_profile_ids: string[]`
- `evaluation_suite_ids: string[]`
- `release_check_profile_id?: string`

These values should be copied from the resolved governed context at log creation time so later registry changes do not rewrite historical execution evidence.

## 6. Backend Changes

### 6.1 `runtime-binding-service`

Extend `CreateRuntimeBindingInput` and validation to support verification expectations.

Validation rules:

- every `verificationCheckProfileId` must resolve to a published verification check profile
- every `evaluationSuiteId` must resolve to an active evaluation suite
- `releaseCheckProfileId`, when present, must resolve to a published release check profile

This service should continue to treat the fields as additive metadata, not as a reason to re-resolve prompt or runtime selection.

### 6.2 `governed-agent-context-resolver`

Replace the placeholder empty expectations with resolved values from the active runtime binding.

No new heuristics are needed. The resolver should just trust the active binding after validation.

### 6.3 Module Services

When screening, editing, or proofreading creates an `AgentExecutionLog`, pass the resolved expectation fields into the log payload.

This ensures the execution trace carries both:

- the runtime bundle that was used
- the verification/evaluation expectations that governed the run

### 6.4 Admin Governance Evidence Assembly

When loading execution evidence, enrich the response with:

- expected verification check profiles
- expected evaluation suites
- expected release check profile

Compute operator-facing gaps such as:

- evidence IDs attached but not mapped to an expected check profile
- expected check profiles with no recorded evidence
- expected evaluation or release assets that remain unfulfilled

The gap model should stay lightweight and descriptive, not prescriptive.

## 7. Web Workbench Changes

### 7.1 Admin Governance Runtime Binding Form

Load verification assets into the overview:

- check profiles
- release check profiles
- evaluation suites

Then extend the runtime-binding form with selectors for:

- verification check profiles (multi-select)
- evaluation suites (multi-select)
- release check profile (single-select)

The form should default to empty selections so current operator behavior remains unchanged unless they choose to opt in.

### 7.2 Runtime Binding List

Show the configured verification expectation summary for each binding:

- count or labels for check profiles
- linked suite count
- selected release check profile

This makes the linkage visible before execution happens.

### 7.3 Execution Evidence Drilldown

Add a dedicated “Verification Expectations” block that contrasts:

- configured expectation IDs/names
- recorded evidence
- missing expected coverage

This is the key operator-facing payoff of the slice.

## 8. Error Handling

Phase 9R should fail clearly during configuration, not lazily during execution:

- invalid verification references should block runtime-binding creation or activation
- missing historical verification assets in evidence drilldown should degrade to raw IDs for auditability
- empty expectation sets should remain valid and render as “No verification expectations configured”

This keeps old bindings compatible while making new governed expectations reliable.

## 9. Out Of Scope

Phase 9R does not include:

- automatic execution of verification checks
- automatic creation of evaluation runs from governed module execution
- background orchestration of release gates
- automatic evidence generation from tool runs
- model routing changes based on evaluation scores
- worker-side scheduling or multi-agent execution pipelines

Those can build on this linkage later.

## 10. Verification

### 10.1 API / Service Tests

Add or update tests to prove:

- runtime bindings accept and persist valid verification expectation references
- runtime bindings reject missing or invalid verification assets
- governed agent context returns the expected verification metadata
- agent execution logs persist immutable verification expectation traces

### 10.2 Web Tests

Add or update tests to prove:

- Admin Governance loads verification assets into the runtime-binding form
- creating a runtime binding with verification expectations sends the new fields
- evidence drilldown renders expected-vs-recorded verification context

### 10.3 Playwright

Extend Admin Governance browser coverage to prove:

- an operator can create a runtime binding that references check profiles / suites / release profile
- the binding list shows those expectations
- a governed execution drilldown surfaces the configured verification expectations

## 11. Expected Outcome

After Phase 9R:

- runtime governance, evaluation assets, and execution evidence share one traceable contract
- admins can see not only what ran, but what verification/evaluation policy it was supposed to satisfy
- the codebase has a real foundation for later release-gate automation and deeper execution orchestration
