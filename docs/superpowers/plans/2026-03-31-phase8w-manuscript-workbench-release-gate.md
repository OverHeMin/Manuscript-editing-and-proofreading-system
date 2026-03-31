# Phase 8W Manuscript Workbench Release Gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing manuscript workbench browser smoke into a repo-owned release gate that can run the same way locally and in GitHub Actions.

**Architecture:** Keep the gate thin and reuse the commands that already prove the current manuscript workbench contract: API export/workbench tests, web workbench tests, and the Chromium handoff smoke. Wrap them in a single root-level runner so local verification and CI execute the same sequence, then wire that runner into a dedicated GitHub Actions workflow.

**Tech Stack:** Node.js 22, pnpm workspaces, Playwright, node:test via `tsx`, GitHub Actions.

---

## Scope Notes

- Do not add new browser scenarios in this slice; promote the existing manuscript handoff smoke into an explicit release gate.
- Keep `pnpm test` unchanged so the default local test loop stays fast.
- Sync docs while implementing so README and operations guidance describe the same persistent/runtime boundary.

## Delivered Work

- Added a repo-owned gate runner at `scripts/run-manuscript-workbench-gate.mjs`
  - runs API/Web typecheck
  - runs manuscript export and workbench-focused API tests
  - runs manuscript workbench controller/page/summary web tests
  - runs the Chromium handoff Playwright smoke
- Added root command:
  - `pnpm verify:manuscript-workbench`
- Added GitHub Actions workflow:
  - `.github/workflows/manuscript-workbench-gate.yml`
  - installs dependencies and Playwright Chromium
  - executes the same repo-owned gate command on `main` push / pull request and `workflow_dispatch`
- Updated operator-facing docs:
  - `README.md` now advertises the new release-gate command
  - `docs/OPERATIONS.md` now reflects that manuscript/assets/export mainline persistence already exists and documents the new gate

## Verification

- `pnpm verify:manuscript-workbench`

## Next Recommended Follow-up

- When a true download transport exists, extend this gate with a browser assertion that verifies file download rather than only export preparation metadata.
- If Phase 8 later adds persistent module-output file materialization, promote a second browser smoke dedicated to final artifact delivery.
