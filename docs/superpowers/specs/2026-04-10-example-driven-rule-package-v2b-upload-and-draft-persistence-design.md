# 示例驱动规则包 V2B 设计

## 背景

V2A 已经把规则库录入升级到“规则包候选列表 + 5 张语义卡片 + Preview”的工作台形态，并验证了以下链路：

- `reviewedCaseSnapshotId -> example pair -> 6 类规则包候选`
- 本地语义卡片编辑
- 显式刷新 preview
- 高级规则编辑器折叠保留

当前缺口主要有两个：

1. 规则中心仍然只能从 `reviewedCaseSnapshotId` 进入，不能直接上传“原稿 + 编后稿”
2. 语义卡片修改仅保存在前端内存里，刷新页面后会丢失

用户当前诉求不是直接进入正式编译发布，而是先把“示例驱动录入”补成可用主流程，同时为未来并入 `manuscript ingestion` 保留兼容边界。

## 目标

V2B 目标：

- 在规则中心提供“原稿 + 编后稿”直传入口
- 上传后直接进入现有规则包工作台，不要求先有 reviewed case
- 支持语义卡片草稿的轻量保存与恢复
- 保持现有规则包引擎、preview 引擎、运行时真源不变
- 为未来接入 `manuscript ingestion` 预留统一 source contract，避免重复重构

## 非目标

V2B 不包含：

- 编译为正式 `editorial_rule`
- 规则包发布、审核、审批流
- 知识投影或知识库写回
- 长期资产管理、正式稿件生命周期治理
- 将直传文件直接纳入 manuscript 主工作台

## 方案结论

V2B 采用“轻入口，重兼容”方案。

含义是：

- 当前在规则中心内直接上传 `原稿 + 编后稿`
- 后端只为本次规则识别生成临时 example pair source
- 不强依赖 `manuscript ingestion / reviewed-case / job` 链路
- 但 source contract 从一开始就抽象为统一入口，未来可以把“直传文件 source”替换为“manuscript ingestion source”

这是比“先做 ingestion-first 再回流规则中心”更稳的路线，因为它复用了已验证的规则包链路，又不会把 V2B 扩成多子系统耦合改造。

## 备选方案比较

### 方案 A：规则中心直传示例对

优点：

- 变更面最小
- 与 V2A 的规则包工作台天然衔接
- 最快形成用户可用闭环
- 不把 manuscript 主链路的复杂度带进当前阶段

缺点：

- 生成的是“规则识别专用临时 source”，不是正式稿件资产
- 后续要补一层与 ingestion 的桥接

### 方案 B：先进入 manuscript ingestion，再从 ingestion 回到规则中心

优点：

- 长期资产与规则识别来源统一
- 后续如果一切都要纳入稿件治理，路径更完整

缺点：

- 需要同时改 intake、资产管理、工作台跳转、规则中心入口
- V2B 范围膨胀，稳定性风险明显更高

### 推荐

V2B 采用方案 A，并在接口设计上兼容方案 B。

## 用户流程

V2B 录入主流程：

1. 用户打开规则中心 authoring 模式
2. 在“示例驱动录入”入口上传 `原稿.docx + 编后稿.docx`
3. 系统创建一个临时 example-source session
4. 后端把这对文件转换成 `ExamplePairUploadInput`
5. 现有规则包引擎返回规则包候选
6. 页面直接进入现有三栏工作台
7. 用户修改 5 张语义卡片
8. 用户点击 `Refresh Preview`
9. 用户可手动保存草稿
10. 用户下次回来可恢复该次草稿，但仍不发布为正式规则

## 交互设计

### 1. 规则中心顶部新增轻入口

仅在 authoring 模式中显示：

- `上传原稿`
- `上传编后稿`
- `开始识别`
- `恢复上次草稿`

默认不展开复杂表单，不要求填写稿件元数据。

可选附加字段保持最小：

- `journalKey` 可选
- `manuscriptType` 暂不要求必填

### 2. 工作台保持现有三栏

V2B 不重做工作台主体，只在进入方式上新增一条 source：

- 左侧候选列表不变
- 中间 5 张语义卡片不变
- 右侧 preview 不变
- 高级规则编辑器继续保留折叠入口

### 3. 草稿保存策略

V2B 采用“轻持久化”，不做数据库建模，不做多人协作。

默认能力：

- 本地自动缓存当前草稿
- 用户可显式点击“保存草稿”
- 页面刷新后可恢复最近一次草稿

保存内容仅包含：

- source session id
- 当前选中的 package id
- editable semantic draft
- preview cache
- 基础来源元信息

## 架构设计

V2B 增加一层新的 source 适配，而不修改规则包识别核心。

### 总体链路

`upload pair -> temporary example source session -> rule package generation -> semantic draft persistence`

### 核心原则

- 规则包识别引擎继续只接受统一的 example pair input
- source 获取方式从单一 `reviewedCaseSnapshotId` 扩展为“可插拔 source”
- 临时上传 source 与 reviewed-case source 共享同一生成服务

## 数据与接口

### 1. 新增 source union

新增统一的规则包 workspace 输入：

- `reviewed_case`
- `uploaded_example_pair`

示意：

```ts
type RulePackageWorkspaceSourceInput =
  | {
      sourceKind: "reviewed_case";
      reviewedCaseSnapshotId: string;
      journalKey?: string;
    }
  | {
      sourceKind: "uploaded_example_pair";
      exampleSourceSessionId: string;
      journalKey?: string;
    };
```

### 2. 新增 example source session

上传成功后，后端返回一个临时 session：

```ts
interface ExampleSourceSessionViewModel {
  session_id: string;
  source_kind: "uploaded_example_pair";
  original_asset: {
    file_name: string;
    mime_type: string;
  };
  edited_asset: {
    file_name: string;
    mime_type: string;
  };
  created_at: string;
  expires_at: string;
}
```

### 3. 新增上传接口

接口职责：

- 接收 `原稿 + 编后稿`
- 解析为临时 source session
- 不创建正式 manuscript
- 不写入 reviewed-case

建议接口：

- `POST /api/v1/editorial-rules/rule-packages/example-source-sessions`

请求体可复用现有 inline upload payload 风格：

```ts
interface CreateExampleSourceSessionInput {
  originalFile: {
    fileName: string;
    mimeType: string;
    fileContentBase64: string;
  };
  editedFile: {
    fileName: string;
    mimeType: string;
    fileContentBase64: string;
  };
  journalKey?: string;
}
```

### 4. 规则包生成接口扩展

V2A 的 reviewed-case 入口继续保留。

V2B 新增通用入口，按 source union 生成 workspace：

- `POST /api/v1/editorial-rules/rule-packages/workspace`

这样前端不再需要知道“当前是 reviewed-case 还是 uploaded pair”，只传 source。

### 5. 语义草稿持久化

V2B 先做前端轻持久化，不立刻引入后端存储。

本地键建议包含：

- `rule-package-workspace-draft::<sourceKind>::<sourceId>`

示意：

```ts
interface StoredRulePackageDraft {
  version: 1;
  source: RulePackageWorkspaceSourceInput;
  selectedPackageId: string | null;
  editableDraftById: Record<string, RulePackageDraftViewModel>;
  previewById: Record<string, RulePackagePreviewViewModel | undefined>;
  savedAt: string;
}
```

## 与 manuscript ingestion 的兼容边界

未来如果接入 manuscript ingestion，不推翻 V2B，而是在 source 层追加一种来源：

```ts
type RulePackageWorkspaceSourceInput =
  | reviewed_case
  | uploaded_example_pair
  | manuscript_ingestion_pair;
```

兼容原则：

- 规则包识别服务不感知来源差异
- 只由 source resolver 负责把不同来源解析成统一 example pair
- V2B 的上传 session 可以被 ingestion 替换，但工作台、语义草稿、preview 接口保持不变

这意味着 V2B 不是一次性代码，而是正式 source abstraction 的第一步。

## 文件边界建议

### 后端

- `apps/api/src/modules/editorial-rules/example-source-session-service.ts`
  - 创建和读取临时上传 session
- `apps/api/src/modules/editorial-rules/rule-package-source-resolver.ts`
  - 统一解析 reviewed-case 与 uploaded pair
- `apps/api/src/modules/editorial-rules/editorial-rule-package-service.ts`
  - 新增通用 workspace 入口
- `apps/api/src/http/api-http-server.ts`
  - 新增上传 session 与 workspace route

### 前端

- `apps/web/src/features/template-governance/rule-package-upload-intake.tsx`
  - 规则中心轻上传入口
- `apps/web/src/features/template-governance/rule-package-draft-storage.ts`
  - 本地草稿保存与恢复
- `apps/web/src/features/template-governance/rule-package-authoring-state.ts`
  - 扩展 source union 与存储恢复
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - 新增 create session 与 load workspace API
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - 接入上传入口、恢复草稿入口、统一 source workflow

## 风险与控制

### 风险 1：上传入口变成第二套 manuscript intake

控制：

- 不引入 title/manuscriptType/createdBy 等稿件 intake 字段
- 只收两份示例文件
- 只生成规则识别临时 source

### 风险 2：本地草稿与新生成候选不一致

控制：

- 草稿恢复时校验 source id 与 package id
- 如果候选结构发生变化，自动降级为“仅恢复可匹配 package”
- 不允许静默把旧草稿套到新候选上

### 风险 3：未来接 ingestion 时返工

控制：

- 本阶段先做 source union 和 resolver
- 不把上传逻辑直接写死在 page 组件里

### 风险 4：上传 DOCX 解析失败影响规则中心稳定性

控制：

- 上传 session 创建与 workspace 生成分两步
- 解析失败只影响当前 source session
- 页面必须给出失败原因，不得污染现有 reviewed-case 流程

## 测试策略

V2B 需要覆盖：

### 后端

- 上传示例对后可创建临时 source session
- source resolver 能从 uploaded pair 构建 example pair
- reviewed-case source 不回归
- workspace 通用入口可兼容两种 source

### 前端

- 规则中心可选择两份文件并启动识别
- 识别完成后进入现有三栏工作台
- 编辑语义卡片后可保存草稿
- 刷新页面后可恢复草稿
- 无 reviewed-case 上下文时，旧高级编辑器仍可正常打开

### 回归

- V2A 现有 reviewed-case workbench 用例全部保持通过
- gold case 六类规则包结果不回归
- 不出现 publish / compile runtime 入口

## 分阶段建议

V2B 建议拆两小步：

### V2B-1

- 直传示例对
- 临时 source session
- 通用 workspace 入口
- 接入现有工作台

### V2B-2

- 本地草稿保存与恢复
- 恢复策略与冲突保护

这样可以先把“上传即可进工作台”做成闭环，再补草稿体验，风险更小。

## 结论

V2B 最稳的推进方式不是把规则中心直接并进完整 manuscript ingestion，而是：

- 用轻入口先打通示例直传
- 在服务层建立统一 source contract
- 在前端加轻量草稿保存
- 保持规则包识别、preview、运行时规则真源不变

这样既能尽快满足当前录入效率目标，也能为未来接入 `manuscript ingestion` 保留一条成本可控的升级路径。

## 实施状态（2026-04-11）

V2B 已完成：

- 规则中心已支持直接上传 `原稿 + 编后稿` 示例对，并创建临时 `example source session`
- 后端已支持 `reviewed_case / uploaded_example_pair` 两类 source 的统一 workspace 入口
- uploaded session 与 reviewed-case 现在都通过同一套 rule-package engine 生成候选
- 前端工作台已接入“示例驱动录入”入口，并默认进入 package-first 录入界面
- 语义草稿已支持按 source identity 做本地自动保存与恢复
- reviewed-case 旧入口已保留，未因 V2B 回归

本阶段仍明确未做：

- 语义确认结果编译为正式 `editorial_rule`
- 规则包发布、审核、审批流
- 知识投影、知识回链、知识优先调用
- `manuscript ingestion` 驱动的第三类 source

当前验收状态：

- `pnpm --filter @medsys/web test` 已通过
- `pnpm --filter @medical/api test -- editorial-rules` 已通过
