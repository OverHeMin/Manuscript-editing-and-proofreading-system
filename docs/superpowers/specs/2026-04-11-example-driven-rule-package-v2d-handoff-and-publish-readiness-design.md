# 示例驱动规则包 V2D 交接强化与发布前解释设计

## 背景

V2C 已经完成了这条主链路的第一轮闭环：

- `reviewed_case / uploaded_example_pair` 两类 source 都能进入 package-first 工作台
- 已确认的规则包可以 `compile-preview`
- 已确认的规则包可以 `compile-to-draft`
- 运行时真源仍然只使用既有的 `editorial_rule_set + editorial_rule`

但当前还缺一段很关键的“交接层”：

- 编译成功后，用户虽然知道“生成了 draft rule set”，但不知道下一步最自然的动作是什么
- 编译结果和当前 `Rule Sets / Advanced Rule Editor / Publish Rule Set` 区域之间，还缺少明确联动
- 发布前解释仍然偏技术视角，缺少更贴近运营决策的“现在能不能发、为什么还不能发”

因此 V2D 不再扩范围去做知识投影、审核流或 manuscript ingestion，而是专门把“编译后交接”和“发布前解释”补完整。

## 目标

- 让 `compile-to-draft` 的结果能自然交接到现有 `Rule Sets / Advanced Rule Editor / Publish Rule Set`
- 让用户在 package-first 工作台中就能理解：
  - 这次写入到了哪个 draft rule set
  - 是复用了现有 draft，还是创建了新 draft
  - 现在适不适合直接进入发布动作
  - 如果不适合，阻断原因是什么
- 保持现有执行真源和发布机制不变，不创建第二套 publish 系统

## 非目标

V2D 明确不做：

- 知识投影、知识回链、知识优先调用
- package 审核状态机
- manuscript ingestion 作为第三类 source
- 多人协作草稿
- 新的 publish API 或新的运行时真源

## 方案比较

### 方案 A：仅显示“编译成功”

只在 compile panel 里显示 `rule_set_id` 和 `created/replaced/skipped`。

优点：

- 改动最小
- 风险最低

缺点：

- 用户仍然需要自己去规则集区域“找”刚刚生成的 draft
- 发布前解释仍然不足
- compile 成功和后续治理动作之间仍有明显断层

### 方案 B：稳态交接强化

在现有 compile panel 上补：

- 目标 draft rule set 解释
- draft 复用策略
- publish readiness summary
- 打开高级编辑器 / 跳转发布区 / 聚焦当前 draft 的联动

优点：

- 不改变真源和发布机制
- 用户主路径完整
- 风险和复杂度都可控

缺点：

- 需要补一层 compile 结果解释与前端联动状态

### 方案 C：把 compile 和 publish 做成新向导

优点：

- 看起来更一体化

缺点：

- 很容易开始复制现有治理能力
- 范围会明显膨胀
- 更容易漂移

## 推荐

采用方案 B。

V2D 的核心原则是：只做“交接强化”，不改运行时真源，不做新的治理域。

## 交互设计

### 1. Compile Panel 增加“目标 draft”区

compile panel 在执行前显示本次写入目标：

- `复用当前 draft rule set（推荐）`
- `新建 draft rule set`

规则：

- 当当前 overview 已选中一个可编辑的 draft rule set，且它的 `template_family / journal_template / module` 与当前 compile 上下文一致时，默认复用它
- 否则默认创建新 draft
- 不开放“任意搜索所有 draft rule set”，避免把范围拉大

这样既能避免误写进错误 draft，也不会引入复杂的多草稿治理。

### 2. Compile 成功后显示“交接动作”

compile 成功后，panel 直接显示：

- `目标 Draft Rule Set`
- `本次动作：复用 / 新建`
- `created / replaced / skipped`
- `Open Draft Rule Set`
- `Open Advanced Rule Editor`
- `Go To Publish Area`

预期行为：

- `Open Draft Rule Set`：把 overview 的 `selectedRuleSetId` 切到本次目标 draft
- `Open Advanced Rule Editor`：展开高级编辑器，并聚焦到当前 draft rule set
- `Go To Publish Area`：聚焦到当前 draft 所在的 `Rule Sets` 区域，保持现有 `Publish Rule Set` 按钮和流程不变

### 3. 增加 Publish Readiness Summary

这层不是新的发布引擎，只是把现有 compile / preview 结果翻译成发布前语言。

建议状态：

- `ready_to_review`
- `review_before_publish`
- `blocked`

判定规则：

- 只要有 `needs_confirmation / unsupported / skipped_packages`，就是 `blocked`
- 没有 blocked，但存在 `guarded_auto / inspect_only / overrides_published_coverage_keys`，就是 `review_before_publish`
- 其他情况为 `ready_to_review`

同时返回说明：

- blocked package 数
- override 风险数
- inspect-only 规则数
- guarded 规则数

### 4. 高级编辑器仍然只是兜底精修

V2D 不把高级编辑器变回主入口。

它的角色继续保持为：

- 查看编译结果
- 对少量原子规则做精修
- 在必要时补 selector / trigger / action 的底层细节

## 后端设计

### 1. 复用现有 `compileToDraft`

`CompileRulePackagesToDraftInput` 继续复用当前模型：

- 提供 `targetRuleSetId` 时写入指定 draft
- 不提供时创建新 draft

V2D 增加的是“更明确的选择策略”和“返回解释”，不是新编译器。

### 2. 扩展 `compile-to-draft` 返回结果

建议在当前结果上补充：

```ts
interface RulePackageCompileToDraftResult {
  rule_set_id: string;
  target_mode: "reused_selected_draft" | "created_new_draft";
  created_rule_ids: string[];
  replaced_rule_ids: string[];
  skipped_packages: Array<{
    package_id: string;
    reason: string;
  }>;
  publish_readiness: {
    status: "ready_to_review" | "review_before_publish" | "blocked";
    reasons: string[];
    blocked_package_count: number;
    override_count: number;
    guarded_rule_count: number;
    inspect_rule_count: number;
  };
}
```

说明：

- `target_mode` 让前端能解释这次是“复用”还是“新建”
- `publish_readiness` 让前端不必自行拼装过多治理语言

### 3. 后端判定只做解释，不做新阻断域

V2D 的“阻断”是 compile 结果解释层阻断，不是新的 publish 权限系统。

也就是说：

- compile panel 可以提示 `blocked`
- 现有 `Publish Rule Set` 仍沿用当前逻辑
- 如果后续需要真正的发布硬阻断，再放到后续阶段处理

## 前端设计

### 1. Compile Panel 状态升级

现有 state 继续保存在 package-first workspace 上，新增：

- `targetRuleSetMode`
- `resolvedTargetRuleSetId`
- `compileResult.publish_readiness`
- `isAdvancedEditorRequestedFromCompile`

### 2. Overview 联动

当 compile 成功后：

- 自动 reload overview
- 自动把 `selectedRuleSetId` 指向本次目标 draft
- 用户点击交接动作时，不再需要手动选择同一个 draft

### 3. 不增加第二个“发布面板”

V2D 只允许 compile panel 给出“前往发布区”的联动入口。

真正的 publish 行为仍发生在现有 `Rule Sets` 区域。

## 文件边界建议

### 后端

- `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - 扩展 compile-to-draft 结果，补 `target_mode` 与 `publish_readiness`
- `packages/contracts/src/editorial-rule-packages.ts`
  - 扩展 compile-to-draft contract
- `apps/api/src/modules/editorial-rules/editorial-rule-package-types.ts`
  - 同步本地类型
- `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`
  - 增加 draft 复用和 publish readiness 测试

### 前端

- `apps/web/src/features/editorial-rules/types.ts`
  - 新增 handoff / publish readiness view model
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - 同步新的 compile result
- `apps/web/src/features/template-governance/rule-package-compile-panel.tsx`
  - 新增目标 draft、交接动作、publish readiness summary
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - 编译后自动选中目标 draft，并联动高级编辑器 / 发布区
- `apps/web/test/...`
  - 补充 compile handoff 与 publish readiness 测试

## 风险控制

### 风险 1：误把规则写入不该复用的 draft

控制：

- 只允许复用“当前已选中、且上下文一致、且可编辑”的 draft
- 否则直接创建新 draft

### 风险 2：compile panel 开始复制发布系统

控制：

- compile panel 只做解释和跳转
- publish 动作仍在既有 `Rule Sets` 区域

### 风险 3：又被拉去做更重治理

控制：

- V2D 不做知识投影
- 不做 package 审核流
- 不做 ingestion

## 验收标准

- 用户能看懂当前 compile 会写入哪个 draft rule set
- compile 成功后，overview 自动聚焦到该 draft
- compile panel 能显示“复用 / 新建”与 `created/replaced/skipped`
- compile panel 能显示 publish readiness summary
- 用户能从 compile panel 一步进入高级编辑器或现有发布区
- 不新增第二套 publish 流程
- 现有 V2C API / HTTP / Web 回归保持通过

## 结论

V2D 的职责不是“再造一个更完整的规则治理系统”，而是把已经成立的 V2C 闭环从“能编译”推进到“能自然交接、能清楚判断是否适合发布”。

只要把：

- 目标 draft 解释
- 复用策略
- 发布前解释
- 高级编辑器与发布区联动

补完整，当前这条稳定路线就还能继续往前走，而不会开始漂到更重的治理域。
## Implementation Status

Implemented in V2D:
- `compile-to-draft` now reports `target_mode` and `publish_readiness`.
- Selected draft rule sets are reused only when `template_family`, `journal_template`, and `module` still match the compile context.
- The package-first compile panel now explains whether the target draft was reused or newly created.
- The package-first compile panel now exposes handoff actions for `Open Draft Rule Set`, `Open Advanced Rule Editor`, and `Go To Publish Area`.
- The existing `Publish Rule Set` flow remains the only publish path.

Still deferred on purpose:
- knowledge projection
- package approval workflow
- manuscript ingestion as a third package source
