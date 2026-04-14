# Manuscript Workbench Final Desk And Governed Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the manuscript operator experience into one consistent desk family for `初筛 / 编辑 / 校对`, while preserving batch processing, moving manuscript-type choice out of the mandatory upload step, and keeping governed template binding aligned with V1 business rules.

**Architecture:** Keep the existing `manuscript-workbench` workbench id, controller, and governed manuscript/runtime flow, but simplify the operator posture around one shared desk: narrow left queue rail, bounded batch slab, dominant central working canvas, and low-frequency actions tucked into drawers or compact panels. Reuse the existing manuscript upload, manuscript-type recognition, template-family selection, and batch-job infrastructure instead of replacing it, then shift the visible decision model to `AI识别稿件类型 -> 系统自动绑定基础模板族 -> 操作员仅在需要时修正大模板或选择期刊模板`.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing `apps/web/src/features/manuscript-workbench`, existing manuscript/template clients in `apps/web/src/features/manuscripts` and `apps/web/src/features/templates`, backend manuscript lifecycle and governed resolution services in `apps/api`, workspace contracts in `packages/contracts`.

---

## Scope And Status

This plan implements the manuscript-workbench phase in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

This plan follows the approved redesign decisions captured in:

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-04-editorial-workbench-ui-refresh-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-04-editorial-workbench-ui-refresh-design.md)
- [2026-04-12-manuscript-quality-v2-governance-and-branching-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md)

The final manuscript-workbench rules are fixed:

- operator-facing daily work should center on `初筛 / 编辑 / 校对`
- existing `submission` mode may remain for compatibility, but it must no longer feel like a separate product
- the three core workbenches must share one family layout
- batch processing remains required
- the default batch cap stays `10`
- manuscript type is not a mandatory pre-upload field
- AI identifies manuscript type after upload
- the system auto-binds the matching `基础模板族`
- if journal information is unclear, the manuscript continues with the base family only
- `期刊模板` remains an optional manual dropdown
- `大模板族` correction remains available only as a secondary operator override
- downstream pages must not carry their own provider/model/temperature control walls after centralized `AI接入` lands

This plan does **not** do the following:

- author new `通用校对包` or `医学专用包` logic
- redesign Harness controls inside the manuscript workbench
- replace governed manuscript/runtime APIs with a new protocol
- remove existing compatibility routes or handoff context without an explicit replacement

## File Structure

### Web manuscript-workbench surface

- `apps/web/src/features/manuscript-workbench/index.ts`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-notice.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`

### Web manuscript/template client layer

- `apps/web/src/features/manuscripts/index.ts`
- `apps/web/src/features/manuscripts/manuscript-api.ts`
- `apps/web/src/features/manuscripts/types.ts`
- `apps/web/src/features/templates/index.ts`
- `apps/web/src/features/templates/template-api.ts`
- `apps/web/src/features/templates/types.ts`

### Backend manuscript and governed-resolution layer

- `packages/contracts/src/manuscript.ts`
- `packages/contracts/src/governed-execution.ts`
- `apps/api/src/modules/manuscripts/manuscript-record.ts`
- `apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts`
- `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- `apps/api/src/modules/manuscripts/manuscript-api.ts`
- `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
- `apps/api/src/modules/execution-resolution/execution-resolution-api.ts`
- `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- `apps/api/src/modules/shared/module-run-support.ts`
- `apps/api/src/http/api-http-server.ts`

### Tests

- `apps/web/test/manuscript-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-controls.spec.tsx`
- `apps/web/test/manuscript-workbench-controller.spec.ts`
- `apps/web/test/manuscript-workbench-notice.spec.tsx`
- `apps/web/test/manuscript-workbench-routing.spec.ts`
- `apps/web/test/manuscript-workbench-summary.spec.tsx`
- `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- `apps/api/test/manuscripts/manuscript-template-selection.spec.ts`
- `apps/api/test/execution-resolution/execution-resolution.spec.ts`
- `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- `apps/api/test/shared/governed-module-context.spec.ts`
- `apps/api/test/http/manuscript-upload-storage.spec.ts`

## Task 1: Lock the final manuscript-desk posture around one shared family

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-notice.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-notice.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-routing.spec.ts`

- [ ] **Step 1: Write failing page tests for the final shared-desk layout**

Cover:

- `初筛 / 编辑 / 校对` share one desk shell
- the page does not render a large internal hero or marketing intro
- the layout is:
  - left queue/search rail
  - bounded batch area
  - dominant central focus canvas
- editing and proofreading no longer feel like a different product from screening
- old `submission` mode stays compatible, but its copy and layout read as intake within the same desk family rather than a fourth independent console

- [ ] **Step 2: Run the manuscript-workbench page tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/manuscript-workbench-notice.spec.tsx ./test/manuscript-workbench-routing.spec.ts
```

Expected: FAIL because the current workbench still carries older summary bands, broader side regions, and compatibility language that does not yet fully match the final desk family.

- [ ] **Step 3: Implement the final shared desk frame**

Apply these rules:

- left rail owns queue and quick search
- batch tools stay visible but bounded
- central canvas owns the main manuscript judgment or document-processing work
- low-frequency actions stay out of the permanent main width
- stage-specific emphasis is communicated through central content, not through separate overall layouts

- [ ] **Step 4: Re-run the page tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/manuscript-workbench-notice.spec.tsx ./test/manuscript-workbench-routing.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-notice.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx apps/web/test/manuscript-workbench-notice.spec.tsx apps/web/test/manuscript-workbench-routing.spec.ts
git commit -m "feat: settle the final manuscript desk family"
```

## Task 2: Finalize AI-first upload and governed auto-binding on the backend contract

**Files:**
- Modify: `packages/contracts/src/manuscript.ts`
- Modify: `packages/contracts/src/governed-execution.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-api.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/test/manuscripts/manuscript-template-selection.spec.ts`
- Modify: `apps/api/test/execution-resolution/execution-resolution.spec.ts`
- Modify: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- Modify: `apps/api/test/shared/governed-module-context.spec.ts`
- Modify: `apps/api/test/http/manuscript-upload-storage.spec.ts`

- [ ] **Step 1: Write failing backend tests for the final intake contract**

Cover:

- upload does not require a manual manuscript-type field for the normal path
- upload returns:
  - AI detection summary
  - resolved manuscript type
  - auto-bound base template family
  - governed execution context summary
- low-confidence recognition is explicit in the response
- journal template remains empty by default unless explicitly chosen later
- the batch limit of `10` remains enforced through the lifecycle and HTTP layer

- [ ] **Step 2: Run the backend manuscript tests to verify RED**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts ./test/manuscripts/manuscript-template-selection.spec.ts ./test/execution-resolution/execution-resolution.spec.ts ./test/modules/governed-module-context-resolver.spec.ts ./test/shared/governed-module-context.spec.ts ./test/http/manuscript-upload-storage.spec.ts
```

Expected: FAIL because the current contract still assumes more manual template-context posture than the final intake model allows, and it does not yet clearly expose the final resolved context expected by the redesigned page.

- [ ] **Step 3: Extend the upload and governed-resolution contract without breaking V1 flow**

Apply these rules:

- AI detects manuscript type after upload
- the system auto-binds the matching基础模板族
- the result exposes enough context for the web desk to show:
  - AI识别结果
  - 置信度
  - 当前基础模板族
  - 当前期刊模板状态
- if no clear journal context exists, stay on the base family only
- do not auto-apply a journal template just because a family was matched

- [ ] **Step 4: Keep manual correction additive, not mandatory**

The backend should support later correction of:

- the base template family
- the optional journal template

But those correction hooks must remain secondary follow-up actions instead of becoming required upload inputs again.

- [ ] **Step 5: Re-run the backend manuscript tests to verify GREEN**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts ./test/manuscripts/manuscript-template-selection.spec.ts ./test/execution-resolution/execution-resolution.spec.ts ./test/modules/governed-module-context-resolver.spec.ts ./test/shared/governed-module-context.spec.ts ./test/http/manuscript-upload-storage.spec.ts
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/manuscript.ts packages/contracts/src/governed-execution.ts apps/api/src/modules/manuscripts/manuscript-record.ts apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts apps/api/src/modules/manuscripts/manuscript-api.ts apps/api/src/modules/execution-resolution/execution-resolution-service.ts apps/api/src/modules/execution-resolution/execution-resolution-api.ts apps/api/src/modules/shared/governed-module-context-resolver.ts apps/api/src/modules/shared/module-run-support.ts apps/api/src/http/api-http-server.ts apps/api/test/manuscripts/manuscript-lifecycle.spec.ts apps/api/test/manuscripts/manuscript-template-selection.spec.ts apps/api/test/execution-resolution/execution-resolution.spec.ts apps/api/test/modules/governed-module-context-resolver.spec.ts apps/api/test/shared/governed-module-context.spec.ts apps/api/test/http/manuscript-upload-storage.spec.ts
git commit -m "feat: finalize ai-first manuscript intake and auto-binding contract"
```

## Task 3: Replace the mandatory type selector with a resolved-context panel and bounded override flow

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscripts/index.ts`
- Modify: `apps/web/src/features/manuscripts/manuscript-api.ts`
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/templates/index.ts`
- Modify: `apps/web/src/features/templates/template-api.ts`
- Modify: `apps/web/src/features/templates/types.ts`
- Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing web tests for the final intake-and-context posture**

Cover:

- upload form no longer shows a mandatory manuscript-type selector
- after upload or workspace load, the page shows a compact resolved-context block with:
  - AI识别稿件类型
  - 识别置信度
  - 基础模板族
  - 期刊模板
- `期刊模板` stays as a simple optional dropdown
- `修正大模板族` exists as a bounded secondary action
- the operator is not forced to decide among too many template categories during initial intake

- [ ] **Step 2: Run the focused web tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because the current intake surface still expects a stronger up-front type/template-selection posture and does not yet express the final secondary-override model.

- [ ] **Step 3: Implement the final operator intake and context model**

Apply these rules:

- initial intake focuses on title, file input, and storage context only
- AI recognition result appears after upload or reload
- base family is treated as the default governed answer
- `期刊模板` is presented as an optional refinement
- `大模板族` correction is hidden behind an explicit override action or low-confidence hint

- [ ] **Step 4: Keep override interactions simple and safe**

The page should allow:

- accepting the AI result and doing nothing
- choosing a different base family when needed
- choosing or clearing a journal template

The page should not:

- expose the full rule-center package tree here
- force the operator to choose among every downstream governed package
- make the override panel permanently consume screen width

- [ ] **Step 5: Re-run the focused web tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscripts/index.ts apps/web/src/features/manuscripts/manuscript-api.ts apps/web/src/features/manuscripts/types.ts apps/web/src/features/templates/index.ts apps/web/src/features/templates/template-api.ts apps/web/src/features/templates/types.ts apps/web/test/manuscript-workbench-controller.spec.ts apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-page.spec.tsx
git commit -m "feat: simplify manuscript intake and template context selection"
```

## Task 4: Rebuild batch processing into a bounded shared slab with stage-specific actions

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write failing tests for the final batch posture**

Cover:

- batch processing remains visible on all three core workbenches
- the default batch surface is bounded and does not dominate the page
- screening batch actions emphasize upload, intake, and初筛 dispatch
- editing batch actions emphasize queued manuscript execution
- proofreading batch actions emphasize定稿、导出 or queue-level closeout actions
- the batch slab and main canvas can scroll independently where needed

- [ ] **Step 2: Run the batch-focused tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because the current batch UI still behaves more like a wide supporting console than the final bounded desk slab.

- [ ] **Step 3: Implement the bounded batch model**

Apply these rules:

- batch remains one shared family concept
- the page shows a compact summary of current batch state
- deeper or less frequent batch actions stay in the drawer
- the operator can keep reading the current manuscript while batch work continues

- [ ] **Step 4: Preserve the early-release guardrails**

Required behavior:

- show the `10`-item batch limit clearly but calmly
- keep limit-enforcement messages compact
- do not reintroduce a large page-wide warning wall
- keep batch recovery or exception messaging near the batch area, not at the top of the whole page

- [ ] **Step 5: Re-run the batch-focused tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx
git commit -m "feat: rebuild manuscript batch processing as a bounded shared slab"
```

## Task 5: Remove duplicate downstream AI control walls and consume centralized defaults read-only

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/test/manuscript-workbench-controller.spec.ts`
- Modify: `apps/web/test/manuscript-workbench-controls.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write failing tests for the centralized AI-settings posture**

Cover:

- manuscript workbench does not expose editable provider/model/temperature controls
- if the operator needs visibility, the page only shows resolved module defaults as read-only context
- AI model governance remains owned by `AI接入`
- manuscript operators are not asked to repeat the same settings here

- [ ] **Step 2: Run the focused AI-default-consumer tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL if the current workbench still surfaces editable AI-setting concepts that should already be centralized.

- [ ] **Step 3: Consume centralized defaults as read-only execution context**

Apply these rules:

- show only what helps the operator trust the run context
- keep model governance out of the daily manuscript desk
- preserve any existing runtime-readiness warning that is genuinely necessary for safe execution
- do not add a new settings mini-console inside the workbench

- [ ] **Step 4: Re-run the focused AI-default-consumer tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-summary.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/test/manuscript-workbench-controller.spec.ts apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx
git commit -m "feat: consume centralized ai defaults in manuscript workbenches"
```

## Task 6: Verify the final manuscript-workbench baseline before full acceptance

**Files:**
- Verify touched files only

- [ ] **Step 1: Run the full manuscript-workbench web regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-controls.spec.tsx ./test/manuscript-workbench-controller.spec.ts ./test/manuscript-workbench-notice.spec.tsx ./test/manuscript-workbench-routing.spec.ts ./test/manuscript-workbench-summary.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 2: Run the full manuscript backend regression suite**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts ./test/manuscripts/manuscript-template-selection.spec.ts ./test/execution-resolution/execution-resolution.spec.ts ./test/modules/governed-module-context-resolver.spec.ts ./test/shared/governed-module-context.spec.ts ./test/http/manuscript-upload-storage.spec.ts
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 3: Perform browser acceptance for the three core manuscript desks**

Manual checklist:

- `初筛 / 编辑 / 校对` clearly feel like the same product family
- no workbench page shows a large internal hero or oversized intro block
- batch processing is still available and easy to find
- upload no longer depends on a mandatory manuscript-type selector
- `AI识别稿件类型` and `基础模板族` are visible after intake
- `期刊模板` remains optional and easy to understand
- correcting `大模板族` is possible but does not clutter the normal path
- the page does not ask operators to manage provider/model/temperature settings

- [ ] **Step 4: Commit only if the verification pass required source adjustments**

```bash
git add apps/web/src/features/manuscript-workbench/index.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-notice.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/src/features/manuscripts/index.ts apps/web/src/features/manuscripts/manuscript-api.ts apps/web/src/features/manuscripts/types.ts apps/web/src/features/templates/index.ts apps/web/src/features/templates/template-api.ts apps/web/src/features/templates/types.ts packages/contracts/src/manuscript.ts packages/contracts/src/governed-execution.ts apps/api/src/modules/manuscripts/manuscript-record.ts apps/api/src/modules/manuscripts/manuscript-type-recognition-service.ts apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts apps/api/src/modules/manuscripts/manuscript-api.ts apps/api/src/modules/execution-resolution/execution-resolution-service.ts apps/api/src/modules/execution-resolution/execution-resolution-api.ts apps/api/src/modules/shared/governed-module-context-resolver.ts apps/api/src/modules/shared/module-run-support.ts apps/api/src/http/api-http-server.ts apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-controls.spec.tsx apps/web/test/manuscript-workbench-controller.spec.ts apps/web/test/manuscript-workbench-notice.spec.tsx apps/web/test/manuscript-workbench-routing.spec.ts apps/web/test/manuscript-workbench-summary.spec.tsx apps/api/test/manuscripts/manuscript-lifecycle.spec.ts apps/api/test/manuscripts/manuscript-template-selection.spec.ts apps/api/test/execution-resolution/execution-resolution.spec.ts apps/api/test/modules/governed-module-context-resolver.spec.ts apps/api/test/shared/governed-module-context.spec.ts apps/api/test/http/manuscript-upload-storage.spec.ts
git commit -m "test: verify manuscript workbench final desk rollout"
```

Skip the commit if verification is green and no extra edits were needed.

## Master-Plan Alignment

This child plan fills the manuscript-workbench phase in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

It should execute after:

- shared shell stabilization
- AI-access/system-settings cleanup
- rule-center rollout
- knowledge-library rollout
- knowledge-review and recovery consolidation

It should complete before:

- management-overview thinning
- final Chinese-copy sweep and browser acceptance

Because the final acceptance pass should verify the actual finished manuscript desk, not the older mixed layout.

## Follow-On, Not In This Plan

Do not use this child plan to build new quality-analyzer authoring surfaces.

Those belong in:

- rule center
- governed quality-package lines
- Harness comparison and rollout flows

This manuscript child plan only needs to consume their resolved outcomes cleanly.

## Execution Gate

Do not start implementation from this document yet.

Current user instruction is:

- keep finishing the total planning set
- do not begin implementation until the remaining plans are finished

When execution is eventually approved, follow the tasks in order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
