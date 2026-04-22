# Editing And Proofreading Product Mainline Implementation Plan

> **For future implementation work:** this plan exists to strengthen permanent product capabilities. Customer presentation is only a validation scenario. Do not add demo-only behavior.

**Goal:** Continue the latest editing and proofreading mainline work so the product becomes more durable, governable, and operationally useful after the customer presentation, not only during it.

**Architecture:** Build on the existing manuscript workbench, manuscript detail child page, proofreading confirmation flow, governed execution context, review-items stack, residual-learning backbone, and rule-center / knowledge-center governance surfaces.

**Tech Stack:** TypeScript, React, existing API HTTP routes, proofreading service, workbench controller and summary surfaces, residual-learning APIs, verification ops, document pipeline normalization, focused API and web tests

---

## Guardrails

- Do not add demo-only pages or demo-only data.
- Do not add residual analysis to `editing`.
- Do not weaken the item-based proofreading confirmation model.
- Do not change the final delivery artifact away from `human_final_docx`.
- Do not present retrieval or Harness evidence as universal manuscript accuracy.

## Current Baseline To Respect

The following are already real product behavior and should be treated as baseline, not as speculative future work:

- editing and proofreading now open real asset detail child pages
- editing exposes a visible change ledger
- proofreading annotated output opens a dedicated confirmation child page
- `publishHumanFinal` already accepts item-level confirmation decisions
- human-final publication can route governed hits and trigger residual observation from human-confirmation deltas
- workbench already exposes governed execution context and governed module bindings

This plan should extend that baseline rather than redesign it.

## File Focus

### Core Web Surfaces

- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- `apps/web/src/features/review-items/types.ts`
- `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- `apps/web/src/features/template-governance/template-governance-overview-page.tsx`

### Core API Surfaces

- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- `apps/api/src/modules/residual-learning/residual-learning-api.ts`
- `apps/api/src/http/api-http-server.ts`

### Focused Verification Targets

- `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`
- `apps/api/test/verification-ops/residual-validation-check.spec.ts`
- `apps/web/test/manuscript-workbench-detail.spec.tsx`
- `apps/web/test/manuscript-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-summary.spec.tsx`
- `apps/web/test/rule-center-learning-review.spec.ts`
- `apps/web/test/template-governance-overview-page.spec.tsx`

---

## Phase 1: Solidify The Real Manuscript Asset Chain

### Task 1: Make asset posture explicit and permanent in the workbench

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/test/manuscript-workbench-detail.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] Ensure the workbench consistently distinguishes:
  - current manuscript
  - current result
  - proofreading annotated manuscript
  - final `human_final_docx`
- [ ] Make preview, download, and publish actions read as one coherent asset lifecycle.
- [ ] Keep asset naming and operator labels aligned across summary, focus canvas, and detail child page.
- [ ] Verify the workbench still feels like one desk rather than three disconnected asset views.

### Task 2: Keep proofreading confirmation as the authoritative settlement step

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/web/test/manuscript-workbench-detail.spec.tsx`
- Modify: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`

- [ ] Preserve the item-based confirmation actions and make sure they remain the official path to `human_final_docx`.
- [ ] Check whether the current confirmation summary returned from publish is rich enough for later operator review.
- [ ] If any confirmation-to-publication payload is too implicit, extend it additively rather than inventing a second state model.

**Acceptance for Phase 1**

- operators can follow the asset chain from working manuscript to final deliverable
- proofreading confirmation remains a permanent mainline step

---

## Phase 2: Consolidate Governed Execution Evidence

### Task 3: Turn governed execution context into a single durable trust layer

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] Consolidate the currently split governed signals into one easier-to-read operator layer:
  - execution profile
  - routing policy version
  - resolved model
  - model source
  - provider readiness
  - runtime binding readiness
  - retrieval preset
  - runtime binding id
- [ ] Keep the distinction between governed and bare posture explicit.
- [ ] Prefer re-grouping existing evidence over inventing new explanation-only copy.

### Task 4: Keep run-result truth aligned with execution-tracking truth

**Files:**

- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`

- [ ] Verify that what the workbench says about the current run can be traced back to actual snapshot or payload data.
- [ ] If additional identifiers are needed for the UI, expose them additively from existing job or snapshot truth.
- [ ] Avoid any second “friendly summary” model that could drift away from execution-tracking reality.

**Acceptance for Phase 2**

- an operator can explain why a run was governed without backend digging
- governed evidence remains tied to actual execution data

---

## Phase 3: Consolidate Rule And Knowledge Participation Evidence

### Task 5: Strengthen the workbench summary as an operational evidence layer

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-high-risk-review.ts`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] Keep showing:
  - rule hits
  - knowledge references
  - high-risk evidence
  - review routing hints
- [ ] Tighten labeling so this reads like durable operator evidence, not internal debugging output.
- [ ] Make sure knowledge references prefer hydrated titles when available.

### Task 6: Bridge retrieval quality into the same long-term story

**Files:**

- Modify: `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Modify: `apps/web/test/template-governance-overview-page.spec.tsx`

- [ ] Keep retrieval-quality metrics where they belong, but improve the bridge from manuscript workbench to governance surfaces.
- [ ] Use stable wording around:
  - answer relevancy
  - context precision
  - context recall
  - Harness queued / passed / failed
- [ ] Keep the narrative operational: this is governed evidence, not generic AI accuracy.

**Acceptance for Phase 3**

- operators can see which rules and knowledge assets participated
- retrieval and Harness metrics remain truthful and understandable

---

## Phase 4: Pull The Proofreading Governance Loop Closer To The Mainline

### Task 7: Expose residual and candidate progression nearer to proofreading work

**Files:**

- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/review-items/types.ts`
- Modify: `apps/web/src/features/template-governance/rule-learning-pane.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`

- [ ] Show lightweight downstream status closer to the proofreading mainline:
  - residual observed
  - Harness pending
  - candidate ready
  - candidate created
- [ ] Do not duplicate the full governance desk in the workbench.
- [ ] Prefer summary cards, handoff packs, or explicit links to the authoritative governance surface.

### Task 8: Preserve the new human-confirmation-to-governance bridge

**Files:**

- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`

- [ ] Keep the new behavior where human confirmation decisions can:
  - create governed hits
  - route rule or knowledge candidates
  - generate residual hints from meaningful human deltas
- [ ] Review whether the residual hints generated from `reject` and `accept_and_edit` are categorized well enough for future use.
- [ ] Adjust only if it improves long-term routing truth, not to make the demo sound stronger.

**Acceptance for Phase 4**

- proofreading remains the strongest closed-loop learning surface in the product
- operators can understand where proofreading decisions go next

---

## Phase 5: Compatibility And Acceptance Hardening

### Task 9: Make normalization and preview readiness operationally explicit

**Files:**

- Modify: `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`
- Modify: `scripts/check_docx_tooling.py`

- [ ] Preserve and surface:
  - `ready`
  - `pending_normalization`
  - LibreOffice unavailable warning
- [ ] Make the operator aware when a `.doc` manuscript is waiting on normalization.
- [ ] Keep this as operational hygiene, not as a headline product capability.

### Task 10: Run focused verification and real-manuscript acceptance

- [ ] Run focused API checks:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-bare-run.spec.ts ./test/proofreading/proofreading-residual-learning.spec.ts ./test/verification-ops/residual-validation-check.spec.ts
```

- [ ] Run focused web checks:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/manuscript-workbench-detail.spec.tsx ./test/manuscript-workbench-page.spec.tsx ./test/manuscript-workbench-summary.spec.tsx ./test/rule-center-learning-review.spec.ts ./test/template-governance-overview-page.spec.tsx
```

- [ ] Run typechecks if touched files require them:

```bash
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web typecheck
```

- [ ] Rehearse one real manuscript path:
  1. load manuscript workbench
  2. inspect governed execution evidence
  3. run editing or proofreading
  4. open detail child page
  5. in proofreading, complete item-based confirmation
  6. publish `human_final_docx`
  7. verify governance handoff signals

**Acceptance for Phase 5**

- the product behaves the same in daily use and in customer presentation
- no critical part of the mainline depends on hidden operator knowledge

---

## Ready-To-Paste Kickoff Prompt

Use the following prompt in a new Codex thread:

```text
当前仓库是 C:\医学稿件处理系统V1。

先完整阅读并遵守这两份文档，再开始实现：
1. docs/superpowers/specs/2026-04-22-editing-proofreading-product-mainline-design.md
2. docs/superpowers/plans/2026-04-22-editing-proofreading-product-mainline.md

这次目标不是为了客户展示临时补功能，而是继续把编辑和校对主链做成长期可用的产品能力。客户展示只是验收场景，不是单独目标。

请严格遵守以下边界：
- 不要做 demo 专用页面或 demo 专用状态
- proofreading confirmation 和 human_final_docx 是正式产品主链，不是演示功能
- 残差分析只保留在 proofreading，不要扩展到 editing
- LibreOffice 只用于 .doc -> .docx 兼容归一化
- 不要把 retrieval 或 Harness 指标包装成“每次准确率”
- 优先在 manuscript workbench、review-items、template-governance 上增强，而不是新建独立桌面

执行方式：
- 先检查当前分支和 git status
- 阅读两份文档后，按长期产品价值重排今天要做的第一阶段
- 优先保证真实稿件资产链、proofreading confirmation、human_final_docx 和 governed evidence 是稳定主链
- 然后再补 rule / knowledge / residual / Harness 的可见性

工作要求：
- 每完成一个阶段，运行对应 focused tests / typecheck
- 不能跳过真实联调
- 如果文档与代码现实不一致，以代码真实情况为准，最小化更新文档并说明原因
- 最终输出必须包含：完成了什么、哪些属于长期保留能力、还剩什么、有哪些运行风险

现在先做：
1. 检查当前分支和 git status
2. 阅读两份文档
3. 说明你准备先做哪一阶段，为什么它对长期产品最重要
4. 然后直接开始实施
```

## Execution Note

This plan exists to continue the real product mainline.

Do not reframe the work as demo-only implementation once execution begins.
