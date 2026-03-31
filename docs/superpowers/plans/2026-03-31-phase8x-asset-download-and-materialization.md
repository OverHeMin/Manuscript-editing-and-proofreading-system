# Phase 8X Asset Download And Materialization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn manuscript export from metadata-only preparation into a true downloadable asset flow for the workbench.

**Architecture:** Add a dedicated authenticated download route for document assets, then back it with a local asset materialization service. The service should read existing bytes from the configured upload root when they already exist, and safely materialize missing report/docx artifacts into separate storage keys when the current runtime has only metadata records. The web workbench should render the returned download URL so browser QA can prove that an operator can export and actually download the current asset.

**Tech Stack:** TypeScript, node:test via `tsx`, React/Vite, Playwright, Python stdlib for minimal DOCX generation, existing local upload root storage.

---

## Scope Notes

- Preserve the existing manuscript current-asset resolution rules from Phase 8V.
- Keep every artifact separate: original upload, editing output, proofreading draft report, and proofreading final must remain individually addressable.
- Use a safe fallback when rich DOCX tooling is unavailable: generate a fresh downloadable DOCX artifact instead of rewriting or mutating the original file in place.

## Planned Tasks

### Task 1: HTTP Contract

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] Add failing HTTP tests for export metadata that includes a download URL and for authenticated asset download.
- [ ] Verify the tests fail for the expected missing route/field reasons.
- [ ] Add `GET /api/v1/document-assets/:assetId/download`.
- [ ] Extend the export payload with the route URL.
- [ ] Re-run the targeted HTTP tests.

### Task 2: Asset Materialization

**Files:**
- Create: `apps/api/src/http/local-asset-materialization.ts`
- Create: `apps/worker-py/src/document_pipeline/materialize_docx.py`
- Modify: `apps/api/src/modules/document-pipeline/document-export-service.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/document-pipeline/document-export.spec.ts`

- [ ] Add failing tests for downloading existing upload bytes and for materializing generated editing/proofreading docx assets.
- [ ] Verify the failures.
- [ ] Implement local storage path resolution, report materialization, and minimal DOCX materialization.
- [ ] Keep the output artifact under its own storage key.
- [ ] Re-run the targeted document pipeline tests.

### Task 3: Web Workbench Download Surface

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts`

- [ ] Add failing UI/browser expectations for a download URL/link in `Latest Export`.
- [ ] Verify the tests fail for the expected missing-field reasons.
- [ ] Render the download link in the workbench summary.
- [ ] Extend the browser smoke to verify a real download event.
- [ ] Re-run the targeted web and Playwright tests.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api exec node --import tsx --test test/document-pipeline/document-export.spec.ts test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts`
- [ ] Run: `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-controller.spec.ts test/manuscript-workbench-summary.spec.tsx`
- [ ] Run: `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/manuscript-handoff.spec.ts`
- [ ] Run: `pnpm verify:manuscript-workbench`

## Acceptance Criteria

- Export payloads include a stable authenticated download URL.
- Operators can download the exported current asset through the browser workbench.
- Existing uploaded files download as their real stored bytes.
- Generated report/docx assets materialize to their own storage keys without mutating the original manuscript file in place.
