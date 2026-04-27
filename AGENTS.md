# Repository Agent Baseline

This repository uses a layered collaboration model. This file defines the default behavior baseline for any coding agent working here.

Use this file together with:
- `docs/CODE_QUALITY.md`
- `docs/REVIEW_CHECKLIST.md`
- `docs/STRICT_SUPERPOWERS_DELIVERY.md`
- `docs/superpowers/specs/11-agent-runtime-and-portable-skills.md`

## Core Rule

Prefer minimal implementation with complete verification.

Short version:
- Ask before guessing.
- Build the smallest change that solves today's problem.
- Touch only code directly related to the task.
- Define verification before claiming the work is done.
- For behavior changes and bug fixes, follow strict Red -> Green -> Verify delivery from `docs/STRICT_SUPERPOWERS_DELIVERY.md`.

## 1. Clarify Before Coding

- Do not silently choose between multiple valid interpretations.
- State assumptions explicitly when proceeding on partial context.
- If a task touches manuscript lifecycle rules, governed asset truth, knowledge binding, rule execution, model routing, runtime binding, or tool permissions, confirm the scope before implementing.
- If a simpler approach exists, prefer it and say so.

## 2. Keep the Implementation Small

- No speculative abstraction, extension point, config flag, or generic helper unless the current task requires it.
- No future-proofing for imagined requirements.
- Error handling should match real failure modes in this repository, not hypothetical impossible cases.
- Verification can be thorough even when the code change stays small.

## 3. Make Surgical Changes

- Change only files and lines that trace directly to the request.
- Do not reformat adjacent code, rewrite unrelated comments, rename symbols for style only, or clean unrelated dead code while "already in there".
- Remove only the imports, variables, or helpers that your own change made obsolete.
- Preserve existing module boundaries unless the current task explicitly includes a boundary repair.

## 4. Work From Verifiable Goals

- Translate requests into checks before implementation.
- Bug fix: reproduce the issue, fix it, then verify the regression is covered.
- New behavior: define acceptance checks first, then implement to meet them.
- Refactor: preserve behavior with before-and-after verification.
- If full verification cannot run, say exactly what ran and what remains unverified.

## 5. Repository Guardrails

- Keep `screening`, `editing`, and `proofreading` semantics separate.
- Do not bypass the governed `draft -> human confirmation -> final manuscript` path.
- Do not collapse template governance, knowledge governance, learning writeback, model routing, and tool permission control into one ad hoc layer.
- Treat `superpowers`, `gstack`, `subagent`, runtime tooling, and admin consoles as operator/admin capabilities, not end-user product behavior.
- Preserve the authority chain for `DocumentAsset` and derived assets.

## 6. Collaboration Layers

- `superpowers` defines what should be built, the plan, and the acceptance boundary.
- `karpathy-governed-delivery` keeps implementation grounded in first principles, minimal scope, root cause, and strong verification.
- `subagent` executes bounded work inside an already approved boundary.
- `gstack` provides browser QA, release checks, and regression evidence.
- This file governs how each layer should behave while doing its work.
- For non-trivial delivery, apply the maximum collaboration protocol in `docs/STRICT_SUPERPOWERS_DELIVERY.md`: superpowers for design/TDD boundaries, karpathy-governed-delivery for disciplined implementation, and gstack for browser or end-to-end evidence.

## 7. Review Questions

- What am I assuming that the user or spec did not confirm?
- What is the smallest diff that solves the problem?
- Which changed lines are not directly justified by the request?
- Is the verification evidence proportional to the change risk?

