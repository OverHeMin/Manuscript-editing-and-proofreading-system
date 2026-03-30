# Phase 6A Evaluation And Experiment Ops Design

**Date:** 2026-03-28  
**Status:** Approved for implementation  
**Scope:** Phase 6A 先交付治理优先的离线实验能力，建立样本集、实验方案、实验运行、证据包与晋升建议闭环，并与 Phase 5 学习治理安全衔接。

## 1. 目标

Phase 6A 的目标，不是再新增一条脱离治理的“AI 实验旁路”，而是在现有医学稿件系统旁边增加一个可审计、可冻结、可复核、可回滚的离线实验层。

本阶段完成后，系统应能稳定回答以下问题：

- 某次实验到底使用了哪一版模型、Runtime、Prompt、Skill、模板与样本集。
- 某个新方案相对当前生产基线到底提升了什么、退步了什么。
- 某次实验的推荐结论是否能追溯到具体样本、具体评分、具体失败原因和完整证据包。
- 某个实验结论如何安全转化为 Phase 5 的学习候选，而不是直接改写生产。

## 2. 非目标

Phase 6A 明确不做以下内容：

- 不读取正在处理中的生产稿件。
- 不对业务角色开放原始实验控制台。
- 不自动切换生产模型路由。
- 不自动发布 Prompt、Skill、模板或知识变更。
- 不做复杂可视化后台页面与大屏。
- 不做多变量实验编排。
- 不做微信小程序实验入口。

## 3. 设计原则

### 3.1 治理优先

实验层首先是治理层，而不是效率工具。实验对象必须可冻结、可审计、可复核，才能避免后期返工。

### 3.2 样本必须来源于已脱敏历史资产

第一版实验数据源严格限定为“已脱敏、已归档、已批准”的历史样本，不允许直接读取正在流转的生产稿件，也不允许绕过脱敏边界。

### 3.3 生产与实验解耦

实验只产生：

- 运行结果
- 证据包
- 晋升建议
- Phase 5 候选项

实验不直接产生：

- 生产路由切换
- 正式模板发布
- 正式 Prompt 发布
- 正式 Skill 发布

### 3.4 单变量 A/B

第一版实验只允许单次 A/B 改一个主变量，保证实验结论可解释、可复盘。

### 3.5 结论必须可被人复核

任何推荐结论都不能只是总分。证据包必须能追到样本、差异、失败原因、评分维度与冻结版本。

## 4. 整体架构

Phase 6A 建议新增一层独立的 `evaluation-ops` 治理域，位于现有生产执行链路旁边，而不是插入生产主链路中间。

建议拆成五个核心子模块：

### 4.1 `sample-set-registry`

负责定义和维护实验样本集。

职责：

- 从已脱敏、已归档、已批准的历史资产中选择样本
- 维护模块、稿件类型、风险标签等筛选条件
- 冻结样本集版本供实验运行引用

### 4.2 `experiment-suite-registry`

负责定义实验方案。

职责：

- 定义实验目标
- 定义适用模块与稿件类型
- 定义硬门槛与加权评分项
- 定义是否允许 A/B 对照
- 定义证据输出要求

### 4.3 `experiment-run-orchestrator`

负责真正执行实验。

职责：

- 冻结样本集、模型、Runtime、Prompt、Skill、模板版本
- 批量运行实验项
- 收集输出、失败、耗时、成本
- 写入实验运行明细

### 4.4 `evidence-pack-registry`

负责沉淀实验证据包。

职责：

- 汇总各项得分与差异
- 记录失败样本
- 记录回归结论
- 形成可复核的实验摘要

### 4.5 `promotion-recommendation`

负责基于证据包输出晋升建议。

职责：

- 生成 `recommended / needs_review / rejected`
- 仅提供治理建议，不直接触发生产切换

## 5. 核心领域对象

### 5.1 `SampleSet`

表示一组可用于实验的历史样本集。

建议字段：

- `id`
- `name`
- `module`
- `manuscript_types`
- `risk_tags`
- `sample_count`
- `source_policy`
- `status`
- `created_by`
- `created_at`

约束：

- 只能引用已脱敏、已归档、已批准的历史资产快照
- 样本集发布后视为可冻结资产，后续变更应走新版本

### 5.2 `SampleSetItem`

表示样本集中的单个样本引用。

建议字段：

- `id`
- `sample_set_id`
- `manuscript_id`
- `snapshot_asset_id`
- `module`
- `manuscript_type`
- `risk_tags`
- `deidentification_passed`

### 5.3 `ExperimentSuite`

表示一套实验定义。

建议字段：

- `id`
- `name`
- `module`
- `manuscript_types`
- `hard_gate_policy`
- `score_weights`
- `supports_ab_comparison`
- `requires_production_baseline`
- `evidence_policy`
- `status`
- `created_by`
- `created_at`

### 5.4 `ExperimentRun`

表示一次真实实验执行。

建议字段：

- `id`
- `experiment_suite_id`
- `sample_set_id`
- `comparison_mode`
- `baseline_binding`
- `candidate_binding`
- `status`
- `started_by`
- `started_at`
- `finished_at`
- `total_cost`
- `total_latency_ms`

其中 `baseline_binding` 与 `candidate_binding` 都应冻结以下版本：

- `model_id`
- `runtime_id`
- `prompt_template_id`
- `skill_package_ids`
- `module_template_id`

### 5.5 `ExperimentRunItem`

表示一次运行中的单条样本结果。

建议字段：

- `id`
- `experiment_run_id`
- `sample_set_item_id`
- `lane`
- `result_asset_id`
- `hard_gate_passed`
- `weighted_score`
- `failure_kind`
- `failure_reason`
- `diff_summary`
- `requires_human_review`

### 5.6 `EvidencePack`

表示一次实验的证据包。

建议字段：

- `id`
- `experiment_run_id`
- `summary_status`
- `score_summary`
- `regression_summary`
- `failure_summary`
- `cost_summary`
- `latency_summary`
- `human_review_summary`
- `created_at`

### 5.7 `PromotionRecommendation`

表示基于证据包得出的治理建议。

建议字段：

- `id`
- `experiment_run_id`
- `evidence_pack_id`
- `status`
- `decision_reason`
- `created_by`
- `created_at`

建议状态：

- `recommended`
- `needs_review`
- `rejected`

## 6. 评分机制与 A/B 对照

### 6.1 两层评分

建议采用“两层评分”：

#### 第一层：硬门槛

任一硬门槛不通过，则该实验项不能进入可晋升结论。

第一版硬门槛建议包括：

- 样本必须满足脱敏要求
- 输出必须完整可解析
- 不得调用未批准工具
- 不得缺失关键章节或关键风险提示
- 不得相对生产基线发生明显负回归

#### 第二层：加权评分

通过硬门槛后，再按加权分比较基线与候选方案。

建议第一版统一采用 100 分制，并按模块共享以下维度：

- `结构与模板符合度`
- `医学术语与表达质量`
- `知识命中与调用质量`
- `风险识别能力`
- `人工修改负担`
- `成本与时延`

### 6.2 A/B 对照规则

第一版固定采用单变量 A/B：

1. 一次实验只能修改一个主变量。
2. A/B 两组必须绑定同一 `SampleSet`。
3. 非对照依赖必须完全一致。
4. 默认必须包含当前生产基线。

主变量允许包括：

- 模型版本
- Runtime 版本
- PromptTemplate 版本
- SkillPackage 版本
- ModuleTemplate 版本

但一次只允许替换其中一种。

## 7. 证据包结构

第一版 `EvidencePack` 至少必须包含以下部分：

### 7.1 实验概览

- 实验名称
- 目标模块
- 目标稿件类型
- 样本集
- 执行人
- 执行时间

### 7.2 冻结依赖清单

- 基线与候选使用的 `model / runtime / prompt / skill / template` 精确版本

### 7.3 分数摘要

- 总分
- 各维度分
- A/B 差值

### 7.4 失败样本清单

- 不通过硬门槛的样本
- 失败类型
- 失败原因

### 7.5 差异摘要

- 哪些地方变好
- 哪些地方变差
- 是否出现新增风险

### 7.6 成本与时延摘要

- 总成本
- 单样本平均成本
- 总时延
- 单样本平均时延

### 7.7 人工复核结论

- 是否需要人工仲裁
- 仲裁意见

### 7.8 晋升建议

- `recommended`
- `needs_review`
- `rejected`

## 8. 实验审批流

建议第一版审批流固定为：

1. `admin` 创建 `SampleSet`
2. `admin` 创建 `ExperimentSuite`
3. `admin` 发起 `ExperimentRun`
4. 系统执行实验并生成 `ExperimentRunItem`
5. 系统生成 `EvidencePack`
6. `admin` 产出 `PromotionRecommendation`

补充原则：

- 第一版应用内不新增 `maintainer` 角色，所有治理写操作仍由 `admin` 负责
- `knowledge_reviewer` 不负责实验准入审批，避免角色混淆
- 业务角色不直接接触实验控制台

## 9. 失败处理

建议将实验失败分成四类：

### 9.1 `governance_failed`

场景：

- 样本未脱敏
- 样本未归档
- 依赖版本未发布
- 使用了未批准工具

处理原则：

- 整次实验直接中止
- 不生成晋升建议

### 9.2 `runtime_failed`

场景：

- 模型调用失败
- Runtime 异常
- 工具调用超时

处理原则：

- 写入 `ExperimentRunItem`
- 允许有限重试
- 失败比例超阈值时整次实验标记失败

### 9.3 `scoring_failed`

场景：

- 输出无法解析
- 评分字段缺失
- 证据不完整

处理原则：

- 样本项进入人工复核池
- 实验可继续
- 证据包必须显式标注不完整风险

### 9.4 `regression_failed`

场景：

- 相对当前生产基线显著退步

处理原则：

- 实验可结束
- 晋升建议只能为 `rejected` 或 `needs_review`

## 10. 与 Phase 5 学习治理的衔接

Phase 6A 与 Phase 5 的关系，应固定为“实验产出候选，不直接写回生产”。

当实验结果证明某套配置明显优于现有基线时，可从 `EvidencePack` 显式生成：

- `prompt_optimization_candidate`
- `skill_update_candidate`
- `template_update_candidate`

后续仍需进入既有 Phase 5 治理链路：

`实验结果 -> 候选项 -> 审核 -> writeback draft -> 正式发布`

Phase 6A 明确不允许直接修改：

- 生产模型路由
- 正式 PromptTemplate
- 正式 SkillPackage
- 正式 ModuleTemplate

## 11. 权限与角色边界

### 11.1 `admin`

可执行：

- 创建与发布实验对象
- 发起实验运行
- 查看完整证据包
- 做出晋升建议

### 11.2 `knowledge_reviewer`

可执行：

- 被引用参与知识质量复核

不可执行：

- 直接审批实验运行与晋升建议

### 11.3 `screener / editor / proofreader`

第一版不直接接触实验控制台，只消费后续已发布的正式能力。

### 11.4 `subagent`

仅负责受控批量执行，不拥有审批、发布、晋升权。

### 11.5 未来 `maintainer` 边界

如后续确需引入“维护者”身份，也应定义为受信运维身份，而不是新的业务角色。第一版不在应用角色表中新增该角色，避免和现有权限体系冲突。

## 12. 模块边界与固定分工

### `superpowers`

负责：

- 实验范围定义
- 方案口径
- 验收标准
- 阶段规划

### `gstack`

负责：

- 验证
- 对比检查
- 证据质量复核
- 发布前检查建议

### `subagent`

负责：

- 在已批准计划下进行受限批量执行
- 不改变实验边界
- 不改变审批与发布规则

系统内不新增新的同级总控角色，继续维持现有固定分工。

## 13. 第一版交付边界

Phase 6A 第一版只交付：

- contracts
- API slices
- in-memory repository / service / API
- typed web clients
- 测试
- 文档

第一版不交付：

- 完整实验管理后台页面
- 复杂图表
- 自动晋升到生产
- 多变量实验
- 在线生产稿件实验
- 微信端实验入口

## 14. 测试策略

第一版建议至少覆盖：

- contracts type tests
- API module tests
- governance failure tests
- regression failure tests
- evidence pack generation tests
- Phase 5 candidate handoff tests
- web typed client typecheck

重点验证：

- 样本集来源是否合法
- 实验运行是否冻结正确依赖版本
- A/B 是否遵守单变量约束
- 证据包是否包含必需字段
- 回归失败时是否禁止生成 `recommended`
- 候选项创建是否正确衔接 Phase 5

## 15. Phase 6A 验收标准

Phase 6A 完成后，应满足：

- 能创建并治理 `SampleSet`
- 能创建并治理 `ExperimentSuite`
- 能发起并执行 `ExperimentRun`
- 能生成 `ExperimentRunItem`
- 能生成完整 `EvidencePack`
- 能生成但不能自动执行 `PromotionRecommendation`
- 能从实验结果显式创建 Phase 5 学习候选
- 权限边界正确
- 审计链完整
- 仍然保持生产发布链路独立、稳定且不被实验层绕过
