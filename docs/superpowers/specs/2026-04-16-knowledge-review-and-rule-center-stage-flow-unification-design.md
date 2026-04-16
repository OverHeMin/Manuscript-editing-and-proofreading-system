# 2026-04-16 Knowledge Review And Rule Center Stage Flow Unification Design

**Date**

2026-04-16

**Status**

Approved in conversation, draft for written review

**Goal**

Turn the current `知识审核 -> 规则中心回流工作区 -> 规则向导` chain into one Chinese-first, stage-led operator flow with clear station boundaries.

This document locks four product outcomes:

- the shared four-stage narrative for the full recovery-governance chain
- the final boundary between `知识审核页` and `规则中心回流工作区`
- the final terminology for titles, buttons, statuses, and empty states
- the final relationship between the four-stage flow and the five-step rule wizard

The system is still an internal beta. The design must therefore optimize for:

- clear operator mental model
- low wording ambiguity
- strong handoff clarity between stations
- stable Chinese-first naming
- minimal repeated explanation across pages

## Relationship To Earlier Specs

This document refines and partially supersedes the following earlier directions:

- [2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md)
- [2026-04-14-knowledge-library-final-structure-and-entry-flow-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-knowledge-library-final-structure-and-entry-flow-design.md)
- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)

The earlier rule-center and knowledge-library directions correctly moved toward:

- ledger-first work surfaces
- compact workbench pages
- bounded wizard flows

But the recovery-governance chain still feels fragmented in three ways:

1. the same operator journey is described with too many object names
2. the boundary between review and rule governance is visible in routing, but not yet visible enough in page language
3. the rule wizard feels like a separate tool instead of the downstream continuation of the same recovery chain

The latest approved direction is simpler:

- the full chain is one shared stage flow
- `知识审核页` and `规则中心` are two stations in that flow
- each station owns a different stage range
- the rule wizard is the downstream subflow inside `转规则 -> 发布`

## Final Product Decisions

The following decisions are treated as locked.

### 1. The full operator chain uses one shared four-stage narrative

The shared top-level narrative is:

`候选` -> `审核` -> `转规则` -> `发布`

This is the only top-level process language that should describe the full chain.

The system should not tell one story in `知识审核页`, another in `规则中心`, and a third in `规则向导`.

### 2. Knowledge review and rule center are two stations, not one blended workspace

The approved relationship is `前后两站`.

The stations are:

- `知识审核页`: responsible for `候选 -> 审核`
- `规则中心回流工作区`: responsible for `转规则 -> 发布` preparation

They are related, but they are not the same page wearing two labels.

### 3. The product posture is strong station separation with one shared flow

The approved posture is `强分站阶段流`.

This means:

- both stations show the same four-stage chain
- each station highlights only the stages it owns
- station copy should reinforce the handoff, not hide it

### 4. The main object names must be simplified

The chain should use only two primary object nouns:

- `回流候选`
- `规则草稿`

Operators should not be forced to mentally remap across:

- learning review
- recovery workspace
- approved candidate
- resolved candidate
- draft rule candidate

Those internal concepts may still exist in data models, but not as competing operator-facing primary nouns.

### 5. Manuscript summary is an entry point, not another governance station

The manuscript summary should not narrate its own parallel process.

Its role is only:

- show current stage
- explain why this manuscript is entering the chain
- route the operator to the correct next station

### 6. The five-step rule wizard is a subflow, not a separate worldview

The rule wizard remains five steps, but it sits inside the shared four-stage narrative.

The correct relationship is:

- stages 1 to 4 of the wizard belong to `转规则`
- stage 5 of the wizard belongs to `发布`

## Problem Statement

The current recovery-governance chain misses the target in five ways:

1. It uses inconsistent operator nouns.
   The same item may be described as a learning candidate, a recovery item, a reviewed candidate, or a rule candidate depending on the page.

2. It does not make station ownership explicit enough.
   Operators can tell they moved pages, but not always why responsibility changed.

3. It mixes action levels in the same button groups.
   Candidate review actions, rule drafting actions, and publishing actions can appear too close together without a clear stage distinction.

4. Empty states do not explain the chain strongly enough.
   Some pages say there is nothing to process, but do not explain where the operator should go next.

5. The rule wizard feels disconnected from the upstream review outcome.
   The operator can lose the sense that they are still processing the same approved recovery item.

## Scope

### In Scope

- the shared stage narrative for the recovery-governance chain
- page-level titles and subtitles for:
  - `知识审核页`
  - `规则中心回流工作区`
  - `稿件摘要入口`
  - `规则向导`
- button naming
- status naming
- empty-state copy
- cross-station handoff copy
- the five-step wizard wording and its mapping into the four-stage model

### Out Of Scope

- redesigning the full knowledge-review layout structure
- redesigning the full rule-center ledger IA again
- changing underlying workflow permissions
- changing backend persistence or review-state data models unless needed for display alignment
- adding new workflow stages beyond the approved four-stage model

## Final Operator Narrative

The operator should always understand the full chain like this:

`回流候选出现` -> `完成审核` -> `转成规则草稿` -> `提交发布`

The same chain should feel different by station:

- in `知识审核页`, the operator is deciding whether a `回流候选` is valid
- in `规则中心`, the operator is transforming an approved `回流候选` into a `规则草稿`
- in the rule wizard, the operator is completing the `规则草稿` until it is ready to publish

## Station Responsibilities

### 1. Knowledge review page

Main responsibility:

- process `回流候选`
- make the review decision

The page must answer:

- `这是不是合格候选？`
- `审核结论是什么？`

It should not behave like:

- a rule-authoring page
- a publishing page
- a mixed review-plus-publish console

### 2. Rule center recovery workspace

Main responsibility:

- receive approved `回流候选`
- transform them into `规则草稿`

The page must answer:

- `这条已通过候选要沉淀成什么规则？`
- `它现在离规则草稿还有哪些整理步骤？`

It should not behave like:

- a first-pass approval desk
- an all-in-one governance console that tries to cover every stage equally

### 3. Manuscript summary entry

Main responsibility:

- explain current handoff stage
- point to the next station

It should not become:

- another review desk
- another governance desk
- another narrative layer with its own vocabulary

## Shared Four-Stage Strip

All three surfaces should show the same top-level strip:

`候选` -> `审核` -> `转规则` -> `发布`

Recommended highlighting:

- `知识审核页`: highlight `候选 / 审核`
- `规则中心回流工作区`: highlight `转规则`
- `规则向导` publish step: highlight `发布`

The strip should tell the operator:

- where they are now
- what stage just finished
- what stage comes next

## Final Naming Dictionary

### Primary nouns

- `回流候选`
- `规则草稿`

### Page titles

- `知识审核页`
  - title: `回流候选审核`
  - subtitle: `确认候选是否可进入规则中心沉淀为规则草稿`

- `规则中心回流工作区`
  - title: `回流候选转规则`
  - subtitle: `将已审核通过的回流候选整理为可发布的规则草稿`

- `规则向导`
  - title: `规则草稿向导`

### Candidate statuses

Candidate status language must be:

- `待审核`
- `已通过`
- `已驳回`

### Draft statuses

Rule-draft status language must be:

- `草稿中`
- `待发布`
- `已发布`

### Forbidden primary operator terms

The following terms should not remain as first-class operator-facing primary names in this chain:

- `learning review`
- `approved candidate`
- `resolved candidate`
- `pending_review`
- `回流工作区` and `规则台账` used as if they were the primary object name

They may still appear in internal code or low-level metadata, but not as competing front-stage nouns.

## Final Button Language

### Knowledge review page

- primary action: `审核通过`
- secondary action: `驳回候选`
- downstream handoff action: `前往规则中心`

### Rule center recovery workspace

- primary action: `转成规则草稿`
- secondary action: `继续编辑草稿`
- auxiliary action: `返回审核记录`

### Rule wizard

- progression actions: `保存草稿`, `下一步`
- final action: `提交发布`

Buttons in one station must stay on one stage level.

For example:

- review actions should not sit beside publish actions with equal emphasis
- candidate approval language should not appear as the main CTA inside the drafting station

## Final Station Guidance Copy

### Knowledge review page

`当前正在处理回流候选。审核通过后，可进入规则中心转成规则草稿。`

### Rule center recovery workspace

`当前正在处理已通过审核的回流候选。完成整理后，可提交为规则草稿。`

### Rule wizard

`当前正在完善规则草稿。完成后即可进入发布。`

## Final Empty States

### Knowledge review page

Title:

`当前没有待审核的回流候选`

Supporting copy:

`新候选进入后，会先在这里完成审核，再决定是否进入规则中心。`

### Rule center recovery workspace

Title:

`当前没有可转规则的已通过候选`

Supporting copy:

`请先在知识审核页完成审核通过，已通过候选会自动进入这里。`

### Rule wizard without active context

Title:

`当前没有待完善的规则草稿`

Supporting copy:

`请先从规则中心选择一条已通过候选，转成规则草稿后再继续。`

## Final Cross-Station Handoff Copy

All cross-station guidance should follow one sentence model:

`当前阶段：X。下一步：前往 Y 完成 Z。`

Approved handoff sentences:

- manuscript summary -> knowledge review
  - `当前阶段：候选。下一步：前往知识审核页完成回流候选审核。`

- knowledge review approved -> rule center
  - `当前阶段：审核。下一步：前往规则中心将候选转成规则草稿。`

- rule center -> rule wizard
  - `当前阶段：转规则。下一步：继续完善规则草稿并进入发布。`

- rule wizard final step
  - `当前阶段：发布。下一步：确认草稿内容与适用范围后提交发布。`

This handoff model should replace weaker expressions such as:

- `保留上下文`
- `进入回流工作区`
- `打开规则向导`

when those phrases are used without stage meaning.

## Final Rule Wizard Model

The five-step rule wizard remains, but the step titles must align with the approved stage story.

Approved step titles:

1. `带入候选`
2. `整理草稿`
3. `确认规则意图`
4. `绑定适用范围`
5. `提交发布`

### Stage mapping

- step 1 to step 4 -> `转规则`
- step 5 -> `发布`

### Display model

The rule wizard should display:

- the shared four-stage strip as the top-level chain
- the five-step wizard as the local subflow

This keeps the operator oriented in both ways:

- where they are in the full product chain
- where they are inside the local drafting sequence

## Acceptance Criteria

The design is considered implemented correctly when all of the following are true:

1. the same recovery item is consistently described as `回流候选` until it becomes `规则草稿`
2. `知识审核页` no longer feels responsible for drafting or publishing
3. `规则中心回流工作区` no longer feels responsible for first-pass approval
4. manuscript summary handoff language explicitly states current stage and next station
5. empty states tell the operator where the previous or next station is
6. the rule wizard reads like the downstream continuation of the same flow instead of a separate product tool
7. button groups no longer mix review-stage and publish-stage verbs in the same emphasis level

## Implementation Notes

Recommended implementation order:

1. align shared strings and top-stage strip labels
2. align manuscript summary handoff text
3. align knowledge-review page title, status language, and CTA labels
4. align rule-center recovery workspace title, status language, and CTA labels
5. align rule-wizard step titles and top-stage mapping
6. update tests to lock the new vocabulary and stage handoff behavior

This order keeps the highest-visibility copy aligned first, then locks the wizard and test surface after the station model is stable.
