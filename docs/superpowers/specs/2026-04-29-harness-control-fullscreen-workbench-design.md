# 2026-04-29 Harness Control Fullscreen Workbench Design

**Date**

2026-04-29

**Status**

Approved and partially implemented. The fullscreen Harness direction was approved in conversation after comparing compact embedded layouts with a dedicated fullscreen workbench. The 2026-04-30 implementation pass has landed the frontend workbench shape, management navigation cleanup, `harnessMode` deep links, legacy hash compatibility, and validation sample-set terminology updates. Backend-only gaps remain listed under residual risks.

**Supersedes**

This design supersedes the navigation and layout assumptions in:

- `docs/superpowers/specs/2026-04-16-harness-unified-page-alignment-design.md`
- `docs/superpowers/specs/2026-04-23-harness-single-page-control-design.md`

Those earlier designs correctly identified that Harness capabilities should be owned by Harness, but they still assumed either a lightweight `管理总览` gateway or a dense all-in-one Harness console. The new decision is stricter:

`Harness 控制` remains the only user-facing entry, but opening it enters a dedicated fullscreen operator workbench.

## Goal

Rebuild `Harness 控制` into a fullscreen operator workbench that lets an operator run candidate-versus-active validation, regression inspection, release gates, single-manuscript diagnosis, and validation sample-set governance without seeing raw asset names or unnecessary internal controls by default.

In one sentence:

`Harness 控制` should feel like a focused validation cockpit, not an admin dashboard, parameter wall, or hidden engineering console.

## Locked Decisions

### 1. Do not add a new top-level product entry

The left navigation should continue to expose one Harness entry:

- `Harness 控制`

There should not be a second top-level entry such as:

- `A/B 验收`
- `发布门`
- `验证样本集`
- `Gold Set`

The change is page shape, not product count.

### 2. Opening Harness enters a fullscreen workbench

The user-approved layout is not an embedded card inside a management overview page.

When the user enters `Harness 控制`, the page should have enough horizontal and vertical room for:

- a mode switcher
- a left settings column
- a wide result and evidence area
- a secondary evidence or decision panel

This can still live inside the existing app shell, but it should visually behave as a dedicated working page rather than a section squeezed into a management summary.

### 3. Remove `管理总览` from the final management area

The final management-area navigation should contain exactly:

- `AI 接入`
- `Harness 控制`
- `账号与权限`

`管理总览` is not needed in the target IA.

This was intentionally delayed while the parallel rule-center and knowledge-table-entry work was active. After that branch landed on `main`, the 2026-04-30 implementation pass completed the navigation cleanup: the management area now exposes exactly `AI 接入 / Harness 控制 / 账号与权限`.

### 4. Keep `规则中心` out of management

`规则中心` already belongs to the knowledge review / knowledge governance area. It should not be reintroduced into the management area to compensate for removing `管理总览`.

### 5. Use `验证样本集`, not `Gold Set`, in the UI

The UI should avoid raw `Gold Set` terminology. The user-facing label is:

- `验证样本集`

Technical code and API names may continue using existing `goldSet` identifiers where changing them would create unnecessary churn.

### 6. Published validation sample sets are immutable

A published validation sample-set version must not be edited directly.

To modify one, the operator should create or copy a draft version, adjust the draft, then publish a new version when all gates pass.

### 7. Compact does not mean cramped

The design must stay compact enough for real operation, but it must not repeat the current problem:

- text squeezed into narrow cards
- buttons too close to each other
- long asset names occupying primary space
- too many controls with unclear value

The target first viewport should show the mode switcher, primary settings, key metrics, and the start of result evidence. Deeper details can scroll inside the right result area or open in a drawer.

## Current Problems To Fix

The existing Harness UI exposes real capabilities, but the page organization is hard to operate.

Observed problems:

- `overview`, `runs`, and `datasets` read as separate sections rather than task modes.
- The current page starts with summaries and status regions instead of the task the user wants to complete.
- Real actions such as preview, run, activate, and rollback are scattered across control components.
- Many low-level names and IDs are visible before the user understands the business choice.
- It is not obvious how to run the user's core workflow: `candidate vs active`, then inspect hit rate, evidence, activation, and rollback.
- Gold-set / dataset work exists, but its purpose is not obvious from the term `数据与样本`.
- The page uses many cards and panels; even when each is technically correct, the overall surface feels complex.

The redesign should preserve real capabilities but change the operator model.

## Target Information Architecture

### Management Area

Target management entries:

| Entry | Purpose |
| --- | --- |
| `AI 接入` | Provider, model, and AI connectivity management. |
| `Harness 控制` | Fullscreen validation and release-control workbench. |
| `账号与权限` | User, role, and access administration. |

Target removals:

- remove `管理总览`
- do not place `规则中心` here

### Harness Internal Modes

Inside `Harness 控制`, use a top segmented mode switcher:

1. `A/B 验收`
2. `回归巡检`
3. `发布门`
4. `单稿诊断`
5. `验证样本集`

These are task modes, not separate products.

Mode state is represented with the `harnessMode` query parameter for shareability. Legacy `harnessSection=overview|runs|datasets` remains supported for compatibility.

## Fullscreen Workbench Layout

### App Bar

Purpose:

- show location and safe exits without stealing attention

Content:

- breadcrumb: `管理区 / Harness 控制 / 当前模式`
- optional `返回管理区`
- optional `打开运行记录`

Rules:

- no large marketing-style hero
- no repeated product explanation after the first release
- no management summary cards

### Workbench Header

Purpose:

- establish current active state and mode

Content:

- title: `Harness 控制`
- one-line summary
- current active environment chip, such as `当前 Active：校对 / 临床研究 / 质量包 v11`
- `高级详情：关闭` chip or toggle
- five-mode segmented switcher

Rules:

- the mode switcher must fit on one row on desktop
- on narrow screens, modes may wrap to two rows or become horizontally scrollable
- the active mode must be obvious

### Main Workspace

Desktop layout:

- left column: 360-420px, preferred 400px
- right column: remaining width
- gap: 14-18px

Left column:

- mode-specific settings
- only visible controls that are necessary for the current mode
- one primary action button

Right column:

- result toolbar
- key metrics
- evidence list or sample list
- detail / decision panel

Rules:

- the left column should not grow into a form wall
- the right side should carry the complexity because evidence needs space
- long names should be business names plus short version labels, not raw IDs
- raw IDs appear only under `高级详情`

## Shared Interaction Rules

### One Primary Button Per Mode

Each mode gets exactly one primary button:

| Mode | Primary button |
| --- | --- |
| `A/B 验收` | `运行 candidate vs active` |
| `回归巡检` | `运行回归巡检` |
| `发布门` | `检查发布门` |
| `单稿诊断` | `诊断单稿` |
| `验证样本集` | context-dependent: `新建草稿版本`, `保存草稿`, or `发布版本` |

Secondary actions go to:

- row actions
- `更多`
- detail drawer
- confirmation dialogs

### Dangerous Actions

Dangerous or state-changing actions must not sit beside ordinary controls as casual buttons.

Examples:

- activate candidate
- rollback scope
- publish validation sample-set version
- archive a draft or version

Rules:

- require an explicit confirmation
- show the affected scope in human-readable terms
- show the reason field where the backend requires it or where audit value is high
- never hide a failed gate behind a green-looking action

### Advanced Details

Default:

- off

When off, hide:

- asset IDs
- binding IDs
- run IDs unless needed for support
- raw JSON
- internal enum values
- long storage paths

When on, show:

- exact IDs
- frozen binding summary
- baseline and candidate raw references
- export paths
- evidence pack IDs

Advanced detail controls should be visible but visually secondary.

### Filtering And Toggles

Use toggles for binary behavior:

- `只看失败`
- `严格门禁`
- `高级详情`
- `自动刷新`

Use dropdowns for bounded choices:

- module
- manuscript type
- candidate type
- candidate version
- validation sample set
- suite
- release object

Use text input only where free text is genuinely required:

- manuscript ID
- reason / audit note

### Empty States

Empty states must tell the user what to do next.

Examples:

- no candidate available: `当前范围没有可验收候选。请先在质量包或运行绑定中生成候选版本。`
- no published validation sample set: `当前范围没有已发布验证样本集。请先在验证样本集模式发布一个版本。`
- no run history: `当前范围还没有运行记录。运行一次验收后会在这里显示结果。`

Empty states should not expose internal implementation details as the first explanation.

## Mode Design

## Mode 1: A/B 验收

### User Goal

Validate whether a candidate is better than the current active setup before activation.

The target user question is:

`我想用 Harness 跑 candidate vs active，看命中、证据、激活、回滚是否符合预期。`

### Left Settings

Visible controls:

- module
- manuscript type
- candidate object
- validation sample set
- optional suite if the system cannot infer it

System-inferred values:

- baseline: current active environment
- release gate profile: from selected suite or validation sample-set binding
- baseline binding details
- candidate frozen binding details

Default toggles:

- `只看失败`: on after results exist
- `严格门禁`: on
- `高级详情`: off

Primary action:

- `运行 candidate vs active`

### Right Results

Top metrics:

- hit / recall-oriented score
- precision or false-positive posture where available
- evidence completeness
- hard-gate result
- recommendation: activate, hold, reject, needs review

Main list:

- failed samples first
- each row shows sample title, failed rule or gate, human review state, evidence action
- no raw asset ID in collapsed row

Detail panel:

- selected sample evidence summary
- baseline vs candidate explanation
- missing evidence or regression reason
- decision guidance

Decision area:

- if all gates pass: show `激活候选`
- if gates fail: show `放弃候选` and explanation; rollback should only appear when relevant to an already-active change or existing active scope

### Guardrails

A/B suites require exactly one primary diff.

The UI must show this before launch:

- 0 primary diffs: cannot run A/B
- 1 primary diff: can run
- more than 1 primary diff: cannot run A/B; ask user to narrow candidate

This behavior already aligns with backend guard logic in `experiment-binding-guard`.

## Mode 2: 回归巡检

### User Goal

Check whether the current active setup still behaves correctly against known validation sample sets.

### Left Settings

Visible controls:

- module
- manuscript type
- validation sample set
- suite or inspection profile

System-inferred values:

- environment: current active only
- no candidate
- no activation target

Default toggles:

- `只看失败`: on after results exist
- `高级详情`: off

Primary action:

- `运行回归巡检`

### Right Results

Top metrics:

- pass/fail
- failure count
- drift count
- evidence completeness
- last run comparison

Main list:

- failed regression samples
- changed outcomes since previous run
- missing evidence

### Guardrails

This mode must not show:

- activate candidate
- rollback candidate
- candidate selector

It is an inspection workflow, not a release workflow.

## Mode 3: 发布门

### User Goal

Verify whether a release object is safe to publish or activate.

Release object examples:

- quality package version
- runtime binding
- routing version
- validation sample-set version
- release check profile

### Left Settings

Visible controls:

- release object type
- release object version
- target scope if needed

System-inferred values:

- required gates
- required validation sample set
- required published rubric
- de-identification and human-review requirements where relevant

Primary action:

- `检查发布门`

### Right Results

Top metrics:

- ready / blocked
- failed gate count
- required evidence count
- missing dependency count

Main list:

- gate name
- status
- blocking reason
- owner or next action

### Guardrails

Users should not manually select every low-level check.

The system should derive gates from the selected release object and show missing requirements clearly.

## Mode 4: 单稿诊断

### User Goal

Diagnose why a specific manuscript did or did not trigger expected findings, evidence, or activation behavior.

### Left Settings

Visible controls:

- manuscript ID
- module
- optional run selector if multiple runs exist
- optional mode: latest run / specific run

Primary action:

- `诊断单稿`

### Right Results

Main sections:

- manuscript run timeline
- hit and miss matrix
- evidence chain
- rule / knowledge / quality-package contribution
- manual review state

Detail panel:

- selected finding
- source evidence
- expected vs actual behavior
- whether the issue is a rule problem, sample-set problem, candidate problem, or evidence problem

### Guardrails

This mode is diagnostic. It should not show activation or publish actions.

Allowed secondary actions:

- open related run
- open evidence detail
- copy support bundle from advanced details

## Mode 5: 验证样本集

### User Goal

Maintain versioned validation sample sets that define what Harness should test for a module and manuscript type.

### Concept

`验证样本集` is not a template.

It is a versioned standard acceptance sample set used to validate rules, AI behavior, retrieval, quality packages, and release gates.

The same manuscript type may have multiple validation sample sets, separated by:

- module
- focus
- risk type
- version
- release purpose

Examples:

- `校对 / 临床研究 / 统计一致性核心回归 v4`
- `校对 / 临床研究 / 术语证据完整性 v2`
- `编辑 / 综述 / 格式一致性 v3`

### Left Settings

Visible controls:

- module
- manuscript type
- focus
- status: draft / published / archived
- version family

Primary action depends on selected context:

- no draft selected: `新建草稿版本`
- draft selected: `保存草稿`
- draft publish-ready: `发布版本`

### Right Results

Views:

- sample-set version list
- selected version detail
- item list
- gate readiness
- rubric assignment
- source provenance
- export history

Published version behavior:

- read-only
- can export
- can copy to new draft
- cannot edit in place

Draft version behavior:

- can edit metadata and items
- can assign rubric
- can run readiness checks
- can publish only when all backend gates pass

### Publish Gates

Publishing requires:

- at least one item
- all items de-identified
- all items human-reviewed
- assigned published rubric

This matches existing backend behavior.

### Naming

UI labels should say:

- `验证样本集`
- `样本集版本`
- `草稿版本`
- `已发布版本`
- `评分规则`

Avoid showing `Gold Set` unless in advanced technical detail or developer-only context.

## Data And Backend Alignment

This design should reuse the existing backend contracts where possible.

Relevant existing surfaces:

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- `apps/web/src/features/evaluation-workbench/evaluation-workbench-operations.ts`
- `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- `apps/web/src/features/harness-datasets/harness-datasets-controller.ts`
- `apps/web/src/features/harness-datasets/types.ts`
- `apps/api/src/modules/harness-control-plane/harness-control-plane-api.ts`
- `apps/api/src/modules/harness-control-plane/harness-control-plane-service.ts`
- `apps/api/src/modules/harness-datasets/harness-dataset-service.ts`
- `apps/api/src/modules/verification-ops/experiment-binding-guard.ts`

Expected backend reuse:

- candidate preview and frozen binding creation
- A/B primary-diff guard
- evaluation run creation
- evidence pack finalization and history
- harness dataset draft update
- harness dataset publication gate
- harness dataset export

Expected frontend reshaping:

- current `overview/runs/datasets` section framing becomes task-mode framing
- `HarnessOperatorSection` responsibilities should be split or wrapped so A/B mode is not forced to show every low-level environment control at once
- dataset page should be embedded or re-composed as `验证样本集` mode
- existing result/history components should feed the right-side result area

## Frontend Component Boundaries

The implementation plan should prefer small, focused components.

Recommended structure:

- `HarnessControlWorkbenchPage`
  - owns fullscreen shell, mode state, shared overview loading, status/error boundaries
- `HarnessModeTabs`
  - renders the five task modes
- `HarnessWorkbenchHeader`
  - renders active environment chip and advanced-detail state
- `HarnessSettingsPanel`
  - mode-specific left panel wrapper
- `HarnessResultsPanel`
  - mode-specific right panel wrapper
- `HarnessAbAcceptanceMode`
  - candidate vs active settings, readiness, run launch, results mapping
- `HarnessRegressionInspectionMode`
  - active-only regression run and result inspection
- `HarnessReleaseGateMode`
  - release object gate checks
- `HarnessSingleManuscriptDiagnosisMode`
  - manuscript lookup and diagnosis evidence
- `HarnessValidationSampleSetsMode`
  - dataset family/version list and draft/publish/export flows
- `HarnessAdvancedDetailsDrawer`
  - raw IDs, frozen bindings, JSON, export paths

The exact filenames can be decided in the implementation plan after checking existing file sizes and local patterns.

## Layout Rules

Desktop:

- appbar: about 48px
- workbench header: compact, about 120-150px
- left panel: 360-420px
- main result area: remaining width
- result body may use two internal columns when width allows

Tablet / medium width:

- mode tabs may wrap
- left and right panels stack vertically
- primary action remains near settings

Narrow width:

- left settings appear above results
- result detail may become a drawer
- mode tabs may become horizontal scroll

No text should be forced into vertical characters or clipped by fixed-width cards.

## Copy And Terminology

Use Chinese-first labels:

- `运行 candidate vs active`
- `运行回归巡检`
- `检查发布门`
- `诊断单稿`
- `验证样本集`
- `当前 Active`
- `候选对象`
- `主差异`
- `硬门禁`
- `证据完整度`
- `高级详情`

Keep these technical terms only where useful:

- `candidate`
- `active`
- `baseline`

Reason:

- these are common A/B and release terms
- translating every term may make logs and backend evidence harder to correlate

Avoid:

- raw `Gold Set` in normal UI
- asset IDs as primary labels
- long storage paths in cards
- English backend enum values in visible operator copy

## Error Handling

General rules:

- errors stay inside the current mode
- failed actions preserve current selections
- readiness failures explain what must be changed
- backend messages may be translated when the meaning is stable

Examples:

- A/B with no primary diff: `当前候选与 Active 没有主差异，不能运行 A/B 验收。`
- A/B with multiple primary diffs: `当前候选存在多处主差异，请收窄到一个候选变量后再验收。`
- missing sample set: `当前范围没有已发布验证样本集。`
- dataset publish blocked: `发布失败：仍有样本未脱敏、未人工复核，或缺少已发布评分规则。`

## Permissions

The workbench should respect existing actor role behavior.

Minimum posture:

- admin can run validation and perform governance actions
- non-admin can inspect where current routes already allow inspection
- dangerous actions should not render as enabled for unauthorized roles

Do not weaken backend authorization. Frontend permission cues are usability support, not the source of truth.

## Testing Requirements

### Unit / Component Tests

Cover:

- mode switcher labels and active mode
- A/B launch readiness messaging for 0, 1, and multiple primary diffs
- advanced details hidden by default
- published validation sample-set versions render read-only actions
- regression mode does not render activation controls
- single manuscript mode does not render publish or activation controls

### Controller / Integration Tests

Cover:

- existing overview loading still works
- A/B mode uses active environment as baseline
- candidate run creation still sends frozen candidate and baseline bindings
- dataset export still calls existing dataset controller behavior
- draft-only dataset update behavior remains unchanged

### Browser / Manual Verification

Cover desktop and narrow layouts:

- five modes are reachable
- left panel is readable and not cramped
- primary button is reachable
- result metrics do not clip
- evidence detail does not overlap adjacent content
- advanced details can be opened and closed

### Regression Verification

At minimum run:

- focused web tests for the modified Harness components
- API tests related to harness control plane and datasets if backend contracts are touched
- full `pnpm test` before final completion when practical

## Implementation Boundaries

The initial implementation avoided shared navigation files until the parallel rule-center / knowledge-table-entry work stabilized. After that work landed on `main`, the integration pass intentionally touched:

- `apps/web/src/features/auth/workbench.ts`
- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/app/app.css`

The Harness-owned surfaces remain the primary feature area:

- `apps/web/src/features/evaluation-workbench/*`
- `apps/web/src/features/harness-datasets/*`
- targeted tests under `apps/web/test` or existing nearby test locations

Navigation cleanup is complete in the 2026-04-30 implementation pass:

- remove `管理总览`
- leave management entries as `AI 接入`, `Harness 控制`, `账号与权限`
- confirm `规则中心` remains in knowledge governance

## Acceptance Criteria

The redesign is accepted when all of the following are true:

1. `Harness 控制` opens a fullscreen workbench rather than a cramped management summary page.
2. The workbench has five task modes: `A/B 验收`, `回归巡检`, `发布门`, `单稿诊断`, `验证样本集`.
3. A user can run candidate vs active from `A/B 验收` and then inspect hit rate, evidence, hard gates, activation readiness, and rollback/hold guidance.
4. `回归巡检` runs current Active only and does not show candidate activation controls.
5. `发布门` derives required checks from the selected release object rather than making the user choose many low-level parameters.
6. `单稿诊断` accepts a manuscript ID and shows run, hit/miss, evidence, and diagnosis context without publish or activation controls.
7. `验证样本集` explains and manages versioned validation sample sets; published versions are read-only and changes go through draft versions.
8. Raw asset IDs, binding IDs, run IDs, storage paths, and raw JSON are hidden by default behind `高级详情`.
9. Each mode has one primary action button.
10. Dangerous actions require confirmation and are visually separated from ordinary controls.
11. The layout is compact but not cramped on desktop; no key labels or buttons are clipped.
12. Shared navigation changes are delayed or isolated to avoid colliding with parallel rule-center work.

## Residual Risks

### Backend capability gaps

Some mode-specific flows may need small frontend orchestration around existing APIs. If a desired mode action lacks a direct API, the implementation plan should either:

- compose existing APIs without changing backend contracts, or
- explicitly add a small backend endpoint with focused tests

It should not fake controls that do not submit real work.

### Navigation conflict

Resolved for the current branch. The cleanup was performed only after the parallel navigation-impacting work landed on `main`, then verified through routing and host tests. Residual risk is limited to future branches that still assume `管理总览` appears in the management navigation.

### Page size

The current `evaluation-workbench-page.tsx` is already large. The implementation plan should split new mode components rather than adding another large block to the same file.

### Terminology drift

UI should say `验证样本集`, but code may still say `goldSet`. The implementation should keep this distinction explicit to avoid risky rename churn.

## Resolved Implementation Decisions

- Mode state uses `harnessMode`.
- `harnessSection` remains as a compatibility input.
- All five modes have a visible first-pass structure.
- Backend mutation depth is scoped to existing contracts; unsupported workflows use honest limited states instead of fake submit controls.
- Validation sample sets live inside Harness, while the old `harness-datasets` hash remains a compatibility alias.
