# 2026-04-14 Knowledge Library Final Structure And Entry Flow Design

**Date**

2026-04-14

**Status**

Approved in conversation, draft for written review

**Goal**

Turn the current knowledge-library direction into a simple, Chinese-first, table-first knowledge operations surface that is easy to learn in an internal beta while still preserving governed drafting, AI semantic assistance, and review submission.

This document locks three product outcomes:

- the final page structure for `知识库`
- the final operator flow for `新增 / 编辑 / AI辅助录入`
- the final relationship between knowledge entry, AI semantic confirmation, and downstream review

The system is still an internal beta. The design must therefore optimize for:

- simple daily operation
- low learning cost
- stable high-frequency entry
- bounded AI assistance
- hidden advanced options

## Relationship To Earlier Specs

This document refines and partially supersedes the following earlier directions:

- [2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-knowledge-library-ledger-entry-and-semantic-editing-design.md)
- [2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md)
- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md)

The earlier knowledge-library designs moved in the right direction by making the page more ledger-like and more AI-assisted, but two conflicts remained:

1. one direction removed the shared shell and left navigation entirely
2. one direction still treated the right side too much like a heavy workspace instead of a compact operator board

The latest approved direction is clearer:

- knowledge library stays inside the unified workbench shell
- knowledge library and rule center belong to the same product family
- but knowledge library should not copy the rule-center five-step wizard
- knowledge library should remain lighter, faster, and more record-oriented

## Final Product Decisions

The following decisions are treated as locked.

### 1. Knowledge library stays inside the shared workbench shell

The knowledge-library page should not become a detached immersive full-screen product.

It stays inside the approved shell model:

- global left navigation remains
- compact workbench shell remains
- page-level giant hero sections should not return

This keeps the whole system coherent and avoids one module feeling like a different product.

### 2. Main work posture is table-first

The primary work surface is:

- top command bar
- central dense knowledge table
- right-side temporary entry board

The page must not depend on:

- long introductory banners
- oversized static right panels
- separate full authoring worlds for basic work
- heavy management-console language

### 3. Entry and editing happen through one temporary right-side board

The main page is centered on the ledger table.

The right side is opened when needed for:

- new record entry
- existing record editing
- AI-assisted pre-entry

It is a temporary operator board, not a permanently dominant workspace.

### 4. Search is direct, advanced filtering is tucked away

The user-approved search model is:

- top search input updates the current table directly
- advanced conditions open in a filter drawer

This preserves a simple first impression while still allowing more precise retrieval.

### 5. New knowledge should not enter the table too early

The user-approved rule is:

- a new knowledge record is created on the right-side board first
- it does not become a visible formal row immediately
- it enters the table only after the operator completes core entry and confirms the AI semantic layer

This avoids a ledger full of half-finished placeholders.

### 6. New rows enter as draft, not as approved content

After the operator confirms entry, the row should enter the knowledge table with a `草稿` state.

The system must not:

- auto-approve it
- auto-submit it to review
- auto-publish it

### 7. Knowledge library and rule center are the same family, not the same flow

The approved family similarity is:

- table-first
- compact command bar
- temporary action board
- AI suggestion plus human confirmation
- clear contribution traceability

The approved difference is:

- knowledge library uses tabbed entry
- rule center uses a stepwise wizard

## Problem Statement

The current and earlier designs miss the target in five ways:

1. Some versions make knowledge entry feel heavier than it needs to be.
   The user wants fast entry and maintenance, not a large governance console.

2. Some versions over-separate table work and entry work.
   The user wants to browse the ledger and work on a record in one coherent page.

3. AI semantic generation is not yet framed as a simple bounded operator flow.
   It must feel useful and editable, not technical or gimmicky.

4. Earlier directions do not fully answer how charts, images, tables, and attachments should be entered.
   The user explicitly wants complex material support.

5. Earlier directions risk disconnecting knowledge entry from downstream governance.
   The user wants easy entry, but still needs review, traceability, and reuse.

## Scope

### In Scope

- the final operator-facing structure for knowledge library
- the final top toolbar posture
- the final table posture and default columns
- the final right-side entry board model
- the final tab structure for entry and editing
- the final AI-assisted intake behavior
- the relationship between knowledge library and knowledge review
- contribution visibility in the table

### Out Of Scope

- redesigning knowledge-review in full detail inside this document
- replacing all backend persistence contracts in one pass
- moving final approval into the knowledge-library page
- full spreadsheet inline editing for all fields
- chat-style AI assistants inside the page
- large-scale analytics, formulas, or pivot-style dashboards

## Final Information Architecture

The final operator model is one stable main page with a bounded temporary work area.

### 1. Top command bar

The top command bar should stay intentionally short.

Approved visible actions:

- `搜索`
- `新增知识`
- `AI辅助录入`
- `筛选`

Behavior rules:

- `搜索` updates the current table directly
- `筛选` opens a drawer for advanced conditions
- batch actions and import/export should not dominate the first version of the toolbar

### 2. Knowledge ledger table

This is the main daily working surface.

Approved default columns:

- 标题
- 分类
- AI语义状态
- 贡献人
- 更新时间

This default set is intentionally restrained. It keeps the table readable and lets the right-side board carry detailed editing.

Interaction rules:

- single click selects a row
- double click or explicit `编辑` action opens the right-side board
- browsing and editing should remain separate

### 3. Right-side temporary entry board

This is the unified temporary work area for:

- manual create
- manual edit
- AI-assisted pre-entry

It should open from the right and stay visually secondary to the table.

The board must not behave like:

- a permanent detail inspector
- a detached full page
- a multi-step wizard

## Final Right-Side Entry Board Structure

The right-side board uses one tabbed structure for both create and edit.

### Tab 1: `基础信息`

This tab owns the smallest set of user-entered core fields.

Required visible fields:

- 标题
- 分类
- 简要说明或标准答案
- 必要标签

Secondary and lower-frequency fields should live inside a bounded `更多信息` collapsible area rather than appearing as a long intimidating form.

Design intent:

- make the first successful entry easy
- avoid overwhelming the operator with metadata

### Tab 2: `内容材料`

This tab uses the user-approved `块列表式` model.

Approved content block types:

- 文字块
- 图片块
- 表格块
- 附件块

Rules:

- every block type must support delete
- blocks should support ordering changes
- the content structure should remain legible both to humans and to AI

This solves the user's requirement that knowledge entry support more complex content and chart-like material instead of only plain text.

### Tab 3: `AI语义层`

This tab uses the user-approved editable-field posture instead of a chat assistant.

Approved AI-generated fields:

- 语义摘要
- 检索词
- 别名
- 适用场景
- 风险标签

Rules:

- AI generates suggestions
- the operator may edit each field
- the operator confirms the semantic layer explicitly
- the system does not silently apply AI output as final truth

This keeps AI useful while preserving editorial control.

## Entry Flows

### Flow A: Manual new entry

1. user clicks `新增知识`
2. right-side board opens in create mode
3. user fills `基础信息`
4. user adds complex material in `内容材料` as needed
5. user generates and edits `AI语义层`
6. user confirms entry
7. system creates a formal row in the ledger with `草稿` state

### Flow B: Edit existing knowledge

1. user single-clicks a row to select it
2. user double-clicks or clicks `编辑`
3. right-side board opens in edit mode
4. user updates fields, content blocks, or semantic fields
5. user saves the draft or submits it to review

### Flow C: AI-assisted pre-entry

1. user clicks `AI辅助录入`
2. right-side board opens in AI pre-entry mode
3. user provides text-first source material
4. user may add image or attachment evidence
5. AI parses the material
6. AI fills candidate values into:
   - `基础信息`
   - `内容材料`
   - `AI语义层`
7. user reviews and edits the result
8. user confirms entry
9. system creates the formal row in `草稿` state

## AI-Assisted Intake Rules

The user-approved AI input rule is:

- text is the primary input
- image and attachment materials are secondary evidence

This means:

- pasted text should drive the first-pass extraction
- uploaded image, table screenshot, or file material can refine interpretation
- the first version should not treat image-only input as the main ingestion path

AI responsibilities in the knowledge library are:

- help parse incoming source material
- structure content into useful record fields
- generate semantic retrieval fields

AI responsibilities do not include:

- auto-approving the record
- auto-submitting it for review
- auto-publishing it into active governed use

## Table Entry Timing And Status Rules

The approved record timing is:

- a new record stays off-table during temporary entry
- it enters the table only after the operator confirms the record and semantic layer

The approved default first state is:

- `草稿`

The board footer therefore has two phases.

### Phase 1: Before formal row creation

Approved actions:

- `取消`
- `确认录入`

### Phase 2: After the row exists as a draft

Approved actions:

- `保存草稿`
- `提交审核`

The `提交审核` action belongs at the bottom of the right-side board, not in the top toolbar.

## Relationship To Knowledge Review

Knowledge library is the entry and maintenance center.

It is not the final review page.

Approved role split:

- knowledge library handles entry, maintenance, semantic confirmation, and draft shaping
- knowledge review handles review decisions in the collaboration/recovery area

This keeps the knowledge-library page short, practical, and high-frequency.

## Relationship To Rule Center And Other Modules

Knowledge library is part of the same family as rule center, but has a different authoring rhythm.

Shared family traits:

- Chinese-first operations
- table-first posture
- bounded temporary side operation area
- AI assistance plus human confirmation
- visible contributor traceability

Different rhythm:

- knowledge library is record-first and tabbed
- rule center is governance-first and stepwise

Future reuse targets may include:

- rule-center reference and packaging
- knowledge-review reuse and correction
- manuscript-processing retrieval and citation support

But the current internal-beta priority remains:

- easy entry
- easy search
- easy maintenance
- easy review submission

## V1 Design Guardrails

The first implemented version should remain simple.

Keep visible by default:

- the top command bar
- the knowledge table
- the three right-side tabs
- the draft and review actions

Hide or defer:

- oversized advanced metadata forms
- large-scale bulk tooling in the primary toolbar
- chat-style AI interactions
- complex analytics views
- low-frequency configuration concepts

## Final Locked Summary

The knowledge library final direction is:

- shared shell retained
- table-first main page retained
- right-side temporary tabbed board retained
- simple toolbar retained
- text-first AI-assisted intake retained
- block-based content material entry retained
- editable semantic fields retained
- off-table temporary creation retained
- draft-first governed state retained
- review handoff retained

In short:

`知识库应该像一个中规中矩、好录入、好维护、带 AI 语义确认的知识总表，而不是一个脱壳的大工作台，也不是一个复杂的治理后台。`
