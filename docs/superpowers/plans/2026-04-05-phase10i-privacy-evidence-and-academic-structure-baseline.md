# Phase 10I Privacy Evidence And Academic Structure Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a worker-only, local-first advisory evidence slice for privacy prechecks and OCR / academic-structure readiness without changing the manuscript mainline.

**Architecture:** Add a new `document_enhancement` worker package with explicit advisory contracts, a bounded heuristic privacy precheck, OCR / structure adapter availability assessment, and one JSON CLI entrypoint. Keep all behavior fail-open and read-only so missing adapters degrade to advisory evidence instead of blocking runtime flows.

**Tech Stack:** Python 3.12+, `pytest`, stdlib `argparse`, `json`, `pathlib`, `re`, and `shutil`.

---

## Scope Notes

- Do not wire the new audit command into screening, editing, proofreading, routing, or verification-ops execution.
- Do not add cloud OCR or hosted privacy dependencies.
- Do not auto-run OCR, anonymization, or structure extraction.
- Keep outputs advisory and operator-owned.
- Prefer worker-local modules and focused tests over cross-project refactors.

## Planned File Structure

- Worker advisory evidence package:
  - Create: `apps/worker-py/src/document_enhancement/contracts.py`
  - Create: `apps/worker-py/src/document_enhancement/privacy.py`
  - Create: `apps/worker-py/src/document_enhancement/academic_structure.py`
  - Create: `apps/worker-py/src/document_enhancement/cli.py`
  - Create: `apps/worker-py/src/document_enhancement/__init__.py`
- Worker tests:
  - Create: `apps/worker-py/tests/document_enhancement/test_privacy.py`
  - Create: `apps/worker-py/tests/document_enhancement/test_academic_structure.py`
  - Create: `apps/worker-py/tests/document_enhancement/test_cli.py`
- Package and docs:
  - Modify: `apps/worker-py/package.json`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Advisory Privacy Evidence Contracts

**Files:**
- Create: `apps/worker-py/src/document_enhancement/contracts.py`
- Create: `apps/worker-py/src/document_enhancement/privacy.py`
- Create: `apps/worker-py/tests/document_enhancement/test_privacy.py`

- [ ] **Step 1: Write the failing privacy tests**

Add coverage that proves:

```python
assert result.status == "needs_review"
assert result.findings[0].category == "email"
```

Add failure-path coverage for:

- missing text input degrades to advisory evidence instead of raising
- text containing email / phone / ID-like markers emits findings
- configured `Presidio` endpoints are surfaced as adapter metadata only

- [ ] **Step 2: Run the targeted privacy tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_privacy.py -v
```

Expected: FAIL because the new privacy advisory module does not exist yet.

- [ ] **Step 3: Implement the privacy advisory contracts**

Implementation rules:

- keep the scan bounded to explicit heuristic patterns
- make the result clearly advisory, not authoritative
- never require `Presidio` to be installed for the function to return

- [ ] **Step 4: Re-run the targeted privacy tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_privacy.py -v
```

Expected: PASS.

### Task 2: Add OCR / Academic Structure Advisory Contracts

**Files:**
- Create: `apps/worker-py/src/document_enhancement/academic_structure.py`
- Create: `apps/worker-py/tests/document_enhancement/test_academic_structure.py`

- [ ] **Step 1: Write the failing academic-structure tests**

Add coverage that proves:

```python
assert result.status == "degraded"
assert result.recommended_path == ["ocrmypdf_local", "paddleocr_local", "grobid_local"]
```

Add failure-path coverage for:

- scanned PDF with no available OCR / structure adapters degrades instead of raising
- PDF with known text layer and configured `GROBID` reports a bounded ready path
- `.docx` inputs remain non-blocking and do not pretend OCR is required

- [ ] **Step 2: Run the targeted academic-structure tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_academic_structure.py -v
```

Expected: FAIL because the advisory module does not exist yet.

- [ ] **Step 3: Implement the academic-structure advisory contracts**

Implementation rules:

- infer document kind from the local path only
- treat adapter readiness as advisory metadata
- keep the output read-only and fail-open

- [ ] **Step 4: Re-run the targeted academic-structure tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_academic_structure.py -v
```

Expected: PASS.

### Task 3: Add The Local Audit CLI And Docs

**Files:**
- Create: `apps/worker-py/src/document_enhancement/cli.py`
- Create: `apps/worker-py/src/document_enhancement/__init__.py`
- Create: `apps/worker-py/tests/document_enhancement/test_cli.py`
- Modify: `apps/worker-py/package.json`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Write the failing CLI tests**

Add coverage that proves:

```python
assert payload["privacy"]["status"] == "needs_review"
assert payload["academic_structure"]["document_kind"] == "pdf"
```

Add failure-path coverage for:

- no `--text-file` still returns a structured degraded privacy section
- unavailable adapters still return a JSON report with `status` and `notes`

- [ ] **Step 2: Run the targeted CLI tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_enhancement/test_cli.py -v
```

Expected: FAIL until the CLI exists.

- [ ] **Step 3: Implement the CLI, package script, and docs**

Implementation rules:

- keep CLI input local-path based
- print JSON to stdout only
- never auto-write audit records into API persistence
- document clearly that this is an advisory evidence tool, not a runtime dependency

- [ ] **Step 4: Re-run the end-to-end targeted 10I verification set**

Run:

```bash
pnpm --filter @medical/worker-py run test
pnpm --filter @medical/worker-py run typecheck
pnpm --filter @medical/worker-py exec python -m src.document_enhancement.cli --document-path fixtures/sample.pdf --text-layer missing
```

Expected: PASS, with the CLI returning a structured JSON audit report.

- [ ] **Step 5: Commit the 10I slice**

Run:

```bash
git add apps/worker-py/src/document_enhancement apps/worker-py/tests/document_enhancement apps/worker-py/package.json README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10i-privacy-evidence-and-academic-structure-baseline-design.md docs/superpowers/plans/2026-04-05-phase10i-privacy-evidence-and-academic-structure-baseline.md
git commit -m "feat: add document enhancement advisory evidence"
```
