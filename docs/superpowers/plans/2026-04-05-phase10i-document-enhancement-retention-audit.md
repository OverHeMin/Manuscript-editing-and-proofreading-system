# Phase 10I Document Enhancement Retention Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only local retention audit for document enhancement artifacts so operators can identify cleanup candidates without deleting anything.

**Architecture:** Extend the worker-only `document_enhancement` package with a dedicated retention evaluator and a separate JSON CLI entrypoint. Reuse the local history/index contract, compute retention recommendations from bounded local rules, and keep all behavior local-first, fail-open, and non-destructive.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `datetime`, `argparse`, and existing worker CLI/testing patterns.

---

## Scope Notes

- Do not delete artifacts.
- Do not rewrite the local index.
- Do not add API endpoints, DB writes, or workbench integration.
- Keep the retention audit local-only and read-only.

## Planned File Structure

- Worker retention evaluator:
  - Create: `apps/worker-py/src/document_enhancement/retention.py`
  - Create: `apps/worker-py/src/document_enhancement/retention_cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_retention.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Read-Only Retention Contracts And Evaluator

**Files:**
- Create: `apps/worker-py/src/document_enhancement/retention.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_retention.py`

- [ ] **Step 1: Write the failing retention tests**

Add coverage that proves:

```python
assert result.status == "ready"
assert result.cleanup_review_count == 1
```

Add failure-path coverage for:

- missing local index degrades into an empty result
- entries outside the keep window become cleanup-review candidates
- optional `max_age_days` marks older entries for cleanup review
- missing artifact files surface as advisory reasons, not hard failures

- [ ] **Step 2: Run the targeted retention tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_retention.py -v
```

Expected: FAIL because the retention module does not exist yet.

- [ ] **Step 3: Implement the retention evaluator**

Implementation rules:

- reuse the local history/index lane
- keep ordering newest-first
- emit recommendations and reasons only
- never delete files

- [ ] **Step 4: Re-run the targeted retention tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_retention.py -v
```

Expected: PASS.

### Task 2: Add The Separate Retention Audit CLI

**Files:**
- Create: `apps/worker-py/src/document_enhancement/retention_cli.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/package.json`

- [ ] **Step 1: Extend retention tests with CLI coverage**

Add coverage that proves:

```python
assert payload["status"] == "ready"
assert payload["cleanup_review_count"] == 1
```

Add failure-path coverage for:

- missing index returns degraded JSON
- `--keep-last` and `--max-age-days` shape the advisory output as expected

- [ ] **Step 2: Run the targeted retention tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_retention.py -v
```

Expected: FAIL until the retention CLI exists.

- [ ] **Step 3: Implement the retention CLI**

Implementation rules:

- always print JSON
- use safe defaults
- keep the command fully read-only

- [ ] **Step 4: Re-run the targeted retention tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_retention.py -v
```

Expected: PASS.

### Task 3: Document And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update docs**

Document:

- the new retention audit command
- the safe defaults
- the fact that this command is advisory and non-destructive

- [ ] **Step 2: Re-run the targeted continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path fixtures/sample.pdf --text-layer missing --write-artifact
pnpm --filter @medical/worker-py run audit:document-enhancement:retention -- --keep-last 1
```

Expected: PASS, with the retention audit returning structured JSON and zero destructive side effects.

- [ ] **Step 3: Commit the continuation slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-retention-audit-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-retention-audit.md
git commit -m "feat: add document enhancement retention audit"
```
