# 运维与交付基线

## 1. 适用范围

本文档覆盖 V1 基础仓库的本地启动、依赖服务、冒烟检查、迁移、升级、回滚与远程维护约定。

当前阶段说明：

- API / Web / Worker 还没有完整的长驻服务入口。
- `smoke:boot` 用于验证配置、依赖连通性和基础模块可导入性。
- 后续阶段接入真实 HTTP 服务和队列轮询后，可以沿用这套运维骨架继续扩展。
- 当前仓库级 `lint/typecheck/test` 已经是真实命令，但覆盖面仍属于 foundation baseline，
  不是最终 UI E2E 或在线协作回归。

## 2. 本地依赖服务

`infra/docker-compose.yml` 当前提供：

- `postgres`
- `redis`
- `minio`

默认端口：

- Postgres: `15432`
- Redis: `56379`
- MinIO API: `59000`
- MinIO Console: `59001`

默认对象存储 bucket：

- `medical-manuscripts-local`
- 首次使用时可在 MinIO Console 中手工创建

## 3. 环境文件

建议每个应用目录独立维护自己的 `.env`：

- `apps/api/.env`
- `apps/web/.env`
- `apps/worker-py/.env`

如果没有正式 `.env`，`smoke:boot` 会自动回退到对应的 `.env.example`。

## 4. Smoke Checklist

### 4.1 依赖可达

- `docker compose -f infra/docker-compose.yml exec postgres pg_isready -U postgres -d medical_api`
- `docker compose -f infra/docker-compose.yml exec redis redis-cli ping`
- `curl http://127.0.0.1:59000/minio/health/ready`

### 4.2 应用基线

- `pnpm --filter @medical/api run smoke:boot`
- `pnpm --filter @medsys/web run smoke:boot`
- `pnpm --filter @medical/worker-py run smoke:boot`

### 4.3 全仓校验

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

覆盖面说明：

- `apps/api`: TypeScript 静态检查 + 领域层与数据库测试
- `apps/web`: TypeScript 类型检查 + Web smoke boot
- `apps/worker-py`: Python 语法检查 + document/PDF pipeline 测试

## 5. 本地启动流程

1. 执行 `pnpm install`
2. 执行 `docker compose -f infra/docker-compose.yml up -d`
3. 等待 Postgres / Redis / MinIO healthcheck 变绿
4. 执行三端 `smoke:boot`
5. 执行 `pnpm lint && pnpm typecheck && pnpm test`

## 6. 数据迁移

数据库变更必须遵守：

- 只通过 migration 变更 schema
- 不手改线上表结构
- 新增 migration 后先在本地验证

当前迁移入口：

- `pnpm --filter @medical/api db:migrate`

## 7. 备份与恢复

V1 至少需要覆盖以下资产：

- Postgres
- MinIO 对象存储
- 模板与知识治理数据
- 审计日志

建议：

- Postgres 做定时逻辑备份
- 对象存储做 bucket 级别备份
- 迁移脚本与版本记录纳入 Git

## 8. 升级与回滚

升级顺序建议：

1. 备份数据库和对象存储
2. 拉取代码
3. 更新依赖
4. 执行 migration
5. 执行 smoke checklist
6. 再执行全仓校验

回滚原则：

- 代码回滚与 schema 状态必须一起考虑
- 未验证 migration 可逆性前，不直接在生产降版本
- 模板发布和知识治理要保留历史版本

## 9. 平台迁移

迁移到其他平台时，必须同时迁移：

- Postgres 数据
- 对象存储 bucket 与对象键
- 应用环境变量
- Git 仓库
- 运维文档

原则：

- 代码与配置分离
- 数据与对象存储独立迁移
- 迁移后先跑 smoke checklist，再开放使用

## 10. 远程维护

远程维护约定：

- Git 仓库是唯一代码真源
- 通过 SSH / VPN / 堡垒机访问远程环境
- 不在生产机上直接开发
- 变更必须先入仓库，再验证，再发布

Codex 的定位：

- 读代码
- 写代码
- Review
- 验证
- 文档维护

Codex 不是运行时依赖。
