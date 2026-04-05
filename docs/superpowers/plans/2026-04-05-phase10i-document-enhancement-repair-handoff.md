# Phase 10I Document Enhancement Repair Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only repair handoff layer for local document enhancement artifacts so operators can save one bounded checklist for manual cleanup or index-repair work.

**Architecture:** Extend the worker-only `document_enhancement` package with a repair-handoff evaluator that composes the existing cleanup-plan and index-consistency evaluators. Expose the result through a separate JSON CLI with optional local manifest persistence, and keep the whole slice local-first, fail-open, and non-destructive.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `argparse`, and the existing document-enhancement worker helpers.

---

## Scope Notes

- Do not repair `audit-index.json`.
- Do not delete or move files.
- Do not add API, DB, or workbench integration.
- Keep the handoff manifest optional and local-only.

## Planned File Structure

- Worker repair-handoff evaluator:
  - Create: `apps/worker-py/src/document_enhancement/repair_handoff.py`
  - Create: `apps/worker-py/src/document_enhancement/repair_handoff_cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_repair_handoff.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Repair-Handoff Contracts And Evaluator

**Files:**
- Create: `apps/worker-py/src/document_enhancement/repair_handoff.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_repair_handoff.py`

- [ ] **Step 1: Write the failing repair-handoff tests**

Add coverage that proves:

```python
assert result.status == "ready"
assert result.actionable_item_count == 2
assert result.items[0].handoff_type == "index_repair_review"
```

Add failure-path coverage for:

- missing local index degrades into a bounded empty handoff
- cleanup-plan actions and consistency issues are merged into one handoff item when they refer to the same local target
- orphan artifacts become `orphan_artifact_review`
- optional handoff writing persists a local JSON file
- handoff-write failures degrade but keep the computed handoff on stdout

- [ ] **Step 2: Run the targeted repair-handoff tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_repair_handoff.py -v
```

Expected: FAIL because the repair-handoff module does not exist yet.

- [ ] **Step 3: Implement the repair-handoff evaluator**

Implementation rules:

- compose existing cleanup and consistency evaluators instead of duplicating their logic
- include only actionable items in the handoff output
- merge overlapping evidence for the same target when practical
- never perform repair actions

- [ ] **Step 4: Re-run the targeted repair-handoff tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_repair_handoff.py -v
```

Expected: PASS.

### Task 2: Add The Separate Repair-Handoff CLI

**Files:**
- Create: `apps/worker-py/src/document_enhancement/repair_handoff_cli.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/package.json`
- Modify: `apps/worker-py/tests/document_enhancement/test_repair_handoff.py`

- [ ] **Step 1: Extend repair-handoff tests with CLI coverage**

Add coverage that proves:

```python
assert payload["status"] == "ready"
assert payload["actionable_item_count"] == 2
assert payload["handoff_path"] is not None
```

Add failure-path coverage for:

- missing index returns degraded JSON
- `--write-handoff` writes a local manifest under a default handoff directory
- `--handoff-output-dir` overrides the local manifest directory

- [ ] **Step 2: Run the targeted repair-handoff tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_repair_handoff.py -v
```

Expected: FAIL until the repair-handoff CLI exists.

- [ ] **Step 3: Implement the repair-handoff CLI**

Implementation rules:

- always print JSON
- keep handoff writing opt-in
- stay fully read-only

- [ ] **Step 4: Re-run the targeted repair-handoff tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_repair_handoff.py -v
```

Expected: PASS.

### Task 3: Document And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update docs**

Document:

- the new repair-handoff command
- the optional `--write-handoff` behavior
- the fact that the result is a human checklist only and does not repair anything

- [ ] **Step 2: Re-run the targeted continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_repair_handoff.py -v
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path fixtures/sample.pdf --text-layer missing --write-artifact
pnpm --filter @medical/worker-py run audit:document-enhancement:repair-handoff -- --keep-last 1 --write-handoff
```

Expected: PASS, with the new command returning structured JSON and optionally writing a local handoff manifest without rewriting local metadata or deleting files.

- [ ] **Step 3: Commit the repair-handoff slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-repair-handoff-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-repair-handoff.md
git commit -m "feat: add document enhancement repair handoff"
```
