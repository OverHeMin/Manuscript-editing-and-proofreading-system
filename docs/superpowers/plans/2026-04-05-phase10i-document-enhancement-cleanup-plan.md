# Phase 10I Document Enhancement Cleanup Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only cleanup-plan layer for local document enhancement artifacts, with an optional local manifest, so operators can review next steps without deleting anything.

**Architecture:** Extend the worker-only `document_enhancement` package with a cleanup-plan evaluator that composes the existing retention audit and optionally writes a local JSON manifest. Expose the behavior through a separate CLI that always emits JSON, keep the feature local-first and fail-open, and avoid any API, workbench, or runtime-mainline integration.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `argparse`, and the existing document-enhancement worker helpers.

---

## Scope Notes

- Do not delete artifacts.
- Do not rewrite the local index.
- Do not add API routes, DB writes, or workbench surfaces.
- Keep manifest persistence optional and local-only.

## Planned File Structure

- Worker cleanup-plan evaluator:
  - Create: `apps/worker-py/src/document_enhancement/cleanup_plan.py`
  - Create: `apps/worker-py/src/document_enhancement/cleanup_plan_cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_cleanup_plan.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Cleanup-Plan Contracts And Evaluator

**Files:**
- Create: `apps/worker-py/src/document_enhancement/cleanup_plan.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_cleanup_plan.py`

- [ ] **Step 1: Write the failing cleanup-plan tests**

Add coverage that proves:

```python
assert result.status == "ready"
assert result.planned_action_count == 1
assert result.actions[1].action == "archive_then_cleanup_review"
```

Add failure-path coverage for:

- missing local index degrades into a bounded empty result
- missing artifact files become `index_repair_review`
- optional manifest writing persists a JSON file under a local plan directory
- manifest-write failures degrade but keep the computed plan in memory

- [ ] **Step 2: Run the targeted cleanup-plan tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cleanup_plan.py -v
```

Expected: FAIL because the cleanup-plan module does not exist yet.

- [ ] **Step 3: Implement the cleanup-plan evaluator**

Implementation rules:

- compose the existing retention evaluator instead of duplicating retention logic
- keep action mapping explicit and bounded
- write only an optional local manifest file
- never delete artifacts or rewrite the index

- [ ] **Step 4: Re-run the targeted cleanup-plan tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cleanup_plan.py -v
```

Expected: PASS.

### Task 2: Add The Separate Cleanup-Plan CLI

**Files:**
- Create: `apps/worker-py/src/document_enhancement/cleanup_plan_cli.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/package.json`
- Modify: `apps/worker-py/tests/document_enhancement/test_cleanup_plan.py`

- [ ] **Step 1: Extend cleanup-plan tests with CLI coverage**

Add coverage that proves:

```python
assert payload["status"] == "ready"
assert payload["planned_action_count"] == 1
assert payload["plan_path"] is not None
```

Add failure-path coverage for:

- missing index returns degraded JSON
- `--write-plan` writes a local manifest by default under the audit directory
- `--plan-output-dir` overrides the local manifest directory

- [ ] **Step 2: Run the targeted cleanup-plan tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cleanup_plan.py -v
```

Expected: FAIL until the cleanup-plan CLI exists.

- [ ] **Step 3: Implement the cleanup-plan CLI**

Implementation rules:

- always print JSON
- keep manifest writing opt-in
- preserve local-first, fail-open behavior

- [ ] **Step 4: Re-run the targeted cleanup-plan tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cleanup_plan.py -v
```

Expected: PASS.

### Task 3: Document And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update docs**

Document:

- the new cleanup-plan command
- the optional `--write-plan` behavior
- the fact that the manifest is local-only and non-destructive

- [ ] **Step 2: Re-run the targeted continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cleanup_plan.py -v
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path fixtures/sample.pdf --text-layer missing --write-artifact
pnpm --filter @medical/worker-py run audit:document-enhancement:retention -- --keep-last 1
pnpm --filter @medical/worker-py run audit:document-enhancement:cleanup-plan -- --keep-last 1 --write-plan
```

Expected: PASS, with the cleanup-plan command returning structured JSON and optionally writing a local manifest without deleting files or rewriting `audit-index.json`.

- [ ] **Step 3: Commit the cleanup-plan slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-cleanup-plan-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-cleanup-plan.md
git commit -m "feat: add document enhancement cleanup plan"
```
