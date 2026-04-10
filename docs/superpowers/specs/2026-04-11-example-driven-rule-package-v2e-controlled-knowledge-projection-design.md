# 示例驱动规则包 V2E 受控知识投影设计

## 背景

`V2D` 已经把 package-first 工作台推进到了一个稳定的 handoff 阶段：

- 已确认的规则包可以 `compile-preview`
- 已确认的规则包可以 `compile-to-draft`
- package-first 可以把用户带到现有 `Rule Sets / Advanced Rule Editor / Publish Rule Set`
- 运行时真源仍然只有既有 `editorial_rule_set + editorial_rule`

当前还缺少的是 `已确认语义层 -> 高质量知识投影` 这一段桥接。

现有发布后知识投影链路本身已经存在，并且稳定：

- `EditorialRuleService.publishRuleSet()` 会触发投影刷新
- `EditorialRuleProjectionService` 会把正式发布的规则投影成 `rule / checklist / prompt_snippet`

但 package-first 编译出来的规则目前主要只写入：

- `authoring_payload`
- `example_before / example_after`
- `manual_review_reason_template`

而现有知识投影真正依赖的高质量语义字段还没有被系统性补齐：

- `explanation_payload`
- `projection_payload`
- `linkage_payload`
- `evidence_level`

因此 `V2E` 的职责不是新建知识治理系统，而是把 package-first 已确认语义层稳定翻译进现有规则真源，使正式发布后的知识投影质量跟上。

## 目标

- 让 package-first 已确认语义层在 `compile-to-draft` 时编译成高质量规则 explainability / projection 字段
- 继续复用现有 `Publish Rule Set -> refreshPublishedRuleSet()` 链路
- 让发布后的知识投影能稳定产出更像“可被 AI 理解和检索”的 `rule / checklist / prompt_snippet`
- 在 package-first 工作台中补一个轻量“发布后知识沉淀预期”说明，帮助用户在发布前理解知识结果

## 非目标

`V2E` 明确不做：

- 新的知识发布入口
- package-native 审批流
- 第二套运行时真源
- manuscript ingestion
- 独立的知识投影审批或知识版本系统

## 方案比较

### 方案 A：只补后端投影字段

做法：

- 仅在 compile 阶段补齐 `explanation_payload / projection_payload / linkage_payload / evidence_level`
- 前端不展示知识投影预期

优点：

- 最稳
- 改动最小

缺点：

- 用户在发布前仍然看不到“这次发布后会沉淀什么知识”
- package-first 对知识投影的解释仍然偏黑箱

### 方案 B：受控知识投影增强

做法：

- 后端把已确认语义层编译为 explainability / projection / provenance 字段
- 正式知识投影仍只发生在现有发布动作之后
- package-first 只增加轻量“知识投影预期”摘要，不增加第二个发布按钮

优点：

- 保持既有发布与投影链路不变
- 让 package-first 到知识库之间形成完整闭环
- 风险和复杂度都可控

缺点：

- 需要同时补后端编译逻辑、投影回归测试和少量前端解释 UI

### 方案 C：package-first 直接管理知识投影

做法：

- 在 package-first 中加入知识投影审批、预发布、确认等治理动作

优点：

- 表面上更“一体化”

缺点：

- 很容易长出第二套治理系统
- 与当前“规则真源唯一”的原则冲突
- 明显超出 V2 稳定收尾边界

## 推荐

采用方案 B。

`V2E` 的核心原则是：

- 编译时增强语义
- 发布时复用现有链路
- UI 只做解释，不做第二次发布

## 设计细节

### 1. 已确认语义层成为知识质量输入

package-first 当前已经有：

- `semantic_summary`
- `hit_scope`
- `applicability`
- `evidence_examples`
- `failure_boundaries`
- `normalization_recipe`
- `review_policy`
- `confirmed_fields`

`V2E` 规定：

- 只有 `confirmed_fields` 覆盖到的语义，才能进入正式规则 explainability / projection 字段
- 未确认内容不能静默写进高可信知识字段
- 缺失确认时允许保留基础 compile trace，但不得冒充“已确认知识语义”

### 2. compile-to-draft 产出 richer rule metadata

对每条 compiled seed，在创建或替换 `editorial_rule` 时补齐：

- `explanation_payload`
  - `rationale`
  - `applies_when`
  - `not_applies_when`
  - `correct_example`
  - `incorrect_example`
  - `review_prompt`
- `projection_payload`
  - `projection_kind`
  - `summary`
  - `standard_example`
  - `incorrect_example`
- `linkage_payload`
  - source session / reviewed case provenance
  - package id
  - semantic hash
  - optional override references
- `evidence_level`
  - 先按稳定规则映射，不引入复杂评分器

### 3. 语义字段到规则字段的编译约定

#### `semantic_summary`

映射到：

- `projection_payload.summary`
- 缺省时也可参与 `explanation_payload.rationale`

#### `applicability + hit_scope`

映射到：

- `explanation_payload.applies_when`
- 必要时补充 `review_prompt` 中的命中说明

#### `failure_boundaries`

映射到：

- `explanation_payload.not_applies_when`

#### `evidence_examples`

映射到：

- `example_before / example_after`
- `projection_payload.standard_example`
- `projection_payload.incorrect_example`
- `explanation_payload.correct_example`
- `explanation_payload.incorrect_example`

#### `review_policy`

映射到：

- `manual_review_reason_template` 的补强文本来源
- `explanation_payload.review_prompt`

#### `normalization_recipe`

映射到：

- `explanation_payload.rationale` 的 recipe 片段
- 必要时补充 `projection_payload.summary`

### 4. provenance 继续挂在规则真源下

`V2E` 不创建单独“知识来源表”。

稳定做法：

- `authoring_payload.compile_trace` 保留当前编译轨迹
- `linkage_payload` 增加可解释来源链接
- 正式知识投影仍从 published rule 读这些字段

这样保持了：

- 规则是执行真源
- 知识只是规则的下游投影

### 5. evidence level 采用保守映射

`V2E` 不引入新的复杂判分器，先用稳定映射：

- 来源是 `reviewed_case` 且语义字段已确认充分：`medium`
- 来源是 `uploaded_example_pair` 且语义字段已确认充分：`low`
- 证据或边界不完整：`unknown`
- 之后如需要更强证据治理，放到后续阶段

### 6. 前端只加“知识投影预期”摘要

在 package-first compile panel 中补一块轻量信息：

- 发布后将生成哪些知识投影种类
- 每类投影会带什么 summary/example/boundary
- 当前哪些语义已确认，哪些仍然不应进入高可信投影

这层是解释层，不是发布层。

明确不做：

- `Publish Knowledge`
- `Approve Projection`
- package-first 的第二个状态机

### 7. 现有投影服务保持不变或仅做兼容增强

`EditorialRuleProjectionService` 的主职责不变：

- 从 published rule set 读取 enabled rules
- 生成 `rule / checklist / prompt_snippet`
- 刷新、归档旧 projection

`V2E` 只需要保证 package compile 产生的规则 metadata 能被现有 projection service 吃好。

若需要增强，只做兼容性增强，例如：

- 更好利用 `explanation_payload.review_prompt`
- 更好利用 `linkage_payload` 或 compile trace

但不改变“必须先 publish 才投影”的原则。

## 接口与数据约束

### 后端 compile 结果

`compile-to-draft` 结果不需要新增一整套知识对象，只需补一个轻量预期摘要：

- 每个 package 是否具备“高质量知识投影条件”
- 预计产出哪些 projection kinds
- 是否存在未确认语义导致的降级

### 规则记录

`EditorialRuleRecord` 结构已具备承载能力，`V2E` 不新增新的核心 record。

重点是 compile 时真正写进去，而不是只在 manual authoring 时可用。

## 测试策略

### 1. 编译桥测试

验证 package compile 后创建的 draft rules 已经带有：

- `explanation_payload`
- `projection_payload`
- `linkage_payload`
- `evidence_level`

并且内容来源于已确认语义层，而不是随意拼接。

### 2. 投影回归测试

把 package-first 生成的规则发布后，验证知识投影结果：

- summary 更完整
- canonical_text 能体现 rationale / boundaries / examples
- projection provenance 保持可追溯

### 3. 边界测试

验证未确认语义字段不会被当作高可信 explainability/projection 直接发布：

- 部分未确认时降级
- 缺少 evidence 或 boundary 时只保留保守字段

### 4. 前端解释测试

验证 compile panel 中的“知识投影预期”只做解释：

- 能显示将产生的 projection kinds
- 能显示确认不足导致的降级原因
- 不出现第二个 publish 入口

## 风险与控制

### 风险 1：编译层过度脑补语义

控制：

- 只允许 confirmed fields 进入高可信 explainability / projection 字段
- 未确认字段最多留在 compile trace，不进入高可信投影文本

### 风险 2：package-first 变成第二套知识治理入口

控制：

- UI 只展示预期摘要
- 真正知识投影仍只跟随 `Publish Rule Set`

### 风险 3：投影文本质量不稳定

控制：

- 优先复用现有 projection service
- 先用模板化、保守的编译映射，不引入 prompt 风格生成

## 验收标准

- package-first 编译出的规则在 draft 中能看到完整 explainability / projection / provenance 字段
- 发布这些规则后，现有知识投影链路能稳定生成更高质量的 `rule / checklist / prompt_snippet`
- compile panel 可以解释“发布后会沉淀什么知识”以及“哪些语义还未确认”
- 整个过程不新增第二套 publish/approval/workflow
- `V2` 到此可以在稳定边界内完成收尾

## 结论

`V2E` 不是“再做一个知识系统”，而是把 package-first 已确认语义层真正接到现有规则真源和知识投影链路上。

只要补齐：

- compile 时的 explainability / projection / provenance 编译
- publish 后的现有投影回归
- package-first 中的轻量知识预期解释

`V2` 就能在不漂移、不分叉的前提下完成闭环收尾。

## Implementation Status

Implemented in V2E:

- confirmed package semantic fields now compile into `explanation_payload`, `projection_payload`, `linkage_payload`, and conservative `evidence_level`
- published package-compiled rules now project richer `rule / checklist / prompt_snippet` knowledge through the existing publish-triggered projection service
- the package-first compile panel now explains post-publish knowledge projection kinds, confirmed semantic fields, and withheld semantic fields

Still deferred on purpose:

- package-native approval workflow
- manuscript ingestion as a new source
- a second publish path for knowledge or package projections
