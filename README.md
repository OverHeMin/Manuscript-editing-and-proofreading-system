# 医学稿件处理系统 V1

这是医学稿件处理系统的 V1 基础仓库。当前仓库已经具备可运行的本地 API / Web / Worker 基线，以及一条受控的 PostgreSQL 持久化 HTTP runtime。

当前已落地的核心能力：

- 稿件主链路与文件资产模型
- 审稿 / 编加 / 校对三大业务模块基础编排
- 知识库、模板治理、学习治理骨架
- AI 模型注册与路由基础
- PDF 一致性核对与学习候选基础能力
- React workbench 页面与本地 demo HTTP runtime
- PostgreSQL 持久化的认证、会话、审计与治理注册表 runtime
- 本地运维、迁移、交付文档基线

## 当前状态

仓库现在有两条明确的 API 运行方式：

- `pnpm --filter @medical/api run serve:demo`
  仅用于本地 loopback-only 演示、联调和 QA。数据为内存态，可自动注入 demo 数据。
- `pnpm --filter @medical/api run serve`
  启动持久化 runtime。当前已把以下内容接入 PostgreSQL：
  - 用户认证、登录失败窗口、服务端会话、审计日志
  - 知识库条目与知识审稿动作
  - 模板家族与模块模板版本治理
  - 学习回写记录

当前仍然是 mixed-mode，不应误判为“整套业务都已完全生产持久化”。仍未完成真实持久化或仍属基础实现的部分包括：

- 稿件、资产、上传与导出主链路
- 学习快照、反馈溯源与完整学习主流程
- Prompt / Skill Registry 的持久化接线
- 评测、验证、执行治理等后续阶段模块

这意味着：

- `apps/web` 已经有真实可运行的 workbench 页面
- `apps/api` 已经有真实可运行的 HTTP 服务
- 但 `serve` 当前代表“认证 + 治理注册表持久化 runtime”，不是最终生产版完整业务系统

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
4. 启动本地 demo API
   `pnpm --filter @medical/api run serve:demo`
5. 启动 PostgreSQL 持久化 API
   `pnpm --filter @medical/api run serve`
6. 启动 Web workbench
   `pnpm --filter @medsys/web run dev`
7. 验证 Web 基线
   `pnpm --filter @medsys/web run smoke:boot`
8. 验证 Worker 基线
   `pnpm --filter @medical/worker-py run smoke:boot`
9. 跑全仓校验
   `pnpm lint && pnpm typecheck && pnpm test`

## Runtime 契约

### Demo Runtime

- `APP_ENV=local`
- 仅允许 loopback host / origin
- 允许自动注入 demo 知识审稿与学习治理样例
- 不连接真实持久化业务存储

### Persistent Runtime

- `APP_ENV=development|test|staging|production`
- 必须提供 `DATABASE_URL`
- 当前持久化范围是“认证 + 治理注册表”
- 不会自动注入 demo 审稿数据

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
  运行、迁移、备份、远程维护
- `docs/CODE_QUALITY.md`
  代码质量与注释约束
- `docs/REVIEW_CHECKLIST.md`
  开发与 review 清单
- `docs/superpowers/specs/README.md`
  规格文档入口

## 说明

如果要把这套系统继续推进到“完整生产可用”，下一批重点工作仍然是：

- 稿件与资产主链路的真实持久化
- 学习主流程与反馈溯源落库
- Prompt / Skill Registry 持久化
- Web workbench 对持久化治理接口的完整接线
- 部署、监控、回滚、远程维护标准化
