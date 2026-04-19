# 2026-04-18 Editing And Proofreading Governed Routing Fallback Design

**Date**

2026-04-18

**Status**

Approved in conversation, written as the short-term internal-trial and demo solution.

**Goal**

Solve one immediate product problem in `编辑` and `校对`:

- the system should keep governed execution as the primary path
- operators should still be able to run governed `编辑 / 校对` when manuscript-type recognition is low-confidence, missing, or wrong
- the workbench should demonstrate that rule-center assets and knowledge assets are truly participating in execution
- manuscript-type recognition should help routing, but it must not block the current short-term demo flow

**Short-Term Promise**

For `编辑` and `校对`, manuscript-type recognition becomes a recommendation layer rather than a hard gate.

If AI recognition is strong, the operator can continue with the recommended governed template context.

If AI recognition is weak or wrong, the operator can directly choose a governed template family, optionally refine the journal template, and continue with the normal governed execution path without dropping into bare AI mode.

## 1. Problem Statement

The current product already supports:

- upload-time manuscript-type recognition
- governed template-family binding
- governed module execution for `screening / editing / proofreading`
- a one-time `bare` AI run path for comparison and emergency use

The short-term issue is not that the system lacks any fallback.

The real issue is narrower:

- if recognition is low-confidence or incorrect, the operator can be delayed before entering governed `编辑 / 校对`
- the existing `bare` path avoids the template-family gate, but that path is not the main path we want to demonstrate in an internal trial
- the near-term trial needs to prove `规则中心 + 知识库 + 模块治理执行` first, not `稿件类型识别能力`

One sentence:

`Short-term success means governed execution must stay reachable even when recognition is imperfect.`

## 2. Locked Product Decisions

### 2.1 Recognition is advisory, not blocking

For this short-term solution:

- manuscript-type recognition remains enabled
- recognition continues to recommend manuscript type, confidence, matched signals, and a recommended template family
- recognition does not decide whether the operator is allowed to enter governed editing or governed proofreading

### 2.2 Scope is only editing and proofreading

This design changes operator handling only for:

- `编辑`
- `校对`

It does not change the `初筛` product posture in this short-term package.

### 2.3 Governed execution remains first-class

This design does not replace the governed path with:

- bare AI as the default
- a new parallel execution family
- a customer-facing comparison mode

The primary target remains:

- governed execution profile
- governed module template
- governed prompt template
- governed rules
- governed knowledge selections
- governed runtime binding

### 2.4 Template-family confirmation becomes the release valve

Short-term release behavior is:

- AI recommends
- operator confirms or overrides the governed template family
- the system persists the confirmed template context
- the existing governed module run continues as normal

This means the short-term gate moves from:

`先把稿件类型识别清楚`

to:

`先把可执行的治理模板上下文定下来`

### 2.5 Bare AI remains available but is not the primary fallback for this trial

The existing one-time `bare` action remains valuable for:

- comparison conversations
- emergency use
- internal debugging

But it is not the fallback this design optimizes for.

The short-term trial should demonstrate governed execution first.

## 3. Existing Repo Anchors

This short-term solution is intentionally additive because the repo already has the most important backend primitives.

### 3.1 Governed execution already depends on manuscript-level template context

The governed module resolver currently requires the manuscript to carry a governed routing context, especially:

- `manuscript.manuscript_type`
- `manuscript.current_template_family_id`
- `manuscript.current_journal_template_id`

The module resolver then resolves the active profile from:

- module
- manuscript type
- template family

This means the product does not need a brand-new execution architecture.

It needs a more reliable way to persist a usable governed context before `编辑 / 校对` runs.

### 3.2 Template selection update already exists

The current manuscript lifecycle service already exposes `updateTemplateSelection`.

That service already:

- validates the template family exists and is active
- synchronizes `manuscript_type` to the chosen template family
- reconciles the stored detection summary to the chosen family
- clears an incompatible journal template when needed
- persists the updated manuscript record

This is the key reason the short-term solution can stay small.

The core backend write path already exists.

### 3.3 Workbench already shows AI recognition and template context

The current workbench already exposes:

- AI recognized manuscript type
- confidence labeling
- optional manual manuscript-type correction
- template-family and journal-template context
- the governed module action

So the short-term work is not to invent a new desk.

It is to change the operator decision order and emphasize template-context fallback over manuscript-type correction.

### 3.4 Bare mode already exists and should stay honest

The repo already contains a bounded `bare` execution branch.

That path is useful, but it intentionally skips governed template-family resolution.

Because the internal trial needs to prove governed rule and knowledge participation, short-term product behavior should avoid steering failed recognition cases into `bare` unless the operator explicitly chooses that path.

## 4. Final Product Decision

The approved short-term direction is:

`执行优先，模板族直选兜底。`

Translated into system behavior:

1. `编辑 / 校对` still open with the AI recommendation panel first
2. when the current governed context is executable, the operator can run the module immediately
3. when the current governed context is missing, low-confidence, or effectively unusable for the current module, the workbench presents a compact template-family fallback action
4. the operator can choose the governed template family directly, optionally choose the journal template, save the context, and continue with governed execution
5. the system does not require a separate manual manuscript-type decision before this step

One sentence:

`Short-term release logic should ask “which governed template family should run now?” rather than “which manuscript type label should be confirmed first?”`

## 5. Operator Experience

### 5.1 Entry posture

When the operator enters `编辑` or `校对`, the workbench should still show:

- AI recommended manuscript type
- confidence
- matched signals
- recommended template family
- current journal-template state

This keeps the AI recommendation visible and useful.

### 5.2 Strong-recognition path

If the current manuscript already has a usable governed context for the current module, the operator experience remains lightweight:

- review the recommendation
- optionally adjust template context
- run governed editing or governed proofreading

Nothing new should feel mandatory in this path.

### 5.3 Weak-recognition or wrong-recognition path

If recognition is low-confidence, missing, or practically unusable for the current module, the workbench should not stop at:

- `先确认 AI 识别结果`

Instead it should show a compact fallback block such as:

- `请选择本次模板族`
- `可选：细化期刊模板`
- `保存模板上下文并继续编辑`
- `保存模板上下文并继续校对`

This block is the short-term release valve.

### 5.4 Manual manuscript-type selection is no longer the primary fallback

The current manual manuscript-type correction flow may remain in the product for compatibility, but it should no longer be the primary action presented during failure recovery.

Short-term operator guidance should prioritize:

- template-family choice first
- manuscript-type correction second

The reason is practical:

- operators care about getting into the governed execution lane
- the backend can already derive and persist the manuscript type from the selected template family

### 5.5 Journal template stays optional

The short-term design does not change the journal posture:

- base template family selection is enough to proceed
- journal-template refinement remains optional
- if the operator does not know the journal template, the manuscript can continue on the base family only

## 6. Backend Design

### 6.1 Reuse the existing template-selection save path

The preferred short-term backend design is to reuse the current template-selection update contract instead of inventing a new routing API.

The save action should continue to post:

- `manuscriptId`
- `templateFamilyId`
- `journalTemplateId?`

The service should continue to:

- validate the chosen template family
- persist `current_template_family_id`
- synchronize `manuscript_type` to the family
- reconcile detection-summary `final_type`
- validate or clear the journal template as needed
- rebuild the governed execution context summary returned to the workbench

### 6.2 No new recognition dependency in the fallback flow

The fallback path must not:

- rerun manuscript recognition as a precondition
- require a manual manuscript-type field before a family can be saved
- wait for an improved classifier before governed execution is unlocked

The chosen template family is the authoritative routing input for the short-term fallback.

### 6.3 Module readiness must still be truthful

Selecting a template family is not enough by itself.

The current module must still be able to resolve a governed summary that is actually runnable.

After template selection is saved, the workbench should inspect the returned governed module summary for the current module.

Short-term acceptance requires that the module summary for the current module becomes effectively executable before the run button is treated as unblocked.

This prevents the UI from pretending that any saved family is automatically ready for every module.

### 6.4 No change to governed execution semantics

Once the template context is saved, `编辑` and `校对` should continue to use the existing governed run flow exactly as they do today.

This short-term package must not:

- reinterpret governed execution as semi-bare execution
- inject a hidden default template family
- bypass rule-center resolution
- bypass knowledge selection
- bypass runtime binding or governed execution logs

## 7. Frontend Design

### 7.1 Reframe the existing context card

The workbench should keep the current AI recognition surface, but the surrounding copy and action emphasis should change.

The primary message should become:

- `AI 已提供推荐上下文`
- `如推荐不稳，请直接选择本次模板族继续治理执行`

instead of:

- `先确认 AI 识别结果，否则无法继续`

### 7.2 Show the fallback when the current module is not ready

The fallback block should appear when either of these is true:

- there is no current template family
- the detection summary requires operator review and the operator has not yet settled a usable template family
- the current module summary is not executable with the current template context

In that state, the page should surface:

- template-family dropdown
- optional journal-template dropdown
- one save-and-continue action for the current module

### 7.3 Keep save and run tightly connected

For the short-term trial, the operator should not need to mentally bridge a long gap between:

- saving the template context
- then separately hunting for the governed run button

The UI should either:

- save the template context and then immediately unlock the normal governed run button in the same panel

or:

- expose a compact combined action that saves the context and then continues into the normal governed run flow

The exact click count is less important than the operator feeling that the workbench did not dead-end.

### 7.4 Do not promote bare AI in this recovery lane

The existing `AI 自动处理（本次）` action may remain visible, but it should not become the first answer to weak recognition in `编辑 / 校对`.

The short-term recovery lane should first try to preserve governed execution.

## 8. Data And Traceability

Short-term success still requires correct manuscript-level truth.

After fallback template selection, the manuscript record should truthfully reflect:

- `manuscript_type`
- `current_template_family_id`
- `current_journal_template_id`
- `manuscript_type_detection_summary`

The expected short-term behavior is:

- `manuscript_type` matches the chosen template family
- `current_template_family_id` reflects the operator-confirmed family
- `current_journal_template_id` is either valid for that family or cleared
- `manuscript_type_detection_summary.final_type` stays aligned to the current family choice

This keeps audit and downstream governed resolution consistent.

## 9. Out Of Scope

This short-term design explicitly does not do the following:

- upgrade manuscript recognition from heuristic matching to a stronger model classifier
- redesign the `初筛` operator flow
- solve batch manuscript fallback UX
- redesign template governance itself
- remove or replace the existing bare AI action
- add new long-term audit tables for confirmation provenance
- add learning or self-improving recognition writeback

Those may still matter later, but they are not required to solve the immediate trial blocker.

## 10. Risks And Mitigations

### 10.1 Risk: operators choose the wrong template family

This risk already exists in any manual override flow.

Short-term mitigation:

- keep AI recommendation visible
- show the chosen family clearly before execution
- keep journal-template refinement optional instead of forcing extra choices

### 10.2 Risk: chosen family still cannot run the current module

Short-term mitigation:

- rely on the returned governed module summary
- do not treat template selection as successful execution readiness until the current module summary is actually usable
- keep the error message truthful if the selected family lacks the needed module configuration

### 10.3 Risk: product message drifts back into “type first, execution later”

Short-term mitigation:

- change the fallback copy
- make the primary recovery action template-family based
- demote manual manuscript-type correction to a secondary action

### 10.4 Risk: bare AI becomes the accidental default again

Short-term mitigation:

- keep bare AI available but secondary
- keep governed execution as the recommended route after fallback template selection

## 11. Acceptance Criteria

This short-term package is accepted only if all of the following are true:

1. In `编辑`, low-confidence or incorrect recognition does not block the operator from entering governed execution.
2. In `校对`, low-confidence or incorrect recognition does not block the operator from entering governed execution.
3. The recovery path uses governed template context rather than defaulting to `bare`.
4. After fallback template selection, the manuscript record persists the corrected governed context truthfully.
5. After fallback template selection, the current module can continue through the normal governed run path and still consume rule-center and knowledge assets.
6. The UI copy no longer implies that manuscript-type confirmation is the only valid way to unlock editing or proofreading.

## 12. Recommended Implementation Order

The short-term implementation should proceed in this order:

1. Reframe the workbench fallback copy and action logic in `编辑 / 校对` so template-family fallback becomes primary.
2. Reuse and tighten the existing template-selection save flow, including readiness checks for the active module.
3. Add focused tests that prove governed execution remains reachable after manual template-family fallback.
4. Keep `bare AI` untouched except where necessary to preserve UI clarity.

One sentence:

`Do not spend the short-term trial budget on making recognition smarter before making governed execution easier to reach.`
