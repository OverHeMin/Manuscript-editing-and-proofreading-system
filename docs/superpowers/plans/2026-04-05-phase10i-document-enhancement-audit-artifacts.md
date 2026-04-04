# Phase 10I Document Enhancement Audit Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded local artifact persistence for document enhancement advisory reports without introducing API persistence or any live manuscript-path dependency.

**Architecture:** Extend the worker-only `document_enhancement` package with one artifacts module plus explicit CLI flags for optional local writes. Keep stdout JSON as the default behavior, and treat all artifact-writing failures as degraded advisory evidence instead of hard failures.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `json`, `pathlib`, `datetime`, and existing worker CLI/testing patterns.

---

## Scope Notes

- Do not write audit artifacts into PostgreSQL or any API contract.
- Do not make artifact persistence mandatory for the advisory CLI.
- Do not add cloud or hosted sinks.
- Keep writes local-first, additive, and operator-triggered.
- Prefer focused worker modules and tests over cross-project refactors.

## Planned File Structure

- Worker artifact persistence:
  - Create: `apps/worker-py/src/document_enhancement/artifacts.py`
  - Modify: `apps/worker-py/src/document_enhancement/contracts.py`
  - Modify: `apps/worker-py/src/document_enhancement/cli.py`
  - Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_artifacts.py`
  - Modify: `apps/worker-py/tests/document_enhancement/test_cli.py`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Local Artifact Persistence Contracts

**Files:**
- Create: `apps/worker-py/src/document_enhancement/artifacts.py`
- Modify: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/tests/document_enhancement/test_artifacts.py`

- [ ] **Step 1: Write the failing artifact tests**

Add coverage that proves:

```python
assert result.status == "written"
assert result.index_path.name == "audit-index.json"
```

Add failure-path coverage for:

- default output directory resolves to `.local-data/document-enhancement-audits/manual`
- a written artifact is appended into a newest-first index manifest
- write failures degrade into a structured result instead of raising

- [ ] **Step 2: Run the targeted artifact tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_artifacts.py -v
```

Expected: FAIL because the artifacts module does not exist yet.

- [ ] **Step 3: Implement artifact persistence contracts**

Implementation rules:

- keep artifact file naming stable and local-path safe
- keep the index compact and additive
- never require the artifact write to succeed for the report to exist

- [ ] **Step 4: Re-run the targeted artifact tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_artifacts.py -v
```

Expected: PASS.

### Task 2: Extend The CLI With Optional Artifact Writes

**Files:**
- Modify: `apps/worker-py/src/document_enhancement/cli.py`
- Modify: `apps/worker-py/src/document_enhancement/__init__.py`
- Modify: `apps/worker-py/tests/document_enhancement/test_cli.py`

- [ ] **Step 1: Write the failing CLI artifact tests**

Add coverage that proves:

```python
assert payload["artifact"]["status"] == "written"
assert payload["artifact"]["artifact_path"].endswith(".json")
```

Add failure-path coverage for:

- stdout-only mode still reports `artifact.status == "skipped"`
- explicit write mode writes into the default local directory
- explicit write mode with a bad output path degrades instead of crashing

- [ ] **Step 2: Run the targeted CLI tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cli.py -v
```

Expected: FAIL until the CLI exposes artifact persistence.

- [ ] **Step 3: Implement optional CLI artifact persistence**

Implementation rules:

- keep stdout JSON as the default path
- add explicit flags for local artifact writing
- include the artifact outcome in the emitted JSON envelope

- [ ] **Step 4: Re-run the targeted CLI tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cli.py -v
```

Expected: PASS.

### Task 3: Document The Local Artifact Lane And Verify End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Update README and operations docs**

Document:

- the default output path
- the optional `--output-dir` override
- the fact that this is a local advisory artifact lane, not API persistence

- [ ] **Step 2: Re-run the targeted 10I continuation verification set**

Run:

```bash
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path fixtures/sample.pdf --text-layer missing --write-artifact
```

Expected: PASS, with the CLI returning JSON that includes an `artifact` section and with a local artifact written under `.local-data/document-enhancement-audits/manual`.

- [ ] **Step 3: Commit the continuation slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-document-enhancement-audit-artifacts-design.md docs/superpowers/plans/2026-04-05-phase10i-document-enhancement-audit-artifacts.md
git commit -m "feat: persist local document enhancement audits"
```
