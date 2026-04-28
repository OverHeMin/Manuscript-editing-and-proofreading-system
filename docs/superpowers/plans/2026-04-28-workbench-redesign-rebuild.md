# Workbench Redesign Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the simplified black-gold manuscript workbench so screening, editing, and proofreading stay compact on the main page, while proofreading and editing document review open in full-screen OnlyOffice-first pages.

**Architecture:** Keep the existing manuscript lifecycle and governed asset model intact. Treat the main workbench as an operator dashboard with one compact queue/status surface, and move complex review details into dedicated detail routes. Reuse existing `OnlyOfficePreviewSurface`, preview-session hydration, manuscript asset routing, and job payload extraction instead of introducing a parallel document viewer.

**Tech Stack:** React, TypeScript, Vite, Node API, PostgreSQL-backed manuscript records, existing `@medical/contracts` types, existing web tests under `apps/web/test`, API HTTP tests under `apps/api/test`.

---

## Current State Findings

- Branch: `codex/ui-workbench-redesign-rebuild`.
- Current tracked working tree is clean for `apps/web/src`; untracked QA screenshots/logs exist and must not be staged by broad `git add .`.
- Residual mojibake risks before implementation:
  - `apps/api/.env` has a mojibake `UPLOAD_ROOT_DIR` path.
  - `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx` contains `PATCH 绫诲瀷`.
  - PostgreSQL still has three historical manuscript titles containing `???`; these can be archived or ignored after user confirmation.
- Existing useful foundations:
  - `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx` already imports and uses `OnlyOfficePreviewSurface`.
  - Proofreading detail has an `issue-workbench` layout with `activeLocateTarget`, `issueMarks`, marker rail, and fallback block rendering.
  - Editing detail currently still falls into `data-editing-layout="shared-review"` when `editingDocumentBlocks.length > 0`.
  - Queue pane already exists in `manuscript-workbench-queue-pane.tsx`, but still includes search, filter tabs, and a top open button that the user wants removed.
  - API route search did not reveal `GET /api/v1/manuscripts?limit=50` or a manuscript archive/delete HTTP endpoint; `PostgresManuscriptRepository.listRecent()` and `PostgresManuscriptRepository.archive()` exist and need HTTP/controller wiring.
  - `buildWorkbenchAssetDetailHref()` currently emits `#editing?...`; the route does not have a separate `mode=editing` query parameter and does not yet support `presentation=fullscreen`.
  - `OnlyOfficeSessionService` currently exposes view-only sessions (`mode: "view"`, `edit: false`, `save_back_enabled: false`), so this plan uses OnlyOffice for visual review/locating, not WPS-like in-place editing and save-back.

## Product Scope

### In Scope

- Keep the black-gold visual theme.
- Fix residual mojibake before feature work.
- Simplify the three module main workbenches:
  - remove top filter chips `全部 / 待处理 / 处理中 / 已完成 / 失败`;
  - remove broken/low-value manuscript lookup from the compact queue;
  - remove redundant “打开稿件” top action where the queue row already has open actions;
  - hide governance/observability cards from the main user-facing surface.
- Preserve manuscript history across navigation using backend-backed recent manuscripts, not only in-memory UI state.
- Add or restore a delete/归档 action for historical manuscript rows.
- Show compact module progress with deterministic labels and percent/progress bar when a job is running.
- Proofreading: detail page opens as a full-screen workbench via button/link, not nested in the main dashboard; issue selection must locate the left document.
- Editing: completed edited DOCX opens as a full-screen OnlyOffice-first review page, with the real `edited_docx` as the main document and a compact right-side human review pane.
- Screening: keep main page simple and provide a result entry; do not implement a screening OnlyOffice workbench in this pass.
- Add regression tests for route selection, queue simplification, deletion/archiving, and preview-session asset choice.

### Out of Scope

- Replacing LibreOffice conversion with OnlyOffice conversion.
- Making OnlyOffice native comments look exactly like WPS/Office if OnlyOffice does not expose that rendering control.
- Reworking model routing, knowledge governance, template governance, or manuscript lifecycle semantics.
- Deleting live user data without explicit user confirmation.

## Files and Responsibilities

- `apps/api/.env`
  - Local runtime config only; repair the upload root path if user confirms local environment repair.
- `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`
  - Fix one mojibake UI label.
- `apps/api/src/http/api-http-server.ts`
  - Add `GET /api/v1/manuscripts?limit=50` if absent.
  - Add `POST /api/v1/manuscripts/:id/archive` only if no existing equivalent route is found.
- `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
  - Expose a safe archive operation that delegates to `ManuscriptRepository.archive()` if the HTTP layer needs it.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
  - Add `listRecentManuscripts()` and `archiveManuscriptAndReloadQueue()` / `archiveManuscript()` controller methods if needed.
  - Ensure recent manuscript list is backend-backed and excludes archived records.
- `apps/web/src/app/workbench-routing.ts`
  - Add optional `presentation` to `WorkbenchHandoff` / `WorkbenchLocation` if full-screen is represented in the route.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
  - Convert the queue to a compact table/list.
  - Remove filter chips, top lookup field, and redundant top open action.
  - Add row-level `打开` and `删除` actions.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  - Wire queue actions, detail links, progress model, fullscreen presentation params, and simplified main module surfaces.
  - Ensure editing detail links target `edited_docx` and pass `presentation=fullscreen`.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
  - Preserve proofreading issue workbench.
  - Add an unconditional editing `edited_docx` OnlyOffice-first branch before the old `editingDocumentBlocks.length > 0` shared-review branch.
  - Keep complex governance cards in the right pane or behind a secondary details section, not in the main dashboard.
- `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
  - Compact queue, progress strip, main dashboard, and full-screen document workbench styling.
- `apps/web/test/manuscript-workbench-page.spec.tsx`
  - Route, queue, progress, history, and delete/archive tests.
- `apps/web/test/manuscript-workbench-queue-pane.spec.tsx`
  - Update tests that currently expect filter chips/search to instead expect the compact row-action queue.
- `apps/web/test/manuscript-workbench-detail.spec.tsx`
  - Editing OnlyOffice-first detail tests and proofreading locate regression tests.
- `apps/api/test/http/persistent-workbench-http.spec.ts`
  - API archive/delete behavior tests if a new HTTP route is added.

---

## Task 0: Preflight Mojibake and Runtime Safety

**Files:**
- Modify: `apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx`
- Local-only repair: `apps/api/.env`
- Optional DB cleanup after user confirmation: `manuscripts` table rows with titles containing `???`

- [ ] **Step 1: Record current state**

Run:

```powershell
git status --short --branch
git diff --name-only
```

Expected: no tracked `apps/web/src` changes before implementation; only known untracked QA/log files.

- [ ] **Step 2: Fix the source label mojibake**

Change:

```tsx
<span>PATCH 绫诲瀷</span>
```

to:

```tsx
<span>PATCH 类型</span>
```

- [ ] **Step 3: Repair local upload root path**

Change `apps/api/.env`:

```env
UPLOAD_ROOT_DIR=C:/Users/Administrator/Documents/医学稿件处理系统/runtime-data/uploads/development
```

This is local config; do not stage it unless the file is tracked and the user explicitly wants local config committed.

- [ ] **Step 4: Decide what to do with historical mojibake manuscripts**

Read only:

```powershell
docker exec infra-postgres-1 psql -U postgres -d medical_api -c "select id,title,status,updated_at from manuscripts where title like '%???%' order by updated_at desc;"
```

If the user confirms deletion/cleanup, prefer archive over hard delete:

```sql
update manuscripts
set status = 'archived', updated_at = now()
where title like '%???%';
```

- [ ] **Step 5: Verify no obvious mojibake remains in touched source**

Run:

```powershell
rg -n "绫诲瀷|鍖|鐞|鑱|錯|濟|�" apps/web/src/features/template-governance apps/web/src/features/manuscript-workbench apps/api/.env
```

Expected: no matches except intentional old test data if explicitly accepted.

---

## Task 1: Lock Down Current Workbench Route Behavior with Tests

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts` only after a failing route test exists.
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-queue-pane.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-detail.spec.tsx`

- [ ] **Step 1: Add a failing test for editing preview-session target**

Add or update a test asserting that editing result preview inputs target the `edited_docx` asset:

```ts
assert.equal(input.assetId, "asset-edited-docx-1");
assert.equal(input.assetType, "edited_docx");
```

Expected before implementation if missing: test fails or current helper targets a non-edited asset.

- [ ] **Step 2: Add a failing test for full-screen editing detail route**

Assert the generated editing result href includes:

```ts
assert.match(href, /^#editing\?/u);
assert.match(href, /assetId=asset-edited-docx-1/u);
assert.match(href, /presentation=fullscreen/u);
```

- [ ] **Step 3: Add route support for `presentation=fullscreen` only after the failing test**

Extend `WorkbenchHandoff` and `WorkbenchLocation`:

```ts
presentation?: "fullscreen";
```

and make `formatWorkbenchHash()` emit:

```ts
if (presentation === "fullscreen") {
  params.set("presentation", presentation);
}
```

Also ensure route parsing reads it back into `WorkbenchLocation`.

- [ ] **Step 4: Add a failing test for queue simplification**

Render the queue and assert:

```ts
assert.doesNotMatch(markup, /data-queue-filter="all"/u);
assert.doesNotMatch(markup, /稿件查找/u);
assert.match(markup, /data-queue-row-action="open"/u);
assert.match(markup, /data-queue-row-action="archive"/u);
```

- [ ] **Step 5: Add a proofreading locate regression test**

Use existing issue workbench fixtures and assert:

```ts
assert.match(markup, /data-proofreading-layout="issue-workbench"/u);
assert.match(markup, /data-proofreading-marker-item-id="issue-1"/u);
assert.match(markup, /data-proofreading-marker-selected="true"/u);
```

- [ ] **Step 6: Run focused tests to confirm failures are meaningful**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-detail.spec.tsx
```

Expected: failures only for newly specified behavior.

---

## Task 2: Compact Queue, History, and Archive Action

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify if needed: `apps/api/src/http/api-http-server.ts`
- Modify if needed: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-queue-pane.spec.tsx`
- Test if API route is added: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Confirm whether list/archive routes already exist**

Run:

```powershell
rg -n "manuscripts\\?limit|listRecent|manuscripts.*archive|archiveManuscript|POST.*archive" apps/api/src apps/web/src/features/manuscript-workbench
```

Expected: if no route exists, implement small `GET /api/v1/manuscripts?limit=50` and `POST /api/v1/manuscripts/:id/archive` routes using existing repository/service capabilities.

- [ ] **Step 2: Implement backend list and archive routes**

`GET /api/v1/manuscripts?limit=50` should:

```ts
return manuscriptRepository.listRecent(limit);
```

`POST /api/v1/manuscripts/:id/archive` should:

```ts
return manuscriptRepository.archive(id, new Date().toISOString());
```

Do not delete document assets or files.

- [ ] **Step 3: Implement controller list/archive methods**

Add a method shaped like:

```ts
listRecentManuscripts(input?: { limit?: number }): Promise<ManuscriptRecord[]>;
archiveManuscript(input: { manuscriptId: string }): Promise<{ archivedId: string }>;
```

It should call the API archive route and reload the recent queue. Do not hard-delete files or assets.

- [ ] **Step 4: Replace queue controls with row actions**

In `ManuscriptWorkbenchQueuePane`, remove:

```tsx
<div className="manuscript-workbench-queue-search">...</div>
<div className="manuscript-workbench-queue-filters">...</div>
```

Keep row-level actions:

```tsx
<button type="button" data-queue-row-action="open">打开</button>
<button type="button" data-queue-row-action="archive">删除</button>
```

Use “删除” as the user-facing label while implementing safe archive semantics.

- [ ] **Step 5: Keep the list compact**

Keep only:

```tsx
title
statusLabel
activityLabel
open/archive actions
```

Do not show governance snapshot ids, quality package ids, or observability asset ids in the queue.

- [ ] **Step 6: Verify queue tests**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-page.spec.tsx
```

Expected: queue simplification tests pass.

---

## Task 3: Main Dashboard Simplification and Progress Model

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx` only if the current dashboard still renders redundant cards there.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Define a compact progress view model**

Use a pure helper in `manuscript-workbench-page.tsx`:

```ts
type ModuleProgressView = {
  module: "screening" | "editing" | "proofreading";
  label: string;
  statusLabel: string;
  percent: number;
  isActive: boolean;
};
```

Map queued/running/completed/failed states to deterministic percent values:

```ts
not_started -> 0
queued -> 12
running -> 55
settling -> 82
completed -> 100
failed -> 100
```

- [ ] **Step 2: Render a single compact module progress strip**

Render one small strip with:

```tsx
<div data-module-progress="editing" aria-valuenow={progress.percent}>
  <span>{progress.statusLabel}</span>
  <strong>{progress.percent}%</strong>
</div>
```

Use CSS animation only for active running state; do not fake progress updates when there is no live job state.

- [ ] **Step 3: Remove redundant intro/status cards**

Delete or hide cards that only repeat:

```text
最近一次校对已完成
这些步骤会做什么
观测资产
治理命中依据
```

Keep these as secondary detail affordances if needed:

```text
查看详情
打开工作台
下载结果
```

- [ ] **Step 4: Keep one primary action per module**

Main area actions:

```text
初筛：开始初筛 / 查看初筛结果
编辑：开始编辑 / 打开编辑稿核验
校对：开始校对 / 打开校对工作台
```

- [ ] **Step 5: Verify dashboard tests**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-page.spec.tsx
```

Expected: tests assert reduced cards and progress strip.

---

## Task 4: Proofreading Full-Screen Workbench Reliability

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts` if `presentation` has not already been added in Task 1.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`

- [ ] **Step 1: Ensure the main page exposes a clear proofreading button**

The user-facing label should be:

```text
打开校对工作台
```

The href should include:

```text
#proofreading
detailKind=proofreading_confirmation
presentation=fullscreen
```

- [ ] **Step 2: Keep proofreading detail full-screen**

For `data-proofreading-layout="issue-workbench"`, CSS should remove nested dashboard constraints and use:

```css
min-height: calc(100vh - 32px);
grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
```

- [ ] **Step 3: Preserve document comments**

Do not move original DOCX comments into custom top cards. Use OnlyOffice rendering when `previewSession` is available and only use fallback blocks inside `details`.

- [ ] **Step 4: Verify right issue locates left document**

Ensure `onProofreadingIssueSelect` updates:

```ts
activeProofreadingIssueId
activeProofreadingLocateTarget
```

and passes `activeLocateTarget` into:

```tsx
<OnlyOfficePreviewSurface activeLocateTarget={activeLocateTarget} />
```

- [ ] **Step 5: Verify proofreading tests**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-detail.spec.tsx test/manuscript-workbench-page.spec.tsx
```

Expected: issue selection markers and fullscreen route tests pass.

---

## Task 5: Editing Full-Screen OnlyOffice Review Page

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts` if `presentation` has not already been added in Task 1.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-detail.spec.tsx`

- [ ] **Step 1: Route editing completed result to the edited DOCX**

Ensure detail-link construction chooses:

```ts
asset.asset_type === "edited_docx"
```

and includes:

```text
presentation=fullscreen
```

- [ ] **Step 2: Build editing preview session for `edited_docx`**

Keep or update preview-session input tests so:

```ts
assert.equal(input.assetType, "edited_docx");
assert.equal(input.assetId, editedDocxAsset.id);
```

- [ ] **Step 3: Add editing OnlyOffice-first branch before shared-review branch**

In `manuscript-workbench-detail.tsx`, branch order must be:

```ts
if (mode === "editing" && detailKind === "document_preview" && asset.asset_type === "edited_docx") {
  return <section data-editing-layout="onlyoffice-review">...</section>;
}

if (mode === "editing" && detailKind === "document_preview" && editingDocumentBlocks.length > 0) {
  return <section data-editing-layout="shared-review">...</section>;
}
```

This prevents real editing results with governance evidence from falling back into the old shared-review card layout.

- [ ] **Step 4: Keep the right pane compact**

Right pane sections:

```text
人工核验
改动台账
阻断项
查看详细治理信息
```

Do not show raw snapshot ids, model ids, quality package ids, or knowledge hit logs in the primary pane.

- [ ] **Step 5: Keep OnlyOffice review-only unless product scope changes**

Do not attempt in-place edit/save-back in this pass because the current OnlyOffice session is view-only:

```ts
mode: "view"
edit: false
save_back_enabled: false
```

The accepted behavior is visual verification plus download/open current document.

- [ ] **Step 6: Use safe Chinese literals**

Edit with `apply_patch` or UTF-8-safe tooling only. Do not use commands that rewrite whole TSX files through a non-UTF-8 console.

- [ ] **Step 7: Verify editing tests**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-detail.spec.tsx test/manuscript-workbench-page.spec.tsx
```

Expected:

```text
data-editing-layout="onlyoffice-review"
data-document-surface-provider="onlyoffice"
```

for edited DOCX cases with preview sessions.

---

## Task 6: Screening Minimal Result Entry

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx` only for small label/routing cleanup.
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Keep screening main page simple**

Show:

```text
开始初筛
查看初筛结果
状态/进度
```

Do not add a screening OnlyOffice workbench in this pass.

- [ ] **Step 2: Move complex screening evidence behind details**

Primary screen should not expose:

```text
治理命中依据
观测资产
知识命中日志
```

Keep these available through a secondary detail view if already present.

- [ ] **Step 3: Verify screening does not regress**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-detail.spec.tsx
```

Expected: screening shared-review tests either remain valid or are updated only if they assert removed primary-dashboard cards.

---

## Task 7: Visual QA and Final Verification

**Files:**
- No planned source changes unless QA reveals a scoped bug.

- [ ] **Step 1: Run typecheck**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected: exit code 0.

- [ ] **Step 2: Run focused web tests**

Run:

```powershell
pnpm.cmd --dir apps/web exec tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-detail.spec.tsx
```

Expected: exit code 0.

- [ ] **Step 3: Run mojibake scan**

Run:

```powershell
rg -n "绫诲瀷|鍖|鐞|鑱|錯|濟|�" apps/web/src/features/manuscript-workbench apps/web/src/features/template-governance apps/api/.env
```

Expected: no unintended matches. If `.env` still matches, repair the local runtime path before restarting services.

- [ ] **Step 4: Run build**

Run:

```powershell
pnpm.cmd --filter @medsys/web build
```

Expected: exit code 0.

- [ ] **Step 5: Restart persistent preview**

Restart only the frontend preview port:

```powershell
$frontProcessIds = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($frontProcessId in $frontProcessIds) { Stop-Process -Id $frontProcessId -Force -ErrorAction SilentlyContinue }
pnpm.cmd --dir apps/web run preview:persistent -- --host 0.0.0.0
```

Expected: `http://192.168.0.119:4173/` serves the new bundle.

- [ ] **Step 6: Manual browser QA**

Check:

```text
1. 上传新稿件后，切换页面再回来，历史稿件仍在。
2. 队列无顶部筛选标签和无效查找。
3. 队列行有打开和删除。
4. 运行中模块显示状态和百分比。
5. 校对“打开校对工作台”进入全屏页。
6. 校对右侧问题点击后左侧文档定位。
7. 编辑已完成稿件进入 OnlyOffice 编辑稿核验页。
8. 筛稿主页面保持简洁，不新增复杂卡片。
9. 黑金主题仍保留。
10. 页面无 mojibake。
```

---

## Execution Notes

- Do not commit unless the user explicitly asks.
- Do not stage untracked screenshots/logs.
- Prefer one task at a time with verification after each task.
- If a task requires data deletion, ask for explicit confirmation and prefer archive over hard delete.
- If OnlyOffice cannot render WPS/Office-style side comment balloons, report it as a product limitation and do not fake comments with custom overlays.
