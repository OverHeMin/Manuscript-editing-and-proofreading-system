# Manuscript Quality 治理工作台维护说明

这份说明面向后台维护人员，解释 Manuscript Quality V2 在系统里到底怎么维护、哪些能在后台改、哪些仍然必须走代码变更，以及它和知识库、规则库、Harness 的衔接方式。

## 1. 一句话原则

当前架构遵循：

`analyzer engine code + governed quality assets + governed runtime binding + Harness activation and rollback`

也就是说：

- analyzer 引擎逻辑仍由代码负责。
- 可配置的质量资产由后台治理。
- Runtime Binding 决定某个 scope 运行时实际加载哪些质量包版本。
- Harness 负责预览、比较、激活和回滚。

## 2. 这套工作台负责什么

当前后台可直接治理的 Manuscript Quality 资产有两类：

- `general_style_package`
- `medical_analyzer_package`

它们解决的是“可配置资产维护”问题，不是“任意编写新解析器”问题。

当前这套工作台负责：

- 创建质量包草稿版本
- 发布质量包版本
- 在 runtime binding 中选择已发布质量包
- 在 Harness 中预览候选质量包引用
- 候选 run 验证
- scope 级激活和回滚

## 3. 这套工作台不负责什么

以下内容当前仍然不是后台自由编辑对象：

- 知识库条目本身
- 编辑规则库条目本身
- 任意新增 Python 解析器
- 任意新增 TypeScript 调度逻辑
- 任意修改表格解析、数值复算、方向判断等核心引擎算法
- 自动把质量发现回写到知识库或规则库

如果要新增全新的解析分支、表格语法、公式复算器或复杂判断器，仍需走代码变更。

## 4. 通用模块当前怎么拆层

`general_proofreading` 当前分成两层：

第一层是内置基础引擎，主要覆盖 V1 的 6 类问题：

- 标点与成对符号
- 全半角与中英文混排
- 错别字、重字、漏字候选
- 前后一致性
- 敏感词与合规
- 语句不顺与逻辑疑点提示

这一层今天仍然以 worker 代码和内置词表为主，不是完全后台自由配置。

第二层是 V2 新增的受治理风格包：

- `section_expectations`
- `tone_markers`
- `posture_checks`
- `genre_wording_suspicions`
- `issue_policy`

这一层可以通过后台维护，适合做：

- 期刊风格和医学研究写作姿态调整
- 强断言和谨慎措辞词表维护
- 摘要/结果/结论写法要求维护
- 某类风格问题的严重度和动作梯度调整

## 5. 医学模块当前怎么拆层

`medical_specialized` 当前也分成两层。

第一层是内置医学分析引擎，负责高价值、强结构的检测，例如：

- 计算与解析错误
- 医学逻辑错误
- 常识与量级错误
- 表文不一致错误
- 术语漂移
- 统计表达疑点
- 隐私与伦理提示

这部分里，真正的解析、抽取、复算、比对逻辑仍由代码负责。

第二层是 V2 受治理医学分析包，当前后台可维护的核心字段包括：

- `indicator_dictionary`
- `unit_ranges`
- `comparison_templates`
- `count_constraints`
- `issue_policy`
- `analyzer_toggles`

这一层适合做：

- 新增指标别名
- 维护默认单位
- 维护正常量级范围
- 维护治疗前后和组间对比模板
- 调整某类 issue 的严重度和动作
- 临时关闭某个 analyzer

## 6. 后台入口在哪里

统一入口在 `Admin Governance`。

常用的三个区域分别是：

- `Quality Packages`
  用于创建、查看、发布 `general_style_package` 和 `medical_analyzer_package`
- `Runtime Bindings`
  用于把已发布质量包版本绑定到某个 scope 的运行环境
- `Harness Control Plane`
  用于预览候选环境、发起候选 run、激活、回滚

## 7. 怎么维护通用风格包

在 `Quality Packages` 区域：

1. 选择 `Package Kind = General Style Package`
2. 输入包名
3. 用结构化编辑器维护以下内容
4. 点击 `Create Draft Package Version`
5. 确认后点击 `Publish`

结构化编辑器当前主要提供以下字段：

- `Abstract Required Labels`
- `Strong Claims`
- `Cautious Claims`
- `Abstract Posture Checks`
- `Results Posture Checks`
- `Conclusion Posture Checks`
- `Genre Wording Suspicions`
- 各类 `issue_policy` 的 `severity` 和 `action`

适合后台直接做的变更：

- 新增一个过强措辞词
- 调整某类风格问题从 `suggest_fix` 提升为 `manual_review`
- 补充某类摘要结构标签要求

不适合后台直接做的变更：

- 新增一整套标点解析器
- 改写基础逻辑疑点抽取算法
- 新增复杂错别字模型

## 8. 怎么维护医学分析包

在 `Quality Packages` 区域：

1. 选择 `Package Kind = Medical Analyzer Package`
2. 输入包名
3. 用结构化编辑器维护 manifest
4. 点击 `Create Draft Package Version`
5. 确认后点击 `Publish`

当前适合后台维护的字段有：

- `Indicator Dictionary`
- `Unit Ranges`
- `Pre/Post Templates`
- `Group Comparison Templates`
- `Percent Max`
- `Unit Range Conflict` 的 `severity/action`
- `Significance Mismatch` 的 `severity/action`
- `Table Text Direction Conflict` 的 `severity/action`
- `Numeric Consistency`
- `Medical Logic`
- `Table Text Consistency`

适合后台直接做的变更：

- 给指标补一个别名
- 给指标补一个默认单位
- 修正量级范围
- 调整组间比较模板
- 临时关闭 `table_text_consistency`

不适合后台直接做的变更：

- 新增新的表格 OCR 解析器
- 改写均值标准差容错解析算法
- 新增新的 P 值复算器
- 改写复杂跨段落逻辑匹配器

## 9. 结构化编辑器和 Advanced JSON 怎么选

优先建议使用结构化编辑器。

适合用结构化编辑器的情况：

- 日常维护词表、模板、阈值、动作梯度
- 低风险运营调整
- 给同事交接后台维护

适合用 `Advanced JSON` 的情况：

- 结构化编辑器暂时没覆盖某个 manifest 字段
- 需要批量粘贴已有 JSON 片段
- 需要精确核对最终写入的 manifest

原则上先用结构化编辑器，再把 `Advanced JSON` 当校对和补充入口，而不是反过来。

## 10. Runtime Binding 在这里扮演什么角色

质量包发布后，并不会自动生效。

真正决定某个 scope 在运行时加载哪些质量包的，是 `Runtime Binding` 里的：

- `quality_package_version_ids`

所以“改了质量包但线上没变化”，最常见的原因不是包没改成功，而是：

- 新版本还没发布
- runtime binding 还没引用它
- Harness 还没把候选 binding 激活到 live scope

另外，runtime binding 只接受已发布质量包版本。后台里看不到某个新包，先检查它是不是还停留在 `draft`。

## 11. Harness 和质量包的配合流程

推荐的标准流程是：

1. 在 `Quality Packages` 中创建新草稿版本。
2. 发布新版本。
3. 在 `Runtime Bindings` 中创建或准备一个候选 binding，并引用新版本。
4. 在 `Harness Control Plane` 中预览候选环境。
5. 在 `Quality Lab` 发起候选 run。
6. 验证证据后，在 `Activation Gate` 激活。
7. 观察新任务是否解析到新的质量包引用。
8. 如有问题，直接用 Harness 回滚。

这条链路里各层职责非常清楚：

- 质量包负责“内容”
- runtime binding 负责“装配”
- Harness 负责“切换和回滚”

## 12. 当前最重要的维护边界

为了不影响现有系统主流程，维护时要始终守住以下边界：

- 不把质量包写进知识库
- 不把质量包写进规则库
- 不让 Harness 直接编辑 analyzer 逻辑
- 不在生产后台写自由执行代码
- 不绕过 runtime binding 直接改 live 环境

如果需要改的是“规则内容、词表、模板、阈值、toggle”，优先走后台治理。

如果需要改的是“解析算法、表格结构识别、数值复算、复杂逻辑匹配”，优先走代码变更。

## 13. 后台日常维护建议

建议把后台维护分成两类。

第一类是运营型维护，适合直接在后台做：

- 新增敏感表达
- 调整问题严重度
- 修正指标别名
- 修正单位范围
- 调整比较模板
- 临时关闭某个分析开关

第二类是工程型维护，适合走代码：

- 新增解析器
- 新增复杂复算器
- 新增新表格语法支持
- 修改基础 issue 抽取算法
- 修改 fallback 行为

## 14. 变更建议流程

为了可追踪、可回滚，建议每次都按下面做：

1. 不直接修改旧 published 版本。
2. 总是新建草稿版本。
3. 在草稿里完成调整。
4. 发布新版本。
5. 通过候选 binding 和 Harness 验证。
6. 激活后观察一段时间。
7. 如有风险，用 Harness 回滚到上一版。

这样做的好处是：

- 版本清楚
- 边界清楚
- 证据清楚
- 回滚容易

## 15. 常见问题排查

### 15.1 包已经改了，为什么结果没变

优先排查：

- 包是不是还没 `published`
- 候选 runtime binding 有没有引用新包
- Harness 有没有真正激活候选环境
- 新任务是不是在旧 scope 上跑的

### 15.2 为什么 Runtime Binding 里看不到某个包

优先排查：

- 包是否已发布
- 包类型是否正确
- 包的 target scope 是否兼容

### 15.3 readiness 报错怎么办

重点关注以下 readiness code：

- `quality_package_missing`
- `quality_package_not_published`
- `quality_package_scope_mismatch`

可直接检查：

- `GET /api/v1/runtime-bindings/:bindingId/readiness`
- `GET /api/v1/runtime-bindings/by-scope/:module/:manuscriptType/:templateFamilyId/active-readiness`

## 16. 当前这套界面是否足够方便

对“包资产维护”来说，已经到了可用状态。

现在比较方便的是：

- 创建和发布版本
- 结构化编辑 manifest
- 把质量包接入 runtime binding
- 用 Harness 做候选验证和回滚

现在还不属于“全图形化可维护”的是：

- 深层 parser 逻辑
- 高复杂度表格算法
- 新增 analyzer 类型

所以它的真实状态应该理解为：

- 运营维护已经后台化
- 核心引擎仍然工程化

这正是当前版本的有意边界，而不是漏做。

## 17. 代码与接口落点

如果后续要继续增强这套工作台，当前主要落点如下。

Web：

- `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- `apps/web/src/features/admin-governance/general-style-package-editor.tsx`
- `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
- `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- `apps/web/src/features/admin-governance/harness-environment-editor.tsx`

API：

- `apps/api/src/modules/manuscript-quality-packages/`
- `apps/api/src/modules/runtime-bindings/`
- `apps/api/src/modules/harness-control-plane/`

Worker：

- `apps/worker-py/src/manuscript_quality/general_proofreading.py`
- `apps/worker-py/src/manuscript_quality/general_style_package.py`
- `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- `apps/worker-py/src/manuscript_quality/medical_asset_runtime.py`

## 18. 最后记住一件事

质量包现在已经能像“受治理资产”一样在后台维护，但它不是新的知识库，也不是新的规则库，更不是让后台直接写解析器。

它是现有系统里专门承接“通用校对资产”和“医学分析资产”的一层受治理配置层。
