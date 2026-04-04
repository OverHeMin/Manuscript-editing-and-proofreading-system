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
- Recent Agent Executions 对应的 manuscript / job / created asset 输出下钻、跳转到对应 workbench / 下载可导出资产，以及按状态筛选/搜索的执行分诊

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

## 5. Release Contract 与 Smoke Checklist

### 5.1 健康检查语义

- `GET /healthz`
  只表示 API 进程仍然存活，适合最轻量的 liveness check。
- `GET /readyz`
  是真正的部署门禁；只有当 runtime contract、数据库连通性、upload root 可写性都通过时才应返回 `200`。
- 不要把 `healthz` 当成可放量信号。发布、扩容、切流、回滚完成后的确认都以 `readyz` 为准。

### 5.2 基础依赖

- `docker compose -f infra/docker-compose.yml exec postgres pg_isready -U postgres -d medical_api`
- `docker compose -f infra/docker-compose.yml exec redis redis-cli ping`
- `curl http://127.0.0.1:59000/minio/health/ready`

### 5.3 Repo-owned pre-deploy validation

- `pnpm verify:production-preflight`
- `pnpm verify:production-preflight -- --manifest <path-to-manifest>`
- `pnpm verify:production-preflight:strict`
- `pnpm verify:production-upgrade-rehearsal -- --manifest <path-to-manifest>`

该命令会按固定顺序串行执行：

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm --filter @medical/api run smoke:boot`
5. `pnpm --filter @medsys/web run smoke:boot`
6. `pnpm --filter @medical/worker-py run smoke:boot`
7. `pnpm verify:manuscript-workbench`

说明：

- 任一步失败都应立即停止发布。
- `--manifest <path>` 会先对 release manifest 做机器校验；若 manifest 声明 `schema change = no` 但仓库仍存在 pending migrations，predeploy 会在真正执行 lint/typecheck/test 之前失败。
- `verify:production-preflight:strict` 会在不依赖 manifest 的情况下追加只读 migration doctor 检查，用于先行发现 checksum drift、unknown database version 或 pending migrations。
- `verify:production-upgrade-rehearsal` 会读取同一份 manifest，验证 secret rotation / rehearsal proof，并打印本地演练步骤；它不会自动执行 deploy、rollback 或 secret mutation。
- `pnpm verify:manuscript-workbench` 仍是 repo 内最贴近运营主链路的浏览器门禁，覆盖 manuscript handoff、learning review、knowledge review、admin governance、evaluation workbench 与 verification-ops 持久化 HTTP 回归。
- `.github/workflows/manuscript-workbench-gate.yml` 会在 `main` 分支 push / pull request 时复用同一条门禁命令。

### 5.4 Release manifest 记录

- 每次 staging / production 发布前，都应先复制并填写 `docs/operations/release-manifest-template.md`。
- Manifest 至少要记录：
  - environment
  - operator
  - commit SHA
  - schema change yes/no
  - backup artifact references
  - restore point
  - pre-deploy checks
  - post-deploy checks
  - rollback decision and outcome
- 若 `schema change required = yes`，则 `PostgreSQL backup artifact`、`Restore point / snapshot ID`、`Backup verified by` 都必须填写完整。
- 若 `Upload root or object storage impact = yes`，则至少要填写一个 storage snapshot 字段：`Object storage backup artifact` 或 `Upload root snapshot`。
- 若 `secret rotation required = yes`，则必须填写 `Secret rotation notes` 与 `Secret rotation verified by`。
- 若发布涉及 schema 变化、storage 变化或 secret rotation，则 `Upgrade rehearsal required` 必须为 `yes`，并补齐 rehearsal environment、evidence、verified by。
- manifest 是 repo-owned 的本地记录与 predeploy 证据，不会触发自动部署、自动回滚或远程发布编排。

### 5.5 持久化启动前验证

- `pnpm --filter @medical/api run preflight:persistent`
- `pnpm --filter @medical/api run db:migrate`
- `pnpm --filter @medical/api run serve`

说明：

- `preflight:persistent` 与 `serve` 复用同一套 persistent runtime contract 与 startup preflight，不允许再依赖第二套口头校验路径。
- `serve` 会在 listen 前完成 contract 解析、数据库可达性检查和 upload root 可写性检查；任一失败都应直接阻断启动。
- `APP_ENV=staging|production` 时必须替换 `ONLYOFFICE_JWT_SECRET=change-me-in-prod`，否则 preflight 会失败。

### 5.6 Post-deploy health confirmation

- `pnpm verify:production-postdeploy -- --base-url http://127.0.0.1:3001`
- `curl http://127.0.0.1:3001/healthz`
- `curl http://127.0.0.1:3001/readyz`

说明：

- `verify:production-postdeploy` 会同时请求 `/healthz` 和 `/readyz`，并输出 compact JSON summary。
- 只要任一端点不是 `200`，脚本都会以非零退出。
- 即使 `healthz=200`，只要 `readyz!=200`，也必须视为部署未完成或需要回滚/修复。

## 6. 启动与发布顺序

1. `pnpm install`
2. `docker compose -f infra/docker-compose.yml up -d`
3. 如需预览联调，再启动 ONLYOFFICE profile
4. 跑三端 `smoke:boot`
5. 在 persistent runtime 上线前执行 `pnpm --filter @medical/api run preflight:persistent`
6. 本地 in-memory/demo 联调用 `serve:demo`，如需 watch mode 用 `dev:demo`
7. 持久化开发默认用 `dev`，持久化非 watch 启动用 `serve`
8. 如需验证真实登录，设置 `apps/web/.env` 中的 `VITE_APP_ENV=dev` 后再启动 `pnpm --filter @medsys/web run dev`
9. staging / production 发布前填写 `docs/operations/release-manifest-template.md`
10. 执行 `pnpm verify:production-preflight`
11. 执行 `pnpm --filter @medical/api run db:migrate` 与部署动作
12. API 启动后执行 `pnpm verify:production-postdeploy -- --base-url <base-url>`

## 7. 迁移、备份与回滚

发布前先基于 `docs/operations/release-manifest-template.md` 记录本次环境、操作人、commit SHA、备份件与 schema change 决策。没有 manifest，就不应进入正式发布动作。

在 Phase 10G 中，建议先执行：

- `pnpm --filter @medical/api run db:migration-doctor -- --json`
- `pnpm verify:production-preflight -- --manifest <path-to-manifest>`
- `pnpm verify:production-upgrade-rehearsal -- --manifest <path-to-manifest>`

这两个步骤都是本地只读 guard：

- 会分类 `clean` / `repairable` / `blocked`
- 会区分 pending repo migrations 与真正的 migration history drift
- 不会自动 deploy、自动 rollback，也不会越权成为 routing control plane

升级演练 guard 还会：

- 验证本次发布是否错误地遗漏了 secret rotation proof
- 验证高风险发布是否错误地把 rehearsal 标成 `no`
- 输出 repo-owned 的本地演练顺序，而不是代替操作者执行升级

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
- 先判断 schema change 是否存在、是否可逆，再决定能否只做代码回滚
- 模板、知识、技能包、提示词模板必须保留版本历史
- 回滚后至少重新执行 `pnpm verify:production-postdeploy -- --base-url <base-url>`；如有疑问，再补跑 `pnpm verify:production-preflight` 与 `pnpm verify:manuscript-workbench`

### 7.1 最小备份清单

每次做以下动作前，都至少做一次可恢复备份：

- 数据库 schema 迁移
- 生产或准生产发布
- 平台迁移
- 密钥轮换
- 大批量知识/模板导入

最小备份包建议包含：

- PostgreSQL dump
- MinIO bucket 快照或镜像副本
- `UPLOAD_ROOT_DIR` 或 `.local-data/uploads/<APP_ENV>` 的目录快照
- 当前 `.env` 字段清单与密钥来源说明
- 当前 Git commit SHA

建议同时记录：

- 备份时间
- 操作人
- 备份覆盖的环境
- 对应发布单或变更原因
- 对应 restore point / snapshot ID

### 7.2 最小回滚执行顺序

如果一次发布需要回滚，优先按以下顺序判断：

1. 先确认是否只需代码回滚，还是必须连同数据库/对象存储一起回滚
2. 如果有 schema 变化，先确认迁移是否可逆，再决定是否执行数据回滚
3. 恢复数据库与对象存储后，再恢复代码版本
4. 恢复完成后立即执行 smoke checklist
5. 恢复完成后立即执行 `pnpm verify:production-postdeploy -- --base-url <base-url>`
6. 如仍有疑问，再补跑 `pnpm verify:manuscript-workbench`
7. 最后再恢复外部访问或通知业务恢复

不建议：

- 只回滚代码而忽略已变更的 schema
- 在没有备份可验证的情况下直接覆盖生产数据
- 在 `readyz` 未恢复为 `200` 前就宣称回滚完成

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

### 8.1 跨平台迁移验收

迁移到新机器或新平台后，至少确认以下内容：

- `pnpm install` 能完整通过
- `docker compose -f infra/docker-compose.yml up -d` 能拉起基础依赖
- `pnpm --filter @medical/api run smoke:boot`
- `pnpm --filter @medsys/web run smoke:boot`
- `pnpm --filter @medical/worker-py run smoke:boot`
- `pnpm verify:manuscript-workbench`

如果是正式迁移，还应补做：

- 抽查至少 1 条稿件主链路
- 抽查至少 1 次 learning review -> knowledge review handoff
- 抽查至少 1 次 evaluation workbench 手动评测闭环
- 抽查上传目录、对象存储、数据库三者之间的资产可追溯性

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

### 9.1 Codex 远程维护标准流程

推荐按以下顺序进行：

1. 进入维护机或开发机，不直接在生产机主分支改代码
2. 拉取最新仓库并创建独立分支或 worktree
3. 先阅读 `README.md`、`docs/OPERATIONS.md`、相关 plan/spec 文档
4. 让 Codex 先做现状审计，再开始修改
5. 所有改动都要求真实验证证据
6. 优先在分支中完成 review、提交、推送
7. 合并后再执行发布或迁移

推荐保留的维护证据：

- 相关 commit SHA
- 执行过的验证命令
- 失败与修复的摘要
- 是否涉及 schema、对象存储或上传目录

### 9.2 让系统不依赖某一台 Codex 机器

为了避免“换电脑或平台后无法继续维护”，应把以下内容留在仓库或团队文档中：

- 关键架构与运维文档
- `docs/superpowers/plans/` 与 `docs/superpowers/specs/` 中的阶段文档
- 关键验证命令与发布门禁
- 必要的脚本、workflow、依赖版本说明

不要把以下内容当作系统运行时依赖：

- 某一台本地 Codex 的会话上下文
- 某一台机器私有的临时提示词
- 某个维护者记忆中的“口头流程”

## 10. 密码与密钥安全

最小要求：

- `.env` 不进 Git
- 生产环境不使用 demo 密码或默认密钥
- `ONLYOFFICE_JWT_SECRET`、数据库密码、对象存储凭据必须独立管理
- 平台迁移、人员变更或疑似泄露后要做密钥轮换
- 当前仓库级硬阻断的已知占位/默认值包括：`ONLYOFFICE_JWT_SECRET=change-me-in-prod`、`OBJECT_STORAGE_ACCESS_KEY=minioadmin`、`OBJECT_STORAGE_SECRET_KEY=minioadmin123`

建议约束：

- 区分本地演示账号与正式环境账号
- 正式环境使用独立密钥管理器、密码库或平台 Secret 管理
- 管理员账号最少化，不共享 root 级凭据
- 把“谁持有哪类凭据”记录到运维清单，而不是写在聊天记录里

当前阶段的现实边界：

- 仓库已经有持久化认证与会话主干
- 但完整的生产级身份管理、找回密码、多因子认证仍不是当前 V1 已交付范围
- 因此外部暴露前仍需要额外的接入层保护、网络边界与账号策略

## 11. 版本更新与升级

发布或升级时，建议至少记录：

- Git commit SHA
- 是否包含数据库迁移
- 是否影响对象存储或上传目录结构
- 是否影响前端环境变量或登录方式
- 是否需要业务停机窗口

推荐升级流程：

1. 在独立分支或 worktree 中完成升级
2. 填写 `docs/operations/release-manifest-template.md`，确认是否包含 schema change、备份件与 restore point
3. 运行 `pnpm verify:production-upgrade-rehearsal -- --manifest <path-to-manifest>`
4. 运行 `pnpm verify:production-preflight -- --manifest <path-to-manifest>`
5. 如涉及持久化 API，先执行 `pnpm --filter @medical/api run preflight:persistent`
6. 执行迁移、部署与 `pnpm --filter @medical/api run serve`
7. 运行 `pnpm verify:production-postdeploy -- --base-url <base-url>`
8. 记录升级前后的关键版本变化，并把结果补回 manifest
9. 只有 `readyz=200` 且 rollback decision 明确后才算发布完成

尤其要注意：

- Node、pnpm、Docker image、Playwright 浏览器版本的联动变化
- 数据库迁移号是否与发布顺序一致
- 前端环境变量变化是否同步写入 `README.md` / `docs/OPERATIONS.md`

## 12. 代码质量与注释约束

除运维流程外，日常开发与维护还应遵循：

- 复杂业务规则优先通过命名、结构和高价值注释表达清楚
- 关键流程改动必须补对应测试或验证证据
- review 重点检查业务边界、权限边界、知识调用边界、草稿/最终稿边界
- 没有验证证据，不宣称完成

配套文档：

- `docs/CODE_QUALITY.md`
- `docs/REVIEW_CHECKLIST.md`

## 13. Document Enhancement Advisory (Phase 10I)

Use the worker-owned audit command when you need bounded local evidence about privacy precheck findings or OCR / academic-structure readiness:

- `pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path <local-path> [--text-file <local-text-file>] [--text-layer present|missing|unknown]`
- `pnpm --filter @medical/worker-py run audit:document-enhancement -- --document-path <local-path> [--text-file <local-text-file>] [--text-layer present|missing|unknown] --write-artifact [--output-dir <local-dir>]`
- `pnpm --filter @medical/worker-py run audit:document-enhancement:history -- --list [--limit <n>] [--output-dir <local-dir>]`
- `pnpm --filter @medical/worker-py run audit:document-enhancement:history -- --artifact-path <local-json>`

Operational rules:

- This command is local-first, read-only, and fail-open.
- The default artifact directory is `.local-data/document-enhancement-audits/manual`, and the directory keeps additive JSON reports plus `audit-index.json`.
- The separate history CLI is also read-only. It only reads the local index and explicit artifact paths; it does not rewrite or delete artifacts.
- Missing `Presidio`, `OCRmyPDF`, `PaddleOCR`, or `GROBID` adapters return degraded advisory evidence instead of blocking worker startup or manuscript execution.
- The JSON output is an operator aid only. It does not replace human de-identification review and does not auto-launch OCR or academic-structure extraction.
