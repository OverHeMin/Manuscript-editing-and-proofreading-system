# Phase 8C Thread Split Handoff

## 1. Context

- Active branch: `codex/phase8c-persistent-workbench-auth`
- Active worktree: `C:\医学稿件处理系统V1\.worktrees\codex-phase8a-auth-persistent-http`
- This branch already contains the major `Phase 8` workbench/auth/governance delivery, plus the later `verification-ops` persistence foundation (`1c01a15 feat: persist verification ops http runtime`).
- `README.md` and `docs/OPERATIONS.md` on this branch already describe the real HTTP service, real web workbenches, release gate, and persistent `verification-ops` boundary. The old review finding about "README still says no real HTTP service/frontend pages" does not match this branch anymore.

## 2. Stable Delivered Baseline

The following are already landed on this branch and repeatedly covered by `pnpm verify:manuscript-workbench`:

- Persistent web auth shell with real login/session/logout flow
- Submission / Screening / Editing / Proofreading workbenches wired to real HTTP routes
- Admin Governance Console with registry management, execution preview, execution evidence drill-down, and Recent Agent Executions triage
- Learning Review flow and Knowledge Review handoff with real browser approve/reject terminal actions
- Evaluation Workbench mainline:
  - draft suite activation
  - create run
  - save run-item result
  - finalize evidence/recommendation
  - hand off governed learning candidate
  - manuscript-to-evaluation handoff
  - manuscript-scoped history
  - compare/history guidance and evidence-pack summaries
- Repo-owned release gate at `pnpm verify:manuscript-workbench`
- Persistent `verification-ops` HTTP/runtime foundation across restart-safe API tests

## 3. Current Uncommitted Slice In This Thread

There is one small uncommitted `Evaluation Workbench` polish slice in the current worktree:

- Files:
  - `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - `apps/web/test/evaluation-workbench-page.spec.tsx`
  - `apps/web/playwright/evaluation-workbench.spec.ts`
- Purpose:
  - make history hidden-state and empty-state summaries readable for operators
  - replace internal enum-like values (`suite`, `all`, `newest`) with labels such as `Entire suite history`, `All finalized runs`, `Newest first`
  - add `Compare status` messaging so operators know whether compare is still available behind current history controls
- Fresh verification already passed for this uncommitted slice:
  - `pnpm exec node --import tsx --test ./test/evaluation-workbench-page.spec.tsx`
  - targeted Playwright grep for hidden/empty history flows
  - full `pnpm verify:manuscript-workbench`

## 4. Remaining Scope For This Thread Only

To keep this thread stable and narrow, it should only do the following:

1. Review the current uncommitted `Evaluation Workbench` polish slice.
2. Commit and push that slice when ready.
3. If one more `Phase 8C` follow-up is still desired, keep it limited to tiny `evaluation-workbench` compare/history readability work in the same three files.

This thread should not expand into:

- `apps/api`
- `apps/worker-py`
- `README.md`
- `docs/OPERATIONS.md`
- `apps/web/src/features/admin-governance/*`
- deployment/infra changes

## 5. Parallelization Boundaries

The following files are reserved for this thread until the current slice is committed:

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/test/evaluation-workbench-page.spec.tsx`
- `apps/web/playwright/evaluation-workbench.spec.ts`
- `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`

Parallel threads should not edit those files.

## 6. Risks And Watchouts

- Port collisions: Playwright and local servers can intermittently collide on `3001` / `4173`. If the browser gate fails for that reason, retry after ports clear.
- `evaluation-workbench-page.tsx` is now a hot file with multiple recent UX-only commits. Avoid parallel edits there.
- Do not reintroduce stale README/runtime claims from older branches or older review comments.
- Keep all new work grounded in real verification. The repo already has a strong gate; use it instead of assuming.

## 7. Recommended New Parallel Threads

### Thread A: Deployment / Ops / Remote Maintenance Standardization

**Why this is safe now**

- Mostly docs/infra/workflow scope
- No overlap with the reserved `evaluation-workbench` files
- Directly addresses the user's earlier concerns about migration, remote maintenance, backup, rollback, and delivery standards

**Suggested ownership**

- `docs/OPERATIONS.md`
- `README.md`
- `.github/workflows/*`
- `infra/*`
- root helper scripts only if needed

**Expected output**

- a concrete implementation plan or a small landed slice for deployment/backup/rollback/remote-maintenance standardization
- explicit local-to-new-platform migration checklist
- explicit remote Codex maintenance workflow

### Thread B: Worker / Document Pipeline Mainline Hardening

**Why this is safe now**

- Owns `apps/worker-py` and document pipeline scripts
- No overlap with the reserved `evaluation-workbench` files
- Advances the core manuscript system without touching the current UI polish lane

**Suggested ownership**

- `apps/worker-py/*`
- `scripts/*` related to document rendering/export only
- worker-focused docs only if needed

**Expected output**

- audit the real document mainline status
- identify the narrowest next production-hardening slice
- preferably produce a plan and, if scope is crisp enough, start implementation with tests

### Thread C: Admin Governance Console Deepening

**Why this is safe now**

- Still in `apps/web`, but different feature area from `evaluation-workbench`
- Builds on already-landed governance registry/execution work
- Can progress UI operations without colliding with the current thread

**Suggested ownership**

- `apps/web/src/features/admin-governance/*`
- matching tests under `apps/web/test/*admin-governance*`
- `apps/web/playwright/admin-governance.spec.ts`

**Expected output**

- one narrow, operator-facing governance improvement
- or a plan for the next governance module if a larger slice is needed first

## 8. Ready-To-Use New Thread Prompts

### Prompt A: Deployment / Ops Thread

```text
你在一个新的 Codex 线程中工作，仓库根目录是 `C:\医学稿件处理系统V1`。

先阅读：
- `README.md`
- `docs/OPERATIONS.md`
- `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`

严格边界：
- 不要修改以下当前线程保留文件：
  - `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - `apps/web/test/evaluation-workbench-page.spec.tsx`
  - `apps/web/playwright/evaluation-workbench.spec.ts`
  - `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`

你的目标：
- 围绕“部署、迁移、备份、回滚、远程维护、Codex 远程维护流程”做一条可落地的标准化工作线。
- 先审视现状，再决定是：
  1. 直接补充/修正文档与脚本；或
  2. 先写一份新的 implementation plan，再开始做最小实现。

要求：
- 只在 `README.md`、`docs/OPERATIONS.md`、`.github/workflows/*`、`infra/*`、必要的根脚本中工作。
- 不要碰 evaluation workbench 相关文件。
- 如果新增多步工作，请把计划写到 `docs/superpowers/plans/`。
- 所有完成声明前必须跑真实验证；至少给出你跑过的命令和结果。

优先关注：
- 系统迁移到另一台机器/平台的步骤是否足够具体
- 备份与恢复是否覆盖数据库、对象存储、上传目录
- 远程用 Codex 维护代码的流程是否可执行
- 发布前后的最小运维清单是否完整
```

### Prompt B: Worker / Document Pipeline Thread

```text
你在一个新的 Codex 线程中工作，仓库根目录是 `C:\医学稿件处理系统V1`。

先阅读：
- `README.md`
- `docs/OPERATIONS.md`
- `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`
- `apps/worker-py` 下与文档处理主链路有关的代码

严格边界：
- 不要修改以下当前线程保留文件：
  - `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - `apps/web/test/evaluation-workbench-page.spec.tsx`
  - `apps/web/playwright/evaluation-workbench.spec.ts`
  - `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`

你的目标：
- 审计当前真实 document mainline 的完成度。
- 找出“最值得先补”的一小段 worker/document-pipeline 硬化工作。
- 如果 scope 清晰，直接用 TDD 落地；如果 scope 还不够清晰，先写一份 implementation plan。

要求：
- 主要工作目录限定在 `apps/worker-py/*`、必要的 `scripts/*`、以及 worker 相关测试。
- 不要改 admin governance 或 evaluation workbench。
- 明确说明当前 document pipeline 已完成、未完成、风险点、下一步建议。
- 所有结论都要尽量落到真实代码与真实验证上。

优先关注：
- doc/docx/pdf 主链路的真实可用程度
- 导出/物化/格式保真相关薄弱点
- 哪一段最可能后期返工，值得现在补强
```

### Prompt C: Admin Governance Thread

```text
你在一个新的 Codex 线程中工作，仓库根目录是 `C:\医学稿件处理系统V1`。

先阅读：
- `README.md`
- `docs/OPERATIONS.md`
- `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`
- `apps/web/src/features/admin-governance/*`

严格边界：
- 不要修改以下当前线程保留文件：
  - `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - `apps/web/test/evaluation-workbench-page.spec.tsx`
  - `apps/web/playwright/evaluation-workbench.spec.ts`
  - `docs/superpowers/plans/2026-04-02-phase8c-thread-split-handoff.md`

你的目标：
- 在不碰 evaluation workbench 的前提下，推进一个“运维人员真的会用到”的 admin governance console 小切片。
- 先基于现有代码与测试判断，选一个最自然、最小、最可验证的增强点。

要求：
- 主要工作目录限定在 `apps/web/src/features/admin-governance/*`、相关测试、以及必要的 browser smoke。
- 必须先写失败测试，再补实现，再跑验证。
- 不要顺手扩散到其它 workbench。
- 在最终汇报中说明：做了什么、为什么选这个点、风险还有什么。

优先方向：
- execution observability 的可读性/可操作性
- registry / policy / binding 的运营可理解性
- Recent Agent Executions 的进一步分诊效率
```

## 9. Recommended Thread Strategy

If opening multiple new threads right now, prefer this order:

1. Thread A first
2. Thread B second
3. Thread C third

Reason:

- A and B are the least likely to conflict with the current thread.
- C is also safe, but still lives in `apps/web`, so it is slightly closer to the current thread's surface area.
