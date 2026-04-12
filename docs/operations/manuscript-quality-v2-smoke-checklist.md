# Manuscript Quality V2 验收清单

这份清单用于验收 `general_proofreading` V2 风格包治理和 `medical_specialized` V2 医学分析包治理是否已经真正接入现有系统，而不是停留在“代码有了、流程没接上”的状态。

本清单重点验证四件事：

- 质量包可以在后台创建、发布、版本化维护。
- Runtime Binding 可以绑定已发布的质量包版本。
- Harness 可以把质量包随环境一起预览、候选验证、激活和回滚。
- 新执行任务会把已解析的质量包引用和质量摘要写入运行证据，而不会改写知识库、规则库或 analyzer 引擎边界。

## 1. 验收边界

本清单验证的是“受治理的质量包接入是否成立”，不是以下事项：

- 不验证知识库条目是否正确。
- 不验证编辑规则库条目是否正确。
- 不把 Harness 当成 analyzer 逻辑编辑器。
- 不要求后台可以任意编写新的 Python 或 TypeScript 解析器逻辑。

## 2. 前置条件

- API 与 Web workbench 已启动，并使用持久化 runtime。
- 使用 `admin` 账号。
- 目标 scope 已存在可用的：
  - execution profile
  - runtime binding
  - routing version
  - retrieval preset
  - manual review policy
- 为同一 Harness scope 预先准备一个候选 runtime binding，或在本次验收中创建一个候选 runtime binding。
- 至少准备一组可验证的已发布质量包：
  - `general_style_package`
  - `medical_analyzer_package`
- 目标模块已有可用 evaluation suite，供 Harness `Quality Lab` 发起候选 run。

建议把候选 runtime binding 与当前 active runtime binding 的差异尽量收敛到“质量包版本不同”，这样更容易看清是不是质量治理真正生效。

## 3. 第一步：确认后台治理入口可见

打开 `Admin Governance`，确认页面中至少能看到以下区域：

- `Quality Packages`
- `Runtime Bindings`
- `Harness Control Plane`

通过标准：

- 后台能直接看到质量包总数。
- 后台能创建质量包草稿版本。
- 后台能在 runtime binding 中选择质量包引用。
- Harness 页面能显示 `Active Quality Packages` 和 `Candidate Quality Packages`。

## 4. 第二步：创建并发布通用风格包版本

在 `Admin Governance` 的 `Quality Packages` 区域：

1. 选择 `Package Kind = General Style Package`。
2. 填写包名，例如同一条产品线的固定风格包名。
3. 使用结构化编辑器修改至少一项字段，例如：
   - `Abstract Required Labels`
   - `Strong Claims`
   - `Cautious Claims`
   - `Abstract/Results/Conclusion Posture Checks`
   - `Genre Wording Suspicions`
   - 某条 `issue_policy` 的 `severity` 或 `action`
4. 点击 `Create Draft Package Version`。
5. 对新建版本点击 `Publish`。

通过标准：

- 新版本以 `draft -> published` 方式发布，而不是直接覆盖旧版本。
- 同名同 scope 的旧发布版本会被归档，不会出现多个 live published 冲突版本。
- 结构化编辑器和 `Advanced JSON` 能保持一致。

## 5. 第三步：创建并发布医学分析包版本

在同一页面创建 `Package Kind = Medical Analyzer Package` 的新版本，并至少修改一项医学治理字段，例如：

- `Indicator Dictionary`
- `Unit Ranges`
- `Pre/Post Templates`
- `Group Comparison Templates`
- `Percent Max`
- 某条 `issue_policy` 的 `severity` 或 `action`
- `Numeric Consistency` / `Medical Logic` / `Table Text Consistency` toggle

然后同样执行：

1. `Create Draft Package Version`
2. `Publish`

通过标准：

- 医学分析包也采用草稿版和发布版的版本流转。
- 发布后可以在后台看到清晰的版本号和 manifest 预览。
- 不需要改 worker 代码，就可以完成词典、量纲、模板、阈值、开关类资产的维护。

## 6. 第四步：把已发布质量包绑定进候选 Runtime Binding

进入 `Admin Governance` 的 `Runtime Bindings` 区域，为目标 scope 创建或准备一个候选 binding。

在候选 binding 中选择：

- 目标 runtime
- sandbox
- agent profile
- tool permission policy
- prompt template
- skill packages
- `Quality Packages`

重点确认 `Quality Packages` 选择器中已经出现刚刚发布的版本。

通过标准：

- runtime binding 中只能绑定已发布的质量包版本。
- 保存后的 binding 含有明确的 `quality_package_version_ids`。
- 当前 active binding 不会因为创建候选 binding 而被直接改写。

如果这里看不到新包，先检查：

- 该版本是否已经 `published`
- 包的 scope 是否与 analyzer 兼容
- 是否选错了包类型

## 7. 第五步：在 Harness 中预览候选环境

进入 `Harness Control Plane`，定位到目标 scope。

在 `Environment Editor` 中：

1. 选中候选 execution profile、runtime binding、routing version、retrieval preset、manual review policy。
2. 点击 `Preview Candidate Environment`。
3. 记录以下卡片内容：
   - `Active Environment`
   - `Candidate Preview`
   - `Diff`
   - `Active Quality Packages`
   - `Candidate Quality Packages`

通过标准：

- `Diff` 至少能显示 `runtime_binding` 变化。
- `Candidate Quality Packages` 能显示刚刚绑定的质量包版本。
- 页面只做预览，不会直接改 live 环境。

## 8. 第六步：发起候选质量 run

在 `Quality Lab` 中：

1. 选择同 scope 的 evaluation suite。
2. 点击 `Launch Candidate Run`。
3. 记录 run ID。

通过标准：

- run 以候选环境发起，而不是继续指向 active 环境。
- 候选 run 的生成不会直接改变生产绑定。
- 这一步只产生验证证据，不产生激活副作用。

## 9. 第七步：激活候选环境

在 `Activation Gate` 中：

1. 填写 operator reason。
2. 点击 `Activate Candidate Environment`。
3. 等待 scope 重新加载。

通过标准：

- `Active Environment` 切换到候选 binding。
- `Active Quality Packages` 更新为候选质量包版本。
- 本次变更只影响当前 scope。

## 10. 第八步：证明新任务真的用了新质量包

激活后，立刻为同 scope 发起一条全新的 `screening`、`editing` 或 `proofreading` 任务。

优先记录以下证据：

- 模块返回 payload 中的质量结果
- `execution snapshot` 中的 `quality_packages`
- `execution snapshot` 中的 `quality_findings_summary`
- 如需直接查 API，可查看：
  - `GET /api/v1/execution-tracking/snapshots/:snapshotId`

通过标准：

- 新任务解析到的 `quality_packages` 包含刚激活的质量包版本。
- 如文稿触发了问题，`quality_findings_summary` 会写出 issue 数量和最高 action。
- 未修改知识库、规则库配置的前提下，仅通过质量包切换即可改变当前质量分析行为。

说明：

- 当前后台更适合验证“解析到了哪些质量包引用”和“摘要是否落证据”，不要求每个具体 issue 都在同一个界面完整展开。
- 如果要做更细粒度比对，建议使用一份已知会触发特定 issue 的固定样稿做候选 run。

## 11. 第九步：执行回滚并证明恢复

仍在 `Activation Gate` 中：

1. 点击 `Roll Back Scope`。
2. 等待 scope 重新加载。
3. 再发起一条新的同 scope 任务。

通过标准：

- `Active Environment` 回到上一版。
- `Active Quality Packages` 回到回滚前的质量包引用。
- 新任务解析到的 `quality_packages` 恢复为旧版本。

## 12. 第十步：证明后台可维护，不需要改代码

为了证明这套治理工作台是“可运维”的，而不是“只能演示一次”，再做一次小改动：

1. 新建一个质量包草稿版本。
2. 只修改 manifest 中一项低风险配置，例如：
   - 调整某条 issue 的 `severity`
   - 新增一个指标别名
   - 调整一个单位范围
   - 打开或关闭一个 analyzer toggle
3. 发布新版本。
4. 将其绑定到新的候选 binding。
5. 走一轮 Harness preview。

通过标准：

- 可通过后台完成受控配置变更。
- 不需要直接修改 worker 源码。
- 变更路径仍是 `draft -> publish -> bind -> preview -> activate/rollback`。

## 13. 建议记录的验收证据

每次验收至少记录以下信息：

- 日期、环境、操作人
- 目标 scope
- 激活前 active runtime binding
- 候选 runtime binding
- 激活前 active quality package refs
- 候选 quality package refs
- 候选 run ID
- 激活后新任务的 snapshot ID 或结果证据
- 回滚后新任务的 snapshot ID 或结果证据
- 是否出现 scope 串改、未发布包误绑定、包引用不生效等问题

## 14. 常见失败信号

如果验收失败，优先排查以下问题：

- 包不存在：`quality_package_missing`
- 包未发布：`quality_package_not_published`
- 包 scope 不兼容：`quality_package_scope_mismatch`
- 改了包但 live 结果没变：通常是 runtime binding 没切换，或 Harness 还没激活

如需直接做 readiness 排查，可使用：

- `GET /api/v1/runtime-bindings/:bindingId/readiness`
- `GET /api/v1/runtime-bindings/by-scope/:module/:manuscriptType/:templateFamilyId/active-readiness`

## 15. 验收完成定义

只有同时满足以下条件，才算质量治理 V2 真正接上系统：

- 质量包可在后台创建、发布、版本化维护。
- runtime binding 能引用已发布质量包。
- Harness 能显示并切换质量包引用。
- 新执行任务能落下质量包引用与质量摘要证据。
- 回滚后下一条新任务能恢复到旧环境。
