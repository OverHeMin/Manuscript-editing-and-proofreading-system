# Agent Collaboration Baseline

## Purpose

This document explains how the repository combines a lightweight behavioral baseline with `superpowers`, `gstack`, and `subagent` without turning them into competing control planes.

The short rule is:

> Implement minimally, verify completely, and keep every layer inside a clear boundary.

## Layer Model

| Layer | Primary responsibility | Should not do |
| --- | --- | --- |
| `AGENTS.md` baseline | Constrain agent behavior during coding, review, and refactoring | Replace specs, plans, or QA workflows |
| `superpowers` | Shape specs, plans, decisions, and acceptance boundaries | Bypass repository guardrails or ship unverified changes |
| `subagent` | Execute bounded, already approved work | Expand scope, redefine requirements, or collapse governance layers |
| `gstack` | Provide browser QA, release checks, and regression evidence | Redefine product scope or stand in for domain governance |

## Default Execution Order

1. Start from the user request and the relevant repository spec or plan.
2. Read `AGENTS.md` to set the default behavior baseline.
3. Use `superpowers` when the work needs structured design, planning, or approval boundaries.
4. Use `subagent` only after the task boundary is already clear and approved.
5. Use `gstack` when the task needs browser QA, release confidence, visual checks, or runtime evidence.

## Conflict Resolution

When these layers feel in tension, use this order:

1. User request and approved repository spec
2. Repository guardrails in `AGENTS.md`
3. Detailed quality rules in `docs/CODE_QUALITY.md` and `docs/REVIEW_CHECKLIST.md`
4. Tool-specific workflows from `superpowers`, `gstack`, or `subagent`

The most common tension is "minimal code" versus "complete verification". In this repository, the answer is not to weaken verification. Keep the implementation small and keep the evidence strong.

## Repository-Specific Boundaries

- `screening`, `editing`, and `proofreading` remain distinct business lanes.
- The governed `draft -> human confirmation -> final manuscript` path must stay intact.
- `DocumentAsset` and derived assets keep a traceable authority chain.
- Template governance, knowledge governance, learning writeback, model routing, runtime binding, and tool permissions stay separately governed.
- `superpowers`, `gstack`, `subagent`, and related runtime tooling are operator or admin capabilities. They are not end-user product features.

## Review Overlay

In addition to the existing review checklist, this baseline adds four recurring questions:

- Did the implementation rely on an assumption that was never surfaced?
- Did it add abstraction, flexibility, or configurability that the task did not require?
- Did the diff drift into nearby files or logic that were not part of the request?
- Is the verification evidence strong enough for the risk level of the change?

## Project Subagent Prompt Templates

For teams using bounded subagent execution in this repository, use the project-scoped prompt templates here:

- `.agents/subagent-prompts/implementer-prompt.md`
- `.agents/subagent-prompts/spec-reviewer-prompt.md`
- `.agents/subagent-prompts/code-quality-reviewer-prompt.md`

These templates intentionally mirror the global `superpowers:subagent-driven-development` split:

- implementer
- spec compliance reviewer
- code quality reviewer

The difference is that the project-local versions inject this repository's governed-delivery rules directly into the dispatched prompt, so subagents do not need to infer them from general guidance.

## References

- `AGENTS.md`
- `docs/CODE_QUALITY.md`
- `docs/REVIEW_CHECKLIST.md`
- `docs/superpowers/specs/11-agent-runtime-and-portable-skills.md`
