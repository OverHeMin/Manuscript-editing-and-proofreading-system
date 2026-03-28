# 运维与交付基线

## 1. 适用范围

本文档覆盖 V1 基础仓库在本地开发、Phase 2 文档主链路、可选 ONLYOFFICE 预览能力，以及后续迁移、升级、回滚、远程维护的操作约定。

当前阶段说明：

- API、Web、Worker 已具备可验证的基础 smoke boot 能力。
- 文档主链路已经包含上传、规范化、结构解析、只读预览、评论读取、权威资产导出。
- ONLYOFFICE 在 Phase 2 仍然是评估性质的只读预览层，不是权威稿件写回通道。
- `gstack`、`superpowers`、`subagent` 属于后台管理员/维护者能力，不对业务角色直接开放。

## 2. 本地依赖服务

`infra/docker-compose.yml` 当前提供：

- `postgres`
- `redis`
- `minio`
- `onlyoffice`：可选 profile，默认不启动，用于 Phase 2 预览评估

默认端口：

- Postgres: `15432`
- Redis: `56379`
- MinIO API: `59000`
- MinIO Console: `59001`
- ONLYOFFICE: `58080`

启动建议：

- 基础开发：`docker compose -f infra/docker-compose.yml up -d`
- 需要验证预览：`docker compose -f infra/docker-compose.yml --profile onlyoffice up -d`

## 3. 环境变量

建议每个应用目录独立维护自己的 `.env`：

- `apps/api/.env`
- `apps/web/.env`
- `apps/worker-py/.env`

如果没有正式 `.env`，`smoke:boot` 会自动回退到 `.env.example`。

Phase 2 新增环境面：

- API
  - `ONLYOFFICE_URL`
  - `ONLYOFFICE_JWT_SECRET`
  - `ONLYOFFICE_MODE`
  - `LIBREOFFICE_BINARY`
- Web
  - `VITE_ONLYOFFICE_PUBLIC_URL`
- Worker
  - `LIBREOFFICE_BINARY`

约定：

- 本地环境允许 `ONLYOFFICE_*` 仅用于 URL 和占位密钥校验，不要求真实联通。
- `LIBREOFFICE_BINARY` 当前只做配置占位，不要求 smoke 阶段一定已安装 LibreOffice。
- 生产环境必须替换 `ONLYOFFICE_JWT_SECRET`，不得使用示例值。

## 4. Smoke Checklist

### 4.1 基础依赖

- `docker compose -f infra/docker-compose.yml exec postgres pg_isready -U postgres -d medical_api`
- `docker compose -f infra/docker-compose.yml exec redis redis-cli ping`
- `curl http://127.0.0.1:59000/minio/health/ready`

### 4.2 Phase 2 预览可选检查

- `docker compose -f infra/docker-compose.yml --profile onlyoffice ps`
- `curl http://127.0.0.1:58080/`

说明：

- ONLYOFFICE 没有启动时，基础 smoke 不应失败。
- 只有在联调预览会话时，才要求运行 ONLYOFFICE profile。

### 4.3 应用基线

- `pnpm --filter @medical/api run smoke:boot`
- `pnpm --filter @medsys/web run smoke:boot`
- `pnpm --filter @medical/worker-py run smoke:boot`

### 4.4 全仓校验

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## 5. 本地启动流程

1. 执行 `pnpm install`
2. 执行 `docker compose -f infra/docker-compose.yml up -d`
3. 如需文档预览联调，再执行 `docker compose -f infra/docker-compose.yml --profile onlyoffice up -d`
4. 等待 Postgres、Redis、MinIO 健康检查通过
5. 运行三端 `smoke:boot`
6. 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`

## 6. Phase 2 运行边界

文档主链路的权威边界如下：

- 原始稿件和衍生稿件都必须保存为 `DocumentAsset`
- 规范化产生 `normalized_docx`
- 结构解析基于规范化资产或其结构化快照
- ONLYOFFICE 只负责只读预览和评论读取
- 最终下载必须从权威 `DocumentAsset` 导出，不能把预览会话 URL 当成正式资产

人工与 AI 的职责边界如下：

- 审稿 AI、编加 AI 可以直接输出最终权威资产
- 校对 AI 先输出草稿，人工确认后再生成最终稿
- 管理员通过模板、知识库、技能包、提示词模板持续优化系统能力

## 7. 迁移、备份与回滚

V1 至少要覆盖以下资产：

- Postgres 数据库
- MinIO 对象存储
- 模板治理数据
- 知识库与学习沉淀
- 审计日志
- 管理员配置项
  - 模型注册表
  - Agent Runtime Registry
  - Tool Gateway Registry
  - Prompt / Skill Registry

回滚原则：

- 代码版本、数据库 schema、对象存储版本要一起考虑
- 迁移前先备份数据库和对象存储
- 模板、知识、技能包、提示词模板必须保留版本历史
- 生产回滚前先重新跑 smoke checklist

## 8. 平台迁移

迁移到其他服务器或平台时，必须同时迁移：

- Git 仓库
- `.env` / 密钥管理配置
- Postgres 数据
- MinIO bucket 与对象键
- 运维文档
- Docker / 部署脚本

推荐顺序：

1. 备份数据库与对象存储
2. 恢复基础依赖
3. 恢复 `.env`
4. 部署代码
5. 跑 smoke checklist
6. 再开放业务使用

## 9. 远程维护

远程维护约定：

- Git 仓库是唯一代码真源
- 远程机器通过 SSH / VPN / 堡垒机接入
- 不在生产机上直接开发主分支
- 维护工作优先在独立分支或 worktree 中完成

Codex 的推荐使用方式：

- 通过 Git 拉取代码到维护机
- 在隔离分支中开发、测试、提交
- 让 Codex 执行阅读、修改、测试、Review、文档同步
- 验证通过后再合并或部署

说明：

- Codex 是开发维护助手，不是生产运行时依赖
- `gstack`、`superpowers`、`subagent` 是后台维护能力，不随业务系统对外暴露

## 10. 后续增强建议

Phase 3 及以后建议继续补强：

- ONLYOFFICE 联调与会话鉴权
- LibreOffice 实机可用性探测
- 文档导出真实下载签名链路
- 审计面板与运维告警
- 部署脚本标准化
- 微信小程序与知识审核后台的联动运维说明

## 11. 代码质量与 Review 约束

除运维流程外，日常开发与维护还应遵循代码质量基线：

- 复杂业务规则优先通过命名、结构和高价值注释表达清楚
- 关键流程改动必须补充相应测试或验证证据
- Review 时重点检查业务边界、权限边界、知识调用边界和草稿/终稿边界
- 完成前必须执行与改动范围匹配的验证，不凭经验直接判定完成

详细规则见 `docs/CODE_QUALITY.md`，执行清单见 `docs/REVIEW_CHECKLIST.md`。
