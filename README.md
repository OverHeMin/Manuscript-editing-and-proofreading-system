# 医学稿件处理系统 V1

这是一个面向医学稿件审稿、编修、校对与治理运营的 V1 仓库。当前仓库已经具备可本地运行的 `API + Web + Worker` 三端基线，并提供一套受治理的 PostgreSQL 持久化 runtime，用来承接稿件主链路、知识与规则治理、AI 接入配置、Harness 验证和运维门禁。

## 当前已经落地的能力

- 稿件主链路已经贯通：`submission -> screening -> editing -> proofreading` 可直接走真实 HTTP 路由。
- 浏览器端已支持本地文件上传，稿件资产默认落盘到 `.local-data/uploads/<APP_ENV>`，也可通过 `UPLOAD_ROOT_DIR` 指向独立目录。
- Manuscript workbench 已提供结构化稿件摘要、作业/资产概览、高风险审阅提示、状态横幅与运营式控制面板。
- Knowledge Library 已支持结构化知识条目录入、富文本/内容块编辑、语义层编辑、重复检测、附件与 revision 下钻。
- Knowledge Review 已有真实队列与审核动作；旧的 `learning-review` 页面现在只是兼容入口，新的质量优化/回流处理已并入 Rule Center 的 learning lane。
- Rule Center 已支持规则台账、规则草稿写回、候选/Canary/Active/Rollback 发布姿态、冲突解释、指标面板与 Harness 证据联动。
- System Settings 已支持 AI Provider Control Plane：可管理 `Qwen`、`DeepSeek`、`OpenAI`、`OpenAI-compatible` 连接，轮换密钥、做连通性测试、注册模型并维护模块默认模型与 fallback。
- Admin Governance 已收敛成轻量总览入口，用于查看 AI 接入、Harness、执行快照、告警与治理概览。
- Harness 工作区已经是统一运营入口：支持 suite/runs/datasets 视图、候选环境预览、candidate run、激活与回滚、latest-versus-previous 对照、稿件联动证据查看。
- Runtime Binding / Execution Profile / Model Routing / Retrieval Preset / Manual Review Policy 已形成一套可观测的受治理 AI 运行环境。
- Agent execution、execution snapshot、knowledge hit evidence、verification-ops 运行与证据包都已经有真实持久化主干。
- Worker 侧已提供文档处理、PDF pipeline、Manuscript Quality 分析器、Harness runners，以及 document enhancement advisory audit 工具链。
- 仓库内已提供 Manuscript workbench 浏览器门禁、生产前 preflight、postdeploy 健康检查、migration doctor、升级 rehearsal 和受治理 orchestration recovery。

## 工作台地图

| 工作台 | 当前作用 |
| --- | --- |
| `submission` | 投稿用户入口，负责上传稿件、查看个人进度与资产。 |
| `screening` / `editing` / `proofreading` | 三段主链路 workbench，支持真实执行、结果概览、导出与治理联动。 |
| `knowledge-library` | 知识库资产录入、修订、重复检查、语义编辑与 revision 管理。 |
| `knowledge-review` | 知识审稿队列、审批与治理动作。 |
| `template-governance` | Rule Center，负责规则作者工作流、规则回流、规则发布姿态与指标观察。 |
| `learning-review` | 兼容落点，进入后会跳转到 Rule Center 的 learning 工作区。 |
| `admin-console` | 轻量管理总览，集中展示 AI 接入、Harness 和治理告警，不承担深度配置。 |
| `system-settings` | AI Access 与 Accounts 两个管理区，负责模型连接、账户与权限。 |
| `evaluation-workbench` | Harness 工作区，统一处理 overview / runs / datasets、候选环境验证、激活与回滚。 |

## 当前持久化边界

`pnpm --filter @medical/api run serve` 启动的是持久化 runtime。当前已接入 PostgreSQL 的主要范围包括：

- 稿件、文档资产、作业记录、导出链路
- 用户认证、服务端会话、登录失败窗口、审计日志
- 知识条目、知识 revision、知识审稿动作
- 规则/模板治理、规则草稿写回、规则发布与相关运营指标
- Manuscript Quality 包、Runtime Binding、Execution Profile、Retrieval Preset、Manual Review Policy
- AI Provider Connection、Model Registry、Model Routing Governance
- Prompt / Skill Registry、Agent Runtime / Tool Gateway / Sandbox Profile / Agent Profile / Tool Permission Policy
- Agent Execution 日志、execution snapshot、knowledge hit evidence、orchestration lifecycle
- Verification Ops / Harness 相关的 sample sets、suites、runs、run items、evidence packs、promotion recommendations

这套系统当前依然是明确的 mixed-mode，不应误判为“完整生产系统已经全部完成”。仍然没有完成或没有打算在当前阶段完成的部分包括：

- 完整自动化学习闭环与自动策略优化
- 更完整的异步 worker 编排、生产级观测和跨系统 operations control plane
- 自动发布、自动切流、自动回滚、自动模型切换
- 最终形态的生产级身份体系、找回密码、多因子认证、多租户隔离

## 快速启动

### 环境要求

- Node.js 22+
- `pnpm` 10+
- Python 3.12+
- Docker Desktop（含 `docker compose`）

### 持久化本地启动（推荐）

如果你要跑真实登录、真实 PostgreSQL 持久化状态，而不是 demo 壳层，先补两份本地 `.env`：

`apps/api/.env`

```bash
APP_ENV=development
API_ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173
```

`apps/web/.env`

```bash
VITE_APP_ENV=dev
VITE_API_BASE_URL=http://127.0.0.1:3001
VITE_ONLYOFFICE_PUBLIC_URL=http://127.0.0.1:58080
WEB_PORT=4173
```

说明：

- `apps/api/.env.example` 与 `apps/web/.env.example` 已提供其余本地默认值；上面两份 `.env` 只覆盖持久化启动必须改掉的键。
- `apps/web/.env` 中如果不把 `VITE_APP_ENV` 改成 `dev`，`pnpm --filter @medsys/web run dev` 仍会停在 demo bootstrap shell，而不是进入真实后端登录壳。
- `API_ALLOWED_ORIGINS` 必须包含 Web 开发端口 `4173`，否则持久化登录会被跨域策略拦住。
- 如需文档预览，再额外启动 ONLYOFFICE profile：`docker compose -f infra/docker-compose.yml --profile onlyoffice up -d`。

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @medical/api run smoke:boot
pnpm --filter @medsys/web run smoke:boot
pnpm --filter @medical/worker-py run smoke:boot
pnpm --filter @medical/api run db:migrate
pnpm --filter @medical/api run preflight:persistent
pnpm --filter @medical/api run serve
pnpm --filter @medsys/web run dev
```

### Demo 启动（只做演示或联调）

如果只需要本地演示/联调，可以保持 `apps/web/.env` 不存在，或让 `VITE_APP_ENV=local`，然后改用 demo runtime：

```bash
pnpm --filter @medical/api run serve:demo
```

### 关键环境变量

- `APP_ENV=local` 只用于 demo runtime；`development|test|staging|production` 才走持久化 runtime。
- `VITE_APP_ENV=local` 使用 demo bootstrap shell；`dev|staging|prod` 使用 persistent login shell。
- 持久化本地登录的最小组合是：`APP_ENV=development`、`VITE_APP_ENV=dev`、`VITE_API_BASE_URL=http://127.0.0.1:3001`、`API_ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173`。
- `DATABASE_URL` 是持久化 runtime 的必需项。
- `UPLOAD_ROOT_DIR` 可把上传资产从默认的 `.local-data/uploads/<APP_ENV>` 迁到独立目录。
- `AI_PROVIDER_MASTER_KEY` 用于系统托管的 AI Provider 密钥加密；启用 AI Access 时需要提供。
- `APP_ENV=staging|production` 时，placeholder secrets 会被启动前校验直接拦截。

## 常用命令

### 三端基础校验

```bash
pnpm --filter @medical/api run smoke:boot
pnpm --filter @medsys/web run smoke:boot
pnpm --filter @medical/worker-py run smoke:boot
```

### 稿件工作台浏览器门禁

```bash
pnpm verify:manuscript-workbench
```

### 生产前 / 生产后门禁

```bash
pnpm verify:production-preflight
pnpm verify:production-preflight -- --manifest <path-to-manifest>
pnpm verify:production-preflight:strict
pnpm verify:production-upgrade-rehearsal -- --manifest <path-to-manifest>
pnpm verify:production-postdeploy -- --base-url http://127.0.0.1:3001
```

### 持久化 runtime 预检与恢复

```bash
pnpm --filter @medical/api run preflight:persistent
pnpm --filter @medical/api run recover:governed-orchestration
pnpm --filter @medical/api run recover:governed-orchestration -- --dry-run
pnpm --filter @medical/api run recover:governed-orchestration -- --dry-run --json
```

### Worker 侧文档增强审计

```bash
pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path <local-path>
```

### Codex 本地日志清理

```bash
pnpm inspect:codex-logs
pnpm cleanup:codex-logs
```

## 目录结构

- `apps/api`
  TypeScript HTTP API、数据库迁移、治理服务、持久化 runtime、运维脚本。
- `apps/web`
  React/Vite workbench，覆盖主链路、知识治理、规则治理、系统设置与 Harness 工作区。
- `apps/worker-py`
  Python worker，负责文档处理、PDF 处理、Manuscript Quality、Harness runners 与 advisory audits。
- `packages/contracts`
  前后端共享契约。
- `infra`
  本地依赖服务编排。
- `scripts`
  仓库级门禁、release/preflight、清理与辅助脚本。
- `docs`
  运维、规格、phase 设计与验收文档。

## 关键文档

- `docs/OPERATIONS.md`
  当前最完整的运行、迁移、备份、回滚、发布与远程维护说明。
- `docs/operations/release-manifest-template.md`
  staging / production 发布记录模板，也是 predeploy / rehearsal 的输入模板。
- `docs/operations/ai-provider-control-plane-smoke-checklist.md`
  AI Provider Control Plane 的后台验收清单。
- `docs/operations/harness-control-plane-p0-smoke-checklist.md`
  Harness Control Plane 的候选环境预览、激活与回滚验收清单。
- `docs/operations/manuscript-quality-v2-smoke-checklist.md`
  Manuscript Quality 包治理、binding、Harness 验证与回滚验收清单。
- `docs/operations/manuscript-quality-governance-workspace.md`
  通用风格包与医学分析包的后台维护边界说明。
- `docs/CODE_QUALITY.md`
  代码质量与注释约束。
- `docs/REVIEW_CHECKLIST.md`
  开发与 review 清单。
- `docs/superpowers/specs/README.md`
  规格文档入口。
- `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  phase 边界和历史交付容器的索引说明。

## 当前系统边界与注意事项

- `learning-review` 不是新主入口，新的质量优化/规则回流工作流在 Rule Center 内处理。
- `admin-console` 是总览入口，不是深度配置台；深度配置分别在 `system-settings`、`template-governance`、`evaluation-workbench`。
- Harness Control Plane 可以改变某个 scope 的受治理 AI 环境，但它不是部署控制面；不会替代发布、迁移或基础设施切流。
- 候选环境的激活与回滚只影响后续新建工作，不会反向改写已经完成的稿件运行。
- 自动模型切换、自动发布、自动 release orchestration、自动 learning writeback 仍不在当前范围。
- `docs/superpowers/plans/*.md` 与 `docs/superpowers/specs/*.md` 仍然是 phase 边界的权威说明；README 负责给出当前可运行状态的总览，不替代这些详细文档。

## 一句话总结

当前这套仓库已经不是“只有骨架的 V1 演示库”，而是一套可本地跑通、可持久化、可做治理运营、可做 Harness 验证、可做 AI 接入配置的医学稿件处理系统基线；但它还不是完整的生产运营平台，后续工作重点仍然在更深的自动化、运维闭环与生产部署能力。
