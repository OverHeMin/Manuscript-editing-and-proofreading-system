# Strict Superpowers Delivery Contract

This repository requires evidence-first delivery for all non-trivial work. Speed must not replace proof.

## When This Applies

Use this contract for any task that changes behavior, UI, API, schema, AI/model flow, manuscript lifecycle, Harness, rules, knowledge, document conversion, table handling, final manuscript generation, or verification logic.

Small read-only analysis may skip implementation steps, but must still separate facts from assumptions.

## Required Sequence

1. **Align**
   - State goal, scope, non-goals, assumptions, and acceptance checks.
   - If the task is ambiguous or high-impact, stop for confirmation before editing.
2. **Design**
   - Give the smallest viable approach and why it is safer than broader alternatives.
   - Identify affected files, interfaces, data, tests, and rollout risk.
3. **Red**
   - Write the failing test or reproducible check before production code.
   - Run it and capture the failure.
   - Confirm the failure is due to the missing behavior, not syntax, encoding, fixture, or environment breakage.
4. **Green**
   - Implement the smallest code change that satisfies the failing test.
   - Do not mix unrelated cleanup, broad rewrites, or speculative abstractions.
5. **Verify**
   - Re-run the same test and show it passes.
   - Run the strongest practical adjacent checks: typecheck, targeted integration tests, build, or browser QA as appropriate.
6. **Report**
   - Report Done, Red, Green, Verification, Partial, Skipped, Risks, and Next.
   - Never claim production readiness without real production-equivalent evidence.

## Maximum Collaboration Protocol

Use `superpowers`, `karpathy-governed-delivery`, and `gstack` together instead of treating them as competing workflows.

### Tool Responsibilities

- **superpowers** owns discovery, design, planning, acceptance boundaries, and Red -> Green -> Verify discipline.
- **karpathy-governed-delivery** owns first-principles implementation discipline: smallest correct change, root cause before fixes, no speculative abstraction, no scope drift, and evidence over confidence.
- **gstack** owns browser-visible and end-to-end evidence: real UI navigation, forms, uploads, screenshots, console errors, visual regressions, and live workflow QA.

### Required Use

- Use `superpowers` for any new behavior, behavior change, bug fix, refactor, architecture decision, or unclear request.
- Use `karpathy-governed-delivery` for every implementation pass in this repository, especially manuscript lifecycle, governed assets, rules, knowledge, Harness, AI/model routing, table handling, DOC/DOCX conversion, or final manuscript generation.
- Use `gstack` whenever the change affects UI, browser workflows, forms, uploads, previews, manual confirmation pages, rule/knowledge authoring pages, or any end-to-end operator flow.

### Collaboration Order

1. `superpowers`: clarify goal, scope, non-goals, assumptions, design, and acceptance checks.
2. `superpowers` TDD: create the failing test/check and prove the expected Red state.
3. `karpathy-governed-delivery`: implement the smallest code change that makes the Red check pass without widening scope.
4. `superpowers` verification: re-run the same check and adjacent automated checks.
5. `gstack`: when browser or workflow behavior matters, perform real UI QA and capture evidence.
6. Final report: state which of the three tools/workflows were used; if one was not used, explain why it was not applicable.

### Conflict Resolution

- Safety and non-destructive behavior outrank all tools.
- User-confirmed goal and factual correctness outrank speed.
- `superpowers` acceptance boundaries outrank implementation convenience.
- `karpathy-governed-delivery` minimality outranks speculative extensibility.
- `gstack` browser evidence can invalidate a passing unit or typecheck result; if gstack finds a bug, return to Red -> Green -> Verify.
- If using a tool would create noise without increasing confidence, skip it only after explicitly stating why.

## Hard Rules

- No production code before a failing test for new behavior or bug fixes, unless the user explicitly approves an exception.
- If a failing test cannot be written first, explain why and use the closest reproducible check before implementation.
- Do not count `run passed` as quality proof for AI workflows. AI workflows need content-level evidence: rule hits, knowledge retrieval, context consistency, residual analysis, human confirmation, Gold Set or equivalent checks, and false-positive/false-negative risk.
- Do not hide blocked or partial states. A gate blocking final output is a valid result when evidence is insufficient.
- Do not write secrets into files, tests, docs, logs, or final reports.

## Medical Manuscript Specific Gates

For proofreading, editing, or document-output work, verification must explicitly state whether these were covered:

- Rule hit evidence
- Knowledge retrieval evidence
- Context consistency / whole-document layer
- Statistics and table layer
- Residual discovery
- Human confirmation path
- Final manuscript generation or finalization gate
- Harness blocking behavior
- Gold Set or substitute acceptance evidence
- DOC/DOCX conversion and complex table risk

If any item is not covered, list it under `Skipped` or `Risks`.

## Required Final Report Shape

- **Done**: what actually changed
- **Red**: failing tests/checks run before implementation and expected failure reason
- **Green**: tests/checks that turned green
- **Verification**: exact commands and results
- **Partial**: partly completed items
- **Skipped**: intentionally skipped items and why
- **Risks**: remaining risks and unknowns
- **Next**: recommended next step
