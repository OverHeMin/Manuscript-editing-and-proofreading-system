# Phase 10I Document Enhancement Index Consistency Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only local index consistency audit for document enhancement artifacts so operators can inspect local drift between `audit-index.json` and the filesystem without repairing anything.

**Architecture:** Extend the worker-only `document_enhancement` package with a dedicated index-consistency evaluator and a separate JSON CLI. Reuse the local artifact/index contract, scan only repository-local filesystem state, and keep all results advisory, bounded, and fail-open.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `argparse`, and existing worker document-enhancement helpers.

---

## Scope Notes

- Do not rewrite `audit-index.json`.
- Do not delete or move files.
- Do not add API, DB, or workbench integration.
- Keep the scan bounded to the chosen local output directory.

## Planned File Structure

- Worker index-consistency evaluator:
  - Create: `apps/worker-py/src/document_enhancement/index_consistency.py`
  - Create: `apps/worker-py/src/document_enhancement/index_consistency_cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_index_consistency.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Index-Consistency Contracts And Evaluator

**Files:**
- Create: `apps/worker-py/src/document_enhancement/index_consistency.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_index_consistency.py`

- [ ] **Step 1: Write the failing index-consistency tests**

Add coverage that proves:

```python
assert result.status == "ready"
assert result.issue_count == 1
assert result.issues[0].issue_type == "missing_artifact"
```

Add failure-path coverage for:

- missing local index degrades into an empty result
- duplicate index entries are surfaced as consistency issues
- malformed index entries are surfaced as consistency issues
- orphan artifact JSON files not referenced by the index are surfaced as consistency issues

- [ ] **Step 2: Run the targeted index-consistency tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_index_consistency.py -v
```

Expected: FAIL because the index-consistency module does not exist yet.

- [ ] **Step 3: Implement the index-consistency evaluator**

Implementation rules:

- reuse the existing local index helpers
- scan only the chosen local output directory
- skip `audit-index.json` and helper subdirectories such as `plans/`
- emit issues only; never repair anything

- [ ] **Step 4: Re-run the targeted index-consistency tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_index_consistency.py -v
```

Expected: PASS.

### Task 2: Add The Separate Index-Consistency CLI

**Files:**
- Create: `apps/worker-py/src/document_enhancement/index_consistency_cli.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/package.json`
- Modify: `apps/worker-py/tests/document_enhancement/test_index_consistency.py`

- [ ] **Step 1: Extend index-consistency tests with CLI coverage**

Add coverage that proves:

```python
assert payload["status"] == "ready"
assert payload["issue_count"] == 1
```

Add failure-path coverage for:

- missing index returns degraded JSON
- the CLI reports orphan artifact files without treating helper directories as artifacts

- [ ] **Step 2: Run the targeted index-consistency tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_index_consistency.py -v
```

Expected: FAIL until the index-consistency CLI exists.

- [ ] **Step 3: Implement the index-consistency CLI**

Implementation rules:

- always print JSON
- keep safe defaults
- stay fully read-only

- [ ] **Step 4: Re-run the targeted index-consistency tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_index_consistency.py -v
```

Expected: PASS.

### Task 3: Document And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update docs**

Document:

- the new index-consistency command
- the issue types it can report
- the fact that it does not repair the index or local files

- [ ] **Step 2: Re-run the targeted continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_index_consistency.py -v
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path fixtures/sample.pdf --text-layer missing --write-artifact
pnpm --filter @medical/worker-py run audit:document-enhancement:index-consistency
```

Expected: PASS, with the new command returning structured JSON issues without rewriting local metadata or deleting artifacts.

- [ ] **Step 3: Commit the consistency-audit slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-index-consistency-audit-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-index-consistency-audit.md
git commit -m "feat: add document enhancement index consistency audit"
```
