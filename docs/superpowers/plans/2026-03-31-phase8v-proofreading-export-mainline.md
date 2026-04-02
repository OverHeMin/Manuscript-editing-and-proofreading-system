# Phase 8V Proofreading Export Mainline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the manuscript workbench operator loop by making `Export Current Asset` reliably export the manuscript's authoritative current asset after proofreading finalization, then surface richer export metadata in the web workbench.

**Architecture:** Fix the export default-selection rule in the API layer first. The asset repository keeps one `is_current` value per asset type, not one for the whole manuscript, so export resolution must follow manuscript pointer fields (`current_proofreading_asset_id`, `current_editing_asset_id`, `current_screening_asset_id`) before falling back to generic asset recency. Once the API returns the correct export target, the web workbench should store the full export payload and render structured export metadata instead of only a storage key string.

**Tech Stack:** TypeScript, node:test via `tsx`, Playwright with bundled Chromium, existing API document pipeline and manuscript workbench UI.

---

## Scope Notes

- Do not redefine the manuscript asset model; fix export resolution to respect the model that already exists.
- Keep proofreading behavior unchanged: draft first, human confirm, final asset pointer second.
- Improve the export summary without introducing a new download transport or file-serving protocol in this slice.

## Delivered Work

- Fixed default export resolution in `DocumentExportService`:
  - default export now follows manuscript current pointers in this order:
    - proofreading final
    - editing current
    - screening current
  - preferred-type exports still work as before
  - fallback recency resolution remains available when no manuscript pointer is present
- Updated all runtime/service wiring so export resolution has access to the manuscript repository in:
  - demo HTTP runtime
  - persistent HTTP runtime
  - in-memory workbench test runtime
  - document export harness tests
- Added regression coverage proving:
  - default export after proofreading final now returns the final proofreading asset, not the original upload
  - workbench controller exports through the governed document-pipeline route
  - browser smoke verifies export after finalization in the real operator handoff flow
- Upgraded the web workbench export state:
  - store the full export payload instead of only the storage key
  - show export file name, download MIME type, source asset, and storage key in `Latest Export`
  - include export metadata in the success action details after an export is prepared

## Verification

- `pnpm --filter @medical/api exec node --import tsx --test test/document-pipeline/document-export.spec.ts`
- `pnpm --filter @medical/api run typecheck`
- `pnpm --filter @medical/api run test`
- `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-controller.spec.ts`
- `pnpm --filter @medsys/web run typecheck`
- `pnpm --filter @medsys/web run test`
- `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/manuscript-handoff.spec.ts`

## Next Recommended Follow-up

- Add one dedicated browser smoke for operator export/download once a true file-download surface exists.
- Consider exposing a clearer export target label in the API response for mini program or downstream client surfaces.
- When CI browser automation is ready, promote the manuscript handoff smoke into a required release gate for the workbench.
