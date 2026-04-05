# Phase 10I Document Enhancement Operator Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a worker-only operator summary snapshot that closes the 10I evidence lane with one bounded JSON view over recent history, retention pressure, consistency drift, and repair attention.

**Architecture:** Extend the worker-only `document_enhancement` package with an operator-summary evaluator that reuses existing history, retention, and repair-handoff logic. Expose the result through a separate JSON CLI with optional local summary snapshot persistence, and keep the whole slice local-first, fail-open, and non-destructive.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `argparse`, and the existing document-enhancement worker helpers.

---

## Scope Notes

- Do not repair `audit-index.json`.
- Do not delete or move files.
- Do not add API, DB, or workbench integration.
- Keep summary snapshot persistence optional and local-only.
- Prevent helper manifests from being reported as orphan artifacts.

## Planned File Structure

- Worker operator-summary evaluator:
  - Create: `apps/worker-py/src/document_enhancement/operator_summary.py`
  - Create: `apps/worker-py/src/document_enhancement/operator_summary_cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/index_consistency.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_operator_summary.py`
  - Modify: `apps/worker-py/tests/document_enhancement/test_index_consistency.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Operator-Summary Contracts And Evaluator

**Files:**
- Create: `apps/worker-py/src/document_enhancement/operator_summary.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_operator_summary.py`

- [ ] **Step 1: Write the failing operator-summary tests**

Add coverage that proves:

```python
assert result.status == "ready"
assert result.indexed_artifact_count == 2
assert result.attention_item_count == 1
```

Add failure-path coverage for:

- missing local index degrades into a bounded empty summary
- recent history and status breakdowns are aggregated from the local index
- repair-handoff items are bounded by `attention_limit`
- optional summary writing persists a local JSON snapshot
- summary-write failures degrade but keep the computed summary on stdout

- [ ] **Step 2: Run the targeted operator-summary tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_operator_summary.py -v
```

Expected: FAIL because the operator-summary module does not exist yet.

- [ ] **Step 3: Implement the operator-summary evaluator**

Implementation rules:

- reuse existing history, retention, and repair-handoff evaluators instead of duplicating their logic
- keep guidance and attention lists bounded and deterministic
- never perform repair or cleanup actions

- [ ] **Step 4: Re-run the targeted operator-summary tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_operator_summary.py -v
```

Expected: PASS.

### Task 2: Add The Separate Operator Summary CLI And Helper-Path Guard

**Files:**
- Create: `apps/worker-py/src/document_enhancement/operator_summary_cli.py`
- Modify: `apps/worker-py/src/document_enhancement/index_consistency.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/package.json`
- Modify: `apps/worker-py/tests/document_enhancement/test_operator_summary.py`
- Modify: `apps/worker-py/tests/document_enhancement/test_index_consistency.py`

- [ ] **Step 1: Extend tests with CLI and helper-path coverage**

Add coverage that proves:

```python
assert payload["status"] == "ready"
assert payload["summary_path"] is not None
assert payload["attention_items"][0]["handoff_type"] == "archive_then_cleanup_review"
```

Add failure-path coverage for:

- missing index returns degraded JSON
- `--write-summary` writes a local manifest under a default summary directory
- `--summary-output-dir` overrides the local manifest directory
- helper directories such as `plans/`, `repair-handoffs/`, and the new summary directory are skipped by index-consistency orphan scans

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_operator_summary.py tests/document_enhancement/test_index_consistency.py -v
```

Expected: FAIL until the CLI and helper-path guard exist.

- [ ] **Step 3: Implement the operator-summary CLI and helper-path guard**

Implementation rules:

- always print JSON
- keep snapshot writing opt-in
- treat helper manifests as non-artifact support files

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_operator_summary.py tests/document_enhancement/test_index_consistency.py -v
```

Expected: PASS.

### Task 3: Document And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update docs**

Document:

- the new operator-summary command
- the optional `--write-summary` behavior
- the fact that the result is a human-facing local evidence snapshot only

- [ ] **Step 2: Re-run the targeted continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_operator_summary.py tests/document_enhancement/test_index_consistency.py -v
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path fixtures/sample.pdf --text-layer missing --write-artifact
pnpm --filter @medical/worker-py run audit:document-enhancement:operator-summary -- --keep-last 1 --write-summary
```

Expected: PASS, with the new command returning structured JSON and optionally writing a local summary snapshot without rewriting local metadata or deleting files.

- [ ] **Step 3: Commit the operator-summary slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-operator-summary-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-operator-summary.md
git commit -m "feat: add document enhancement operator summary"
```
