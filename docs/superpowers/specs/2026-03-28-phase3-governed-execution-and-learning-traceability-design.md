# Phase 3 Governed Execution And Learning Traceability Design

**Date:** 2026-03-28  
**Status:** Approved for implementation  
**Scope:** Phase 3 后端治理闭环优先，在保留现有三大业务模块主体的前提下，建立统一执行治理、命中追踪、人工反馈和学习来源闭环。

## 1. 目标

Phase 3 的目标不是继续堆新的业务模块，而是把已经存在的 `screening`、`editing`、`proofreading`、`knowledge`、`templates`、`prompt-skill-registry` 真正连成一个可治理、可追溯、可演进的执行闭环。

本阶段完成后，系统应能稳定回答以下问题：

- 某次审稿、编加或校对到底用了哪个模板版本、Prompt 版本、SkillPackage 版本和模型版本。
- 某条知识为什么会在本次执行中被命中。
- 某次人工确认、人工驳回或人工修改如何沉淀为后续学习候选。
- 当前哪些治理资产虽然已经单独批准，但还没有进入真实业务执行链路。

## 2. 非目标

Phase 3 明确不做以下内容：

- 不做自动学习结果写回生产。
- 不做大型后台页面或复杂可视化看板。
- 不做微信小程序扩展。
- 不重构掉现有 `screening`、`editing`、`proofreading` 服务主体。
- 不改变 `gstack`、`superpowers`、`subagent` 的固定分工。

## 3. 设计原则

### 3.1 增量治理闭环

采用“选 1，但借一点 2 的优点”的方式推进：

- 保留现有三大模块服务。
- 新增统一治理入口 `GovernedModuleContextResolver`。
- 所有模块执行前先解析统一治理上下文，执行后统一写追踪记录。

### 3.2 业务执行只认发布后的执行画像

知识、模板、Prompt、SkillPackage 可以分别审批或发布，但真实业务执行只认 `ModuleExecutionProfile`。

这意味着：

- 散落的已批准对象不直接进入执行链路。
- 只有一条已发布的执行画像，才能决定某模块某稿件类型当前真实生效的组合。

### 3.3 学习只能受治理地进入候选层

系统允许“越来越聪明”，但只允许以受治理的候选流转体现：

`执行快照 -> 人工反馈 -> 学习候选 -> 审核 -> 后续版本更新`

不允许：

- 自动写回生产模板
- 自动写回生产 Prompt
- 自动写回生产 SkillPackage
- 自动绕过审核改变业务执行画像

## 4. 核心领域对象

### 4.1 保留不动的核心对象

- `TemplateFamily`
- `ModuleTemplate`
- `KnowledgeItem`
- `PromptTemplate`
- `SkillPackage`
- `DocumentAsset`
- `screening / editing / proofreading` 现有服务

### 4.2 新增治理对象

#### `ModuleExecutionProfile`

表示某个模块、某个稿件类型、某个模板族在当前时刻的正式执行画像。

建议字段：

- `id`
- `module`
- `manuscript_type`
- `template_family_id`
- `module_template_id`
- `prompt_template_id`
- `skill_package_ids`
- `knowledge_binding_mode`
- `status`
- `version`
- `notes`

建议状态：

- `draft`
- `active`
- `archived`

#### `KnowledgeBindingRule`

表示某条知识如何被拉入执行上下文。

建议支持的绑定维度：

- 按模块绑定
- 按稿件类型绑定
- 按模板绑定
- 按章节绑定
- 按风险标签绑定

建议字段：

- `id`
- `knowledge_item_id`
- `module`
- `manuscript_types`
- `template_family_ids`
- `module_template_ids`
- `sections`
- `risk_tags`
- `priority`
- `binding_purpose`
- `status`

#### `ModuleExecutionSnapshot`

表示某次真实模块执行被冻结的治理上下文。

建议字段：

- `id`
- `manuscript_id`
- `module`
- `job_id`
- `execution_profile_id`
- `module_template_id`
- `prompt_template_id`
- `skill_package_ids`
- `model_id`
- `knowledge_item_ids`
- `created_asset_ids`
- `created_at`

#### `KnowledgeHitLog`

表示某次执行中某条知识为什么命中。

建议字段：

- `id`
- `snapshot_id`
- `knowledge_item_id`
- `binding_rule_id`
- `match_source`
- `match_reasons`
- `score`
- `section`
- `created_at`

#### `HumanFeedbackRecord`

表示人工确认、人工修改或人工驳回的治理反馈。

建议字段：

- `id`
- `manuscript_id`
- `module`
- `snapshot_id`
- `feedback_type`
- `feedback_text`
- `created_by`
- `created_at`

#### `LearningCandidateSourceLink`

表示学习候选与来源证据之间的强关联。

建议字段：

- `id`
- `learning_candidate_id`
- `snapshot_id`
- `feedback_record_id`
- `source_asset_id`
- `created_at`

## 5. 执行治理链路

### 5.1 统一执行入口

新增 `GovernedModuleContextResolver`，让 `screening`、`editing`、`proofreading` 都通过它获取上下文。

输入：

- `manuscript_id`
- `module`
- `actor_role`
- `job_id`

输出：

- 当前生效的 `ModuleExecutionProfile`
- 冻结的 `ModuleTemplate`
- 冻结的 `PromptTemplate`
- 冻结的 `SkillPackage` 列表
- 命中的知识集合
- 知识命中原因
- 当前模型选择结果

### 5.2 运行步骤

建议统一步骤：

1. 模块服务读取稿件主档与当前模板族。
2. `GovernedModuleContextResolver` 解析当前 `active` 的执行画像。
3. 解析执行画像引用的模板、Prompt、SkillPackage、知识绑定规则。
4. 结合稿件类型、章节、风险标签筛选知识集合。
5. 通过 AI Gateway 解析模型选择。
6. 返回冻结后的执行上下文给模块服务。
7. 模块服务按该上下文执行，并生成业务资产。
8. 执行完成后写入 `ModuleExecutionSnapshot` 和 `KnowledgeHitLog`。

### 5.3 无画像即不执行

Phase 3 起，三大业务模块不再允许回退到“临时拼模板 + 临时筛知识”的散装模式。

- 若当前 `module + manuscript_type + template_family_id` 找不到 `active` 的 `ModuleExecutionProfile`，则本次执行必须失败。
- 失败原因应明确暴露为“尚未发布执行画像”，便于后台治理人员补齐发布动作。
- 该约束用于确保所有真实执行都可追溯、可冻结、可复盘。

### 5.4 校对的特殊约束

校对继续遵守此前已确认的业务规则：

- 先输出草稿。
- 人工确认后再输出最终稿。
- 最终稿必须沿用草稿阶段冻结的执行快照，不允许因为中途发布了新模板、新 Prompt、新 Skill 或新知识绑定而被污染。
- 建议最终稿记录 `draft_snapshot_id` 或等价关联字段，确保后续能从终稿直接追溯到草稿阶段的治理上下文。

## 6. 发布治理

### 6.1 发布边界

真实业务执行只认 `ModuleExecutionProfile`，不直接认散对象。

### 6.2 发布规则

- 只有 `admin` 可以发布执行画像。
- 同一 `module + manuscript_type + template_family_id` 同时只能存在一个 `active` 画像。
- 发布前必须校验：
  - `ModuleTemplate` 已 `published`
  - `PromptTemplate` 已 `published`
  - `SkillPackage` 已 `published`
  - 被绑定知识必须为 `approved`
  - 所有引用对象的模块与稿件类型兼容
- 已发布画像不能原地修改，只能新建版本再发布。
- 新版本生效时，旧版本自动 `archived`。

## 7. 学习与反馈治理

### 7.1 学习来源

学习候选的来源限定为：

- `ModuleExecutionSnapshot`
- `HumanFeedbackRecord`
- 人工确认后的最终资产或批注资产

### 7.2 学习候选类型

Phase 3 建议正式支持：

- `rule_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`
- `checklist_update_candidate`

`skill_update_candidate` 只预留接口，不在 Phase 3 自动生成。

### 7.3 生成约束

学习候选必须满足：

- 能追溯到执行快照
- 能追溯到人工反馈
- 能追溯到最终人工确认资产
- 具有模块、稿件类型、模板版本、Prompt 版本、SkillPackage 版本上下文

### 7.4 审核约束

- 学习候选仍由 `knowledge_reviewer` 审核。
- 审核通过后，进入后续治理输入，而不是直接写回生产。

## 8. 模块边界与职责

### 8.1 `execution-governance`

负责：

- `ModuleExecutionProfile`
- `KnowledgeBindingRule`
- 发布、归档、版本切换

### 8.2 `execution-tracking`

负责：

- `ModuleExecutionSnapshot`
- `KnowledgeHitLog`

### 8.3 `feedback-governance`

负责：

- `HumanFeedbackRecord`
- `LearningCandidateSourceLink`

### 8.4 `shared/governed-module-context-resolver`

负责：

- 统一解析模块执行上下文
- 冻结治理输入
- 返回模块可直接消费的治理结果

### 8.5 现有模块服务

`screening`、`editing`、`proofreading` 继续只负责：

- 权限校验
- 作业创建
- 资产创建
- 模块输出规则

不再各自散落维护模板、知识、Prompt、Skill 的拼装逻辑。

## 9. 测试策略

### 9.1 治理规则测试

验证：

- 只有 `admin` 能发布 `ModuleExecutionProfile`
- 发布时引用对象必须已发布或已批准
- 旧版本会在新版本生效时自动失效

### 9.2 解析器测试

验证 `GovernedModuleContextResolver` 能稳定返回：

- 模板版本
- Prompt 版本
- SkillPackage 版本
- 命中的知识集合
- 命中原因
- 模型选择

### 9.3 模块集成测试

验证：

- 三大模块都通过统一治理解析入口执行
- 执行后会写快照和命中日志
- 校对最终稿沿用草稿阶段冻结的治理上下文

### 9.4 学习来源测试

验证：

- 人工反馈可挂到执行快照
- 学习候选必须有来源链
- 来源不完整时不能生成正式学习候选

## 10. 与固定分工的关系

### `superpowers`

负责：

- 规格边界
- 实施计划
- 验收口径
- 阶段推进决策

### `gstack`

负责：

- 验证
- 回归
- 上线前检查
- 质量与流程 QA

### `subagent`

负责：

- 在已批准计划下执行明确子任务
- 不改变需求边界
- 不改变验收标准

### 系统内暴露边界

- `Prompt / Skill / Agent Runtime / Tool Gateway / Execution Governance` 都属于后台治理层。
- 三大业务模块只消费治理层已发布结果。
- 业务角色不直接操作治理层底座对象。

## 11. Phase 3 验收标准

Phase 3 完成后，应满足：

- 三大业务模块已通过统一治理入口获取执行上下文。
- 执行快照、知识命中日志、人工反馈、学习来源关联具备完整链路。
- 发布后的执行画像成为唯一正式生效的治理入口。
- 校对草稿与最终稿能共享冻结的治理上下文。
- 学习候选具备可追溯来源，但不会自动写回生产。
- 现有固定分工和模块主体保持稳定，没有出现大规模返工式重构。
