# 2026-04-23 Internal Team Account Role Convergence Design

## Goal

在不重做认证体系、不引入新角色键和不扩大实现范围的前提下，把当前内部团队账号收敛成 3 类可长期使用的固定账号，并让不同账号的页面入口和操作权限明确不同。

## Scope

本次只覆盖内部团队账号：

- `admin`
- `editor`
- `knowledge_reviewer`

本次不覆盖：

- 外部投稿用户账号体系
- MFA、找回密码、SSO、LDAP
- 多租户、科室隔离、组织架构
- 自定义权限编辑器

## Decision

选择最小改动方案，直接复用现有角色键：

- `admin` 继续表示“系统管理员”
- `editor` 改为内部展示名“稿件处理员”
- `knowledge_reviewer` 改为内部展示名“知识治理员”

停止为内部团队新发以下角色：

- `screener`
- `proofreader`
- `user`

`screener` 和 `proofreader` 只作为兼容历史数据的过渡角色保留，后续迁移到 `editor`。

## Role Model

### 1. 系统管理员 `admin`

权限范围：

- 全部工作台
- 全部账号管理动作
- AI 接入与模型配置
- Knowledge / Rule / Harness / Governance 全部入口

### 2. 稿件处理员 `editor`

权限范围：

- `screening`
- `editing`
- `proofreading`

不允许：

- `system-settings`
- `admin-console`
- `evaluation-workbench`
- `harness-datasets`
- `knowledge-library`
- `knowledge-review`
- `template-governance`

### 3. 知识治理员 `knowledge_reviewer`

权限范围：

- 稿件处理员全部能力
- `knowledge-library`
- `knowledge-review`
- `template-governance`

不允许：

- `system-settings`
- `admin-console`
- `evaluation-workbench`
- `harness-datasets`

## Workbench Exposure

建议工作台可见性收敛为：

| Workbench | admin | editor | knowledge_reviewer |
| --- | --- | --- | --- |
| submission | 否 | 否 | 否 |
| screening | 是 | 是 | 是 |
| editing | 是 | 是 | 是 |
| proofreading | 是 | 是 | 是 |
| knowledge-library | 是 | 否 | 是 |
| knowledge-review | 是 | 否 | 是 |
| template-governance | 是 | 否 | 是 |
| admin-console | 是 | 否 | 否 |
| system-settings | 是 | 否 | 否 |
| evaluation-workbench | 是 | 否 | 否 |
| harness-datasets | 是 | 否 | 否 |

默认首页建议保持最小改动：

- `admin` -> `screening`
- `editor` -> `screening`
- `knowledge_reviewer` -> `knowledge-library`

## Permission Mapping

在现有权限常量基础上按最小改动收敛：

- `admin`
  - 保留全部权限
- `editor`
  - `workbench.screening`
  - `workbench.editing`
  - `workbench.proofreading`
- `knowledge_reviewer`
  - `workbench.screening`
  - `workbench.editing`
  - `workbench.proofreading`
  - `knowledge.review`
  - `learning.review`
  - `template-governance.manage`

以下权限仍只给 `admin`：

- `system-settings.manage-users`
- `permissions.manage`
- Harness 相关全部管理入口
- AI provider / model / runtime / gateway / policy 等治理配置

## Account Management Rules

系统设置里的内部账号管理只允许创建和维护这 3 类账号：

- `admin`
- `editor`
- `knowledge_reviewer`

仍然保留当前账号闭环：

- 创建账号
- 修改显示名
- 修改角色
- 重置密码
- 停用 / 启用
- 重置密码后强制旧会话失效
- 停用后强制旧会话失效

安全规则保持不变：

- 最后一个启用中的管理员不能被停用
- 最后一个启用中的管理员不能被降级

## Migration Rules

内部团队历史账号迁移建议如下：

- `screener` -> `editor`
- `proofreader` -> `editor`
- `editor` -> 保持 `editor`
- `knowledge_reviewer` -> 保持 `knowledge_reviewer`
- `admin` -> 保持 `admin`

迁移目标不是保留旧岗位拆分，而是把主链路处理统一到 `editor`。

## Required Changes

要真正落地这套收敛方案，后续实现只需要改这几处：

1. 角色展示文案
   - `editor` 显示为“稿件处理员”
   - `knowledge_reviewer` 显示为“知识治理员”
2. 角色权限映射
   - 扩大 `editor` 到三段稿件主链路
   - 扩大 `knowledge_reviewer` 到稿件主链路 + 知识治理
3. 工作台可见性
   - 更新 role-to-workbench 映射
   - 更新左侧导航和默认首页逻辑
4. 后端权限守卫
   - 所有相关路由按新映射返回 `403`
5. 账号创建页
   - 内部账号下拉框只保留 3 个角色
6. 历史账号迁移
   - 把内部团队旧账号批量归并到新分工

## Acceptance Criteria

- 系统里内部团队只发 3 类账号
- `editor` 登录后能看到并处理 `screening/editing/proofreading`
- `knowledge_reviewer` 登录后拥有 `editor` 全部能力，并额外看到知识与规则治理入口
- `editor` 和 `knowledge_reviewer` 都不能看到或进入 Harness
- 只有 `admin` 能进入账号管理、AI 接入和 Harness
- 前端菜单隐藏与后端 `403` 判断一致
- 历史 `screener` / `proofreader` 账号有明确迁移方案

## Notes

该设计刻意不引入新 role key，目的是降低代码改动面、数据库迁移面和现有持久化账号兼容风险。

如果未来要做更干净的角色命名，再单独发起一次“角色键重命名和数据迁移”即可；本次不处理。
