# Phase 8K Inline Upload Persistence and Submission File Picker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade manuscript intake from metadata-only upload triggering to a real browser file-pick flow, while keeping the existing `storageKey` contract for backward compatibility and ensuring uploaded files are persisted to a controlled local directory.

**Architecture:** Keep the domain manuscript upload contract intact and handle inline file persistence at the HTTP/runtime edge. The web submission workbench reads the selected browser file into base64 and submits it to the existing intake route. The API stores that file under a configured local upload root, returns the generated `storage_key`, and then continues through the normal manuscript asset/job lifecycle.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, Node filesystem APIs, existing manuscript workbench controllers and persistent HTTP runtime.

---

## Scope Notes

- Do not introduce multipart uploads or object storage orchestration in this phase.
- Preserve backward compatibility with metadata-only uploads that still provide `storageKey`.
- Keep upload persistence configurable through environment settings so deployments can move the upload root outside the repo checkout.

## Delivered Work

- Added API-side inline upload storage handling that:
  - accepts `fileContentBase64`
  - validates the payload
  - enforces a V1 size cap
  - persists the file under a controlled local upload root
  - returns/persists the resolved `storage_key`
- Kept manuscript upload backward compatible with the pre-existing metadata-only `storageKey` path.
- Added submission workbench support for:
  - a real browser file picker
  - base64 encoding of the selected file
  - optional `storageKey` override
  - upload submission without requiring a manual storage key when a local file is selected
- Added runtime config support for `UPLOAD_ROOT_DIR` in both demo and persistent API entrypoints.
- Synced operational docs so backup/migration guidance includes the inline upload persistence root.

## Verification

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-upload-file.spec.ts ./test/manuscript-workbench-controller.spec.ts`
- `pnpm --filter @medsys/web typecheck`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/http/manuscript-upload-storage.spec.ts ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/http/demo-server-config.spec.ts ./test/http/persistent-server-config.spec.ts`

## Next Recommended Follow-up

- Move from inline base64 upload to multipart/object storage once large-file pressure and worker integration justify it.
- Replace the JSON-heavy submission workbench presentation with a more operator-friendly manuscript/asset/job summary UI.
- Add real browser QA coverage for file-pick upload plus cross-role downstream execution from the same manuscript.
