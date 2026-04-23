---
name: karpathy-governed-delivery
description: Use when writing, reviewing, or refactoring code in this repository and there is risk of silent assumptions, overengineering, scope drift, or weak verification. Applies especially to manuscript lifecycle logic, governed assets, knowledge or rule binding, multi-module changes, and agent tooling boundaries.
---

# Karpathy Governed Delivery

Use this skill as a behavior overlay, not as a replacement workflow. The governing idea is simple: verify completely, implement minimally.

## Core Pattern

1. Surface assumptions before editing.
2. Choose the smallest change that solves the requested problem.
3. Touch only code that traces directly to the task.
4. Define acceptance checks before calling the work done.

## In This Repository

- Keep `screening`, `editing`, and `proofreading` separate.
- Do not bypass `draft -> human confirmation -> final`.
- Do not blur template, knowledge, learning, routing, and tool-permission governance.
- Treat `superpowers`, `gstack`, and `subagent` as admin or operator tooling, not end-user product features.

## How It Fits

- Use `superpowers` to shape the spec, plan, and acceptance boundary.
- Use `subagent` only for bounded work inside an approved plan.
- Use `gstack` for browser QA, release checks, and verification evidence.
- Use this skill to keep all of those layers from overbuilding, drifting, or silently guessing.

## Quick Checks

- What am I assuming?
- What is the smallest diff that works?
- Which changed lines are not directly justified by the request?
- How will I verify this before claiming completion?

## Red Flags

- "I already know what they meant."
- "We may need this abstraction later."
- "I'll clean up these nearby files while I'm here."
- "The change is small, so I can skip verification."

If any red flag appears, pause and tighten scope.

