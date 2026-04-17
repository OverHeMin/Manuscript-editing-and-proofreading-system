# 2026-04-16 Rule Center And Knowledge Entry Boundary V1 Implementation Summary

**Date**

2026-04-16

**Status**

Execution summary synced to the branch state verified on 2026-04-17

**Primary Reference**

Use this summary together with:

`docs/superpowers/specs/2026-04-16-rule-center-and-knowledge-entry-boundary-v1-design.md`

## 1. One-Sentence Boundary

`规则中心` 承载可执行规则与规则包，`知识库` 承载可检索依据与解释性知识，规则可以引用知识，但知识库不再作为普通用户录入可执行规则的主入口。

## 2. What Has Been Implemented

### 2.1 Knowledge entry defaults

The normal knowledge-entry default has been aligned away from executable rules:

- `knowledgeKind = "reference"` is now the default for general knowledge creation.
- This applies both to the newer knowledge ledger composer and to the hidden knowledge draft seed still present in the template-governance workbench.

Practical meaning:

- 普通知识录入默认是“依据 / 参考 / 可检索知识”。
- 不再让普通录入入口默认落成 `rule`。

### 2.2 Legacy knowledge workbench structured controls

The legacy knowledge workbench has already been retrofitted to stop relying on comma-separated primary entry for structured routing fields.

Implemented control behavior:

- `稿件类型`: structured multi-select with `"any"` support
- `章节`: structured multi-select
- `风险标签`: repeated tag-style input rows
- `学科标签`: repeated tag-style input rows
- `别名`: repeated tag-style input rows

Practical meaning:

- 旧知识工作台现在更接近正式受控录入，而不是自由文本拼接。
- 这条线已经符合“哪些应该下拉/多选，哪些应该标签输入”的 V1 设计原则。

### 2.3 Advanced rule authoring linked knowledge

The advanced rule-authoring surface in `规则中心` already supports explicit linked knowledge selection.

Implemented behavior:

- Rule authoring drafts include `linkedKnowledgeItemIds`.
- The form can receive available knowledge items from the workbench shell.
- Serialization and hydration use `linkage_payload.projected_knowledge_item_ids`.

Practical meaning:

- 在高级规则作者页里，规则可以明确关联知识条目作为依据。
- 这已经是当前分支上真实打通的“规则引用知识”路径。

### 2.4 Rule wizard structured advanced routing controls

The rule wizard has been aligned with the same structured-entry direction for its high-frequency advanced routing fields.

Implemented wizard controls:

- `稿件类型`: structured multi-select
- `章节标签`: structured multi-select
- `风险标签`: tag-list rows
- `规则包提示`: tag-list rows

Implemented data behavior:

- The wizard entry form now normalizes legacy string inputs into arrays.
- Draft-save and hydration paths accept both legacy string input and normalized structured state.
- Existing callers that still pass comma-separated strings are normalized instead of breaking.

Practical meaning:

- 规则向导里这些字段现在“看起来是结构化控件，保存时也真的是结构化状态”，不再只是 UI 换皮。

Additional implemented behavior:

- the confirm step now uses a structured multi-select for `稿件类型`
- the confirm step now uses tag-list rows for `检索词`
- AI semantic summaries, applicable-scenario copy, and binding-step impact previews now render manuscript-type labels in operator-facing Chinese rather than raw enum strings

### 2.5 Rule wizard linked knowledge persistence and grouped selection

The rule wizard binding step now supports minimal but real linked-knowledge persistence.

Implemented behavior:

- The binding step loads approved non-`rule` knowledge items from the knowledge library.
- Operators can explicitly select linked knowledge items in the wizard binding step.
- The linked-knowledge selector is now searchable and grouped by `知识类型`.
- Each linked-knowledge option now shows `知识类型 / 发布状态 / 模块` in Chinese labels, and the binding-step impact preview now shows operator-facing `稿件类型` labels instead of raw enum values.
- Saving the wizard now emits `knowledge_item` revision bindings.
- Editing an existing wizard-created rule can hydrate those linked knowledge bindings back into the binding step.

Practical meaning:

- `规则向导` is no longer limited to package + template-family binding only.
- The branch now contains a second real path, in addition to advanced rule authoring, where rules can explicitly point to supporting knowledge.

### 2.6 Intentional wizard rule persistence

The rule wizard still saves draft assets as:

- `knowledgeKind = "rule"`

This is intentional.

Reason:

- The wizard is a rule-creation surface.
- It is not the general knowledge-entry surface.
- So this path should continue creating rule assets rather than defaulting to `reference`.

### 2.7 Governed runtime linked-knowledge bridge

The governed runtime now includes a minimal but real bridge from authored bindings into execution context.

Implemented behavior:

- approved knowledge bound at the `template_family` level can now be selected into governed runtime context
- when a selected approved knowledge item carries `knowledge_item` bindings, the runtime expands approved linked knowledge items into `knowledgeSelections`
- expanded linked items are recorded with `matchSource = "knowledge_item_binding"` and a parent-aware `matchSourceId`

Practical meaning:

- `规则中心` 中显式关联的知识，不再只是“保存下来了”，而是已经能沿着最小主链路进入 governed runtime
- 这使“规则 + 关联知识一起生效”从 authoring/binding persistence 前进到了 runtime consumption

### 2.8 Knowledge entry parameter guidance

The newer knowledge-ledger entry board now explains the boundary and the meaning of key fields directly in-page.

Implemented behavior:

- the create/edit board explicitly explains that `知识库` stores evidence, explanations, and references rather than executable rules
- `分类`, `适用模块`, and `必要标签` now each show in-page helper copy about what the field controls

Practical meaning:

- 录入知识时，页面本身会先回答“为什么这里不是规则中心”。
- 业务人员不需要只靠口头约定去猜 `分类 / 适用模块 / 必要标签` 的填写含义。

### 2.9 Knowledge ledger structured entry controls

The newer knowledge-ledger entry board has moved further away from text-only routing input.

Implemented behavior:

- `必要标签` now uses structured repeated tag rows instead of a comma-separated text box
- `稿件类型` now uses a searchable multi-select with `"全部 / 任意"` support
- `章节标签` now uses a searchable structured multi-select instead of being hidden only in stored draft state
- `证据等级` and `来源类型` are now exposed as controlled dropdowns in the newer knowledge-ledger entry board

Practical meaning:

- 新知识台账入口不再只是“内部能存结构化值”，而是把这些结构化字段真的开放给录入人员操作。
- “哪些适合单选/多选/标签录入”的边界，在新知识入口里又往前统一了一步。
- 录入人员现在可以直接判断这条知识更接近“高证据/一般参考/待补充”以及“指南/论文/内部案例”等来源类型。

### 2.10 More user-facing labels for table proofreading guidance and governance summaries

Some high-traffic governance surfaces now show business-facing Chinese labels instead of raw code values.

Implemented behavior:

- the `表格专项知识模板` cards now render readable labels for `knowledgeKind`, `sourceType`, and `evidenceLevel`
- the rule wizard linked-knowledge selector now renders `知识类型 / 发布状态` in Chinese labels instead of raw enum strings
- retrieval-signal cards in the rule-center workbench now render `retrieval_drift`, `missing_knowledge`, and similar signal kinds with Chinese labels
- instruction-template summaries now render `allowed_content_operations` and `forbidden_operations` with operator-facing Chinese wording instead of raw enum strings

Practical meaning:

- 页面上更少出现 `reference / guideline / high / approved` 这类只对开发友好的值。
- 一线同学在规则绑定和表格专项入口里更容易看懂这些参数。

### 2.11 Historical rule compatibility is now explicit

The branch now distinguishes between new knowledge creation and historical `rule`-typed knowledge more clearly.

Implemented behavior:

- normal knowledge creation no longer offers `rule` as a regular category in the newer knowledge-ledger entry board
- when editing a historical `rule` knowledge item, the select now renders `规则投影（历史兼容）`
- ledger list, legacy knowledge workbench, and legacy knowledge grid surfaces now render historical `rule` knowledge as `规则投影`

Practical meaning:

- 新录知识不会再误导业务同学把“可执行规则”录进知识库。
- 历史存量 `rule` 数据仍可继续查看和维护，但页面会明确告诉使用者这属于兼容投影，而不是推荐的新录入方式。

### 2.12 Core entry vocabularies are now shared

The branch now centralizes the main controlled vocabularies used by knowledge-entry and rule-center entry surfaces.

Implemented behavior:

- `稿件类型`, `章节标签`, `证据等级`, `来源类型`, and `知识分类` labels/options now share a common taxonomy module
- the newer knowledge-ledger board, legacy knowledge workbench, rule wizard entry step, extraction task form, and key rule-center display surfaces now read from that shared taxonomy
- linked-knowledge labels in rule-center display surfaces inherit the same historical `规则投影` wording

Practical meaning:

- 这些核心参数不再由多个页面各自维护一套枚举和中文文案。
- 后续如果要补充稿件类型、章节标签或兼容标签，维护成本会明显降低，也更不容易出现“这里叫法和那里不一样”的问题。

## 3. What This Means for Product Boundary

### 3.1 Rule Center

`规则中心` should be understood as the place for:

- 可执行规则
- 规则集
- 规则包
- 表格校对规则
- 规则与知识依据的显式关联

### 3.2 Knowledge Library

`知识库` should be understood as the place for:

- 依据
- 解释
- 参考
- 审核标准说明
- 例外条件
- 可被检索的补充知识

### 3.3 Table proofreading

For the user's original confusion, the boundary is now explicit:

- “表格校对规则” belongs in `规则中心`
- “表格校对依据 / 解释 / 期刊特殊要求 / 为什么这样判” belongs in `知识库`

一句话：

`规则决定系统怎么做，知识说明系统为什么这么做。`

## 4. What Remains Beyond This V1 Slice

The original P0, P1, and P2 boundary items for this slice are now in place. What remains is no longer about entry-boundary correctness, but about richer governance depth beyond V1.

### 4.1 Richer linked-knowledge governance metadata

- The stored relationship is still a lightweight revision binding.
- This pass does not yet add richer per-link metadata such as weighting, explanation fields, ranking, or review notes.

### 4.2 Richer downstream observability and provenance

- The runtime bridge is now real and verified, but downstream analytics and explanation surfaces have not been redesigned around the new binding kind yet.
- Runtime provenance still keeps a single primary `matchSource`; if one knowledge item is both dynamically selected and linked, the current implementation merges the linked reason but does not expose multiple first-class source records.

## 5. Guidance for Follow-Up Threads

If another thread continues the work, use this order of judgment:

1. 要新增“表格校对规则”，进入 `规则中心`。
2. 要新增“表格校对依据、解释、例外说明、期刊要求”，进入 `知识库`。
3. 要做“规则显式关联知识”，优先沿用当前高级规则作者页已经打通的路径。
4. 如果后续要继续增强“规则向导关联知识”，优先做更细的 per-link metadata、解释面板，以及下游消费该绑定的分析视图。

## 6. Verification Evidence

The following commands were run and passed in this branch:

- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/searchable-multi-select.spec.tsx ./test/knowledge-library-ledger-composer.spec.ts ./test/template-governance-rule-authoring.spec.ts`
- `pnpm --filter @medsys/web typecheck`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/shared/governed-module-context.spec.ts ./test/modules/governed-module-context-resolver.spec.ts ./test/database/schema.spec.ts`
- `pnpm --filter @medical/api typecheck`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-composer.spec.ts ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-composer.spec.ts ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/template-governance-rule-authoring.spec.ts`
- `pnpm --filter @medsys/web typecheck`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-workbench-page.spec.tsx`
- `pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-ledger-page.spec.tsx ./test/knowledge-library-workbench-page.spec.tsx ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/searchable-multi-select.spec.tsx`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/database/schema.spec.ts`
- `pnpm --filter @medical/api typecheck`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/shared/governed-module-context.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/modules/governed-module-context-resolver.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/shared/governed-module-context.spec.ts ./test/modules/governed-module-context-resolver.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/execution-tracking/execution-tracking.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/modules/module-orchestration.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-checker.spec.ts`

All listed commands completed with exit code `0`.

Additional verification note:

- `pnpm --filter @medical/api test` did not finish within the local 124042 ms timeout, so it was not used as passing evidence for this summary.

## 7. Dirty Worktree Note

The branch still contains unrelated pre-existing dirty files outside this implementation slice, including:

- `.githooks/pre-push`
- `scripts/local-pr-gate.mjs`

Those files were intentionally left untouched.
