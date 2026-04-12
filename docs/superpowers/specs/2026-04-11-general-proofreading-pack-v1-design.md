# 通用校对包 V1 设计稿

**日期：** 2026-04-11  
**状态：** Draft for review  
**适用范围：** 所有类型稿件的基础校对层  
**定位：** 位于行业知识库、行业规则库之前的通用文本质量与合规兜底层

---

## 1. 目标

建设一个适用于所有类型稿件的通用校对包 V1，用来覆盖最常见、最稳定、最值得自动化处理的文本问题。

它不负责替作者重写全文，也不负责专业领域最终裁决，而是承担以下职责：

- 统一文本预处理与结构切分
- 发现低风险机械错误
- 发现中风险语言问题并给出建议
- 发现高风险逻辑、合规、一致性疑点并转人工复核
- 为后续医学专用模块、知识库、规则库提供干净且可解释的输入

---

## 2. 设计边界

### 2.1 本模块要做的

- 标点与版式机械错误处理
- 全角/半角、中英文混排、空格、成对符号规范化
- 错别字、重字、漏字等通用字词错误候选发现
- 语句不顺、搭配生硬、指代不清等语言问题提示
- 前后一致性检查
- 通用敏感词与基础合规检测
- 数字、时间、编号、交叉引用的基础一致性检查
- 段落衔接与篇章逻辑疑点提示

### 2.2 本模块不做的

- 专业医学事实判断
- 统计学结论裁决
- 表格语义深度核验
- 图像、图表、参考文献数据库校验
- 高风险内容自动重写
- 文言文、双语、法律等专门文体深度适配

### 2.3 与其他模块的关系

- 通用校对包：所有稿件先过的基础层
- 文体包：学术稿、政务稿、宣传稿等风格差异层
- 行业包：医学、法务等专业判断层

V1 只落通用层，不把文体层和行业层混进来。

---

## 3. 总体架构

通用校对包 V1 采用“预处理 -> 多模块检查 -> 风险分流 -> 统一输出”的架构。

执行顺序建议如下：

1. 文本预处理模块
2. 标点与版式模块
3. 字词与用字模块
4. 语句通顺模块
5. 一致性核验模块
6. 篇章衔接与逻辑疑点模块
7. 合规与敏感词模块
8. 证据与分流模块

这个顺序的原则是：

- 先处理低风险、确定性高的问题
- 再处理需要上下文的语言问题
- 最后处理高风险、只适合提示的问题

---

## 4. 八个子模块

### 4.1 文本预处理模块

**职责**

- 统一输入文本
- 生成可复用的段落、句子、标题、列表、编号结构
- 为后续模块提供稳定坐标和切片

**输入**

- 原始文本
- 可选：文档段落信息、样式信息、标题信息

**处理**

- 清洗特殊空格、零宽字符、非法换行
- 全角/半角归一
- 中英文标点标准化
- 句子切分、段落切分
- 标题、列表、编号块识别
- 数字与中文数字标准化表示

**输出**

- normalized_text
- paragraph_blocks
- sentence_blocks
- heading_blocks
- list_blocks
- token_map

### 4.2 标点与版式模块

**职责**

- 处理最适合自动化的低风险机械问题

**问题类型**

- 漏写、重写、连写标点
- 句末标点不当
- 成对括号/引号/书名号不闭合
- 中文与英文之间空格异常
- 全角半角符号混用
- 标题末尾句号、逗号等异常

**建议动作**

- 低风险：`auto_fix`
- 不确定场景：`suggest_fix`

### 4.3 字词与用字模块

**职责**

- 发现通用字词层面问题

**问题类型**

- 错别字
- 漏字、重字
- 近形字、同音误写
- 同一术语多种写法
- 缩写首次未定义
- 同一对象前后命名漂移

**建议动作**

- 明显误写：`suggest_fix`
- 涉及专业意义变化：`manual_review`

### 4.4 语句通顺模块

**职责**

- 发现句子层面的语言问题

**问题类型**

- 语句不顺
- 搭配生硬
- 成分残缺
- 句式杂糅
- 修饰错位
- 指代不清
- 冗余表达

**建议动作**

- 默认 `suggest_fix`
- 不直接自动替换正文

### 4.5 一致性核验模块

**职责**

- 做跨句、跨段、跨全文的一致性检查

**问题类型**

- 同一名词写法不一致
- 缩略语前后不统一
- 数字前后不一致
- 时间顺序异常
- 编号跳号或重复
- 章节引用、图表引用、参考文献引用不一致

**建议动作**

- 确定性编号问题：可 `auto_fix`
- 其他：`manual_review` 或 `suggest_fix`

### 4.6 篇章衔接与逻辑疑点模块

**职责**

- 做篇章层疑点检测，不直接裁决内容对错

**问题类型**

- 前后观点跳跃
- 因果关系不成立
- 转折关系不成立
- 摘要与结论不一致
- 论证链断裂
- 结论强度突然升级

**建议动作**

- 一律 `manual_review`
- 输出疑点说明与证据片段

### 4.7 合规与敏感词模块

**职责**

- 覆盖所有稿件都可能遇到的基础合规问题

**问题类型**

- 政治敏感词
- 绝对化、夸张化、宣传化表述
- 歧视性或攻击性表达
- 基础隐私信息泄露
- 不当营销口径

**建议动作**

- 采用分级：
  - `block`
  - `manual_review`
  - `suggest_fix`

### 4.8 证据与分流模块

**职责**

- 汇总所有问题
- 按风险和可确定性统一分流

**统一动作层级**

- `auto_fix`
- `suggest_fix`
- `manual_review`
- `block`

**统一输出字段**

- issue_id
- issue_type
- severity
- action
- confidence
- span / paragraph_index / sentence_index
- source
- evidence
- suggestion
- explanation

---

## 5. V1 首批问题清单

为了避免范围失控，V1 首批只要求稳定覆盖以下六类：

1. 标点与成对符号
2. 全角/半角与中英文混排
3. 错别字、重字、漏字候选
4. 前后一致性
5. 合规与敏感词
6. 语句不顺与逻辑疑点提示

这六类已经能覆盖大部分纯文字稿的高频问题，并且和现有仓库的治理思路兼容。

---

## 6. 自动修、建议修、人工复核边界

### 6.1 可自动修

- 成对标点闭合
- 多余空格
- 全角/半角规范
- 明显连续标点
- 极低风险编号问题

### 6.2 建议修

- 错别字候选
- 语句不顺
- 搭配不当
- 指代不清
- 冗余重复

### 6.3 必须人工复核

- 逻辑跳跃
- 结论异常增强
- 敏感词高危命中
- 数字前后冲突
- 隐私信息疑似泄露
- 任何可能改变原意的改写

---

## 7. 数据与存储建议

V1 建议把通用校对包产物统一存为结构化问题清单，而不是只存一段大模型文本。

建议实体：

- `GeneralProofIssue`
- `GeneralProofRun`
- `GeneralProofEvidence`
- `GeneralProofRule`
- `SensitiveLexiconEntry`

建议问题字段：

- `module_scope = general_proofreading`
- `issue_type`
- `category`
- `severity`
- `action`
- `confidence`
- `source_kind`
- `source_id`
- `text_excerpt`
- `normalized_excerpt`
- `suggested_replacement`
- `explanation`
- `status`

---

## 8. 与现有仓库的衔接建议

当前仓库已经有以下适合承接的能力：

- 文档结构解析
- 规则集治理
- Prompt/Skill Registry
- Runtime Binding
- Execution Snapshot
- Agent Execution Log
- Knowledge 审核流

因此通用校对包 V1 建议不要另起一套平行体系，而是：

- 作为 `proofreading` 前置或子能力接入
- 复用当前的规则治理和执行治理能力
- 把“通用校对规则”与“医学专用规则”分开存储
- 让 `proofreading` 输出中增加通用问题清单与通用 evidence

---

## 9. 不建议在 V1 里一起做的内容

- 文言文专门支持
- 双语或英文学术深度校对
- 行业专属裁决
- 图表/表格语义核验
- 深度统计学核验
- 大规模自动润色改写

这些应作为后续 `文体包` 或 `行业包` 单独推进。

---

## 10. 成功标准

V1 成功标准如下：

- 纯文字稿不依赖医学知识库也能稳定发现高频基础问题
- 低风险机械错误可自动修正
- 中高风险问题不被大模型直接改写，而是进入建议或人工复核
- 所有问题都有结构化输出与证据片段
- 能与现有审稿/编辑/校对治理链路兼容
- 为后续医学专用模块预留清晰边界

---

## 11. 后续扩展方向

V1 之后可以继续扩展为：

- 通用校对包 V2：文体包
- 医学专用校对包 V1：术语、统计、伦理、结论-证据对齐
- 期刊模板包：栏目、版式、参考文献制式
- 数据核验模块：数字、比例、样本量、交叉一致性

---

## 12. 一句话定义

通用校对包 V1 不是一个“万能改稿 AI”，而是一层基础文本质量控制系统：先抓机械错、语言错、一致性错、合规错和逻辑疑点，再把问题按风险稳妥分流。
## Implementation Status (2026-04-12)

- Backend V1 baseline is implemented in the current repository state.
- Shared contracts, execution snapshot quality summaries, worker normalization, and deterministic general analyzers are landed.
- API orchestration now feeds advisory general-proofreading findings into `proofreading`, `editing`, and `screening` without changing governance authority.
- Third-party adapter seams exist behind explicit enablement and remain disabled by default; when enabled in the future, they are normalized to advisory-only actions.
- This implementation still excludes medical-specialized analyzers, automatic knowledge/rule write-back, and workbench UI expansion.

### Verification

- `python -m pytest ./apps/worker-py/tests/manuscript_quality/test_text_normalization.py ./apps/worker-py/tests/manuscript_quality/test_general_proofreading.py ./apps/worker-py/tests/manuscript_quality/test_adapter_registry.py -q`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts`
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`
