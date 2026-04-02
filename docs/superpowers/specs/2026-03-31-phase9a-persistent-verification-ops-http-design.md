# Phase 9A Persistent Verification Ops HTTP Design

**Date:** 2026-03-31  
**Status:** Approved for implementation under the current autonomous Phase 9 direction  
**Scope:** 为 `verification-ops` 补齐 PostgreSQL 持久化与真实 HTTP runtime，使 Phase 6A 的评测/实验治理能力不再停留在内存模块测试层。

## 1. Goal

Phase 9A 的目标不是扩展新的实验能力定义，而是把 Phase 6A 已经建好的离线实验治理模型真正接入当前系统主干：

- 能通过真实 HTTP API 创建和读取评测治理对象
- 能在 `serve` 持久化 runtime 下跨重启保留评测/实验数据
- 能把实验结果继续交给既有 learning review / knowledge review 链路

完成后，Phase 9B 才有稳定底座去做 `Evaluation Workbench`。

## 2. Current Gap

当前仓库已经具备：

- `verification-ops` 领域模型、服务、typed web client
- 样本集、实验套件、运行项、证据包、推荐建议、实验到学习候选 handoff
- 领域层测试

当前缺口是：

- 没有 PostgreSQL-backed `verification-ops` repository
- 没有 migration 持久化这些对象
- `apps/api` 没有把 `verification-ops` 路由接入真实 HTTP server runtime
- `serve` 还不能把评测/实验当成真实后台能力对外提供

这会导致后续如果先做 `Evaluation Workbench`，页面会踩在非持久化或根本不存在的 HTTP 契约上，返工概率高。

## 3. Options Considered

### Option A: 先做 Evaluation Workbench，再补后端

优点：

- 页面可见进展快

缺点：

- UI 需要先绑 demo-only 或临时 client contract
- 后面补持久化时会重新改 controller、空态、错误态和回归测试

不推荐。

### Option B: 先把 HTTP 路由接出来，但仍然用内存 repository

优点：

- 能较快形成 API 契约

缺点：

- `serve` 的真实语义仍然不成立
- 文档和运行边界会再次变得模糊
- 后续仍要做第二轮“从 HTTP demo 到 persistent”的迁移

不推荐。

### Option C: 先做持久化 + 真实 HTTP foundation，再做 Workbench

优点：

- 与 Phase 8 的持久化主线保持一致
- 能一次性定义清楚 runtime 边界
- Phase 9B 只需专注前端运营体验

缺点：

- 这一刀用户可见 UI 变化较少

推荐采用。

## 4. Recommended Architecture

Phase 9A 采用和 Phase 8B/8F 一致的结构：

1. 新增 `0011_verification_ops_persistence.sql`
2. 新增 `PostgresVerificationOpsRepository`
3. 在 `persistent-governance-runtime` 中装配 `VerificationOpsService`
4. 在 `api-http-server.ts` 中：
   - 扩展 `ApiServerRuntime`
   - 扩展 route union / route matching
   - 扩展 request handling switch
5. 增加 HTTP 测试与 persistent restart 回归

## 5. Data Model Strategy

为降低第一次持久化接线风险，Phase 9A 优先采用“关系主键 + JSONB 明细”的方案：

- 关系字段单独落列：
  - `sample_set_id`
  - `suite_id`
  - `evaluation_run_id`
  - `experiment_run_id`
  - `evidence_pack_id`
- 嵌套/数组/冻结配置落 JSONB：
  - `manuscript_types`
  - `risk_tags`
  - `source_policy`
  - `module_scope`
  - `hard_gate_policy`
  - `score_weights`
  - `baseline_binding`
  - `candidate_binding`
  - `evidence_ids`
  - `learning_candidate_ids`

这样做的理由：

- 当前 Phase 9A 主要需求是正确持久化与读取，不是复杂 SQL 查询分析
- 可以最大限度保持现有 TypeScript record 结构不变
- 后续如果要做更细的运营筛选，再按真实查询压力拆表，不会阻塞当前阶段

## 6. Runtime Boundaries

### Demo Runtime

继续保留内存态 `verification-ops`，用于本地轻量联调。

### Persistent Runtime

`serve` 下新增 PostgreSQL-backed `verification-ops`，覆盖：

- 样本集与样本项
- 校验 profile / release check profile
- 评测 suite
- verification evidence
- evaluation run / run item
- evidence pack / promotion recommendation

实验到学习候选 handoff 继续复用既有 `learning`/`feedback-governance` 持久化主链路。

## 7. HTTP Surface

Phase 9A 接入当前已经定义过的 typed client 路由，不重设计 API shape：

- `POST/GET /api/v1/verification-ops/check-profiles`
- `POST /api/v1/verification-ops/check-profiles/:id/publish`
- `POST/GET /api/v1/verification-ops/release-check-profiles`
- `POST /api/v1/verification-ops/release-check-profiles/:id/publish`
- `POST/GET /api/v1/verification-ops/evaluation-suites`
- `POST /api/v1/verification-ops/evaluation-suites/:id/activate`
- `GET /api/v1/verification-ops/evaluation-suites/:id/runs`
- `POST/GET /api/v1/verification-ops/evaluation-sample-sets`
- `POST /api/v1/verification-ops/evaluation-sample-sets/:id/publish`
- `GET /api/v1/verification-ops/evaluation-sample-sets/:id/items`
- `POST /api/v1/verification-ops/evidence`
- `POST /api/v1/verification-ops/evaluation-runs`
- `POST /api/v1/verification-ops/evaluation-runs/:id/complete`
- `POST /api/v1/verification-ops/evaluation-runs/:id/finalize`
- `GET /api/v1/verification-ops/evaluation-runs/:id/items`
- `POST /api/v1/verification-ops/evaluation-run-items/:id/result`
- `POST /api/v1/verification-ops/evaluation-runs/:id/learning-candidates`

## 8. Test Strategy

Phase 9A 至少新增两类保障：

### 8.1 HTTP Contract Tests

证明：

- 管理员能通过真实 HTTP 创建 sample set / suite / run
- 能完成 run、生成 evidence pack、生成 recommendation
- 能从 evaluation run 创建 governed learning candidate

### 8.2 Persistent Restart Tests

证明：

- `serve` 重启后仍能读取 sample set / suite / run
- finalize 后的 evidence pack 与 recommendation 仍可恢复
- evaluation-to-learning handoff 的 provenance 在重启后仍完整

## 9. Out of Scope

Phase 9A 不做：

- `Evaluation Workbench` 页面
- 浏览器端评测 smoke
- 复杂过滤、排序、统计图表
- 自动执行真实模型实验
- 自动把 recommendation 写回生产路由

这些放到 Phase 9B 及后续阶段。

## 10. Acceptance Criteria

- `verification-ops` 在 `serve` 下可通过真实 HTTP 调用
- 关键评测治理对象在 PostgreSQL 中跨重启保持稳定
- 实验结果可继续 handoff 到 learning candidate 治理链路
- 文档明确把 `verification-ops` 纳入当前 persistent runtime 边界
