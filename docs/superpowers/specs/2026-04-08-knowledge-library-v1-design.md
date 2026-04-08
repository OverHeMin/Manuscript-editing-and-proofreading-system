# Knowledge Library V1 Design

**Date**

2026-04-08

**Goal**

为医学稿件处理系统 V1 设计一套可落地的知识库重构方案，把当前“知识审核台独立、知识录入挂靠模板治理页”的状态，升级为真正的一级 `knowledge-library` 模块，并为后续 `V2` 的版本治理、重复检测、批量导入和运营分析预留稳定骨架。

## Final Design Decisions

本次确认后的核心决策如下：

- 知识库按“终局架构一次定清、实现分 `V1 / V2` 两阶段落地”的方式推进。
- `knowledge-library` 升级为一级 workbench，不再挂在 `template-governance` 下面。
- `knowledge-review` 继续保持独立 workbench，只负责审核队列、审核动作与审核历史。
- `template-governance` 只保留模板家族、模块模板、规则库和期刊小模板治理，不再承担知识录入端。
- `V1` 的录入/编辑权限先给：
  - `admin`
  - `knowledge_reviewer`
- `V1` 的底层模型从第一天就采用：
  - `knowledge_asset`
  - `knowledge_revision`
  - `knowledge_revision_binding`
  - `knowledge_review_action`
- 已批准知识不得原地覆盖；任何修订都必须从当前批准版本派生新的 `draft revision`。
- 运行时检索只使用：
  - `approved`
  - 当前生效 revision
  - 未过期 revision
- 当前平铺的 `KnowledgeRecord` 在 `V1` 过渡期保留兼容投影视图，但不再作为长期真源。

## Context

当前系统已经具备知识草稿创建、提审、审核、归档的基础能力，也具备独立的知识审核台，但模块边界已经出现明显漂移。

已确认的现状包括：

- Web 导航中存在 `knowledge-review`，但不存在独立的 `knowledge-library` workbench。
- 知识草稿录入和编辑被嵌入 `template-governance` 页面内部，而不是以独立知识库工作台呈现。
- 当前后端知识模型仍然以单条 `KnowledgeRecord` 为中心。
- 共享 contract 中保留了 `effective_at` / `expires_at`，但后端实际知识记录中没有完整落地这套时效治理。
- 当前绑定关系主要依赖 `template_bindings: string[]`，并在前端以字符串约定方式解释，不够稳定。
- 当前审核对象还是“知识条目”本身，没有显式 revision 维度。

这意味着：

- 录入端能力不是完全没有，而是产品形态缺失。
- 审核端和录入端角色链路不顺。尤其是驳回后，知识审核员可以退回草稿，但没有清晰的一线修订工作台。
- 如果继续沿用平铺知识模型，后续一做版本治理、结构化绑定和历史对比，就会产生高概率返工。

## Problem Statement

当前知识库模块存在 5 个核心问题：

1. 模块边界错误
   知识库本应是独立业务模块，但现在更像模板治理页的一个子面板。

2. 作者端与审核端拆分不完整
   独立暴露的是审核台，而不是完整知识库；录入、修订、绑定、搜索没有形成自己的一级入口。

3. 数据模型过平
   现在以单条知识记录为中心，不适合表达“批准后只能派生修订版”的版本治理要求。

4. 绑定关系不够结构化
   当前主要靠字符串绑定模板关系，难以支撑模板族、模块模板、章节、期刊模板等多维绑定。

5. 迁移风险正在累积
   如果 `V1` 只补一个 UI 壳层，而不纠正底层模型，`V2` 在做版本对比、替代/废弃治理时仍然要推倒重来。

## Scope

本设计覆盖：

- `knowledge-library` 一级 workbench 的信息架构
- `V1` 的权限边界
- `knowledge_asset / revision / binding / review action` 的领域模型
- `V1` 的 API 分组与路由边界
- 兼容当前 `knowledge-review` 与 runtime retrieval 的过渡方案
- 从旧平铺知识模型迁移到 revision 模型的策略
- `V1 / V2` 的边界划分

本设计不覆盖：

- `V2` 的批量导入界面与自动抓取流程细节
- 重复知识检测算法细节
- 检索召回/重排算法升级细节
- 具体数据库 migration SQL
- 具体前端组件拆分和实现代码

## Target Product Shape

### 1. 一级工作台结构

`knowledge-library` 在产品上是独立业务模块，面向“知识资产的录入、修订、绑定、搜索与治理”。

工作台职责如下：

- `knowledge-library`
  - 知识列表
  - 搜索与筛选
  - 草稿创建
  - 草稿编辑
  - 模板/模块/章节绑定
  - 版本历史查看
  - 发起提审
- `knowledge-review`
  - 审核队列
  - 审核详情
  - 审核备注
  - 审核历史
  - 通过 / 驳回动作
- `template-governance`
  - 模板家族治理
  - 模块模板治理
  - 规则库治理
  - 期刊小模板治理
  - 对知识库仅保留引用或跳转，不再承担知识录入

### 2. 作者端与审核端的关系

`knowledge-library` 与 `knowledge-review` 不是重复关系，而是：

- `knowledge-library` 是作者端
- `knowledge-review` 是审核端

标准流转为：

1. 在 `knowledge-library` 创建 asset 与 draft revision
2. 在 `knowledge-library` 完成字段编辑与绑定
3. 发起提审
4. 在 `knowledge-review` 审核该 revision
5. 通过后该 revision 成为当前批准版本
6. 如需修改，从批准版本派生新 draft revision，再次提审

## Workbench Information Architecture

`V1` 在单一 `knowledge-library` workbench 中提供 4 类核心视图，不强制拆成多个 URL 页面壳，但信息架构必须清晰。

### 1. 列表视图

用于管理知识资产总表，必须支持：

- 服务端分页
- 关键字搜索
- 状态筛选
  - `draft`
  - `pending_review`
  - `approved`
  - `archived`
- 知识类型筛选
  - `rule`
  - `case_pattern`
  - `checklist`
  - `prompt_snippet`
  - `reference`
  - `other`
- 模块筛选
- 模板绑定筛选
- 最近更新时间排序
- 当前批准 revision 摘要展示

### 2. 编辑视图

用于创建和编辑 `draft revision`，至少包含：

- 基础字段
  - `title`
  - `canonical_text`
  - `summary`
- 分类字段
  - `knowledge_kind`
- 路由字段
  - `module_scope`
  - `manuscript_types`
  - `sections`
  - `risk_tags`
  - `discipline_tags`
- 来源字段
  - `source_type`
  - `source_link`
  - `evidence_level`
- 时效字段
  - `effective_at`
  - `expires_at`
- 术语字段
  - `aliases`

### 3. 绑定视图

用于结构化维护 revision 绑定关系，不再依赖自由字符串：

- 绑定模板族
- 绑定模块模板
- 绑定章节
- 预留期刊模板绑定能力

`V1` 中期刊模板绑定可以先保留为简单选择器或隐藏入口，但模型必须支持。

### 4. 历史视图

用于查看当前知识资产的治理轨迹：

- 当前 asset 下的所有 revisions
- 每个 revision 的状态
- 当前 approved revision 标识
- 审核动作历史
- 备注与时间线

## Domain Model

`V1` 的核心设计不是“多一个页面”，而是把知识条目从单记录模型升级为“资产 + 修订”的治理模型。

### 1. Knowledge Asset

`knowledge_asset` 代表知识条目的稳定身份。

建议字段：

- `id`
- `status`
  - `active`
  - `archived`
- `current_approved_revision_id`
- `created_at`
- `updated_at`

职责：

- 提供稳定 ID
- 标识当前正在生效的批准版本
- 承担资产级归档

### 2. Knowledge Revision

`knowledge_revision` 代表某一时刻的具体内容版本。

建议字段：

- `id`
- `asset_id`
- `revision_no`
- `status`
  - `draft`
  - `pending_review`
  - `approved`
  - `superseded`
  - `archived`
- `title`
- `canonical_text`
- `summary`
- `knowledge_kind`
- `module_scope`
- `manuscript_types`
- `sections`
- `risk_tags`
- `discipline_tags`
- `evidence_level`
- `source_type`
- `source_link`
- `effective_at`
- `expires_at`
- `aliases`
- `source_learning_candidate_id`
- `created_at`
- `updated_at`

职责：

- 承载所有可编辑知识内容
- 成为审核对象
- 成为运行时检索的直接内容源

### 3. Knowledge Revision Binding

`knowledge_revision_binding` 表达结构化绑定关系。

建议字段：

- `id`
- `revision_id`
- `binding_kind`
  - `template_family`
  - `module_template`
  - `section`
  - `journal_template`
- `binding_target_id`
- `binding_target_label`
- `created_at`

职责：

- 替代当前松散的 `template_bindings: string[]`
- 允许运行时按模板族、模块模板、章节、期刊模板检索绑定知识包

### 4. Knowledge Review Action

`knowledge_review_action` 保留审核轨迹。

建议字段：

- `id`
- `revision_id`
- `action`
  - `submitted_for_review`
  - `approved`
  - `rejected`
  - `archived`
- `actor_role`
- `review_note`
- `created_at`

职责：

- 记录审核与治理动作
- 为审核台和历史视图提供时间线

## Lifecycle Design

`V1` 必须从第一天就支持“批准后只能派生新修订”，不能继续允许原地修改批准知识。

标准生命周期如下：

1. 新建知识
   - 创建 `knowledge_asset`
   - 创建 `revision-1`
   - `revision-1.status = draft`

2. 提审
   - `revision-1.status = pending_review`
   - 写入 `submitted_for_review` action

3. 审核通过
   - `revision-1.status = approved`
   - `asset.current_approved_revision_id = revision-1`
   - 写入 `approved` action

4. 审核驳回
   - `revision-1.status = draft`
   - 写入 `rejected` action
   - revision 保持可继续修订，不额外生成第二条草稿记录

5. 后续修订
   - 从当前 approved revision 派生 `revision-2`
   - `revision-2.status = draft`
   - `revision-1` 保留为历史版本，不允许直接编辑

6. 再次通过
   - `revision-2.status = approved`
   - `asset.current_approved_revision_id = revision-2`
   - `revision-1.status = superseded`

这里的关键原则是：

- 驳回中的“历史”由 `knowledge_review_action` 记录
- 批准中的“版本历史”由 `knowledge_revision` 记录
- 只有“已批准后再次修改”才必须派生新 revision

`V1` 可以不立刻做复杂版本对比 UI，但生命周期语义必须先定对。

## Permissions

`V1` 先按最顺畅的业务链路设计权限。

### 1. Admin

允许：

- 新建 asset
- 编辑 draft revision
- 派生新 revision
- 维护 binding
- 提交审核
- 审核通过 / 驳回
- 归档 asset

### 2. Knowledge Reviewer

允许：

- 新建 asset
- 编辑 draft revision
- 派生新 revision
- 维护 binding
- 提交审核
- 审核通过 / 驳回

这样可以保证“驳回后直接修订”的链路顺滑，不需要在角色之间来回切换。

### 3. Editor / Proofreader

`V1` 暂不直接编辑正式知识库。

进入知识库的方式为：

- 通过学习回写进入草稿池
- 通过后续提案机制进入草稿池

### 4. Runtime

运行时是只读消费者，只能读取：

- 当前 approved revision
- 当前时间已生效
- 当前时间未过期

## Route And Workbench Design

### 1. Workbench IDs

新增：

- `knowledge-library`

保留：

- `knowledge-review`
- `learning-review`
- `template-governance`

### 2. Hash 路由建议

建议使用当前 workbench hash 体系延伸：

- `#knowledge-library`
- `#knowledge-library?assetId=...`
- `#knowledge-library?assetId=...&revisionId=...`
- `#knowledge-review?revisionId=...`

这样可以：

- 保持与现有 workbench routing 风格一致
- 保留作者端到审核端的 handoff 能力
- 避免未来二次改造路由模型

## API Design

`V1` 不建议继续围绕“知识条目 = 单记录”建接口，而应围绕 asset / revision 工作。

### 1. Asset 与列表接口

- `GET /api/v1/knowledge/assets`
  - 支持分页、搜索、状态、类型、模块、绑定筛选
- `GET /api/v1/knowledge/assets/:assetId`
  - 返回资产摘要、当前 approved revision、最近 draft revision、历史摘要

### 2. Revision 接口

- `POST /api/v1/knowledge/assets`
  - 创建 asset + 初始 draft revision
- `POST /api/v1/knowledge/assets/:assetId/revisions`
  - 从当前 approved revision 或指定 revision 派生新 draft revision
- `POST /api/v1/knowledge/revisions/:revisionId/draft`
  - 更新 draft revision 内容
- `POST /api/v1/knowledge/revisions/:revisionId/submit`
  - 提交 revision 进入审核队列

### 3. Binding 接口

- `GET /api/v1/knowledge/revisions/:revisionId/bindings`
- `POST /api/v1/knowledge/revisions/:revisionId/bindings`

### 4. Review 接口

- `GET /api/v1/knowledge/review-queue`
- `GET /api/v1/knowledge/revisions/:revisionId/review-actions`
- `POST /api/v1/knowledge/revisions/:revisionId/approve`
- `POST /api/v1/knowledge/revisions/:revisionId/reject`

## Compatibility Strategy

`V1` 不能在第一步就粗暴删除旧知识接口，否则会同时影响：

- `knowledge-review`
- runtime retrieval
- learning writeback
- 现有 typed clients

因此需要兼容层。

### 1. 兼容视图原则

旧的平铺 `KnowledgeRecord` 暂时变成“投影视图”，不再作为长期真源。

兼容视图可映射为：

- 资产 ID
- 当前工作 revision 或当前 approved revision
- 绑定信息的简化投影

### 2. 读路径过渡

分阶段切换：

1. 新的 `knowledge-library` 先全部读新模型
2. `knowledge-review` 改为按 revision 维度工作
3. runtime retrieval 读取 approved revision
4. 最后再收缩旧平铺接口

### 3. 检索兼容要求

运行时 retrieval 在 `V1` 必须满足：

- 只命中 approved revision
- 过滤未生效 revision
- 过滤已过期 revision
- 保留现有 routing 语义

## Migration Strategy

建议把迁移分成 3 个阶段。

### Phase 1. 新表落地

新增表：

- `knowledge_assets`
- `knowledge_revisions`
- `knowledge_revision_bindings`
- `knowledge_review_actions`

若现有审核动作表可复用，可选择扩展并迁移到 revision 维度。

### Phase 2. 历史数据回填

把当前平铺知识记录映射为：

- 每条旧知识记录生成一个 `asset`
- 每个 `asset` 生成一个初始 `revision-1`
- 原 `template_bindings` 拆解为 `binding records`
- 原审核历史尽可能回填到 `knowledge_review_actions`

### Phase 3. 读路径切换

切换顺序：

1. 新 `knowledge-library` 工作台读新表
2. `knowledge-review` 审核台切到 revision 维度
3. runtime retrieval 切到 approved revision
4. 旧平铺知识接口降级为兼容层

这样可以尽量避免一次性大爆炸式切换。

## V1 / V2 Boundary

### V1 必做

- 独立 `knowledge-library` workbench
- 列表 / 搜索 / 分页 / 筛选
- 草稿创建与编辑
- 结构化 binding
- revision 生命周期
- 提审 / 审核 / 驳回 / 历史
- runtime 只读 approved + 生效 revision
- 学习回写进入统一知识草稿池

### V2 再做

- 版本对比 UI
- 替代 / 废弃治理
- 重复知识检测
- 批量导入
- 自动抓取入审核区
- 覆盖率与运营分析视图
- 编辑 / 校对提案入口

## Acceptance Criteria

`V1` 完成后，系统必须满足：

- 存在独立 `knowledge-library` 一级入口
- `template-governance` 不再承载知识录入表单
- 知识资产可以创建，并以 revision 方式编辑
- 已批准知识不能原地修改，只能派生新 draft revision
- 审核台审核对象是 revision，而不是旧平铺知识条目
- binding 采用结构化记录，不再依赖字符串拼接语义
- runtime retrieval 只使用 approved 且生效中的 revision
- 学习回写生成的知识草稿统一进入知识草稿池
- 列表查询具备服务端分页与筛选
- 现有知识审核流程和 manuscript 主链在迁移后仍可正常运行

## Risks And Guardrails

- 不要只做 UI 拆分而继续保留平铺知识模型，否则 `V2` 必然返工。
- 不要让 `template-governance` 再继续承担知识录入责任，否则模块边界会继续漂移。
- 不要让 runtime 直接消费 draft 或 pending_review revision。
- 不要继续用 `template_bindings: string[]` 作为长期绑定真源。

## Planning Readiness

本设计已将以下关键问题定清：

- 模块边界
- 权限边界
- 生命周期边界
- API 边界
- 迁移边界
- `V1 / V2` 边界

因此下一步可以直接进入 implementation plan 编写，不需要再次重做产品层设计。
