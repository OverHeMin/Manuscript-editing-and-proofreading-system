# Harness 控制台最终实施方案

日期：2026-04-30

状态：已在 `codex/harness-control-redesign` 上按远端新 `main` 重放并执行第一批可落地改动。本文是 rebase 后的最终实施方案和当前交付边界。

## 目标

把原来复杂、参数暴露过多的 Harness 控制台改成一个紧凑但不拥挤的全宽工作台。用户进入 `Harness 控制` 后，应能按任务模式完成：

- `A/B 验收`
- `回归巡检`
- `发布门`
- `单稿诊断`
- `验证样本集`

核心用户路径是：选择 `A/B 验收`，用 Harness 跑 `candidate vs active`，查看命中、证据、硬门禁、激活和回滚是否符合预期。

## 范围

本批完成：

- 同步本地旧 `main` 到远端新 `main`。
- 将 Harness 控制台分支 rebase 到新 `main`。
- 消化规则中心/知识库表格录入强化线程落入 `main` 后的导航变化。
- 将管理区最终收敛为 3 个入口：`AI 接入`、`Harness 控制`、`账号与权限`。
- 移除左侧管理导航里的 `管理总览`。
- 保持 `规则中心` 在知识治理/协作回收区，不放入管理区。
- 保留旧 hash 兼容：`#admin-console` 不再打开管理总览，`#harness-datasets` 进入统一 Harness 工作台。
- 新增 `harnessMode` 深链，支持直接打开五个 Harness 模式。
- 将 Harness 内容区改成全宽工作台 lane，避免旧 1240px 宽度约束造成挤压。
- 将普通 UI 术语从 `Gold Set` / `金标准` 改为 `验证样本集`。
- 明确已发布验证样本集只读，修改需走草稿/新版本。

本批不做：

- 不伪造后端还没有的发布对象门禁派生 API。
- 不伪造完整单稿 hit/miss 归因 API。
- 不伪造验证样本集新建、保存、发布、复制等 HTTP 写接口。
- 不把激活安全完全交给前端按钮禁用；后端证据包激活门禁另列任务。
- 不做与 Harness 无关的规则中心、知识库、稿件流程重构。

## 架构决策

### 1. 单入口，多模式

左侧导航只暴露一个 Harness 入口：

- `Harness 控制`

五个任务不新增为顶层入口，而是在 Harness 页面内部用模式切换承载。这避免把导航继续做复杂，也符合用户对“直接把 Harness 界面当主入口”的决定。

### 2. 保留兼容 WorkbenchId

`admin-console` 和 `harness-datasets` 仍保留为底层兼容 id，原因是历史 hash、测试夹具和旧入口可能仍会访问它们。

兼容行为：

- `#admin-console`：因为管理员可见工作台不再包含 `admin-console`，会回落到默认 `screening`，不再显示 `管理总览`。
- `#harness-datasets`：继续可解析，但渲染到统一的 `EvaluationWorkbenchPage`，并打开 `验证样本集` 模式。

这不是重新开放导航入口；管理区导航仍只有 3 项。

### 3. Harness 模式可深链

新增 `harnessMode`，取值：

- `ab_acceptance`
- `regression_inspection`
- `release_gate`
- `single_manuscript_diagnosis`
- `validation_sample_sets`

示例：

```text
#evaluation-workbench?harnessMode=release_gate
#evaluation-workbench?harnessMode=validation_sample_sets
```

旧 `harnessSection` 仍兼容：

- `overview -> ab_acceptance`
- `runs -> regression_inspection`
- `datasets -> validation_sample_sets`

### 4. 全宽但不真隐藏壳层

本批把 `evaluation-workbench` 从旧 `min(1240px, 100%)` 内容约束里移出，改为 `width: 100%`。这样 Harness 页面在现有 app shell 内获得全宽内容 lane。

当前没有隐藏顶部 header 或左侧导航。这样变更范围更小，也不会破坏整站导航一致性。

## 页面结构

### 顶部区

包含：

- 面包屑：`管理区 / Harness 控制 / 当前模式`
- 标题：`Harness 控制`
- 当前模式说明
- `当前 Active` 摘要
- `高级详情：开/关`
- 五模式切换

高级详情默认关闭，内部 ID、绑定 ID、运行 ID 只在展开后显示。

### 主工作区

桌面布局：

- 左侧设置列：约 340-400px
- 右侧结果列：占满剩余宽度
- 间距：14px

响应式：

- 1100px 以下改为上下堆叠。
- 760px 以下模式切换可横向滚动。

### 每模式一个主按钮

当前主按钮：

- `A/B 验收`：`运行 candidate vs active`
- `回归巡检`：`运行回归巡检`
- `发布门`：`检查发布门`
- `单稿诊断`：`诊断单稿`
- `验证样本集`：`查看验证样本集`

受后端能力限制的模式，按钮可禁用并显示清晰边界说明，不能假装提交真实工作。

## 模式设计和当前落地状态

### A/B 验收

已落地：

- 默认进入模式。
- 展示当前 Active。
- 展示候选主差异 readiness。
- 显示命中/建议、证据完整度、硬门禁摘要。
- 结果区展示最近已定稿历史和 baseline 对照摘要。
- 点击 `运行 candidate vs active` 后展开真实执行面板，复用现有 Harness operator 的预览、创建运行、激活、回滚能力。

保留限制：

- 后端激活接口尚未强制绑定“已通过 run/evidence pack”，因此前端不能声明激活安全由新页面完整保证。

### 回归巡检

已落地：

- 旧 `harnessSection=runs` 会进入此模式。
- 展示可见历史、回归提及、失败提及。
- 展示回归套件列表，并带 `data-evaluation-suite-id/type`，方便测试和后续扩展。
- 展示历史筛选、时间窗口、排序。
- 不显示激活和回滚控制。

保留限制：

- 尚无专用 Active-only 回归运行 API。本模式先展示历史巡检信号和套件选择，不伪造“运行 Active-only”后端行为。

### 发布门

已落地：

- 支持 `harnessMode=release_gate` 深链。
- 展示发布配置数量、当前证据状态、建议状态。
- 基于现有已定稿历史给出发布门摘要。
- 明确提示 release object 自动派生门禁尚未接入。

保留限制：

- 尚无 `release object type/version -> required gates -> blocking reasons -> owner/next action` API。
- 当前不提供虚假的发布对象提交控件。

### 单稿诊断

已落地：

- 提供稿件 ID 输入。
- `prefilledManuscriptId` 可进入诊断上下文。
- 点击 `诊断单稿` 会重新加载 overview，并传入稿件 ID。
- 结果区展示命中运行、命中套件、历史命中数量和运行历史。
- 不显示发布、激活、回滚控制。

保留限制：

- 尚无完整单稿诊断 API，因此 hit/miss 矩阵、expected vs actual、原因分类仍是后续任务。

### 验证样本集

已落地：

- 旧 `harnessSection=datasets` 和 `#harness-datasets` 都进入统一 Harness 工作台的 `验证样本集` 模式。
- 嵌入现有样本集工作台。
- 普通 UI 不显示 `Gold Set` / `金标准`。
- family 名称里的 `gold set` 会格式化为 `验证样本集`。
- 已发布版本显示 `已发布版本只读`。
- 已发布版本保留导出 JSON / JSONL 行为。

保留限制：

- Web HTTP 当前只暴露 workbench overview 和 export。
- 新建草稿、保存草稿、发布、复制为草稿这些 service 能力尚未接入 HTTP 和前端，不在本批伪造。

## 文件变更

核心新增：

- `apps/web/src/features/evaluation-workbench/harness-control-workbench.tsx`
- `apps/web/src/features/evaluation-workbench/harness-control-workbench.css`

核心修改：

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- `apps/web/src/features/auth/workbench.ts`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/app.css`

测试修改：

- `apps/web/test/evaluation-workbench-page.spec.tsx`
- `apps/web/test/evaluation-workbench-online-regression.spec.tsx`
- `apps/web/test/harness-datasets-workbench-page.spec.tsx`
- `apps/web/test/manuscript-workbench-routing.spec.ts`
- `apps/web/test/workbench-host.spec.tsx`

设计文档：

- `docs/superpowers/specs/2026-04-29-harness-control-fullscreen-workbench-design.md`
- `docs/superpowers/plans/2026-04-29-harness-control-fullscreen-workbench.md`

## 查漏补缺结论

子代理只读检查后的统一结论：

- 前端五模式、全宽工作台、术语替换、旧 hash 兼容、管理导航收敛都可以实现，且本批已完成。
- A/B 验收可以复用现有真实 Harness 控制面。
- 回归巡检、发布门、单稿诊断当前只能做“基于已有运行/证据的真实只读或有限动作”，不能声称有完整后端工作流。
- 验证样本集当前可以查看和导出，不能声称已经能完整维护草稿/发布。

## 最终执行顺序

- [x] fetch 远端并确认本地 `main` 等于 `origin/main`。
- [x] 在 `codex/harness-control-redesign` 上 rebase 到新 `main`。
- [x] 重新应用 Harness 控制台改动。
- [x] 处理 rebase 后导航集成边界。
- [x] 添加 Harness 五模式页面结构。
- [x] 添加 `harnessMode` 路由格式化和解析。
- [x] 将管理导航收敛为 3 项。
- [x] 将 `harness-datasets` 旧入口接入统一 Harness 工作台。
- [x] 将 `evaluation-workbench` 内容区改成全宽。
- [x] 更新验证样本集术语和已发布只读说明。
- [x] 补充 focused tests。
- [x] 跑 web typecheck。
- [x] 跑 Harness/导航重点测试。
- [x] 尝试跑完整 web test suite。
- [x] 对照干净 `main`，确认完整 suite 失败来自既有规则中心测试状态，而不是本次 Harness diff。
- [ ] 启动本地 dev server 做人工浏览入口。

## 后续独立任务

这些任务需要后端或更大集成，不应混入当前前端收口：

1. 后端激活门禁：`activate candidate` 要求传入并校验已通过的 run/evidence pack。
2. 发布门 API：根据 release object 自动派生 required gates、missing dependencies、blocking reasons 和 owner/next action。
3. 单稿诊断 API：按 manuscriptId/runId 返回 timeline、hit/miss、evidence chain、expected vs actual 和原因分类。
4. 验证样本集 HTTP 写接口：create/update/publish/archive/copy draft。
5. 回归巡检 Active-only API：用当前 Active 环境生成可追踪的 frozen snapshot，并运行非 A/B regression suite。
6. 浏览器视觉 QA：桌面和窄屏检查模式切换、按钮可达性、文本不裁切、证据区不重叠。

## 验收标准

当前批次验收标准：

- 管理区左侧导航只有 `AI 接入 / Harness 控制 / 账号与权限`。
- `管理总览` 不在管理导航中出现。
- `#admin-console` 不再打开管理总览。
- `Harness 控制` 打开全宽五模式工作台。
- `harnessMode` 可格式化、解析并直接打开模式。
- 旧 `overview/runs/datasets` 仍兼容。
- `#harness-datasets` 进入统一 Harness 工作台，而不是单独导航入口。
- 普通 UI 使用 `验证样本集`，不显示 `Gold Set`。
- 已发布验证样本集显示只读说明，导出仍可见。
- 受限能力明确展示边界，不提供假按钮。
- TypeScript typecheck 通过。
- 重点 Harness/导航测试通过。
- 完整 web test suite 当前在规则中心相关用例上失败；同一失败已在干净 `main` 复现。当前批次只能声明 Harness/导航重点验证通过，不能声明完整 web suite 全绿。
