# 示例驱动规则包 V2C 编译预演与受控发布设计

## 背景

到 V2B 为止，规则中心已经具备：

- `reviewed_case / uploaded_example_pair` 两类 source 的统一接入
- package-first 录入工作台
- 5 张语义卡片的本地编辑
- 规则包预演
- source identity 级别的草稿恢复

但当前链路仍停在“可录入、可解释、可预演”，还不能把人工确认后的规则包真正落到运行时真源 `editorial_rule`。这意味着规则中心还不是完整闭环，操作者确认完语义之后，仍然要回到长表单手工录规则。

同时，仓库里已经存在成熟的运行时治理能力：

- `EditorialRuleService` 负责 `rule set` 的 draft / publish
- `EditorialRuleResolutionService` 负责 base / journal overlay
- `EditorialRulePreviewService` 负责规则命中和执行姿态预演

因此，V2C 最稳的方向不是先把规则中心并入更重的 `manuscript ingestion` 或知识投影链路，而是先让“规则包语义层”能安全编译进现有 `editorial_rule` 真源。

## 目标

V2C 目标：

- 让已确认的规则包可以编译成现有 `editorial_rule_set + editorial_rule` draft
- 在正式 publish 前，向操作者明确展示：
  - 哪些包可以编译
  - 会生成哪些运行时规则
  - 会覆盖哪些已有 coverage key
  - 哪些规则仍需人工复核或降级为 `inspect_only`
- 复用现有 `Publish Rule Set`、resolution、preview 能力，不创建第二套运行时发布引擎
- 保持 package-first 工作台仍是主入口，长表单高级编辑器只承担精修与兜底

## 非目标

V2C 不包含：

- 知识投影、知识回链、知识优先调用
- 新的规则包审核/审批工作流
- `manuscript ingestion` 驱动的第三类 source
- 多人协作草稿、服务端草稿持久化
- 自由改写类非结构化规则编译

## 方案比较

### 方案 A：继续以长表单为真入口，规则包只做预填充

优点：

- 后端变更最小
- 风险看起来低

缺点：

- 操作者仍会被扔回旧长表单，违背 package-first 主流程
- 规则包价值被削弱为“半自动预填”
- 难以形成真正的示例驱动录入闭环

### 方案 B：规则包直接编译到现有 `editorial_rule` draft，再走已有 publish 流程

优点：

- 不新建运行时真源
- 能复用现有 rule set / publish / resolution / preview 服务
- package-first 工作台可以真正产出可发布规则
- 允许编译后进入高级编辑器做少量精修，风险可控

缺点：

- 需要新增一层 package -> atomic rule 的稳定编译映射
- 需要设计编译就绪与覆盖解释

### 方案 C：新建 package-native 发布系统，运行时再动态解释规则包

优点：

- 规则包概念更完整

缺点：

- 等于新造第二套运行时
- 会与现有 `editorial_rule` 真源冲突
- 风险和实现量都明显过大

### 推荐

V2C 采用方案 B。

原因是当前仓库已经有现成的运行时基础设施，V2C 只需要补“编译桥”和“发布前解释”，就可以让规则中心从录入台进化为真正可发布的治理入口。

## 用户流程

V2C 推荐主流程：

1. 用户在规则中心上传示例对，进入 package-first 工作台
2. 用户完成 5 张语义卡片确认
3. 系统给出每个规则包的 compile readiness
4. 用户点击 `Compile To Draft Rule Set`
5. 系统创建或复用一个 `editorial_rule_set` draft，并将选中的规则包编译成若干原子 `editorial_rule`
6. 页面返回：
   - 生成了哪些 rule
   - 哪些 coverage key 将覆盖现有 published rule
   - 哪些项被降级成 `inspect_only`
   - 哪些项因为语义确认不足未参与编译
7. 用户可选择：
   - 留在 package-first 视图检查编译解释
   - 打开高级编辑器对个别原子规则精修
   - 进入已有 `Rule Sets` 区域发布 draft rule set
8. 用户点击现有 `Publish Rule Set`
9. 现有 publish 机制生效，旧 published rule set 被 archive，新 rule set 成为运行时真源

## 核心设计

### 1. 编译真源仍然只有 `editorial_rule`

V2C 不保存“已发布的规则包”。发布动作的结果仍然是：

- 一个已有的 `editorial_rule_set`
- 多条已有的 `editorial_rule`

规则包只承担：

- 录入层
- 语义确认层
- 编译来源层
- 发布前解释层

### 2. 引入 compile readiness，而不是直接允许所有包发布

每个规则包在 V2C 都要先通过 compile readiness 检查。

建议最小就绪条件：

- `semantic_summary` 已确认
- `applicability` 已确认
- 至少一条 `evidence_examples`
- `failure_boundaries` 或 `review_policy` 至少其一有值
- 包类型属于当前支持的 deterministic compiler 范围

编译状态建议分为：

- `ready`
- `ready_with_downgrade`
- `needs_confirmation`
- `unsupported`

其中：

- `ready` 可直接编译
- `ready_with_downgrade` 可编译，但姿态会被强制降级
- `needs_confirmation` 不允许参与编译
- `unsupported` 明确告诉用户当前包型暂不支持自动编译

### 3. 编译不是一包一条规则，而是一包映射到 1..N 条原子规则

V2C 不把规则包直接当运行时规则。每个包编译为若干现有 catalog 内的 `rule_object`：

- `front_matter` -> `author_line` / `journal_column` / `statement`
- `abstract_keywords` -> `abstract` / `keyword`
- `heading_hierarchy` -> `heading_hierarchy` / `manuscript_structure`
- `numeric_statistics` -> `numeric_unit` / `statistical_expression`
- `three_line_table` -> `table`
- `reference` -> `reference`

第一版编译只支持 deterministic mapping：

- 不做自由改写
- 不把模糊语义硬编成激进自动化规则
- 表格和复杂前置信息优先保守

### 4. 编译结果必须携带 trace，允许后续重编译与兜底精修

每条编译生成的 `editorial_rule` 都需要带 compile trace，建议写入 `authoring_payload`：

```ts
interface RulePackageCompileTrace {
  package_id: string;
  package_kind: RulePackageKind;
  source_kind: RulePackageWorkspaceSourceKind;
  source_id: string;
  semantic_hash: string;
  evidence_examples: RuleEvidenceExample[];
  compiled_at: string;
  compiler_version: string;
}
```

这样做的目的：

- 后续重编译时能识别哪些 draft rule 是由规则包生成的
- 高级编辑器能明确标出“此规则来自哪个规则包”
- publish 后仍可追溯来源

### 5. 发布前预演优先复用现有 preview / resolution 服务

V2C 不新建第二套“发布前模拟器”。

建议采用两层解释：

- 编译预演：
  - 说明一个 package 会编译出哪些 atomic rule
  - 这些 rule 的 `execution_mode / confidence_policy / severity` 是什么
  - 哪些已有 coverage key 会被覆盖
- 运行时预演：
  - 对已创建 draft rule 使用现有 `EditorialRulePreviewService`
  - 对将要 publish 的 rule set 使用现有 `resolution` 逻辑做最终覆盖解释

## 接口建议

### 1. 新增 compile preview 接口

用于在真正写入 draft rule set 前，先向用户解释编译结果。

```ts
interface PreviewCompileRulePackagesInput {
  source: RulePackageWorkspaceSourceInput;
  packageDrafts: RulePackageDraft[];
  templateFamilyId: string;
  journalTemplateId?: string;
  module: "editing" | "proofreading";
}
```

返回：

```ts
interface RulePackageCompilePreview {
  package_id: string;
  readiness: "ready" | "ready_with_downgrade" | "needs_confirmation" | "unsupported";
  draft_rule_seeds: CompiledEditorialRuleSeed[];
  overrides_published_coverage_keys: string[];
  warnings: string[];
}
```

### 2. 新增 compile 到 draft rule set 接口

```ts
interface CompileRulePackagesToDraftInput {
  actorRole: AuthRole;
  source: RulePackageWorkspaceSourceInput;
  packageDrafts: RulePackageDraft[];
  templateFamilyId: string;
  journalTemplateId?: string;
  module: "editing" | "proofreading";
  targetRuleSetId?: string;
}
```

返回：

```ts
interface CompileRulePackagesToDraftResult {
  rule_set_id: string;
  created_rule_ids: string[];
  replaced_rule_ids: string[];
  skipped_packages: Array<{
    package_id: string;
    reason: string;
  }>;
}
```

说明：

- 若未提供 `targetRuleSetId`，则创建新的 draft rule set
- 若提供已有 draft rule set，则只替换同一 compile trace / coverage key 下的 package-owned draft rules
- 不触碰 published rule set

### 3. publish 继续复用现有接口

V2C 不新增 publish API，继续复用：

- `publishEditorialRuleSet`

这样可最大化复用既有 archive、projection refresh、resolution 约束。

## 前端交互建议

### 1. package-first 工作台底部新增 Compile Panel

默认只展示轻量信息：

- 当前 source
- 目标层级：family / journal
- 目标模块：editing / proofreading
- compile readiness summary
- `Preview Compile`
- `Compile To Draft Rule Set`

### 2. Compile Panel 返回编译解释，而不是直接跳走

编译后在当前页面展示：

- 每个 package 生成的 rule 数量
- 生成的 `rule_object`
- 预计运行姿态：`auto / guarded / inspect_only`
- 会覆盖哪些已有 published coverage key
- 哪些包未编译及原因

### 3. 高级编辑器成为编译后的精修入口

V2C 不取消高级编辑器，反而让它承担更清晰职责：

- 只在编译后用于少量原子规则精修
- 默认仍然折叠
- 用户不需要从零写 rule，只改编译结果中的少数细节

## 编译映射原则

### automation posture 到运行时姿态的映射

- `safe_auto` -> `execution_mode: "apply"` + `confidence_policy: "always_auto"`
- `guarded_auto` -> `execution_mode: "apply_and_inspect"` + `confidence_policy: "high_confidence_only"`
- `inspect_only` -> `execution_mode: "inspect"` + `confidence_policy: "manual_only"`

### 风险优先级

- 表格类默认不提升为 `auto`
- 复杂 front matter 在证据不足时降级为 `inspect_only`
- 只有 deterministic text normalization 才允许 `safe_auto`

### selector / trigger / action 来源

V2C 编译器优先从以下信息组合：

- package kind
- semantic summary
- applicability
- evidence examples
- existing recognizer hints / supporting signals
- current object catalog

不允许：

- 仅凭一句抽象 summary 直接生成激进 selector
- 在边界不清时静默生成 `apply`

## 文件边界建议

### 后端

- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - compile readiness、compile preview、compile-to-draft 主服务
- `apps/api/src/modules/editorial-rules/rule-package-compiler.ts`
  - package kind -> atomic rule seeds 的稳定映射
- `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - 暴露 compile preview / compile to draft 路由
- `apps/api/src/http/api-http-server.ts`
  - 新增 compile 相关 route

### 前端

- `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
  - compile summary 与动作入口
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - 调用 compile preview / compile-to-draft
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - 接入 compile panel 与编译结果展示
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - 新增 compile preview / compile to draft client

## 风险与控制

### 风险 1：规则包编译结果不稳定，覆盖了不该覆盖的 published rule

控制：

- 编译前先返回 coverage key 覆盖解释
- 只允许写入 draft rule set
- publish 动作继续复用现有显式按钮，不做静默发布

### 风险 2：语义卡片确认不足，却被硬编译进运行时

控制：

- 引入 compile readiness gate
- 未确认字段不参与编译
- readiness 不满足时只能停留在 workbench

### 风险 3：package-first 工作台被编译细节重新拉回长表单体验

控制：

- compile panel 默认只展示 readiness 和解释摘要
- selector / trigger / action 继续收进高级编辑器
- 默认用户路径仍然是“卡片确认 -> 编译解释 -> draft rule set -> publish”

### 风险 4：V2C 范围再次膨胀到知识投影或 manuscript ingestion

控制：

- V2C 明确只做运行时闭环
- 知识投影和 ingestion source 继续延期到后续阶段

## 测试策略

V2C 需要覆盖：

### 后端

- compile readiness 对 6 类包的判断稳定
- deterministic package 可以编译成预期数量的 atomic rule seeds
- compile preview 能返回 coverage key 覆盖解释
- compile-to-draft 只写 draft rule set，不影响 published rule set
- 重新编译同一 package 时，只替换 package-owned draft rules

### 前端

- package-first 工作台出现 compile summary 和 compile actions
- readiness 不足时 compile action 禁用并显示原因
- compile preview 能清楚显示：
  - 生成了哪些 rule
  - 会覆盖哪里
  - 哪些项被降级
  - 哪些项未编译
- compile 成功后可跳转或联动到已有 rule set / advanced editor 区域

### 回归

- V2B uploaded pair 与 reviewed-case 两种 source 都可进入 compile 流
- 未开启 compile 时，现有 package-first workbench 不回归
- publish 仍然通过现有 `Publish Rule Set` 流程，不新增第二套发布真源

## 结论

V2C 最稳的切入点不是继续把规则中心做得更像 intake，也不是立刻延伸到知识库，而是先把“规则包语义层”桥接到现有 `editorial_rule` 真源。

这样做的收益是：

- 规则中心第一次真正形成“录入 -> 确认 -> 编译 -> 发布”的闭环
- 现有 `editorial_rule` runtime、overlay、preview 能力被复用，而不是推翻
- package-first 交互保持简洁，长表单只承担精修兜底
- 后续再接知识投影或 manuscript ingestion 时，边界仍然清楚
## Implementation Status (2026-04-11)

Implemented in V2C:

- backend compile preview service for rule packages
- backend compile-to-draft bridge into existing `editorial_rule_set` and `editorial_rule`
- HTTP routes for `compile-preview` and `compile-to-draft`
- workbench controller and client support for compile preview and draft compile
- compact compile panel inside the package-first authoring shell
- focused API, HTTP, controller, panel, shell, and page coverage for the compile flow

Still intentionally deferred:

- knowledge projection from confirmed semantic drafts
- manuscript-ingestion-backed third source type
- package-native approval workflow
- multi-user draft collaboration and server-side draft persistence
- non-deterministic free-rewrite compilation
