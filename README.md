# 医学稿件处理系统 V1

这是医学稿件处理系统的 V1 基础仓库，当前阶段已经完成：

- 稿件主线与文件资产模型
- 审稿 / 编加 / 校对模块基础编排
- 知识库、模板治理、学习治理骨架
- AI 模型注册与路由基线
- PDF 一致性核对与学习候选基础能力
- 本地运维与交付基线

## 当前阶段说明

这还是基础设施与领域层仓库，不是完整可上线的 Web/API 产品。

- API / Web / Worker 的 `smoke:boot` 目前验证的是配置加载、依赖连通性和基础模块可导入性。
- 当前仓库已经包含 phase 7 的本地 Web workbench 页面，以及一个仅用于本地联调 / QA 的 API demo runtime。
- `pnpm --filter @medical/api run dev:demo` / `serve:demo` 启动的是内存型演示服务，只允许本机回环地址访问，不连接真实持久化存储，也不能作为生产 API 入口。
- 当前 `pnpm lint && pnpm typecheck && pnpm test` 覆盖的是：
  API 领域层静态检查与测试、Worker 文档/PDF pipeline 测试、Web 类型检查与 smoke boot、以及本地 demo HTTP 回归测试。
- 它不是最终的 UI 自动化测试或生产 HTTP 端到端验收。

## 环境要求

- Node.js 22+
- `pnpm` 10+
- Python 3.12+
- Docker Desktop（含 `docker compose`）

## 快速启动

1. 安装依赖：
   `pnpm install`
2. 启动本地依赖：
   `docker compose -f infra/docker-compose.yml up -d`
3. 验证 API 基线：
   `pnpm --filter @medical/api run smoke:boot`
4. 如需本地演示 HTTP workbench API：
   `pnpm --filter @medical/api run serve:demo`
5. 验证 Web 基线：
   `pnpm --filter @medsys/web run smoke:boot`
6. 验证 Worker 基线：
   `pnpm --filter @medical/worker-py run smoke:boot`
7. 跑全仓校验：
   `pnpm lint && pnpm typecheck && pnpm test`

## 环境文件

- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/worker-py/.env.example`

`smoke:boot` 会优先读取同目录下的 `.env`，不存在时回退到 `.env.example`。

## 目录结构

- `apps/api`: 领域服务、权限、数据库迁移与接口层
- `apps/web`: 前端类型与 API 调用壳
- `apps/worker-py`: 文档处理、模块 runner、PDF pipeline
- `infra`: 本地依赖服务编排
- `docs`: 运维、方案与实现文档

## 开发规范

- 代码质量与 review 基线：`docs/CODE_QUALITY.md`
- 开发与 review 检查清单：`docs/REVIEW_CHECKLIST.md`
- 运维、迁移与远程维护：`docs/OPERATIONS.md`
- 规格文档入口：`docs/superpowers/specs/README.md`

## 运维与迁移

详细操作手册见 `docs/OPERATIONS.md`。
