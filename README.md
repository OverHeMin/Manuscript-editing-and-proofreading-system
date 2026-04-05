# 医学稿件处理系统 V1

这是医学稿件处理系统的 V1 基础仓库。当前仓库已经具备可运行的本地 API / Web / Worker 基线，以及一条受控的 PostgreSQL 持久化 HTTP runtime。

当前已落地的核心能力：

- 稿件主链路与文件资产模型
- 审稿 / 编加 / 校对三大业务模块基础编排
- 知识库、模板治理、学习治理骨架
- AI 模型注册与路由基础
- PDF 一致性核对与学习候选基础能力
- React workbench 页面、本地 demo runtime 与持久化登录壳层
- Submission / Screening / Editing / Proofreading web workbench 已可直连真实 HTTP 路由
- Submission workbench 已支持浏览器本地选文件上传，并可将文件落盘到受控本地目录
- Manuscript workbench 已将原始 JSON 输出升级为结构化的稿件、资产、作业摘要视图，并保留可折叠调试快照
- Manuscript workbench 的上传、查稿、模块执行、导出控制区已重组为运营面板式布局
- Manuscript workbench 现已提供顶部成功/错误状态横幅和面板内输入校验提示
- Evaluation Workbench 已可加载 verification-ops 的 suites / finalized runs / run items / sample-set context，并以 suite-first 运营视角展示默认 latest-versus-previous finalized comparison、bounded visible history 与 read-only signal summary
- Evaluation Workbench 现在也支持按 manuscript 重新打开由 runtime-binding 自动 seed 的 governed evaluation runs，在浏览器中展示 machine evidence、governed source 明细与输出资产下载入口；治理写操作、release orchestration、跨系统 operations dashboard、auto-finalize、异步 worker、自动评分仍未进入当前范围
- Admin Governance Console 已可在浏览器中查看 execution snapshot、知识命中证据，以及 manuscript / job / output asset 下钻结果，并直接跳转到对应 workbench、下载可导出的输出资产，并用 Recent Agent Executions 的状态筛选/搜索快速分诊运行记录
- Template Governance Workbench 已可在浏览器中管理模板家族、模块模板草稿、知识条目筛选，以及围绕模板绑定的知识草稿创建 / 编辑 / 提审 / 归档
- 仓库内已提供可复用的 manuscript workbench release gate，并可在 GitHub Actions 中自动执行稿件 handoff、learning review、knowledge review 真实浏览器 smoke
- PostgreSQL 持久化的认证、会话、审计、模板治理、Prompt/Skill Registry、模型路由、agent-tooling 治理、执行治理/追踪，以及 verification-ops 评测资产 runtime
- 本地运维、迁移、备份/回滚、远程 Codex 维护与密码安全文档基线

## 当前状态

仓库现在有两条明确的 API 运行方式：

- `pnpm --filter @medical/api run serve:demo`
  仅用于本地 loopback-only 演示、联调和 QA。数据为内存态，可自动注入 demo 数据。
- `pnpm --filter @medical/api run serve`
  启动持久化 runtime。当前已把以下内容接入 PostgreSQL：
  - 稿件、文档资产、作业记录与当前资产导出主链路
  - 审稿 / 编加 / 校对模块的受治理执行记录
  - 用户认证、登录失败窗口、服务端会话、审计日志
  - 知识库条目与知识审稿动作
  - 模板家族与模块模板版本治理
  - 学习回写记录、reviewed-case snapshots、人工反馈记录与 governed provenance source links
  - Prompt 模板与 Skill 包注册表
  - 模型注册表与路由策略
  - Agent Runtime / Tool Gateway / Sandbox Profile / Agent Profile 注册表
  - Runtime Binding / Tool Permission Policy 治理配置
  - Agent Execution 日志
  - 执行治理配置（execution profiles、knowledge binding rules）
  - 执行追踪快照与知识命中日志

当前仍然是 mixed-mode，不应误判为“整套业务都已完全生产持久化”。仍未完成真实持久化或仍属基础实现的部分包括：

- 完整学习主流程的更深自动化、评测闭环与策略持续优化
- 评测、验证与 agent 执行编排等后续阶段模块
- 更完整的 Worker 编排、运维观测与生产级部署闭环

这意味着：

- `apps/web` 已经有真实可运行的 workbench 页面
- `apps/web` 已经能从 submission / screening / editing / proofreading workbench 直接触发真实稿件主链路与模块执行
- `apps/api` 已经有真实可运行的 HTTP 服务
- `apps/api run serve` 已经能持久化稿件上传、资产读取、作业查询、当前资产导出，以及 screening / editing / proofreading 的受治理执行
- `apps/api run serve` 已经能持久化 learning review 的 reviewed-case snapshots、人工反馈记录、governed provenance，knowledge review 的队列 / 历史治理数据，以及 verification-ops 的 sample sets / check profiles / suites / runs / evidence packs
- `apps/api run serve` 现在会在 screening / editing / proofreading-final 业务成功后触发 best-effort 的 governed verification orchestration：business completion 与 orchestration completion 已拆分，agent execution log 会持久化 orchestration lifecycle / attempt / error 元数据，成功时把 machine evidence 挂到 evaluation run 与 agent execution log，失败时只把 orchestration 标成 `retryable` / `failed`，不会回滚已经产出的模块输出
- `Phase 10K` 在此基础上进一步补齐 single-owner orchestration attempt claim guardrails：并发的 best-effort dispatch、手动 recovery、boot recovery 不会同时赢下同一条 follow-up attempt；旧 owner 的迟到写回会 fail-open 成 no-op，不会覆盖较新的 reclaim owner
- `apps/api` 的稿件 intake 路由已经支持 `fileContentBase64` 直传，本地文件默认写入 `.local-data/uploads/<app-env>`，也可通过 `UPLOAD_ROOT_DIR` 改到独立数据目录
- `apps/web` 里的 admin-console 已经能加载治理数据、管理 agent-tooling 注册表/策略/绑定，并下钻查看 execution snapshot 与知识命中证据，不再是纯占位页
- `apps/web` 里的 admin-console 现在还可以把 Recent Agent Executions 直接下钻到 manuscript、job 与 created asset 输出明细，并通过状态筛选/搜索快速聚焦 running / failed / completed 执行，方便治理台追踪运行结果
- `apps/web` 里的 evaluation-workbench 已不再是占位页，当前会以 suite-first 运营视角读取 verification-ops 的 suites / finalized runs / sample-set context，并默认展示 latest-versus-previous finalized comparison、bounded visible history 与 read-only signal summaries
- `apps/web` 里的 evaluation-workbench 现在也能按 manuscript 重新打开由 runtime binding 自动 seed 的 governed evaluation runs；这类无 sample-set 上下文的 run 会显示 governed source 明细、输出资产下载入口与 machine evidence，并继续保持为 evidence surface，而不是治理写操作、release orchestration 或跨系统 operations dashboard
- `apps/web` 里的 template-governance 已不再是占位页，当前可以直接查看模板家族与模块模板版本、筛选知识条目、围绕选中模板族维护 template bindings，并把知识草稿推进到 review lane
- `pnpm verify:manuscript-workbench` 当前已经覆盖 manuscript handoff、learning review flow、knowledge review handoff + approve/reject terminal actions、admin governance execution observability + Recent Agent Executions triage、evaluation workbench delta-first read-only operations smoke 的真实浏览器门禁，并包含 verification-ops 持久化 HTTP 路由回归
- `pnpm verify:manuscript-workbench` 的 evaluation workbench smoke 现在会验证 latest-versus-previous 默认对比、`Latest 10` 可见历史窗口、history/recommendation/sort 控件、signal summary，以及 `Activate` / `Run Launch` / `Complete And Finalize Run` / `Finalize Recommendation` 写操作控件保持缺席
- 但 `serve` 当前仍是“稿件主链路 + 认证 + 学习/知识治理主干 + 治理注册表 + 模型路由 + agent-tooling governance + execution governance/tracking”的阶段性持久化 runtime，不是最终生产版完整业务系统

## 环境要求

- Node.js 22+
- `pnpm` 10+
- Python 3.12+
- Docker Desktop（含 `docker compose`）

## 快速启动

1. 安装依赖
   `pnpm install`
2. 启动本地依赖
   `docker compose -f infra/docker-compose.yml up -d`
3. 验证 API 基线
   `pnpm --filter @medical/api run smoke:boot`
4. 在启动 persistent API 前执行共享 preflight
   `pnpm --filter @medical/api run preflight:persistent`
   - If you need to replay pending, retryable, or stale-running governed follow-up orchestration after a restart or operator intervention, run `pnpm --filter @medical/api run recover:governed-orchestration`.
  - If you need to inspect the same governed orchestration backlog without mutating it first, run `pnpm --filter @medical/api run recover:governed-orchestration -- --dry-run`.
  - Add `-- --dry-run --actionable-only --limit <n>` to narrow the same read-only view down to the highest-priority actionable backlog items first.
  - Add repeatable `--module <module>` and `--log-id <execution-log-id>` flags to scope either recovery replay or dry-run inspection down to a bounded subset of logs without overriding retryability or terminal-failure rules.
  - Add `--budget <n>` to replay only the next bounded slice of eligible scoped logs. This does not change retryability or dry-run behavior; replay summary output reports the scoped eligible and remaining counts for that budget window.
  - `Phase 10P` further aligns budgeted replay with dry-run recoverable priority: under `--budget <n>`, stale-running reclaim candidates are replayed before plain recoverable-now candidates inside the same scope, while no-budget replay keeps its prior behavior.
  - `Phase 10R` extends the same budget semantics into read-only inspection: add `-- --dry-run --budget <n>` to preview the exact next bounded replay window before mutating orchestration state. This keeps full backlog summary counts while narrowing the dry-run item list to the selected replay slice.
  - `Phase 10S` extends the same dry-run lane with normalized readiness windows: item output now shows `readiness=` and, when blocked work has a concrete next-ready timestamp, `ready_at=` so operators can see when deferred retries or fresh running attempts become replayable next.
  - `Phase 10T` adds a summary-level readiness rollup to the same dry-run lane, so the top summary line now shows how much actionable backlog is `ready_now`, how much is still waiting on retry eligibility or running-timeout expiry, and the earliest `next_ready_at` timestamp.
  - Retryable logs now honor a bounded next-eligible retry timestamp, so recovery only replays work that is actually due.
  - Add `-- --json` for machine-readable output. `--dry-run` stays read-only and classifies backlog items into recoverable/deferred/stale/attention buckets before replay; it does not change routing policy, release state, or existing business outputs.
  - Set `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT=true` to trigger the same recovery path automatically after persistent server startup. This boot replay stays best-effort and fail-open.
  - Optionally set `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET=<positive-integer>` to cap each boot replay pass to the next bounded eligible slice. Missing or invalid values are ignored fail-open.
5. 启动本地 demo API
   `pnpm --filter @medical/api run serve:demo`
6. 启动 PostgreSQL 持久化 API
   `pnpm --filter @medical/api run serve`
   - For watch mode, use `pnpm --filter @medical/api run dev`
   - For watch + demo runtime, use `pnpm --filter @medical/api run dev:demo`
7. 启动 Web workbench
   `pnpm --filter @medsys/web run dev`
   - `VITE_APP_ENV=local`：走 demo bootstrap shell，仅用于本地 Vite 开发联调
   - `VITE_APP_ENV=dev|staging|prod`：走 persistent login shell，调用后端真实会话接口
   - 可选：设置 `UPLOAD_ROOT_DIR` 为独立磁盘/目录，用于保存 submission workbench 的本地直传文件
8. 验证 Web 基线
   `pnpm --filter @medsys/web run smoke:boot`
9. 验证 Worker 基线
   `pnpm --filter @medical/worker-py run smoke:boot`
10. 跑全仓校验
   `pnpm lint && pnpm typecheck && pnpm test`
11. 跑仓库级生产前门禁
   `pnpm verify:production-preflight`
12. 跑 Manuscript workbench 发布门禁
   `pnpm verify:manuscript-workbench`

## Runtime 契约

### Demo Runtime

- `APP_ENV=local`
- 仅允许 loopback host / origin
- 允许自动注入 demo 知识审稿与学习治理样例
- 不连接真实持久化业务存储

### Persistent Runtime

- `APP_ENV=development|test|staging|production`
- 必须提供 `DATABASE_URL`
- `serve` / `serve:persistent` 在 listen 前会统一执行 runtime contract + startup preflight；如需单独验证可运行 `pnpm --filter @medical/api run preflight:persistent`
- `APP_ENV=staging|production` 不允许继续使用占位值 `ONLYOFFICE_JWT_SECRET=change-me-in-prod`
- 未显式设置 `UPLOAD_ROOT_DIR` 时，稿件上传根目录默认落在 `.local-data/uploads/<APP_ENV>`
- `GET /healthz` 只表示进程存活；`GET /readyz` 才表示 runtime contract、数据库和 upload root 已通过部署门禁
- 当前持久化范围已覆盖“稿件主链路 + 认证 + 学习/知识治理主干 + 治理注册表 + agent-tooling governance + execution governance/tracking + verification-ops persistence”
- 不会自动注入 demo 审稿数据

## Production Release Contract

- 发布前统一运行 `pnpm verify:production-preflight`。该脚本会按固定顺序执行 `lint`、`typecheck`、`test`、API/Web/Worker `smoke:boot`，以及 `pnpm verify:manuscript-workbench`。
- 进入 Phase 10G 后，发布前优先使用 `pnpm verify:production-preflight -- --manifest <path-to-manifest>`。脚本会先校验 release manifest，再在需要时串联只读的 migration doctor；如果 manifest 声明 `schema change = no` 但仓库仍有 pending migrations，predeploy 会直接失败。
- 如需单独做 repo-owned 的 migration guard，可运行 `pnpm verify:production-preflight:strict` 或 `pnpm --filter @medical/api run db:migration-doctor -- --json`。这些检查只输出本地证据与阻断信号，不会自动部署、自动回滚或修改 release 状态。
- 进入 Phase 10H 后，`staging` / `production` 的 persistent runtime 还会拒绝已知占位或本地默认 secret：当前包含 `ONLYOFFICE_JWT_SECRET=change-me-in-prod`、`OBJECT_STORAGE_ACCESS_KEY=minioadmin`、`OBJECT_STORAGE_SECRET_KEY=minioadmin123`。
- 如需做 schema/storage/secret 变更的升级演练，可运行 `pnpm verify:production-upgrade-rehearsal -- --manifest <path-to-manifest>`。它只校验 manifest 并输出本地化 rehearsal steps，不会自动 deploy、rollback 或轮换 secret。
- 持久化 API 启动后，用 `pnpm verify:production-postdeploy -- --base-url http://127.0.0.1:3001` 检查 `/healthz` 和 `/readyz`。其中 `/readyz` 是发布是否可放量的真门禁。
- 每次 staging / production 发布都应先基于 `docs/operations/release-manifest-template.md` 记录环境、操作人、commit SHA、备份件、schema 决策、发布后检查与回滚结果。

### Web Workbench Shell

- `VITE_APP_ENV=local`
  Web 端走 demo bootstrap shell，并使用本地 demo 用户自动换取后端 cookie。该模式仅建议在 `vite dev` 下使用。
- `VITE_APP_ENV=dev|staging|prod`
  Web 端走 persistent login shell，通过 `/api/v1/auth/session`、`/api/v1/auth/local/login`、`/api/v1/auth/logout` 管理真实后端会话。
- Submission workbench
  现在既支持旧的 `storageKey` 元数据上传，也支持浏览器选择本地文件后直接以内联 base64 调用 intake 路由；若未设置 `UPLOAD_ROOT_DIR`，文件默认落在 `.local-data/uploads/<app-env>`。

## 目录结构

- `apps/api`
  领域服务、权限、数据库迁移、demo runtime、persistent runtime
- `apps/web`
  React/Vite workbench、浏览器侧 API 客户端与联调页面
- `apps/worker-py`
  文档处理、格式转换、PDF pipeline
- `infra`
  本地依赖服务编排
- `docs`
  方案、运维、评审与实现文档

## 关键文档

- `docs/OPERATIONS.md`
  运行、迁移、备份/回滚、远程维护、密钥安全与升级流程
- `docs/operations/release-manifest-template.md`
  staging / production 发布记录模板，覆盖 manifest 字段校验、schema/storage backup gate、migration doctor 证据、发布后验证与回滚决策
- `docs/CODE_QUALITY.md`
  代码质量与注释约束
- `docs/REVIEW_CHECKLIST.md`
  开发与 review 清单
- `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  phase 边界与历史交付容器解释索引
- `docs/superpowers/plans/2026-04-03-phase4-7b-8-boundary-reconciliation.md`
  phase4 / phase7b / phase8 的历史边界 reconciliation
- `docs/superpowers/specs/README.md`
  规格文档入口

## 说明

如果要把这套系统继续推进到“完整生产可用”，当前更准确的状态是：

### 已有首版能力，但仍需深化

- 学习主流程与反馈溯源落库
  已具备 reviewed-case snapshots、人工反馈记录、governed provenance source links 与 learning writeback 持久化，但更深的自动化闭环、策略优化与持续学习运营仍未完成。
- 模型执行治理、评测与路由策略联动
  已具备模型注册表、路由策略、runtime binding、verification expectations、governed evaluation run seeding 与 Phase 9T 的 inline check execution 基础联动，但更自动的策略执行与跨层编排仍需继续完善。
- agent 执行编排、运行证据与更深层治理运营能力
  已具备 execution log、execution snapshot、knowledge-hit evidence、Recent Agent Executions triage、admin evidence drilldown，以及 Phase 10J 的 durable orchestration baseline（重启安全、有限重试、恢复状态、只读观测）；更深层队列化 worker、自动化 release orchestration 与跨系统 operations control plane 仍不在当前范围。

## Durable Execution Orchestration Baseline (Phase 10J)

- `AgentExecutionLog.status` 继续表示业务执行生命周期；新增 orchestration lifecycle 只表示 business commit 之后的 governed follow-up 状态。
- `verification-ops` 对同一 governed source + suite 的 seeded run 现已做幂等复用，避免恢复/重放时重复造 run。
- `screening` / `editing` / `proofreading-final` 现在在业务事务完成后做 best-effort orchestration dispatch；失败会保留业务完成结果，并把 orchestration 标记为 `retryable` / `failed`，并在 retryable 状态下记录 bounded next-retry eligibility。
- orchestration running state 现在还会携带一个内部 attempt claim token，用于 repo-owned compare-and-swap claim/finalize guard；它只服务 durable execution safety，不成为新的 operator control plane 或 write surface。
- `Phase 10L` adds a repo-owned dry-run inspection mode on top of the same orchestration rules, so operators can see `recoverable_now` / `deferred_retry` / `stale_running` / `attention_required` / `not_recoverable` backlog state before choosing to replay recovery.
- `Phase 10M` adds bounded actionable focus ordering to that dry-run lane. Operators can keep the full summary counts while asking for `--actionable-only` and `--limit <n>` so the CLI shows the most urgent replay candidates first without turning into a new orchestration control plane.
- `Phase 10N` adds bounded replay scoping to the same repo-owned lane. Operators can repeat `--module <module>` and `--log-id <execution-log-id>` to inspect or replay only a narrow subset of logs, while all existing retry-eligibility, stale-running, and terminal-failure protections stay unchanged.
- `Phase 10O` adds bounded replay budgeting to the same repo-owned lane. Operators can ask recovery to process only the next `n` eligible scoped logs via `--budget <n>`, while the summary reports scoped eligible-versus-remaining backlog counts and all existing recoverability protections stay unchanged.
- `Phase 10P` aligns budgeted replay ordering with the existing recoverable-priority model already visible in dry-run categories, so stale-running reclaim work is consumed before plain recoverable-now work when a replay budget is supplied.
- `Phase 10Q` extends the same semantics to startup wiring: if boot recovery is enabled, operators may optionally bound each auto-recovery pass with `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET`, while invalid values degrade to the prior full-pass boot behavior.
- `Phase 10R` closes the remaining preview gap in that same lane: `--dry-run --budget <n>` now shows the exact next replay slice and its eligible / selected / remaining counts without mutating durable orchestration state or adding a new control plane.
- `Phase 10S` makes recovery-state timing more explicit in that same read-only lane: dry-run items now surface normalized readiness states plus concrete `ready_at` timestamps for deferred retry eligibility and fresh running reclaim windows, without changing replay policy.
- `Phase 10T` makes that same timing posture glanceable at summary level: dry-run reports now roll up `ready_now`, `waiting_retry_eligibility`, `waiting_running_timeout`, and the earliest `next_ready_at`, again without adding replay authority.
- Admin Governance 只新增 read-only orchestration 观测字段，不获得新的写控制权；Evaluation Workbench 仍然只是 evidence surface，不成为 routing 或 release control plane。
- Web workbench 对持久化稿件链路与治理接口的完整接线与深度运营能力
  当前 manuscript workbench、knowledge review、template governance、admin governance 与 evaluation workbench 都已经接入真实 HTTP / 持久化主干，但更深的运营视角、批量化操作能力与最终生产化细节仍待补齐。
- 更深的 Evaluation Workbench 运营能力
  当前已经支持 suite-first finalized-run 运营视图、default latest-versus-previous comparison、bounded history window、read-only signal summaries，以及 governed-source manuscript matching 与 machine evidence 展示；后续仍应继续深化检索效率、运营分析与长期对比视图，但不应回退为控制面。

### 仍是后续重点

- 更完整的 Worker 编排、运维观测与生产级部署闭环
- 部署、监控、回滚、远程维护标准化自动化
- 更细的密码/密钥安全、升级编排与平台迁移自动化

### 文档解释约束

- `docs/superpowers/plans/*.md` 与 `docs/superpowers/specs/*.md` 是 phase 范围的权威定义。
- 个别历史分支或 PR 名称并不严格等于最终交付边界。
- `phase8aa / phase8ab / phase8ac / phase8ad` 是 `phase8z` 之后的延续编号，不是 `phase8a` 的子层级。
- Phase 9 的缺失字母当前视为未使用编号，不默认代表丢失内容。
- 具体边界解释以 `Phase Boundary Index` 与相关 reconciliation 文档为准。
## Model Governance Routing

- `Model Registry` stores approved model assets and module compatibility only. It does not own routing governance decisions.
- `Model Routing Governance` stores versioned routing policy for `module` and `template_family` scopes, including the approved primary model, ordered fallback chain, and evidence references.
- `Admin Governance Console` is the only routing control plane in Phase 10B. `Evaluation Workbench` remains an evidence surface and does not activate policy.
- Live runtime resolves routing in this order:
  1. active `template_family` policy
  2. active `module` policy
  3. legacy singleton template override
  4. legacy singleton module default
  5. legacy singleton system default
- Runtime fallback is limited to approved chains for technical/runtime failures. Quality-based automatic switching remains out of scope for Phase 10B.

## Harness Dataset Governance (Phase 10D)

- `harness-datasets` is a dedicated governed asset lane for gold-set families, immutable gold-set versions, rubric definitions, and export audit history. It does not replace `verification-ops`, `learning-governance`, or `knowledge-review`.
- `verification-ops` sample sets and finalized evaluation runs remain execution/evidence assets. Gold sets remain separate human-curated reference assets for later harness use.
- The new harness workbench is an admin-only curation and export surface. It is not a routing control plane, and `Evaluation Workbench` remains an evidence surface rather than a policy activator.
- Harness capabilities are local-first and fail-open. Live manuscript execution does not depend on gold-set publication, rubric publication, or harness export success.
- Manual export is limited to published gold-set versions only. The HTTP workbench writes under `.local-data/harness-exports/<APP_ENV>`, and the standalone scripts write under `.local-data/harness-exports/manual` unless an explicit local output directory override is provided.
- Rubric calibration, borderline case resolution, and promotion into gold sets remain human-owned decisions. Phase 10D does not enable automatic model switching, automatic publishing, or automatic learning writeback.

## Retrieval Quality Harness Governance (Phase 10E)

- `knowledge-retrieval` is an additive evidence lane for retrieval index entries, reproducible retrieval snapshots, and template-scoped retrieval-quality runs. It does not replace `knowledge-review`, `verification-ops`, or the production manuscript mainline.
- Retrieval snapshots are recorded before scoring and remain auditable evidence. Retrieval-quality runs stay local-first and can be exported from published gold sets into local dataset files for offline harness execution.
- Local harness runners live under `apps/worker-py/src/harness_runners`, and repo-owned export/runner scripts live under `scripts/harness`. These tools are fail-open and must never become synchronous dependencies of live screening, editing, or proofreading execution.
- Template Governance Workbench now exposes a bounded read-only retrieval view: latest retrieval-quality run, latest retrieval snapshot summary, and operator signals. Missing endpoints or missing data degrade to a fail-open evidence message instead of blocking governance actions.
- `Evaluation Workbench` still does not become the routing control plane in Phase 10E. Retrieval metrics may inform operators, but they do not activate routing policy, auto-switch models, auto-publish templates or knowledge, or auto-write learning feedback.

## Local-First Harness Adapter Platform (Phase 10F)

- `harness-integrations` is a repository-owned adapter lane for `promptfoo`, `langfuse_oss`, `simple_evals_local`, and `judge_reliability_local`. It keeps harness tools replaceable and outside the synchronous manuscript execution dependency chain.
- Harness launches stay explicit and bounded to governed runtime assets such as active runtime bindings and approved evaluation suites. `screening`, `editing`, `proofreading`, the routing control plane, and existing `verification-ops` contracts do not depend on adapter availability to complete their primary path.
- Self-hosted tracing is limited to `Langfuse OSS` style endpoints. Repo scripts degrade or skip when no local/self-hosted sink is configured, and hosted `langfuse.com` endpoints are not the primary path for this phase.
- Admin Governance now exposes a read-only harness health surface for registered adapters, latest execution state, trace sink availability, and judge calibration outcomes. This surface is additive only: it does not publish policies, activate routing, auto-switch models, or become an operations control plane.
- Harness read/write surfaces are fail-open by design. Missing harness endpoints or unavailable adapter executions degrade to empty evidence/read-model state instead of blocking broader governance work, and operator-launched harness failures remain recorded as governed degraded results.
- Phase 10F does not enable automatic model switching, automatic publishing, automatic release actions, or automatic learning writeback. Judge and eval outcomes remain advisory evidence for human operators.

## Production Hardening And Upgrade Rehearsal (Phase 10H)

- `Phase 10H` continues the repo-owned production lane from `10A` and `10G`, but keeps the boundary narrow: secret placeholder protection, secret-rotation proof, and upgrade-rehearsal proof.
- The new rehearsal guard is local-first and operator-owned. It prints a bounded sequence built from existing repo commands such as manifest-aware predeploy, strict migration checks, persistent startup preflight, migration execution, and postdeploy readiness verification.
- This phase still does not create a deployment control plane. It does not auto-deploy, auto-rollback, auto-rotate secrets, or grant Evaluation Workbench / Admin Governance authority over release execution.

## Privacy Evidence And Academic Structure Baseline (Phase 10I)

- `Phase 10I` starts with a worker-only advisory evidence lane under `apps/worker-py/src/document_enhancement` rather than wiring privacy or OCR tools into the manuscript mainline.
- `pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path <local-path> [--text-file <local-text-file>] [--text-layer present|missing|unknown]` emits a local-first JSON report for privacy precheck findings and OCR / academic-structure readiness.
- Add `--write-artifact` to persist the same advisory report under `.local-data/document-enhancement-audits/manual`, or pair it with `--output-dir <local-dir>` to override the local artifact directory.
- The local artifact lane keeps additive JSON history plus `audit-index.json` for replay. It remains manual and repository-local rather than API-backed persistence.
- `pnpm --filter @medical/worker-py run audit:document-enhancement:history -- --list [--limit <n>] [--output-dir <local-dir>]` lists the local artifact index, and `--artifact-path <local-json>` replays one persisted advisory report.
- `pnpm --filter @medical/worker-py run audit:document-enhancement:retention -- --keep-last <n> [--max-age-days <n>] [--output-dir <local-dir>]` produces a read-only retention audit that recommends which local artifacts are safe candidates for cleanup review.
- `pnpm --filter @medical/worker-py run audit:document-enhancement:cleanup-plan -- --keep-last <n> [--max-age-days <n>] [--output-dir <local-dir>] [--write-plan] [--plan-output-dir <local-dir>]` turns those retention recommendations into a bounded local cleanup plan and can optionally persist one local JSON manifest under `plans/`.
- `pnpm --filter @medical/worker-py run audit:document-enhancement:index-consistency -- [--output-dir <local-dir>]` audits whether `audit-index.json` still matches the local artifact directory and reports bounded issues such as `missing_artifact`, `duplicate_index_entry`, `invalid_index_entry`, and `orphan_artifact`.
- `pnpm --filter @medical/worker-py run audit:document-enhancement:repair-handoff -- --keep-last <n> [--max-age-days <n>] [--output-dir <local-dir>] [--write-handoff] [--handoff-output-dir <local-dir>]` combines cleanup and consistency findings into one bounded local repair checklist and can optionally persist a handoff manifest under `repair-handoffs/`.
- `pnpm --filter @medical/worker-py run audit:document-enhancement:operator-summary -- --keep-last <n> [--max-age-days <n>] [--history-limit <n>] [--attention-limit <n>] [--output-dir <local-dir>] [--write-summary] [--summary-output-dir <local-dir>]` closes the phase with one bounded local operator snapshot over recent audit history, status breakdowns, retention pressure, consistency drift, and repair attention items.
- Missing `Presidio`, `OCRmyPDF`, `PaddleOCR`, or `GROBID` adapters degrade to advisory evidence. They do not block screening, editing, proofreading, routing, or verification-ops contracts.
- Cleanup-plan manifests are local-only operator aids. They do not delete files, rewrite `audit-index.json`, or auto-launch archive / cleanup actions.
- The index-consistency audit is also advisory-only. It does not repair local metadata, re-index orphan files, or remove stale entries automatically.
- Repair handoff manifests are human-owned checklists only. They do not repair the index, re-index orphan artifacts, or execute cleanup automatically.
- Operator-summary snapshots are local-only evidence summaries. They may write one JSON snapshot under `operator-summaries/`, but they do not trigger repair, cleanup, routing, or release actions.
- This baseline does not auto-anonymize, auto-run OCR, auto-publish governed assets, or promote itself into a routing or release control plane.
