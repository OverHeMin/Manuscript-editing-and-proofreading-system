# 2026-04-24 Editing Module Redefinition And Slot Governance Design

**Date**

2026-04-24

**Status**

Written after design approval in conversation. Awaiting written review before implementation.

**Goal**

把当前系统里的 `editing` 从“局部安全格式修改链路”升级成真正可交付的“期刊格式编辑模块”。

这份设计的目标不是让 AI 更自由，而是让系统在严格边界内更可靠地完成以下事情：

- 按目标期刊的结构化格式模型编辑稿件
- 在不改变文章事实、医学含义、统计结果的前提下完成格式调整
- 对前置元数据、表格、符号、声明、参考文献等高风险对象采用 evidence-first 路线
- 通过 `槽位制 + 缺口驱动人工核对` 保证必备项目不漏
- 让 `规则中心 / 知识库 / 期刊模板 / editing` 形成一条真实可执行的治理链

一句话总结：

`编辑模块不是自由改稿 AI，而是受期刊目标模型、规则层级、证据采集和人工核对共同约束的格式治理引擎。`

## User-Approved Baseline

本次设计建立在以下已经确认的决策上：

- `editing` 只允许做格式、结构、符号、版式和规范化调整，不允许改文章含义、数据和医学结论。
- 期刊格式目标模型不能只靠说明文，必须变成结构化目标。
- 目标模型应采用 `固定骨架 + 可扩展目标块`，而不是每加一个字段就改底层。
- 标题上方常见目标块至少包括：
  - 作者简介
  - 通信作者简介
  - 基金项目
- 关键词下方常见目标块至少包括：
  - 中图分类号
  - 文献标志码
- 上述目标块不应被硬编码死，运营人员需要能够自由添加、修改、排序和设为必填或非必填。
- 如果作者把相关信息藏在页眉页脚、正文前置区以外、或乱放位置，系统应先做候选猎取，再由人工核对缺口，而不是让 AI 自由猜。
- 前置元数据的正确产品方向不是“全文重写式猜测”，而是 `槽位制 + 缺口驱动人工核对`。
- 表格目标不是“尽量识别”，而是朝 `全量富样式无损采集` 和 `全量表格重建式自动排版` 设计。
- 通用包和医学包不应只是狭窄二选一入口，规则体系最终应支持 `通用层 -> 医学层 -> 期刊层` 叠加。

## Why This Design Is Needed

当前仓库已经具备一些关键地基：

- governed rule-set / rule resolution 主链路已存在
- editing 已有 deterministic apply 与安全降级逻辑
- `front_matter` 已有基础识别概念
- 表格已有结构语义、粗粒度 style profile、局部 patch 规划
- 知识与规则已具备一定程度的绑定和投影能力

但从“真正可用的编辑模块”角度看，当前系统仍然不够，主要差在 6 件事：

1. 期刊格式目标仍然过薄，无法作为编辑模块的真实目标源。
2. 前置元数据还没有被产品化为可追踪、可验收的槽位系统。
3. 前置元数据错位识别仍主要依赖正文前置区启发式，页眉页脚未进入主链路。
4. 规则层级与包作用域在 UI 和运行时之间仍然不够清晰，达不到“运营可控”的程度。
5. 表格 rich style 采集还不是无损级别，不能支撑严格期刊格式编辑。
6. 表格自动编辑仍偏向局部 patch，不是整表重建级别。

因此，这份设计要回答的核心不是“如何多加一点 AI”，而是：

- 系统如何知道目标期刊到底要什么
- 系统如何知道稿件里哪些必备项目还没落位
- 系统如何在高风险对象上宁可保守，也不乱改
- 运营人员如何看到规则、知识、期刊目标和编辑结果之间的真实关系

## Problem Statement

编辑模块需要系统性解决以下 8 类问题：

1. `编辑目标不够结构化`
   期刊模板当前更像选择器或薄覆盖层，不足以独立支撑整篇稿件格式编辑。

2. `前置元数据没有完成判定机制`
   现在无法稳定回答“这篇稿件的作者简介、基金项目、中图分类号到底有没有落到该落的位置”。

3. `错位元数据没有全域猎取`
   信息可能出现在正文前置区、页眉页脚、摘要附近、正文末尾声明区，但当前主链路无法完整覆盖。

4. `规则层级还不够接近期刊编辑实际`
   真实编辑不是一个包二选一，而是通用规则、医学规则、期刊规则三层叠加。

5. `表格识别精度还达不到编辑要求`
   编辑模块需要完整知道表格格式事实，不能依赖粗粒度 style hints 或 AI 补猜。

6. `表格自动编辑能力还不是重建级`
   三线表、复杂表头、局部富文本、边框和对齐要求无法只靠 patch 稳定完成。

7. `高风险对象缺少统一降级策略`
   图片代替的符号、公式片段、对象型内容不能走普通文本改写。

8. `完成判定标准过弱`
   “生成了一个新文档”不等于“编辑完成”。

## Approach Options

这次设计存在 3 条候选路线。

### Option A: AI Guess-First Editing

做法：

- 让 AI 直接读稿件
- 结合期刊说明文和规则提示自由修改
- 缺少信息时由 AI 推断

优点：

- 看起来开发快
- UI 可以比较简单

缺点：

- 高风险场景极易误改
- 无法保证同一篇稿件多次执行结果稳定
- 很难解释“为什么改”
- 很难做严格验收

结论：

不采用。这条路线和用户明确要求相反。

### Option B: Hard Template Only

做法：

- 所有期刊格式都写死成固定模板
- 依赖确定性匹配和写回
- 异常情况全部人工

优点：

- 安全边界清楚
- 结果相对稳定

缺点：

- 适应力太弱
- 运营录入和维护成本很高
- 难处理真实稿件中的乱放、缺失和历史遗留排版

结论：

不采用。它太硬，无法承受真实医学稿件的混乱输入。

### Option C: Slot-Governed Evidence-First Editing

做法：

- 用结构化期刊目标模型定义“要编辑成什么样”
- 用槽位系统承载前置元数据和高价值格式对象
- 用 evidence-first 的候选猎取和精确采集获取事实
- 只对高确定性对象自动改
- 对低确定性缺口进入人工核对

优点：

- 既比 AI 自由猜更安全，又比全硬编码更有弹性
- 能做可解释、可回滚、可验收的编辑闭环
- 与当前仓库已有 governed runtime 最兼容

缺点：

- 需要补较多底层能力
- 第一阶段工作量不小

结论：

采用。这是唯一同时满足“能落地、够安全、后续可扩展”的路线。

## Final Design Decisions

- 编辑模块以 `结构化期刊目标模型` 为唯一目标源，不以 prompt prose 为唯一目标源。
- 前置元数据采用 `槽位制`，不再依赖“整块 front matter 猜中即可”。
- 前置元数据必须支持 `正文前置区 + 页眉 + 页脚 + 摘要附近 + 正文末尾声明区` 的候选猎取。
- 必填槽位未解决时，稿件不得判定为“编辑完成”。
- 规则体系采用 `通用层 -> 医学层 -> 期刊层` 三层叠加，而不是窄二选一。
- 知识库承担依据和解释，规则中心承担执行，期刊模板承担目标和范围，三者各司其职。
- 表格采集目标升级为 `全量富样式无损`，不再接受关键事实缺失后由 AI 脑补。
- 表格写回能力目标升级为 `全量表格重建式自动排版`，局部 patch 只作为安全子路径。
- 对图片符号、公式片段、对象型内容引入独立安全通道，不进入普通文本改写。
- 编辑模块必须提供可追溯改动账本、回滚能力、重跑能力和幂等收敛保障。

## Scope

### In Scope

- 编辑模块的重新定义和完成标准
- 期刊格式目标模型
- 前置元数据槽位系统
- 元数据猎取器
- 通用层 / 医学层 / 期刊层规则叠加模型
- 规则中心 / 知识库 / 期刊模板 / editing 的职责边界
- 表格 full-fidelity capture 目标 contract
- 表格重建式自动排版主链路设计
- 图片符号和对象型内容的安全降级设计
- 编辑结果追踪、回滚、重跑和验收标准

### Out of Scope

- PDF 全量编辑支持
- 所有外部文档格式的一次性全覆盖
- 图像表格和复杂数学公式的一步到位全自动编辑
- 一阶段内覆盖所有期刊的全部极端历史版式
- 把编辑模块扩展成内容改写或语言润色产品

## 1. Editing Product Definition

编辑模块的正确定义应为：

`在不改变稿件内容事实的前提下，基于结构化期刊目标模型、分层规则和证据采集，对稿件执行可追溯、可回滚、可验收的格式治理。`

它至少要回答 4 个问题：

- 目标期刊想要什么格式
- 当前稿件离目标还有哪些差距
- 哪些差距可以安全自动修正
- 哪些差距必须人工裁决

### 1.1 Editing Allows

- 调整结构位置
- 调整顺序
- 调整样式
- 调整符号表示方式
- 调整单位和统计表达的规范形式
- 调整标题、摘要、关键词、声明、图表、参考文献等格式层对象

### 1.2 Editing Forbids

- 修改研究数据
- 修改统计结果含义
- 修改医学结论
- 修改作者真实身份信息
- 修改参考文献事实内容
- 用 AI 填造缺失信息

### 1.3 Editing Completion Standard

以后“编辑完成”至少满足：

- 必填槽位全部解决
- 前置元数据冲突项全部裁决
- 高风险对象全部通过人工或安全自动链路处理
- 表格高风险项全部处理
- 没有阻断级格式错误
- 生成的改动账本完整可追踪

### 1.4 Core Module Review Surface

三大核心模块的人工工作面不采用“只看问题列表、不看整篇文稿”的模式。

统一交互原则应为：

- 点开任一核心模块子页面时，人工可以看到整篇文章
- 页面采用 `左侧正文 / 右侧问题与动作` 的双栏结构
- 右侧问题项必须可以反向定位到左侧正文中的具体位置
- 左侧正文中的命中对象、候选对象、自动改动对象、待人工裁决对象必须具备可见标记

其中：

- `screening` 右侧展示问题与处理建议
- `proofreading` 右侧展示问题、建议修改和证据
- `editing` 右侧展示待确认改动、槽位缺口、对象型风险、改动账本

换句话说：

人工不是“不看整篇文章”，而是“看整篇文章，但默认按问题定位导航，而不是靠人工从头翻找”。

## 2. Journal Format Target Model

### 2.1 Fixed Skeleton + Extensible Target Blocks

期刊格式目标模型采用 `固定骨架 + 可扩展目标块`。

固定骨架至少包括：

- 前置元数据区
- 标题区
- 摘要区
- 关键词区
- 正文区
- 图表区
- 参考文献区

可扩展目标块用于承载期刊差异。

### 2.2 Target Block Schema

每个目标块至少需要这些字段：

- `block_key`
- `label`
- `zone`
- `anchor`
- `order`
- `required`
- `repeatable`
- `format_policy`
- `content_source_policy`
- `completion_gate`

字段语义必须明确到实现可落地的程度：

- `block_key`
  - 在同一份 `journal_format_target_model` 内稳定唯一
  - 一经发布后不能直接复用给不同语义对象
- `label`
  - 运营可见名称，可改
  - 不参与运行时主键匹配
- `zone`
  - 必须属于固定骨架中的一个 zone
- `anchor`
  - 必须来自受支持的锚点枚举
  - 运行时用于自动落位和位置校验
- `order`
  - 表示同一 anchor 下的相对顺序
- `required`
  - 是否进入强完成门禁
- `repeatable`
  - 是否允许一个 block 产出多个槽位实例
- `format_policy`
  - 至少包括显示标签、前后缀、分隔符、目标位置、样式要求、是否允许自动重排
- `content_source_policy`
  - 至少区分：
    - `must_harvest_existing`
    - `prefer_existing_with_manual_fill`
    - `manual_only`
  - editing 不允许出现“AI 自由生成缺失内容”策略
- `completion_gate`
  - 至少区分：
    - `block_on_missing`
    - `block_on_unresolved`
    - `warn_only`

### 2.3 Default Front-Matter Blocks

系统默认内置这些前置元数据目标块：

- `author_line`
- `affiliation_line`
- `author_bio`
- `corresponding_author_bio`
- `funding_statement`
- `classification_code`
- `document_code`
- `abstract`
- `keywords`

后续可增补：

- `doi`
- `ethics_statement`
- `conflict_of_interest`
- `orcid`
- `received_date`
- `accepted_date`

### 2.4 Anchor Model

目标块位置不应只写死成自然语言，而应采用锚点模型，例如：

- `before_title`
- `after_title`
- `after_author_line`
- `after_abstract`
- `after_keywords`
- `before_reference`
- `footer_zone`

这样期刊差异就能通过配置表达，而不是继续靠硬编码。

### 2.5 Target Model Persistence And Ownership

当前仓库中的 `journal template` 实体还比较薄，无法直接承载完整的目标模型。

因此本设计明确采用两层对象：

- `journal_template`
  - 继续承担“选择哪个期刊目标生效”的作用域职责
- `journal_format_target_model`
  - 作为挂在某个 `journal_template` 下的受治理子对象
  - 专门承载 fixed skeleton、target blocks、slot config、anchor policy、completion gate

也就是说：

- `journal_template` 不被硬塞成巨大的配置表单
- 现有模板台账仍保留
- 但模板详情页必须新增一个“格式目标模型”入口
- editing 运行时真正消费的是 `journal_template selection + published target model version`

### 2.6 Block Lifecycle And Versioning

为满足“自由增删改”与历史稿件可追溯两者并存，目标块生命周期必须采用版本化治理：

- 草稿阶段允许新增、修改、删除
- 一旦发布，不允许物理删除已生效 block
- 发布后的“删除”以 `archived` 或 `disabled_in_next_version` 表达
- 历史稿件继续引用其运行时所使用的 target model version
- 新稿件只消费最新发布版本

## 3. Front-Matter Slot Governance

### 3.1 Why Slot Governance Is Required

前置元数据不应再被视为“一坨 front matter 文本”。

真实编辑关心的是：

- 哪个项目应该存在
- 现在有没有找到
- 找到的是不是正确内容
- 位置是否正确
- 是否允许自动落位

### 3.2 Slot States

每个槽位必须进入以下 6 种状态之一：

- `resolved_auto`
- `resolved_manual`
- `recognized_misplaced`
- `conflicted_candidates`
- `low_confidence_pending_review`
- `missing`

### 3.3 Completion Logic

- `required = true` 且状态不是 `resolved_auto` 或 `resolved_manual` 时，阻断编辑完成。
- `required = false` 时，可只出提醒，不阻断完成。
- `conflicted_candidates` 和 `low_confidence_pending_review` 默认阻断完成，除非期刊配置明确允许跳过。

### 3.4 Slot State Transitions

- `recognized_misplaced -> resolved_auto`
  - 仅在候选唯一、目标 anchor 明确、且该 block 的 `format_policy` 允许自动重排时成立
- `recognized_misplaced -> low_confidence_pending_review`
  - 当候选本身可信，但目标位置存在多个可接受落点时成立
- `conflicted_candidates -> resolved_manual`
  - 由人工明确选择候选后成立
- `missing -> resolved_manual`
  - 仅当人工手动录入、确认豁免、或明确标记“此期刊当前稿件不适用”时成立
- 任一人工裁决都必须写入 slot resolution ledger，并在后续重跑时优先回放

### 3.5 Why This Solves The User's Real Problem

用户真正担心的不是“AI 识别时偶尔失手”，而是“稿件编辑完了却漏掉必备项目”。

槽位制把这个问题从“AI 猜得准不准”改成了“系统是否把缺口暴露出来”，这是更可靠的产品方向。

## 4. Metadata Hunter

### 4.1 Responsibility

元数据猎取器专门负责前置元数据和相关声明候选的发现，不跟普通正文规则混在一起。

### 4.2 Candidate Sources

必须扫描这些区域：

- 正文前置区
- 页眉
- 页脚
- 标题附近
- 摘要前后
- 正文末尾声明区

### 4.3 Candidate Output

每个候选至少输出：

- `candidate_id`
- `slot_key`
- `raw_text`
- `normalized_text`
- `source_zone`
- `source_locator`
- `semantic_role`
- `confidence`
- `recommended_action`

### 4.4 Candidate Consolidation Rules

元数据猎取器不能只吐原始候选，还必须在进入槽位判断前做合并与拆分：

- 相同 `normalized_text + semantic_role` 且来源不同的候选，应合并为一个候选并保留多条 evidence
- 带明确标签的候选优先级高于仅靠位置推断的候选
- 距离目标 anchor 更近的候选优先级更高
- 对“中图分类号 / 文献标志码”这类可能同处一行的内容，允许从一个 legacy candidate 拆成两个 slot candidate
- 若同一候选无法稳定归属一个 slot key，则不得自动落位，直接进入 `conflicted_candidates`

### 4.5 Runtime Behavior

- 候选唯一且高置信度时，可进入自动落位候选。
- 多个候选冲突时，进入人工核对。
- 低置信度时，不允许硬落位。
- 完全未找到时，槽位状态为 `missing`。

### 4.6 Header/Footer Support

当前仓库对页眉页脚还没有完整主链路支持，因此这次设计明确把 `header/footer metadata harvesting` 纳入必做范围，而不是继续假设所有信息都在正文前置区。

### 4.7 Legacy Front-Matter Migration Baseline

当前仓库里的 `front_matter` 识别仍主要来自正文开头段落的启发式分类。

在迁移期内：

- legacy `front_matter` block 继续作为 metadata hunter 的一个候选来源
- 但它不再是最终完成判定对象
- 最终判定对象统一转换为 slot resolution
- legacy `classification_line` 需在候选整合阶段拆分映射到 `classification_code` 和 `document_code`

## 5. Roles Of Journal Template, Knowledge, Rule Center, And Editing

### 5.1 Journal Template

期刊模板负责定义目标期刊的结构化目标和作用范围。

它回答：

- 这篇稿件要被编辑成什么样
- 哪些槽位必填
- 哪些位置锚点有效
- 哪些期刊层覆盖规则生效

### 5.2 Knowledge Library

知识库负责提供依据、说明、示例和参考材料。

它回答：

- 为什么要这样改
- 正确示例长什么样
- 某条期刊规则、表格规则、符号规则的依据是什么

### 5.3 Rule Center

规则中心负责把这些依据转成可执行动作。

它回答：

- 命中什么
- 允许怎样改
- 哪些情况只能 inspect
- 哪些情况要进入人工复核

### 5.4 Editing Runtime

编辑运行时负责执行：

- 目标模型解析
- 候选猎取
- 规则叠加解析
- 自动编辑决策
- 文档写回
- 改动账本输出

### 5.5 Concrete Runtime Contract

为了避免“职责说清了，但链路没打通”，运行时 contract 明确为：

`journal_template selection -> published journal_format_target_model -> structured knowledge selection -> layered rule resolution -> evidence snapshot -> editing decision -> editing ledger -> completion gate`

各阶段输出物必须明确：

- `journal_template`
  - 输出当前生效的 `journal_template_id`
- `journal_format_target_model`
  - 输出 `target_model_version_id`
  - 包含 target blocks、anchors、slot config、completion gate config
- `knowledge library`
  - 输出结构化 binding targets、linked knowledge ids、运行时可用的 evidence basis
- `rule center`
  - 输出按 `general -> medical -> journal` 叠加后的 resolved rules
- `editing runtime`
  - 输入文档结构快照、元数据候选、表格 rich snapshot、对象型证据
  - 输出编辑动作、slot resolution、object decision、edited asset、editing ledger
- `completion gate`
  - 读取 slot/object 结果
  - 决定模块是否真正可视为完成

### 5.6 UI And Verification Contract

这条链不应只存在于后端类型里，UI 上也必须真实可操作、可验证：

- 模板详情页必须能打开和查看 target model
- 规则中心必须能看到某条规则绑定到了哪一层、哪个 target block、哪些知识依据
- 知识库必须能查看结构化绑定，而不是只存一串扁平 template ids
- editing 结果页必须能看到：
  - 使用了哪个 `journal_template`
  - 使用了哪个 `target_model_version`
  - 使用了哪套 resolved rules
  - 哪些 slot 仍未解决

### 5.7 Shared Document-First Workspace

这次设计明确要求三大核心模块共享一套 document-first 工作台形态：

- 左栏为整篇文稿视图
- 右栏为问题、候选、规则命中、人工动作和账本摘要
- 支持从右栏点击后精确定位左栏对应位置
- 支持从左栏对象反查右栏对应问题卡片

因此，`screening / proofreading / editing` 不应再分别设计成完全不同的人工核对范式。

它们共享同一文稿视图底座，只是右栏动作类型不同。

### 5.8 LibreOffice Reuse Direction

按已确认方向，LibreOffice 不应在新的编辑方案里被绕开。

本设计明确要求：

- 如果校对模块分支已经把 LibreOffice 引入到人工查看整篇文稿的能力链路中，editing 不另起一套平行方案
- 三大核心模块的整篇文稿查看底座应优先复用同一条文档归一化 / 渲染 / 定位能力链
- 后续实施时应优先抽出 shared document viewer contract，而不是让 proofreading 和 editing 各做各的

这意味着：

- LibreOffice 在这里不只被当作“兼容依赖”的历史概念
- 它至少要被视为当前共享文稿查看链路设计中的既有方向
- 若后续实现要替换或弱化 LibreOffice，也必须先保证共享文稿视图、定位和人工核对能力不退化

## 6. Rule Layering Model

### 6.1 Final Layer Model

规则体系采用三层：

- `general`
- `medical`
- `journal`

### 6.2 Responsibilities

- `general` 处理通用格式规范
- `medical` 处理医学写法、统计表达、单位、医学声明等
- `journal` 处理某本期刊的最终格式要求

### 6.3 Precedence

冲突覆盖顺序固定为：

`journal > medical > general`

### 6.4 Package UX Direction

包的产品形态不应再被理解为“只能二选一的狭窄入口”。

正确方向是：

- 通用层可生效
- 医学层可生效
- 期刊层可额外覆盖

也就是说，包是作用域和层级的一部分，不是唯一入口。

## 7. Full-Fidelity Table Capture

### 7.1 Required Goal

表格采集目标必须升级为 `全量富样式无损`。

这里的“无损”不是营销词，而是指：对于受支持的输入路径，关键格式事实必须被完整采集，不允许关键字段缺失后再让 AI 脑补。

### 7.2 Required Table Facts

至少需要采集：

- 表号
- 表题
- 表注
- 表头层级
- stub 列
- 数据区
- 合并单元格拓扑
- 边框
- 水平对齐
- 垂直对齐
- 字体
- 字号
- 粗体
- 斜体
- 上标
- 下标
- 单元格局部富文本
- 单位标记
- 特殊符号
- 表内图片型符号对象

### 7.3 Supported Paths

第一阶段需要明确区分“受支持路径”和“仅降级支持路径”。

受支持路径至少包括：

- 运行时 `.docx` 主链路解析
- 明确受支持环境下的 Word / WPS exact-capture clipboard 路径

非受支持路径或不完整路径：

- 可以进入 inspect / manual review
- 不能作为 authoritative rich-style capture 来源

### 7.4 Capture Policy

- 受支持输入路径必须 fail closed。
- 缺字段时明确标记缺失项。
- 不允许“字段拿不到也照常生成精确规则”。

## 8. Full-Table Reconstruction Engine

### 8.1 Product Position

全量表格重建式自动排版是编辑模块核心能力，不是锦上添花能力。

### 8.2 Why Patch-Only Is Not Enough

只做局部 patch 无法稳定处理：

- 三线表切换
- 多层表头重排
- 表注重排
- 单位进表头
- 边框和对齐系统性变更
- 表内局部富文本恢复

### 8.3 Reconstruction Pipeline

推荐链路为：

`table rich snapshot -> normalized table object -> journal target table model -> reconstruction plan -> DOCX writeback`

### 8.4 Patch vs Rebuild

- 低风险文本替换可走 patch。
- 涉及样式体系、边框体系、表头结构、合并拓扑时，优先走 rebuild。
- 只要重建证据不完整，就降级人工复核。

## 9. Object-Type Symbols And Complex Embedded Content

编辑模块必须把以下对象单独处理：

- 图片代替的统计学符号
- 希腊字母截图
- 公式碎片截图
- 表格内部对象型符号

这类对象不能走普通文本替换。

正确路径是：

- 识别为对象型候选
- 提取可验证上下文
- 进入安全替换或人工确认

### 9.1 Minimal Evidence Contract

对象型内容至少需要这些证据：

- 图像或对象快照
- 邻近文本
- 来源位置
- 候选标准化符号
- 置信度

### 9.2 Auto-Replace Boundary

只有在以下条件同时满足时，才允许自动替换对象型内容：

- 候选符号唯一
- 邻近文本没有歧义
- 替换目标属于允许自动替换的最小安全集合
- 不涉及公式结构重组

否则一律进入人工确认。

## 10. Editing Decision Engine

### 10.1 Decision Classes

每个编辑动作最终进入 3 类之一：

- `auto_apply`
- `inspect_only`
- `manual_review_required`

### 10.2 Auto-Apply Conditions

至少同时满足：

- 目标对象识别明确
- 目标位置明确
- 命中规则明确
- 不改变内容含义
- 所需证据完整

### 10.3 Manual Review Conditions

以下情况默认进入人工：

- 多候选冲突
- 低置信度
- 表格 rich style 缺字段
- 对象型符号
- 会影响结构或样式体系的大动作

## 11. Human Review Workspace

人工核对工作台的目标不是把整篇稿件隐藏掉，而是让人工在“能看整篇”的前提下，只把注意力集中到问题和定位点上。

工作台至少要显示：

- 左侧整篇稿件视图
- 哪个槽位未解决
- 找到了哪些候选
- 为什么系统没自动落位
- 推荐处理动作
- 改前改后预览

并且必须支持：

- 右侧问题卡片点击后，左侧正文自动定位
- 左侧定位点点击后，右侧自动聚焦对应问题卡片
- 自动改动、待确认改动、证据对象、对象型风险使用不同视觉标记
- 在同一篇稿件内保持上下文，不把人工切碎到只看单点弹窗

对表格和对象型内容，还需要显示：

- 原始证据
- 结构理解结果
- 计划执行动作
- 降级原因

### 11.1 Module-Specific Right Pane

三大核心模块共享左侧整篇文稿视图，但右侧问题区有所区别：

- `screening`
  - 风险点
  - 推荐决定
  - 依据摘要
- `proofreading`
  - 问题项
  - 建议改法
  - 证据与规则命中
- `editing`
  - 待确认改动
  - 槽位缺口
  - 对象型高风险项
  - 改动账本和完成门禁

### 11.2 Full-Document Viewer Requirement

人工工作台的文稿视图必须满足：

- 能看完整文章，而不是只看片段
- 能跳转到问题位置
- 能在问题位置附近保留足够上下文
- 能在表格、前置元数据、正文、声明区、参考文献区之间来回导航

如果当前 shared document viewer 能力依赖 LibreOffice 相关链路，则实施应复用该方向，而不是在 editing 单独发明新的局部预览方案。

## 12. Traceability, Rollback, And Idempotence

### 12.1 Editing Ledger

每次运行都要输出可追溯账本，至少记录：

- 命中的规则
- 引用的知识
- 目标槽位或对象
- 改前值
- 改后值
- 证据来源
- 执行动作
- 降级原因

### 12.2 Rollback

- 单篇稿件支持回滚
- 规则升级后支持重跑
- 人工裁决后支持再次收敛

### 12.3 Idempotence

同一篇稿件在相同目标模型和相同规则版本下，多次运行应稳定收敛到同一结果。

### 12.4 Manual Resolution Persistence

人工裁决不能只停留在页面状态里。

系统必须持久化：

- slot manual resolutions
- object manual decisions
- completion gate override reasons

并在同一稿件后续重跑时优先回放，保证幂等。

## 13. Completion Gate Integration With Current Mainline

当前仓库里的 `completed` 更接近“作业生命周期完成”，而不是“格式治理完成”。

因此 editing 需要在现有 mainline 之上增加一个后置门禁：

- `job lifecycle completed`
- `editing completion gate passed`

只有两者同时成立，editing 模块才可被视为真正完成。

### 13.1 Current-Reality Alignment

现有主链路已经有：

- job/batch lifecycle
- readiness summary
- settlement / handoff status

本设计不推翻它们，而是新增一个 `editing_completion_gate_summary` 类对象接入到 readiness/settlement。

### 13.2 Gate Verdicts

completion gate 至少区分：

- `passed`
- `needs_manual_resolution`
- `blocked_by_missing_required_slots`
- `blocked_by_high_risk_objects`

### 13.3 Mainline Mapping

- 当作业完成且 gate = `passed` 时，editing 才进入真正 completed
- 当作业完成但 gate 不是 `passed` 时：
  - edited asset 可以生成
  - 但 readiness / settlement 不得把 editing 视为已完成
  - handoff 应保持 blocked 或 action required

## 14. Migration And Compatibility

### 14.1 Front-Matter Migration

当前基于 `front_matter` 的启发式识别不立即删除，而是分三步迁移：

1. 继续保留为候选来源
2. 在 metadata hunter 中转成 slot candidates
3. 待 slot-based runtime 稳定后，弱化其作为最终规则命中对象的职责

### 14.2 Template Upgrade Path

现有薄模板表单不应一次性塞入全部 target model 字段。

迁移路径为：

- 保留现有模板台账和基础表单
- 在模板详情中新增“格式目标模型”子入口
- 新 target model 以 versioned child object 方式治理
- 逐步减少对 `journalScope/notes` 这种自由文本的依赖

### 14.3 Knowledge Binding Compatibility

迁移期内允许 structured bindings 与 legacy flattened `template_bindings` 并存。

运行时优先级应为：

`structured binding_targets > legacy template_bindings`

并在审计面板中显式提示某条知识仍处于 legacy binding 模式。

### 14.4 Existing Rule Compatibility

已有 `front_matter / author_line / statement` 等规则在迁移期内继续可用，但原则上：

- 旧规则仍可 inspect
- 新的自动落位动作优先基于 slot/object model
- 旧规则包与 reviewed cases 需要增加迁移脚本或人工复核批次，逐步补齐 slot target 信息

## 15. Acceptance Criteria

验收至少包括：

- 目标期刊的前置元数据块可配置、可排序、可设必填
- 目标模型明确落在 `journal_format_target_model` 这类 versioned child object 上，而不是继续塞进薄模板表单
- 作者简介、通信作者简介、基金、中图分类号、文献标志码可以进入槽位体系
- 系统能对正文前置区、页眉、页脚和末尾声明区做元数据候选猎取
- 必填槽位未解决时，系统不会把稿件标记为“编辑完成”
- completion gate 已接入现有 readiness / settlement 主链路
- 通用层、医学层、期刊层规则能稳定叠加，优先级可解释
- 规则、知识、模板、editing 之间的版本和输入输出可在 UI 中追踪
- 表格关键 rich style 字段具备完整采集 contract
- 表格高风险编辑支持 reconstruction 路线，而非只剩 patch
- 图片型符号不会被普通文本替换误改
- legacy `front_matter` 和 legacy bindings 有清晰迁移路径
- 三大核心模块都采用 `左正文 / 右问题` 的整篇文稿工作台形态
- 右侧问题项可以稳定定位到左侧文稿中的对应位置
- editing 方案复用与 proofreading 一致的共享文稿查看底座，而不是另起一套孤立预览
- 编辑结果可追溯、可回滚、可重跑

## 16. Phase Recommendation

### Phase 1: Foundation

- 期刊格式目标模型
- 前置元数据槽位系统
- 元数据猎取器
- 完成判定改造
- 三层规则解析与解释
- target model child-object 挂载
- completion gate 接入 readiness / settlement
- legacy front_matter 到 slot candidate 的迁移桥接
- shared document-first viewer contract
- `左正文 / 右问题` 工作台底座
- proofreading / editing 共用的定位与标注机制

### Phase 2: Table Hardening

- 表格 full-fidelity contract
- richer DOCX capture
- table reconstruction planner
- reconstruction writeback

### Phase 3: High-Risk Object Governance

- 图片符号和对象型内容通道
- 更强的人工核对工作台
- 批量重跑与回滚

## 17. What This Design Explicitly Does Not Pretend

这份设计不把当前系统包装成已经完成的全自动编辑模块。

相反，它明确承认：

- 当前仓库已经有编辑地基
- 但还没有达到“真正期刊格式编辑器”的标准
- 需要先把目标模型、槽位治理、元数据猎取、表格无损采集和表格重建这几条主骨架补齐

只有这些骨架补齐后，`editing` 才能从“安全格式操作链路”真正升级成“可交付的期刊格式编辑模块”。
