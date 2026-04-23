# Proofreading Quality Control Regression Design

## Goal

Make proofreading quality more controllable without changing the product flow.

This round only covers:

1. Locking the proofreading AI contract.
2. Adding a small regression-grade sample set for high-value proofreading risks.
3. Keeping `screening`, `editing`, and `proofreading` boundaries unchanged.

## Why Now

The governed proofreading loop is now able to:

- keep whole-document continuity for long manuscripts,
- persist residual AI issues,
- hand `manual_only` residuals into the proofreading governance handoff.

The next risk is not missing plumbing. The next risk is drift:

- the proofreading model may change tone or inspection focus across runs,
- important cross-section contradictions may be under-specified in the prompt contract,
- future changes may silently weaken quality without obvious regressions.

## Scope

### In Scope

- strengthen the proofreading AI planning contract in `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
- add deterministic tests for the proofreading contract and payload
- add a minimal regression sample set covering:
  - cross-section contradiction
  - conclusion overclaim
  - terminology or abbreviation consistency

### Out of Scope

- UI redesign
- browser acceptance changes
- changing manuscript lifecycle semantics
- changing Harness routing or residual routing semantics

## Design

### 1. Proofreading Contract Hardening

The proofreading AI planning layer should explicitly encode a stable controlled-review contract:

- identity stays `医学稿件终校审校员`
- the task remains single-pass whole-document proofreading
- output remains issue planning only, never full-manuscript rewriting
- governed coverage remains excluded from residual duplication
- the model is reminded to prioritize high-value medical proofreading checks before generic polish

Add a dedicated `qualityControlChecklist` payload section so the runtime receives machine-readable review priorities in addition to the system prompt text.

### 2. Regression Focus Set

Add a minimal deterministic regression set with three recurring risk classes:

- cross-section contradiction:
  methods, results, conclusion, sample size, population definition, follow-up window
- conclusion overclaim:
  conclusion stronger than evidence or study design
- terminology consistency:
  first mention expansion, abbreviation casing, unit style consistency

These are not meant to prove model quality by themselves. They are meant to prove that future code changes keep feeding the model the same controlled contract.

### 3. Verification

Verification for this round should stay deterministic:

- targeted proofreading tests
- no product-flow changes
- no reliance on live provider output for unit-level pass/fail

## Acceptance Checks

1. The proofreading planning payload contains a stable quality-control contract.
2. The contract explicitly covers whole-document review, governed exclusion, and no full-text rewriting.
3. The regression sample tests cover contradiction, overclaim, and terminology focus.
4. Existing proofreading planning tests still pass.

## Notes

This is intentionally the smallest step that improves controllability before we invest more in human-review UI and broader acceptance automation.
