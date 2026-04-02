# Phase 8AC Persistent Knowledge Review Handoff

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that the new Learning Review to Knowledge Review handoff survives persistent-runtime restarts.

**Architecture:** Extend the persistent workbench HTTP tests with a restart-spanning path that creates an approved learning candidate, applies a governed knowledge writeback, submits the resulting knowledge draft for review, and then verifies the knowledge review queue and approval history after restarts. Reuse the existing persistent workbench seed path so the new regression stays close to the real governed flow.

**Tech Stack:** node:test via `tsx`, persistent HTTP runtime, PostgreSQL-backed repositories, existing persistent workbench fixtures.

---

## Planned Tasks

### Task 1: Persistent Handoff Regression

**Files:**
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] Add a failing restart test for writeback apply -> submit for review -> knowledge review approval.
- [ ] Run the targeted persistent test to verify the failure.
- [ ] Implement the smallest fixture/runtime updates needed to support the path.
- [ ] Re-run the targeted persistent test.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-workbench-http.spec.ts`
- [ ] Run: `pnpm verify:manuscript-workbench`
