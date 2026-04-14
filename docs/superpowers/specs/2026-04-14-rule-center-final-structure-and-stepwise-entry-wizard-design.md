# 2026-04-14 Rule Center Final Structure And Stepwise Entry Wizard Design

**Date**

2026-04-14

**Status**

Approved in conversation, draft for written review

**Goal**

Turn the current rule-center direction into a simple, Chinese-first, ledger-first operations surface that feels like the knowledge library instead of a backend configuration console.

This document locks two product outcomes:

- the final information architecture for `规则中心`
- the final five-step authoring flow for `新增 / 编辑规则`

The system is still an internal beta. The design must therefore optimize for:

- simple daily operation
- low learning cost
- strong AI assistance
- clear traceability
- hidden advanced settings

## Relationship To Earlier Specs

This document refines and partially supersedes the following earlier directions:

- [2026-04-13-rule-center-ledger-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-rule-center-ledger-governance-redesign-design.md)
- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md)

The earlier rule-center redesign correctly moved toward a ledger-first model, but it still exposed too much governance structure too early.

The latest approved direction is simpler:

- rule center should behave like a governed knowledge ledger
- the operator should not need to understand internal authoring architecture before starting work
- templates, packages, semantic understanding, and routing still exist, but appear through one unified work model

## Final Product Decisions

The following decisions are treated as locked.

### 1. Rule center should not feel like a management console

The operator-facing page should not read like a backend control plane full of authoring nouns and routing concepts.

It should instead feel like:

- a unified rule ledger
- a governed knowledge table
- one consistent add/edit model
- one consistent AI semantic confirmation model

### 2. Main work posture is table-first

The primary work surface is:

- top command bar
- central dense ledger table
- compact current-item detail area

The page must not depend on:

- large hero cards
- long explanatory banners
- always-open oversized right drawers
- permanent multi-panel governance consoles

### 3. Advanced functions stay hidden

Advanced functions are allowed, but only in bounded places:

- stepwise wizard pages
- temporary drawers
- secondary subpages

High-frequency work should remain visible. Low-frequency governance should stay tucked away.

### 4. One unified rule model

The operator should experience one unified rule governance model, even though the system still manages multiple governed asset types.

Those governed types remain:

- rules
- large template families
- journal templates
- general proofreading packages
- medical specialized packages
- recycled candidate items from learning / quality feedback

But they should appear as categories, tabs, filters, or tightly related subpages inside one family, not as a maze of disconnected authoring pages.

### 5. Learning review is folded into rule center

The old low-frequency learning review concept should not remain a lonely top-level destination.

Its new role is:

- a reusable rule feedback and candidate intake surface
- a `回流候选` or equivalent child view inside rule center

This keeps quality improvement active and reusable instead of burying it as a rarely used menu.

### 6. General and medical proofreading content live inside rule center

The user-approved direction is to treat `通用校对` and `医学专业校对` as governed rule-package assets maintained inside rule center.

They are not separate operator worlds.

### 7. New and edit flows use one stepwise wizard

All new rule authoring and rule editing should use the same five-step model:

1. `基础录入与证据补充`
2. `AI 识别语义层`
3. `人工确认 AI 结果`
4. `放入模板 / 规则包`
5. `保存与发布`

The main ledger should never become the permanent location for complex editing.

## Problem Statement

The current and earlier designs miss the target in six ways:

1. They expose internal governance concepts too early.
   Operators are asked to think like rule engineers before they can do basic work.

2. They split closely related assets into too many mental models.
   Templates, modules, packages, and candidates feel like different products instead of one rule-governance family.

3. They do not explain rule intake clearly enough.
   The missing operator question was: how do I enter a rule, let AI understand it, review it, and put it into a usable package?

4. They make daily work feel heavier than knowledge entry.
   The user wants the rule center to be as easy to operate as the knowledge library.

5. They risk making AI look like a template-only gimmick.
   The system's value should be AI understanding plus governed routing, not only template application.

6. They leave the learning-feedback surface underused.
   Quality feedback must feed reusable governed rules, not become an orphan page.

## Scope

### In Scope

- the final operator-facing structure for rule center
- the final five-step rule authoring wizard
- the approved downstream binding logic into packages and template families
- publication states for governed rule assets
- the relationship between rules and manuscript workbenches in V1

### Out Of Scope

- replacing all backend governance data models in one pass
- redesigning Harness inside this document
- redesigning AI provider configuration inside this document
- full spreadsheet inline editing for every table cell
- automatic journal inference for every manuscript in V1
- batch AI reclassification across many rules in the first pass

## Final Information Architecture

The final operator model is a light home page plus one unified working family.

### 1. Rule center home

This page should be light and short.

Responsibilities:

- compact metrics
- quick entry actions
- recent pending items
- recent package/template updates
- entry points into deeper working views

It should not contain:

- full editing forms
- long descriptions
- permanent review consoles
- deeply nested management panels

### 2. Unified rule ledger

This is the main daily working page.

Recommended page shape:

- top command bar
- dense central table
- compact selected-item detail area below the table or in a secondary bounded panel

Recommended top command bar actions:

- `新建规则`
- `搜索`
- `筛选`
- `批量操作`
- `导入`

Recommended default table columns:

- rule name
- category or package type
- applicable module
- applicable manuscript type
- semantic status
- publish status
- contributor
- updated at

Recommended category switches or tabs:

- `全部资产`
- `规则`
- `大模板`
- `期刊模板`
- `通用包`
- `医学专用包`
- `回流候选`

This page must feel like one ledger with category lenses, not a different product each time the user switches the filter.

### 3. Secondary child views

The system may still provide dedicated child views when a single ledger becomes too dense.

The approved child-view family is:

- `大模板台账`
- `期刊模板台账`
- `规则包台账`
- `回流候选台账`

`规则包台账` may internally switch between:

- `通用校对包`
- `医学专业校对包`

Implementation may choose either:

- one unified ledger with category switches
- or a lightweight home page plus these dedicated child pages

But the product behavior must stay consistent:

- same table-first posture
- same command bar language
- same add/edit entry model
- same AI semantic confirmation logic

## Rule Record Model

Every governed rule record should expose five operator-facing layers.

### 1. Human-authored content layer

This is the source content entered by the operator.

Examples:

- rule title
- rule body
- examples
- source basis
- notes

### 2. Evidence layer

This is the supporting evidence that helps AI understand and classify the rule more accurately.

Examples:

- positive example
- negative example
- image
- figure or table
- screenshot
- source excerpt
- applicable scope
- exclusion scope

### 3. Semantic layer

This is the AI-generated structured understanding, confirmed by a human.

Examples:

- rule type
- risk level
- semantic summary
- trigger cues
- inapplicable conditions
- suggested package or template family

### 4. Binding layer

This is where the rule is routed into downstream governed assets.

Examples:

- package assignment
- template family assignment
- applicable execution module
- recommendation visibility

### 5. Lifecycle layer

This tracks governance status.

Examples:

- draft
- pending review
- published
- recycled candidate
- updated by
- updated at

## Final Add/Edit Interaction Model

Rule center add/edit should no longer be a permanent form inside the ledger.

It should use:

- one shared wizard for `new`
- the same wizard for `edit`
- optional quick-view and quick-actions from the ledger

The ledger remains the browsing surface. The wizard becomes the authoring surface.

## Final Five-Step Wizard

The following five steps are approved.

### Step 1. `基础录入与证据补充`

This step is not a plain form. It should behave like a knowledge-library entry canvas.

Layout intent:

- top area for key fields
- central content-block canvas
- secondary AI guidance rail
- advanced tags hidden in a drawer

Visible high-frequency fields:

- rule name
- applicable module
- source type
- contributor

Content blocks:

- rule body
- positive example
- negative example
- image / figure / screenshot
- source basis
- applicable scope / exclusion scope

Advanced drawer items:

- manuscript types
- sections
- error types
- risk tags
- package hints
- candidate-only flag
- conflict notes

AI guidance on this page should explicitly tell the operator what helps recognition:

- positive and negative examples
- source basis
- exclusion conditions
- before/after comparison

### Step 2. `AI 识别语义层`

This step is a reading and understanding page, not another authoring page.

Its purpose is to let the user quickly understand:

- what AI recognized
- why AI recognized it that way
- which conclusions are stable
- which conclusions need human attention

Recommended visible outputs:

- rule type
- risk level
- applicable scenario
- suggested package
- semantic summary
- trigger explanation
- inapplicable conditions
- confidence score
- evidence trace preview

Actions on this page:

- rerun recognition
- go back and add more evidence
- continue to human confirmation

### Step 3. `人工确认 AI 结果`

This page is for correction, not re-entry.

The confirmed pattern is:

- one card per decision dimension
- AI recommendation on one side
- human correction options on the other side
- high-confidence items support one-click acceptance

High-frequency editable dimensions:

- rule type
- risk level
- applicable execution modules
- applicable manuscript types
- semantic summary

Low-frequency fixes should stay in an advanced drawer:

- sections
- exclusions
- conflict rules
- second-review requirement
- candidate-only routing

The page should also show a compact change summary so the operator can see what they changed.

### Step 4. `放入模板 / 规则包`

This step should translate governance into business language.

The operator should decide:

- which package this rule enters
- which large template families it binds to
- which business modules can call it
- whether it appears as a recommended reusable item

The page should also preview impact:

- which workbenches will use it
- which template families inherit it
- whether it remains outside journal-specific templates by default

Advanced binding controls may exist, but only inside a drawer.

### Step 5. `保存与发布`

This is a clean closing page.

It should show:

- final summary
- release state choices
- impact after save or publish
- simple pre-submit checklist

Only three release states are needed in the main path:

- `保存草稿`
- `提交审核`
- `直接发布`

For the internal beta, the recommended default is:

- `提交审核`

After completion, the system should return the user to the rule ledger and highlight the newly created or updated row.

## Downstream Binding Logic For Manuscript Workbenches

The following V1 runtime logic is already approved and must remain aligned with rule-center design.

### Manuscript routing logic

1. AI auto-detects manuscript type after upload
2. system auto-binds the matching large template family
3. journal template does not auto-apply by default
4. if journal identity is unknown, use the corresponding base family
5. the operator may manually choose a journal template from a dropdown

### Correction logic

If AI classifies manuscript type incorrectly:

- the user corrects manuscript type
- the system remaps the large template family
- the user does not directly choose internal template-family ids as the first correction step

### Why this matters to rule center

Rule center is not just a storage area.

Its outputs feed the downstream chain:

`规则 -> 规则包 / 大模板族 -> 工作台调用`

This means rule-center routing must remain understandable at the operator level, but the technical binding chain should stay behind the scenes.

## UI Rules For The Final Rule Center

These rules are mandatory.

### 1. Chinese-first visible language

All editable, user-facing labels should be Chinese wherever translation is safe.

Do not rename:

- route ids
- backend field keys
- API payload structure
- internal code enums unless implementation explicitly handles compatibility

### 2. No oversized page intros

Rule center pages should not waste the first screen on explanation.

Allowed:

- compact title row
- compact status strip
- compact metrics on home page

Disallowed:

- marketing hero cards
- long prose intros
- oversized stat bands

### 3. Keep the page short

The user explicitly wants rule review and governance pages to avoid feeling endlessly long.

Required behavior:

- dense tables
- bounded detail panels
- drawer-based advanced settings
- wizard steps that each focus on one decision

### 4. Reuse knowledge-library interaction logic where possible

Rule center should inherit from the validated knowledge-library model:

- table-first
- simple top command bar
- temporary add/edit surface
- AI semantic layer confirmed before final governance state

### 5. Do not expose AI configuration here

Model selection, temperature, API provider setup, and similar control-plane concerns belong in AI configuration areas, not in the operator-facing rule wizard.

## Non-Goals And Guardrails

The system should avoid the following in V1:

- forcing operators to choose manuscript type before upload
- forcing operators to understand template architecture before adding a rule
- automatically applying journal templates without explicit journal context
- keeping learning review as a separate major navigation destination
- duplicating Harness controls inside rule center
- turning the rule ledger into a dense backend settings table

## Recommended Rollout

Implementation should happen in this order:

1. simplify the rule-center home page
2. create the unified rule ledger
3. wire `new` and `edit` into the shared five-step wizard
4. fold `回流候选` into rule-center child views
5. align package and template-family labels with the approved operator language

This sequence preserves the current backend while moving the visible experience closer to the approved product shape.

## Acceptance Criteria

The redesign should be considered aligned only if the following are true:

- operators can add a new rule without first understanding internal governance architecture
- the main rule-center page feels like a ledger, not a backend console
- AI semantic understanding is visible, editable, and traceable
- package and template binding are understandable in business language
- advanced settings are present but hidden by default
- general proofreading and medical specialized content are maintained inside rule center
- learning feedback is folded back into rule governance instead of isolated elsewhere
- downstream manuscript routing still follows the approved V1 logic
