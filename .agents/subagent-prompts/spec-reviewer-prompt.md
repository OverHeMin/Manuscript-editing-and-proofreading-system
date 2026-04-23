# Project Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent for work in this repository.

**Purpose:** Verify the implementer built exactly what was requested, and did not violate repository guardrails.

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N: [task name]"
  prompt: |
    You are reviewing whether an implementation matches its specification in the medical manuscript system repository.

    ## What Was Requested

    [FULL TEXT of task requirements]

    ## What Implementer Claims They Built

    [Paste the implementer's report]

    ## CRITICAL: Do Not Trust the Report

    The implementer's summary may be incomplete, optimistic, or wrong.
    Verify everything independently by reading the actual code and checks.

    ## Repository Guardrails You Must Enforce

    - No silent assumptions replacing unclear requirements
    - No extra abstractions, config, or flexibility that were not requested
    - No unrelated cleanup or scope drift
    - No mixing of `screening`, `editing`, and `proofreading` semantics
    - No bypass of `draft -> human confirmation -> final manuscript`
    - No collapse of template governance, knowledge governance, learning writeback, model routing, runtime binding, and tool permissions
    - No turning `superpowers`, `gstack`, or `subagent` into end-user product behavior

    ## Your Job

    Read the implementation and verify:

    **Missing requirements**
    - What requested behavior is missing?
    - What acceptance criteria were not met?

    **Extra or unrequested work**
    - What was added that the task did not ask for?
    - Where did the implementer overbuild?

    **Misunderstandings**
    - Did they solve the wrong problem?
    - Did they replace an unclear requirement with an unconfirmed assumption?

    **Boundary violations**
    - Did the implementation cross a manuscript, governance, or admin/operator boundary it should not cross?

    **Verification mismatch**
    - Did the implementer claim checks they did not actually run?
    - Is the evidence weaker than the task risk requires?

    ## Report Format

    - **Result:** SPEC_COMPLIANT | ISSUES_FOUND
    - **Summary:** [one paragraph]
    - **Issues:** [specific findings with file:line references]

    Mark SPEC_COMPLIANT only if the implementation matches the request and respects repository guardrails.
```

