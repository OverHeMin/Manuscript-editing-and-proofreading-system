# 示例驱动规则包引擎 V1 设计

## 背景

现有规则库录入方式偏长表单、偏技术字段，虽然覆盖了底层命中能力，但不利于基于样稿沉淀高频编辑规则，也不利于后续做“短卡片精修”的低误判交互。

原先计划中的“示例驱动 + 短卡片精修”方向保留，但为了控制风险，第一阶段不直接做 UI，不直接发布正式 `editorial_rule`，而是先做一个稳定的后端规则包引擎，把“原稿 + 编后稿”转成可解释的规则包候选。

## 目标

- 基于 `原稿 + 编后稿` 识别高频结构化编辑动作。
- 首版稳定输出 6 类 `RulePackageCandidate`。
- 输出结构直接对齐未来 UI：
  - 左侧候选列表摘要
  - 中间 5 张短卡片字段
  - 右侧预演解释字段
- 用真实样稿对 + 人工小样例做 gold case 回归，优先降低误判。

## 非目标

- 不做上传 UI。
- 不做规则包在线编辑界面。
- 不做规则发布到正式 `editorial_rule`。
- 不做知识库投影。
- 不追求与编后稿逐字一致。

## 首版范围

首版固定支持 6 类规则包：

1. 前置信息包
2. 摘要关键词包
3. 标题层级包
4. 数值统计包
5. 三线表包
6. 参考文献包

## 总体方案

V1 采用“分层规则包引擎”而不是“直接硬编码吐规则”。

链路如下：

1. `样稿快照层`
   - 输入真实 DOCX 或测试夹具。
   - 输出统一的 `ExampleDocumentSnapshot`。
2. `差异归一层`
   - 对原稿/编后稿差异做结构化归一。
   - 输出 `EditIntentSignal[]`。
3. `规则包识别层`
   - 将相关信号聚合为 6 类 `RulePackageCandidate`。
4. `语义卡片装配层`
   - 直接组装未来 UI 要消费的 5 张卡片字段。
5. `预演解释层`
   - 产出命中、未命中、自动化姿态、人工复核原因。

## 核心边界

V1 只解决：

- “识别什么规则包”
- “为什么识别成它”
- “证据是什么”
- “建议自动化姿态是什么”

V1 不解决：

- “如何编辑这张卡片”
- “如何发布为正式运行时规则”
- “如何知识投影”

## 数据契约

### 1. 文档快照

`ExampleDocumentSnapshot` 表示一份原稿或编后稿的稳定结构化快照。

建议包含：

- `source`
- `parser_status`
- `sections`
- `blocks`
- `tables`
- `warnings`

其中 `blocks` 需支持至少这些类型：

- `front_matter_line`
- `heading`
- `paragraph`
- `keyword_line`
- `reference_entry`
- `table_caption`
- `table_note`

### 2. 编辑意图信号

`EditIntentSignal` 是第一版的关键中间层，用于避免直接从 diff 生硬生成规则。

建议包含：

- `package_hint`
- `signal_type`
- `object_hint`
- `before`
- `after`
- `location`
- `rationale`
- `confidence`
- `risk_flags`

典型 `signal_type`：

- `label_normalization`
- `inserted_block`
- `deleted_block`
- `text_style_normalization`
- `table_semantic_change`
- `reference_style_change`

### 3. 规则包候选

`RulePackageCandidate` 是 V1 的最终输出，也是未来 UI 的直接输入。

建议包含：

- `package_kind`
- `title`
- `suggested_layer`
- `automation_posture`
- `status`
- `source_signal_ids`
- `cards`
- `preview`
- `compile_hints`

其中：

- `cards` 对应未来中间 5 张短卡片
- `preview` 对应未来右侧预演区
- `compile_hints` 先保留，不在 V1 使用，为第二阶段编译发布做准备

## 未来 5 张短卡片字段

`cards` 固定输出以下 5 组：

1. `rule_what`
   - 规则名
   - 规则对象
   - 建议发布层级
2. `ai_understanding`
   - 一句话摘要
   - 命中对象
   - 命中位置
3. `applicability`
   - 稿件类型
   - 模块
   - 章节/块
   - 表格目标
4. `evidence`
   - `before/after` 示例
   - 备注说明
5. `exclusions`
   - 不适用边界
   - 人工复核条件
   - 风险姿态

## 6 类规则包识别策略

### 1. 前置信息包

- 识别对象：
  - 作者简介
  - 通信作者
  - 作者行
  - 单位行
  - 英文作者块
  - 分类号/文献标志码
- 建议落层：`journal_template`
- 默认姿态：`guarded_auto`

### 2. 摘要关键词包

- 识别对象：
  - 摘要标签
  - 关键词标签
  - 缩写统一
  - 关键词增删
  - 中英文摘要同步
- 建议落层：`template_family`
- 默认姿态：`guarded_auto`

### 3. 标题层级包

- 识别对象：
  - `1 / 1.1 / 1.2.1`
  - 层级空格
  - 子节拆分
  - 标题命名规范
- 建议落层：`template_family`
- 默认姿态：`safe_auto`

### 4. 数值统计包

- 识别对象：
  - 单位
  - 范围连接号
  - 乘方
  - `P` 值
  - 统计符号
- 建议落层：`template_family`
- 默认姿态：`guarded_auto`

### 5. 三线表包

- 识别对象：
  - 表题
  - 列头单位
  - 删除 `n/t/P` 行
  - 组别排序
  - 统计脚注字母化
  - 表注拆分
- 建议落层：`journal_template`
- 默认姿态：`inspect_only`

### 6. 参考文献包

- 识别对象：
  - 文献类型标识
  - 全角标点
  - 期卷页
  - 图书条目
  - 续页规范
- 建议落层：`template_family`
- 默认姿态：`guarded_auto`

## 识别原则

- 单条 diff 不直接等于一条规则。
- 多个强相关信号优先合并为一个规则包候选。
- 证据不足时必须降级：
  - `needs_review`
  - `insufficient_evidence`
- 三线表与复杂前置信息优先保守，不追求自动执行。

## 实施拆分

V1 建议拆成 5 个后端单元：

### 1. 样稿快照层

- 复用现有 DOCX 结构解析能力。
- 对真实 DOCX 与测试夹具做统一适配。

### 2. 差异归一层

- 输入：`original snapshot + edited snapshot`
- 输出：`EditIntentSignal[]`
- 只做“编辑动作归一”，不做规则识别。

### 3. 规则包识别层

- 6 个识别器分别识别 6 类规则包。
- 每个识别器只聚合相关信号，不跨职责做格式生成。

### 4. 卡片装配与预演层

- 直接装配未来 UI 所需结构。
- 输出：
  - 候选摘要
  - 5 张卡片
  - 命中解释
  - 未命中解释
  - 自动化姿态

### 5. gold case 回归层

- 真实样稿对：1 组
- 人工小样例：1 到 2 组
- 回归只验证“结构化覆盖与解释稳定性”

## 验收标准

V1 通过条件：

- 能稳定产出 6 类规则包候选。
- 每个候选都带完整 5 张卡片字段。
- 每个候选都有预演解释：
  - 命中了哪里
  - 为什么命中
  - 为什么不命中
  - 是否需要人工复核
- 三线表不会被错误提升为激进自动化。
- 证据不足时明确降级，不做硬判。

## 风险控制

### 风险 1：被单一样稿带偏

- 用真实样稿对 + 人工小样例双基线。

### 风险 2：表格误判

- 三线表 V1 固定 `inspect_only`。

### 风险 3：内容改写与结构化动作混淆

- V1 只识别结构化编辑动作，不处理自由改写。

### 风险 4：后续接 UI/发布时返工

- 当前输出直接按未来 UI 数据结构设计。
- 保留 `compile_hints`，为第二阶段保留扩展位。

## 第二阶段衔接

第二阶段再增加两层：

### 1. 语义确认层

用户修改：

- AI 怎么理解
- 适用范围
- 不适用边界
- 风险姿态

而不是直接改 `selector/trigger/action`。

### 2. 编译发布层

- 经过人工确认的规则包才允许进入编译。
- 编译结果写入正式 `editorial_rule`。
- 运行时真源仍然只有 `editorial_rule`。

## 结论

V1 的最佳落点不是“先做一个长表单的替代品”，而是“先做一个稳定、可解释、可回归的示例驱动规则包引擎”。

先把：

- 识别
- 聚合
- 卡片结构
- 预演解释
- 回归稳定性

做扎实，再进入第二阶段的语义确认与规则发布，会明显降低误判和返工风险。

## V1.1 加固状态（2026-04-10）

已完成的 V1.1 加固项：

- 真实 `原稿.docx + 已编辑.docx` 已沉淀为 committed gold case fixture，测试不再依赖桌面文件。
- DOCX 结构提取 CLI 已改为 UTF-8 安全输出，避免 Windows 控制台编码导致的 JSON 输出异常。
- 当 Word 未设置标题样式时，解析层可通过编号标题回退识别章节结构。
- real gold case 已接入 `buildRealSampleFixture()` 主测试入口，规则包识别继续以真实样稿为基线。

当前仍明确延期到 V2 的内容：

- 语义卡片编辑 UI
- 语义层到正式 `editorial_rule` 的编译发布
- 发布/审核流
- 知识投影与知识库优先调用链路

## V2A 语义确认工作台（2026-04-10）

V2A 在不改变运行时真源的前提下，把 reviewed-case handoff 接入规则中心录入页，并补上第一版“语义确认工作台”。

V2A 已增加：

- 以 `reviewedCaseSnapshotId` 为入口，从 reviewed snapshot 解析示例对并生成规则包候选
- 在 `template-governance` 页面中启用三栏工作台
  - 左侧 `Rule Packages` 候选列表
  - 中间 5 张语义卡片
  - 右侧 `Preview` 预演解释区
- 语义卡片支持前端本地编辑
  - 一句话摘要
  - 适用范围
  - before/after 示例
  - 不适用边界
  - 人工复核条件
- 预演区支持基于本地语义草稿显式刷新 preview
- 原有长表单规则编辑器保留，但仅在 `Open Advanced Rule Editor` 后展开

V2A 仍明确延期：

- 原稿/编后稿原始上传向导
- 将确认后的语义层编译为正式 `editorial_rule`
- 规则包发布、审核、入库流
- 知识投影、知识回链、知识优先调用
- 语义草稿持久化

V2A 的边界要求不变：

- 执行真源仍然只有 `editorial_rule`
- 当前规则包工作台只承担录入、解释、预演职责
- 未经人工确认的语义字段不得直接驱动正式运行时调用

## V2B 示例直传与草稿持久化（2026-04-11）

V2B 在不引入正式 manuscript ingestion 的前提下，把“示例驱动录入”补成了可用主流程。

V2B 已增加：

- 规则中心支持直接上传 `原稿 + 编后稿`，并创建临时 `example source session`
- 规则包工作台支持 `reviewed_case / uploaded_example_pair` 两类 source 的统一 workspace 入口
- reviewed-case 与 uploaded pair 现在共用同一套 rule-package engine
- 规则中心 authoring 模式默认显示 package-first 工作台，而不是长表单主入口
- 语义卡片草稿已支持按 source identity 本地自动保存与恢复
- `@medsys/web test` 与 `@medical/api test -- editorial-rules` 已通过，V2B 相关回归稳定

V2B 仍明确延期：

- 将确认后的语义层编译为正式 `editorial_rule`
- 规则包发布、审核、审批流
- 知识投影、知识回链、知识优先调用
- `manuscript ingestion` 驱动的 source 接入

当前推荐的下一阶段不是先把规则中心并入更重的 ingestion 主链，而是先进入 V2C：语义确认后的编译预演与受控发布。原因是仓库里已有成熟的 `editorial_rule` rule set、publish、resolution 与 preview 能力，V2C 只需要把规则包编译接入现有真源，就能把当前录入工作台真正变成可发布、可运行的治理闭环。
