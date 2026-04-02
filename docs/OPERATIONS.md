# 运维与交付基线

## 1. 适用范围

本文档覆盖当前 V1 仓库的本地开发、启动、迁移、备份、回滚、平台迁移与远程维护约束。

当前仓库存在两类 API runtime：

- demo runtime
  本地联调专用，内存态，允许 demo 数据
- persistent runtime
  当前用于 PostgreSQL-backed 稿件主链路、认证、学习/知识治理主干、治理注册表、agent-tooling 治理、执行治理/追踪、模型路由与 verification-ops 评测资产

## 2. 当前持久化边界

`pnpm --filter @medical/api run serve` 当前已经持久化：

- 稿件
- 稿件资产
- 作业记录
- 当前资产导出主链路
- 用户认证
- 登录失败窗口
- 服务端会话
- 审计日志
- 知识库条目
- 知识审稿动作
- 模板家族
- 模块模板版本
- 学习回写记录
- reviewed-case snapshots
- 人工反馈记录
- governed learning provenance source links
- Prompt 模板
- Skill 包
- 模型注册表
- 模型路由策略
- Agent Runtime Registry
- Tool Gateway Registry
- Sandbox Profile Registry
- Agent Profile Registry
- Runtime Binding Registry
- Tool Permission Policy Registry
- Agent Execution 日志
- 执行治理配置
- 执行追踪快照
- 知识命中日志
- Evaluation Sample Sets
- Evaluation Sample Set Items
- Verification Check Profiles
- Release Check Profiles
- Evaluation Suites
- Verification Evidence
- Evaluation Runs
- Evaluation Run Items
- Evaluation Evidence Packs
- Evaluation Promotion Recommendations

当前仍然不是完整生产持久化的部分：

- 完整学习主流程的更深自动化、评测闭环与策略优化
- 更完整的评测运营 UI、验证与 agent 执行编排等后续模块

因此，persistent runtime 当前应被视为：

- 可验证的持久化 API 入口
- 可继续扩展的生产前基础

而不是：

- 已经覆盖全部业务域的最终生产系统

当前 `apps/web` 的 admin governance console 已经可以直接管理：

- 模板家族与模块模板草稿/发布
- 模型注册表与模块路由策略
- Tool Gateway、Sandbox Profile、Agent Profile、Agent Runtime
- Tool Permission Policy、Runtime Binding
- execution bundle preview、最近 Agent Execution 日志查看，以及 execution snapshot / knowledge-hit 证据下钻
- Recent Agent Executions 对应的 manuscript / job / created asset 输出下钻

## 3. 本地依赖服务

`infra/docker-compose.yml` 当前提供：

- `postgres`
- `redis`
- `minio`
- `onlyoffice`
  通过 profile 方式按需启用

默认端口：

- Postgres: `15432`
- Redis: `56379`
- MinIO API: `59000`
- MinIO Console: `59001`
- ONLYOFFICE: `58080`

启动建议：

- 基础开发
  `docker compose -f infra/docker-compose.yml up -d`
- 需要验证 ONLYOFFICE 预览
  `docker compose -f infra/docker-compose.yml --profile onlyoffice up -d`

## 4. 环境变量

建议每个应用目录单独维护 `.env`：

- `apps/api/.env`
- `apps/web/.env`
- `apps/worker-py/.env`

如果没有正式 `.env`，`smoke:boot` 会回退到 `.env.example`。

API 关键环境变量：

- `APP_ENV`
- `API_PORT`
- `API_HOST`
- `API_ALLOWED_ORIGINS`
- `DATABASE_URL`
- `DATABASE_ADMIN_URL`
- `UPLOAD_ROOT_DIR`
- `REDIS_URL`
- `OBJECT_STORAGE_*`
- `ONLYOFFICE_*`
- `LIBREOFFICE_BINARY`

Web 关键环境变量：

- `VITE_APP_ENV`
- `VITE_API_BASE_URL`
- `VITE_DEMO_PASSWORD`
- `VITE_DEV_*`

约束：

- `APP_ENV=local`
  只能跑 `serve:demo` / `dev:demo`
- `APP_ENV=development|test|staging|production`
  走 `serve` / `serve:persistent`
- `VITE_APP_ENV=local`
  Web 端走 demo bootstrap shell，仅建议配合 `vite dev`
- `VITE_APP_ENV=dev|staging|prod`
  Web 端走 persistent login shell，依赖后端会话接口
- 生产环境必须替换 `ONLYOFFICE_JWT_SECRET`
- 生产环境必须使用真实数据库与对象存储凭据
- 稿件本地直传文件默认会写到 `.local-data/uploads/<APP_ENV>`；如需独立数据盘、跨平台迁移或集中备份，应显式设置 `UPLOAD_ROOT_DIR`

## 5. Smoke Checklist

### 5.1 基础依赖

- `docker compose -f infra/docker-compose.yml exec postgres pg_isready -U postgres -d medical_api`
- `docker compose -f infra/docker-compose.yml exec redis redis-cli ping`
- `curl http://127.0.0.1:59000/minio/health/ready`

### 5.2 应用基线

- `pnpm --filter @medical/api run smoke:boot`
- `pnpm --filter @medical/api run dev`
- `pnpm --filter @medical/api run dev:demo`
- `pnpm --filter @medical/api run serve:demo`
- `pnpm --filter @medical/api run serve`
- `pnpm --filter @medsys/web run smoke:boot`
- `pnpm --filter @medical/worker-py run smoke:boot`

### 5.3 全仓校验

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

### 5.4 Manuscript Workbench Release Gate

- `pnpm verify:manuscript-workbench`

说明：

- 该命令会串行执行 API/Web typecheck、稿件 workbench 相关 HTTP/页面测试，以及 Playwright 真实浏览器 smoke
- 当前浏览器门禁已经覆盖 manuscript handoff、learning review flow，以及 knowledge review handoff + approve/reject terminal actions
- 当前浏览器门禁已经覆盖 admin governance console 的模板治理、execution bundle preview，以及 execution observability 输出下钻
- 当前浏览器门禁也覆盖 evaluation workbench 中 draft suite 的真实激活链路，以及 create run -> save run item result -> finalize -> create learning candidate 的手动评测闭环
- 同一条门禁也覆盖 verification-ops 持久化 HTTP 回归，确保评测资产、run/evidence/evidence-pack 与 learning handoff 在重启后仍可读取和继续流转
- `.github/workflows/manuscript-workbench-gate.yml` 会在 `main` 分支 push / pull request 时复用同一条门禁命令

## 6. 启动顺序

1. `pnpm install`
2. `docker compose -f infra/docker-compose.yml up -d`
3. 如需预览联调，再启动 ONLYOFFICE profile
4. 跑三端 `smoke:boot`
5. 本地 in-memory/demo 联调用 `serve:demo`，如需 watch mode 用 `dev:demo`
6. 持久化开发默认用 `dev`，持久化非 watch 启动用 `serve`
7. 如需验证真实登录，设置 `apps/web/.env` 中的 `VITE_APP_ENV=dev` 后再启动 `pnpm --filter @medsys/web run dev`
8. 最后执行 `pnpm lint && pnpm typecheck && pnpm test`
9. 如需在发布前补一条贴近运营链路的回归，执行 `pnpm verify:manuscript-workbench`

## 7. 迁移、备份与回滚

至少需要覆盖以下资产：

- PostgreSQL 数据库
- MinIO 对象存储
- Manuscript inline upload root (`UPLOAD_ROOT_DIR` or `.local-data/uploads/<APP_ENV>`)
- 模板治理数据
- 知识库数据
- 学习治理数据
- 审计日志
- 管理员配置数据
  - 模型注册表
  - 模型路由策略
  - Agent Runtime Registry
  - Tool Gateway Registry
  - Sandbox Profile Registry
  - Agent Profile Registry
  - Runtime Binding Registry
  - Tool Permission Policy Registry
  - Agent Execution Logs
  - Prompt / Skill Registry
  - Verification Sample Sets / Sample Set Items
  - Verification Check Profiles / Release Check Profiles
  - Evaluation Suites / Runs / Run Items
  - Verification Evidence / Evidence Packs / Promotion Recommendations

回滚原则：

- 代码版本、数据库 schema、对象存储版本必须一起评估
- 迁移前先备份数据库与对象存储
- 模板、知识、技能包、提示词模板必须保留版本历史
- 回滚后重新执行 smoke checklist

## 8. 平台迁移

迁移到其他服务器或平台时，至少同步：

- Git 仓库
- `.env` 与密钥管理配置
- PostgreSQL 数据
- MinIO bucket 与对象键
- 运维文档
- Docker / 部署脚本

推荐顺序：

1. 备份数据库与对象存储
2. 恢复基础依赖
3. 恢复 `.env`
4. 部署代码
5. 跑 smoke checklist
6. 再开放业务访问

## 9. 远程维护

远程维护约束：

- Git 仓库是唯一代码真源
- 通过 SSH / VPN / 堡垒机进入维护环境
- 不直接在生产机改主分支
- 维护工作优先在独立分支或 worktree 完成

Codex 的推荐使用方式：

- 在维护机拉取代码
- 在隔离分支或 worktree 中开发、测试、review
- 让 Codex 执行阅读、修改、测试、文档同步
- 验证通过后再合并或部署

说明：

- Codex 是开发维护助手，不是生产运行时依赖
- `gstack`、`superpowers`、`subagent` 属于后台管理与维护能力，不对业务角色直接开放

## 10. 代码质量与注释约束

除运维流程外，日常开发与维护还应遵循：

- 复杂业务规则优先通过命名、结构和高价值注释表达清楚
- 关键流程改动必须补对应测试或验证证据
- review 重点检查业务边界、权限边界、知识调用边界、草稿/最终稿边界
- 没有验证证据，不宣称完成

配套文档：

- `docs/CODE_QUALITY.md`
- `docs/REVIEW_CHECKLIST.md`
