# Harness Quality Gates

The harness must evaluate content quality separately from execution success.
`run passed` only means the workflow completed. A passed run can still fail the
content gate when it misses expected findings, produces many false positives, or
omits required rule and knowledge evidence.

## Internal-Test Thresholds

- Recall must be at least `0.80`.
- Precision must be at least `0.60`.
- High-risk manual review pass rate must be at least `0.90`.
- Gold-set fixtures must include at least three snippets covering terminology,
  table/text consistency, and statistical-expression issues.
- Deterministic findings must include expected rule hit IDs.
- Knowledge-backed findings must include expected knowledge item IDs.

## Output Contract

`GoldSetAssertionRunner` returns:

- `executionStatus`: original workflow status, unchanged.
- `contentGate.status`: `passed` or `failed`.
- `failedGateIds`: exact content gate failures.
- `metrics`: recall, precision, false positives, false negatives, and manual
  review pass rate.
- `falseNegatives`, `falsePositives`, `ruleCitationFailures`, and
  `knowledgeCitationFailures`: item-level evidence for review.
