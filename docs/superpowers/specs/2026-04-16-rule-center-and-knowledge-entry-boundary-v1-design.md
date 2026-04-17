# 2026-04-16 Rule Center And Knowledge Entry Boundary V1 Design

**Date**

2026-04-16

**Status**

Approved in conversation as the V1 baseline for rule-center and knowledge-library entry design

**Goal**

Give one written baseline that another implementation thread can use while improving `规则中心` and related entry flows.

This document fixes the most important V1 ambiguity:

- what belongs in `规则中心`
- what belongs in `知识库`
- how `规则` and `知识` relate at runtime
- which entry fields should be dropdowns, multi-selects, tags, free text, or system-generated values

## 1. Final Product Decisions

The following decisions are locked for V1.

### 1.1 Ownership boundary

- `规则中心` owns executable governance assets:
  - 模板族
  - 期刊模板
  - 规则集
  - 单条规则
  - 通用包
  - 医学专用包
  - 模板组合
  - 回流候选
- `知识库` owns retrievable reference assets:
  - 参考依据
  - 核查清单
  - 案例模式
  - 提示片段
  - 其他解释性知识

One sentence:

`规则中心决定系统怎么做，知识库决定系统为什么这么判断。`

### 1.2 Runtime relationship

Rules do use knowledge, but not as ad hoc direct lookups from each rule.

The stable V1 model is:

1. resolve manuscript type
2. resolve template family and journal template
3. load rule sets and rule packages
4. retrieve approved knowledge by module, manuscript type, sections, risk tags, and bindings
5. run module logic with both rule context and knowledge context

One sentence:

`规则不直接裸查知识库，运行时编排层按绑定和路由把知识送进规则与 AI 上下文。`

### 1.3 Table proofreading ownership

Table proofreading belongs primarily to `规则中心`, not `知识库`.

Examples that belong in `规则中心`:

- 表号是否连续
- 表题位置是否正确
- 单位是否统一
- 小数位是否一致
- 表注是否补齐
- `n`、`%`、`P` 值写法是否统一

Examples that belong in `知识库`:

- 某类统计表达为何这样要求
- 某期刊对三线表的特殊说明
- 特定学科表格单位使用的依据
- 无法自动稳定判断时给人工复核的参考依据

### 1.4 Frontend rule for `knowledge_kind = rule`

The current contract still contains `knowledge_kind = "rule"` for compatibility and projection use.

For V1 product UI:

- regular users should not create new executable rules through the knowledge library
- `knowledge_kind = rule` should be hidden from normal entry flows
- it may remain available for admin-only compatibility, imported legacy data, or rule-projection records

One sentence:

`可执行规则一律进规则中心，知识库里的 rule 仅作兼容保留，不作日常录入入口。`

### 1.5 Vocabulary unification

Any older wording that implies `模板由知识库统一管理` should be treated as outdated for V1 UI ownership.

The V1 wording should be:

- `规则中心治理模板、规则、规则包`
- `知识库治理知识条目及其绑定`

## 2. User-Facing Workflow Baseline

The operator-facing baseline remains:

1. 上传稿件
2. AI 识别稿件类型
3. 人工确认稿件类型
4. 选择模板族和期刊模板
5. 加载规则集、通用包、医学专用包
6. 检索已审核知识
7. 执行业务模块
8. 输出结果

Module behavior must remain distinct:

- `编辑` can generate revised manuscript output
- `校对` does not directly rewrite正文 and should only output structured findings, Word comments, and report

## 3. Recommended Entry IA

### 3.1 Recommended overall approach

Use `对象化引导表单`, not a single giant generic form.

The recommended entry logic is:

1. choose asset family
2. choose owned object
3. show object-specific fields
4. attach routing, bindings, and evidence
5. submit into review/publish flow

### 3.2 Rule center entry surfaces

Rule center should expose four distinct authoring surfaces:

1. `规则集基础信息`
2. `规则对象编辑器`
3. `知识关联`
4. `发布与审阅`

### 3.3 Knowledge library entry surfaces

Knowledge library should expose three distinct authoring surfaces:

1. `知识正文`
2. `路由范围`
3. `来源与绑定`

This keeps knowledge entry focused on retrieval and evidence instead of execution behavior.

## 4. Rule Center V1 Form Design

## 4.1 Rule set form

This is the parent record for a coherent set of rules.

| Field | Key | Control | Required | Meaning |
| --- | --- | --- | --- | --- |
| 模板族 | `template_family_id` | searchable dropdown | yes | which manuscript family this rule set belongs to |
| 期刊模板 | `journal_template_id` | searchable dropdown | no | journal-specific overlay scope |
| 执行模块 | `module` | dropdown | yes | screening / editing / proofreading |
| 版本号 | `version_no` | auto-generated | no | system-managed version |
| 状态 | `status` | auto-generated | no | default `draft` until publish |

### 4.1.1 Validation

- if `journal_template_id` is selected, `template_family_id` must also exist
- one scope should not create duplicate active baselines for the same family + journal + module + version

## 4.2 Rule item common form

This is the child record that defines one executable rule.

| Field | Key | Control | Required | Meaning |
| --- | --- | --- | --- | --- |
| 规则对象 | `rule_object` | dropdown | yes | which editorial object the rule controls |
| 顺序 | `order_no` | number | yes | execution order inside the rule set |
| 规则类型 | `rule_type` | dropdown | yes | format / content / structure-like class |
| 执行方式 | `execution_mode` | dropdown | yes | apply / inspect / apply_and_inspect |
| 置信策略 | `confidence_policy` | dropdown | yes | always_auto / high_confidence_only / manual_only |
| 严重级别 | `severity` | dropdown | yes | info / warning / error |
| 是否启用 | `enabled` | toggle | yes | whether this rule participates in execution |
| 证据级别 | `evidence_level` | dropdown | yes | low / medium / high / expert_opinion / unknown |
| 示例前 | `example_before` | text | no | example of unnormalized input |
| 示例后 | `example_after` | text | no | example of normalized or target output |
| 人工复核原因 | `manual_review_reason_template` | short text | no | operator-facing reason when automation must stop |
| 关联知识条目 | related knowledge IDs | searchable multi-select | no | evidence or exception knowledge linked to this rule |

### 4.2.1 Internal fields

These exist in the backend model but should not be hand-authored in the normal V1 form:

- `scope`
- `selector`
- `trigger`
- `action`
- `explanation_payload`
- `linkage_payload`
- `projection_payload`

Normal operator flow should edit object fields only. The system generates these structured payloads.

## 4.3 Rule object dictionary

The object dictionary should stay aligned with the current owned rule-authoring model:

- `abstract`
- `heading_hierarchy`
- `numeric_unit`
- `statistical_expression`
- `table`
- `reference`
- `declaration`
- `statement`
- `title`
- `author_line`
- `keyword`
- `terminology`
- `figure`
- `manuscript_structure`
- `journal_column`

## 4.4 Table rule form

Because table proofreading is a high-confusion area, it should have its own object card.

| Field | Key | Control | Required | Meaning |
| --- | --- | --- | --- | --- |
| 预期表格形态 | `tableKind` | dropdown | yes | three-line table, baseline table, outcome table, etc. |
| 语义目标 | `semanticTarget` | dropdown | yes | which semantic cell class is being checked |
| 表头路径 | `headerPathIncludes` | tag input | conditional | semantic path for header-focused checks |
| 行标识 | `rowKey` | assisted text / tag | conditional | stable row identifier |
| 列标识 | `columnKey` | assisted text / tag | conditional | stable column identifier |
| 脚注类型 | `noteKind` | dropdown | conditional | statistical significance, abbreviation, general |
| 单位上下文 | `unitContext` | dropdown | conditional | header / stub / footnote |
| 表题要求 | `captionRequirement` | short text | yes | expected caption placement or form |
| 版式要求 | `layoutRequirement` | short text | yes | layout expectations |
| 人工复核原因 | `manualReviewReasonTemplate` | short text | yes | why a human should review this finding |

### 4.4.1 Table defaults

For proofreading-oriented table rules, recommended defaults are:

- `execution_mode = inspect`
- `confidence_policy = manual_only` or `high_confidence_only`
- `severity = warning`

Do not default table proofreading rules to blind auto-apply.

### 4.4.2 Table validation

- if `semanticTarget = header_cell`, `headerPathIncludes` is required
- if `semanticTarget = stub_column`, `rowKey` is required
- if `semanticTarget = data_cell`, `rowKey` and `columnKey` are required
- if `semanticTarget = footnote_item`, `noteKind` is required
- if the rule checks unit issues at a data-cell level, `unitContext` is required

## 5. Knowledge Library V1 Form Design

Knowledge entry should be an `依据卡`, not an execution-rule editor.

| Field | Key | Control | Required | Meaning |
| --- | --- | --- | --- | --- |
| 标题 | `title` | text | yes | human-readable title |
| 标准表述 | `canonical_text` | long text | yes | authoritative version of the content |
| 摘要 | `summary` | short text | no | compact explanation for browsing |
| 知识类型 | `knowledge_kind` | dropdown | yes | reference, checklist, case pattern, prompt snippet, other |
| 模块范围 | `module_scope` | dropdown | yes | screening / editing / proofreading / any |
| 稿件类型 | `manuscript_types` | multi-select dropdown | yes | applicable manuscript types |
| 章节 | `sections` | multi-select dropdown | no | applicable sections |
| 风险标签 | `risk_tags` | tag input | no | risk dimensions for retrieval |
| 学科标签 | `discipline_tags` | tag input | no | subject tags |
| 证据级别 | `evidence_level` | dropdown | no | evidence strength |
| 来源类型 | `source_type` | dropdown | no | paper / guideline / book / website / internal case / other |
| 来源链接 | `source_link` | text | no | original source URI |
| 别名 | `aliases` | tag input | no | synonyms and retrieval terms |
| 生效时间 | `effective_at` | date-time | no | when the knowledge becomes active |
| 失效时间 | `expires_at` | date-time | no | when the knowledge should stop applying |
| 绑定目标 | bindings | searchable multi-select | no | template family, module template, journal template, general package, medical package |

### 5.1 Knowledge type presentation

Recommended normal-user labels:

- `reference` -> `参考依据`
- `checklist` -> `核查清单`
- `case_pattern` -> `案例模式`
- `prompt_snippet` -> `提示片段`
- `other` -> `其他`

Recommended admin-only compatibility label:

- `rule` -> `规则投影 / 兼容资产`

### 5.2 Knowledge validation

- new manually-created knowledge should default to `pending_review`
- only `approved` knowledge may enter production retrieval
- `expires_at` must not be earlier than `effective_at`
- if a binding targets a journal template, the matching family context must be valid

## 6. Control-Type Standard

## 6.1 Must be dropdown or multi-select

These fields should not remain free text in V1:

| Field family | Fields |
| --- | --- |
| rule controls | `rule_object`, `rule_type`, `execution_mode`, `confidence_policy`, `severity`, `evidence_level` |
| rule scope | `module`, `template_family_id`, `journal_template_id` |
| knowledge routing | `knowledge_kind`, `module_scope`, `manuscript_types`, `sections`, `source_type`, `evidence_level` |
| table-specific | `tableKind`, `semanticTarget`, `noteKind`, `unitContext` |
| bindings | binding target kind and target record |

## 6.2 Should be tag input with suggestions

These fields should support suggestion-assisted token entry:

- `risk_tags`
- `discipline_tags`
- `aliases`
- `headerPathIncludes`
- `rowKey`
- `columnKey`

## 6.3 Should remain free text

These fields are better as text because they carry explanation rather than controlled classification:

- `title`
- `canonical_text`
- `summary`
- `source_link`
- `captionRequirement`
- `layoutRequirement`
- `manualReviewReasonTemplate`
- `example_before`
- `example_after`

## 6.4 Should be system-generated or admin-only

These should not be normal hand-entry fields:

- `status`
- `revision_no`
- `projection_source`
- `source_learning_candidate_id`
- raw `scope`
- raw `selector`
- raw `trigger`
- raw `action`
- raw `explanation_payload`
- raw `linkage_payload`
- raw `projection_payload`

## 7. Controlled Dictionaries

## 7.1 Module scope

Recommended V1 dropdown:

- `any`
- `screening`
- `editing`
- `proofreading`
- `manual`
- `learning`

## 7.2 Manuscript types

Use the fixed type set already defined in contracts:

- `clinical_study`
- `review`
- `systematic_review`
- `meta_analysis`
- `case_report`
- `guideline_interpretation`
- `expert_consensus`
- `diagnostic_study`
- `basic_research`
- `nursing_study`
- `methodology_paper`
- `brief_report`
- `other`

## 7.3 Recommended section dictionary

The product should stop relying on arbitrary comma-separated section text in normal entry flows.

Recommended V1 section dictionary:

- `title`
- `abstract`
- `keywords`
- `introduction`
- `methods`
- `results`
- `discussion`
- `conclusion`
- `references`
- `tables`
- `figures`
- `declarations`
- `front_matter`

### 7.3.1 Advanced fallback

If a legacy or unusual section is needed:

- normal users choose from the controlled list
- admins may use an `其他章节` fallback with explicit review note

## 7.4 Table dictionary

Recommended V1 table dictionaries:

- `tableKind`
  - `three_line_table`
  - `general_data_table`
  - `baseline_characteristics_table`
  - `outcome_indicator_table`
- `semanticTarget`
  - `header_cell`
  - `stub_column`
  - `data_cell`
  - `footnote_item`
- `noteKind`
  - `statistical_significance`
  - `abbreviation`
  - `general`
- `unitContext`
  - `header`
  - `stub`
  - `footnote`

## 8. Immediate Implementation Recommendations

The next implementation thread should treat the following as priority work.

### 8.1 Rule center

- keep the existing object-based rule authoring direction
- add explicit `关联知识条目` selection in the rule authoring flow
- keep raw JSON generation internal
- preserve strong defaults for proofreading table rules

### 8.2 Knowledge library

- replace comma-separated free-text fields for `manuscriptTypes`, `sections`, `riskTags`, `disciplineTags`, and `aliases` with structured controls
- hide `knowledge_kind = rule` from normal entry
- make binding targets searchable and explicit

### 8.3 Cross-system wording

All operator-facing wording should align to:

- `规则中心治理模板、规则、规则包`
- `知识库治理知识条目和依据绑定`

Do not reintroduce wording that blurs ownership between executable rules and retrievable knowledge.

## 9. One-Sentence Baseline

If another thread needs a single-line implementation rule, use this:

`V1 中，可执行资产一律进入规则中心，知识库只录可检索依据；规则通过绑定和运行时路由使用知识，而不是把规则和知识混录在同一入口。`
