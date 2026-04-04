# Phase 10I Document Enhancement History CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate read-only CLI for listing and replaying local document enhancement audit artifacts without touching API persistence or the live manuscript path.

**Architecture:** Extend the worker-only `document_enhancement` package with a dedicated history reader module and a separate JSON CLI entrypoint. Keep all history behavior local-first, bounded to the known index path, and fail-open when local files are missing or malformed.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `argparse`, and existing worker CLI/testing patterns.

---

## Scope Notes

- Do not modify artifact files during history reads.
- Do not add API endpoints, database writes, or workbench read models.
- Do not merge read-only history behavior back into the main audit CLI.
- Keep history listing bounded and local-first.

## Planned File Structure

- Worker history readers:
  - Create: `apps/worker-py/src/document_enhancement/history.py`
  - Create: `apps/worker-py/src/document_enhancement/history_cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_history.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Read-Only History Contracts And Readers

**Files:**
- Create: `apps/worker-py/src/document_enhancement/history.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_history.py`

- [ ] **Step 1: Write the failing history tests**

Add coverage that proves:

```python
assert result.status == "ready"
assert len(result.items) == 2
```

Add failure-path coverage for:

- missing index returns a degraded empty listing
- listing respects a bounded `limit`
- replaying a missing artifact degrades instead of raising
- replaying a present artifact returns the stored advisory report

- [ ] **Step 2: Run the targeted history tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_history.py -v
```

Expected: FAIL because the history module does not exist yet.

- [ ] **Step 3: Implement the read-only history contracts and readers**

Implementation rules:

- read only from the known local index and explicit artifact paths
- treat malformed or missing local files as degraded results
- keep history ordering newest-first

- [ ] **Step 4: Re-run the targeted history tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_history.py -v
```

Expected: PASS.

### Task 2: Add The Separate History CLI

**Files:**
- Create: `apps/worker-py/src/document_enhancement/history_cli.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/package.json`

- [ ] **Step 1: Extend history tests with CLI coverage**

Add coverage that proves:

```python
assert payload["status"] == "ready"
assert payload["items"][0]["document_path"] == "fixtures/latest.pdf"
```

Add failure-path coverage for:

- `--list` with a missing index returns degraded JSON
- `--artifact-path` replays a stored artifact JSON

- [ ] **Step 2: Run the targeted history tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_history.py -v
```

Expected: FAIL until the history CLI exists.

- [ ] **Step 3: Implement the separate history CLI**

Implementation rules:

- keep the CLI read-only
- support bounded listing via `--list --limit <n>`
- support replay via `--artifact-path <local-file>`
- always print JSON to stdout

- [ ] **Step 4: Re-run the targeted history tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_history.py -v
```

Expected: PASS.

### Task 3: Document And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update docs**

Document:

- the separate history CLI command
- default local output directory assumptions
- the fact that history inspection remains local-only and advisory

- [ ] **Step 2: Re-run the targeted continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement:history -- --list
```

Expected: PASS, with the history CLI returning structured JSON even when the local index is empty or missing.

- [ ] **Step 3: Commit the continuation slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-history-cli-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-history-cli.md
git commit -m "feat: add document enhancement history cli"
```
