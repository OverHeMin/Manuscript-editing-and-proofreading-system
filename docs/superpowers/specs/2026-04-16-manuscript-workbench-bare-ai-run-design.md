# 2026-04-16 Manuscript Workbench Bare AI Run Design

**Date**

2026-04-16

**Status**

Approved in conversation, draft for written review

**Goal**

Add one minimal operator-facing capability to the three manuscript workbenches:

- `初筛`
- `编辑`
- `校对`

Each workbench should expose one extra entry:

`AI 自动处理（本次）`

This entry should let the operator trigger one AI-only run for the current module without requiring template-family governance to be configured first.

The feature is explicitly for:

- fast internal demonstration
- customer-facing comparison conversations
- showing what the system can do when AI works without governed template context

The feature is explicitly not intended to replace governed execution as the system default.

## 1. Final Product Decision

The approved product direction is the smallest possible version.

Do not build:

- a separate bare-run page
- a separate workbench mode
- a comparison dashboard
- a dual-result split screen
- a large new settings surface

Instead:

- keep the existing three workbenches unchanged as the main family
- keep the existing governed execution path unchanged
- add one extra bounded action inside each workbench
- let that action run AI directly for the current module once

One sentence:

`This is one extra action, not one extra product surface.`

## 2. Operator Experience

### 2.1 Placement

The extra entry should live inside the existing manuscript processing area that already contains:

- AI recognition summary
- template context confirmation
- module execution action

It should not be hidden in:

- the asset table
- a debug area
- a separate drawer
- a separate settings page

It should appear where the operator already decides how to process the current manuscript.

### 2.2 User-facing control

Each of the three workbenches should expose an extra bounded action:

- screening: `AI 自动处理（本次）`
- editing: `AI 自动处理（本次）`
- proofreading: `AI 自动处理（本次）`

The current governed action remains available and unchanged:

- `执行初筛`
- `执行编辑`
- `生成校对草稿`

This means the operator sees two ways to run the current module:

1. governed module action
2. bare AI one-time action

The new entry should feel lightweight and local, not like a global mode switch.

### 2.3 Scope of effect

The new entry is one-time only.

It must:

- affect only the current button click
- not persist as a manuscript-wide long-term mode
- not rewrite manuscript governance configuration
- not replace the system default path for future actions

The operator can run governed first, bare first, or alternate between them. Each click is independent.

### 2.4 Result presentation

After the bare AI run completes:

- the newly produced result becomes the current result in the same way as a normal module result
- the operator can view and download it from the existing result shortcuts
- the older governed result remains preserved in the asset chain

Do not add a separate operator-facing result name such as:

- `裸跑结果`
- `演示结果`
- `raw-run`

Do not add special visible filename markers just for customer display.

Customer-facing behavior should remain simple:

`I clicked AI 自动处理（本次）, and the system produced the current module result.`

## 3. Backend Execution Design

### 3.1 One request-level execution branch

The existing module run contract should gain one request-level execution flag:

- `governed` as the current default
- `bare` for the new one-time AI action

Frontend behavior:

- existing governed buttons continue calling the current run flow with default governed behavior
- the new `AI 自动处理（本次）` action calls the same run family with `executionMode = bare`

This should be implemented as one bounded branch inside the existing run APIs, not as a parallel second workflow family.

### 3.2 Governed path stays unchanged

When `executionMode` is absent or equals `governed`, the current logic stays exactly as it is now:

- require `current_template_family_id`
- resolve governed execution profile
- resolve governed module template
- resolve governed prompt template
- resolve governed skill package set
- resolve governed retrieval preset
- resolve governed manual review policy
- resolve governed runtime binding and governed runtime context
- continue producing the existing governed result assets

This feature must not loosen or reinterpret the current governed path.

### 3.3 Bare path

When `executionMode = bare`, the service should take a different path for the current run only.

That path should:

- not require `current_template_family_id`
- not call governed module-context resolution
- not require active governed execution profile
- not require governed module template
- not require governed retrieval preset
- not require governed manual review policy
- not require governed runtime binding

It should still use:

- current manuscript
- selected/current parent asset
- current module identity
- centralized AI routing defaults that can run without template-family scope

The bare path should therefore be a true no-template AI run, not a hidden fallback to some default template family.

### 3.4 Bare prompt sources

The bare path should use one small internal prompt skeleton per module:

- screening bare prompt
- editing bare prompt
- proofreading bare prompt

These prompt skeletons should be intentionally generic and bounded:

- medical-manuscript aware
- module-specific
- no template-family specialization
- no journal-template specialization

They are demo-oriented defaults, not a new governed authoring surface.

## 4. Module Boundaries

### 4.1 Screening

`AI 自动处理（本次）` on screening should:

- read the selected/current manuscript asset
- produce a normal screening-style output
- place that output into the current result position

It should not require template confirmation first.

### 4.2 Editing

`AI 自动处理（本次）` on editing should:

- read the selected/current manuscript asset
- produce a normal editing output asset
- place that output into the current result position

It should not require template confirmation first.

### 4.3 Proofreading

`AI 自动处理（本次）` on proofreading should:

- read the selected/current manuscript asset
- produce the proofreading draft output
- place that output into the current result position

This feature only covers the AI generation step.

It does not change:

- `确认校对定稿`
- `发布人工终稿`

Those downstream actions remain in the existing closing path.

## 5. Data And Traceability

Although the operator should not see a special bare-run label, the system still needs internal traceability.

Each bare run should record internal execution metadata such as:

- execution mode
- module
- input asset id
- output asset id
- job id

The recommended internal value is:

- `execution_mode = bare`

This internal traceability is needed so the system can:

- distinguish governed and bare runs in logs
- support internal debugging
- support later analytics
- avoid corrupting governance assumptions

This internal marker should be repo-owned metadata, not a customer-facing display string.

## 6. Result Semantics

The result asset strategy should be conservative.

Bare runs should:

- produce the normal module output type for that stage
- become the current result after completion
- remain downloadable through the existing result path

Bare runs should not:

- delete previous governed outputs
- overwrite historical asset records
- rewrite manuscript template configuration

This keeps the product simple at the surface while preserving the real history underneath.

## 7. Error Handling

The new feature is mainly intended to bypass the current template-family gate.

Therefore the system should stop failing with:

`Manuscript <id> does not have a current template family.`

for the new one-time AI action.

However, the bare path may still fail for real reasons such as:

- no usable model route
- provider connection unavailable
- invalid input asset
- AI gateway error

Those errors should be reported through the existing workbench action feedback surface, not through a new error model.

## 8. Testing And Acceptance

Implementation should add focused coverage for the following:

### 8.1 Web behavior

- each workbench renders the new `AI 自动处理（本次）` action
- clicking the new action calls the run path in bare mode
- the existing governed action still behaves unchanged
- bare-run completion updates the current result surface

### 8.2 Backend behavior

- bare run succeeds without `current_template_family_id`
- governed run still fails without `current_template_family_id`
- bare run does not call governed module-context resolution
- bare run still produces normal stage output assets
- bare run records internal execution-mode metadata

### 8.3 Browser acceptance

Real browser acceptance should verify:

1. open `#screening`, `#editing`, and `#proofreading`
2. confirm the new entry appears in all three workbenches
3. trigger bare AI run on each stage
4. confirm the result becomes current and remains downloadable
5. confirm the older governed or previous results remain in asset history

## 9. Out Of Scope

This feature should not expand into the following in this phase:

- a separate bare-run control plane
- customer-facing result comparison dashboard
- visible bare-run asset naming conventions
- bare-run-specific template authoring
- bare-run-specific AI parameter editing
- replacing governed execution as the default path
- changing final proofreading closeout semantics

## 10. Final Summary

The approved implementation target is:

- keep the existing governed manuscript workbenches
- add one extra action called `AI 自动处理（本次）`
- let that action trigger a one-time no-template AI run
- keep the result easy to see and easy to download
- keep governed execution untouched as the default
- keep internal traceability without adding customer-facing result noise

This gives the product owner a clean demo capability without forcing the system to pretend that governed and non-governed execution are the same thing.
