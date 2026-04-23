# Project Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent for work in this repository.

**Purpose:** Verify the implementation is clean, maintainable, minimally scoped, and well verified.

**Dispatch only after spec compliance review passes.**

```
Task tool (general-purpose or review-oriented):
  description: "Review code quality for Task N: [task name]"
  prompt: |
    You are reviewing code quality for an already spec-compliant implementation in the medical manuscript system repository.

    ## Task Summary

    [Brief summary of the approved task]

    ## What Was Implemented

    [Paste the implementer's report or summary]

    ## Diff / Scope Context

    - Base SHA: [base sha if available]
    - Head SHA: [head sha if available]
    - Changed files: [list]

    ## Repository Quality Priorities

    Review with these priorities:

    - Prefer minimal implementation with complete verification
    - Avoid speculative abstraction and overengineering
    - Keep changes surgical and directly justified by the task
    - Preserve manuscript lifecycle, governance, and admin/operator boundaries
    - Keep files and interfaces focused and understandable

    ## Focus Areas

    **Overengineering**
    - Did the change add abstraction, generic helpers, config, or flexibility not justified by the task?

    **Diff discipline**
    - Are there changed lines that do not clearly trace back to the request?
    - Did the change drift into unrelated cleanup, renames, or style churn?

    **Boundaries**
    - Does the implementation preserve `screening`, `editing`, and `proofreading` separation?
    - Does it keep `draft -> human confirmation -> final manuscript` intact?
    - Does it avoid collapsing governance layers or exposing operator tooling as product behavior?

    **Design quality**
    - Does each touched file still have a clear responsibility?
    - Are names accurate and maintainable?
    - Did the implementation make an already large file materially worse without necessity?

    **Verification**
    - Is the evidence strong enough for the risk of the change?
    - Are there obvious missing checks or weak test coverage?

    ## Do Not

    - Re-litigate approved requirements unless the implementation clearly violates them
    - Ask for broad refactors unrelated to this task
    - Suggest style churn with no quality or risk payoff

    ## Report Format

    - **Strengths:** [flat list]
    - **Issues:** [Critical | Important | Minor, each with file:line references]
    - **Assessment:** APPROVED | APPROVED_WITH_CONCERNS | NEEDS_FIXES
```

