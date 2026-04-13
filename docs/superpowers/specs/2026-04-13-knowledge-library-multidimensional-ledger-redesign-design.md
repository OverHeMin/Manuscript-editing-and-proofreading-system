# 2026-04-13 Knowledge Library Multidimensional Ledger Redesign

## Summary

This redesign replaces the current ledger-style knowledge library subpage with a true multidimensional-table entry surface. The page should feel like a spreadsheet-first knowledge base, not a workbench-with-editor. The table is the primary surface, action buttons live above the table, search opens a dedicated results page, and add/edit flows reuse one temporary form panel. AI semantic generation remains mandatory, but it is embedded inside the add/edit form before final submission rather than exposed as a separate workspace.

This spec supersedes the current "sheet on the left, workspace on the right" direction for the `#knowledge-library?knowledgeView=ledger` route.

## User-Approved Decisions

- The ledger subpage must not render the system left navigation or workbench shell.
- The default page must be a full multidimensional table, not a persistent right-side drawer.
- Table-level actions should be minimal for now: `添加`, `删除`, `查找`.
- Search should open a separate results page rather than only filtering inline.
- Add and edit should reuse the same form surface.
- The record should not be saved into the table until the operator has reviewed and accepted the AI semantic layer.
- AI should primarily read text input. Images are supporting evidence, not the primary semantic source.

## Goals

- Make the knowledge library feel like a spreadsheet-style entry ledger.
- Maximize visible data density on desktop.
- Keep the add/edit flow simple enough for high-volume knowledge entry.
- Keep AI semantic enrichment mandatory but not intrusive.
- Preserve governed review submission and duplicate-check safeguards.

## Non-Goals

- No persistent side drawer as the main page layout.
- No heavy filter builder, grouping system, or advanced semantic query builder in this round.
- No image-only ingestion flow.
- No inline freeform cell editing for long-form fields in the first iteration.

## Primary UX

### 1. Ledger Page

The ledger route remains the dedicated subpage:

- Route: `#knowledge-library?knowledgeView=ledger`
- Layout: full-width table page
- No outer workbench header
- No outer workbench left navigation

The page contains:

- A compact top title row
- A table action toolbar
- The multidimensional knowledge table

### 2. Toolbar

The toolbar sits directly above the table and contains:

- `添加`
- `删除`
- `查找`
- Optional view controls on the right:
  - row density switch: `紧凑 / 标准 / 宽松`
  - horizontal scroll hint

The toolbar should not be presented as large marketing-style cards. It should feel like table controls.

### 3. Table Structure

The table is the main product surface. The default visible columns, in priority order, are:

1. `名称 / 关键词`
2. `答案`
3. `类别`
4. `详情`
5. `图片 / 附件`
6. `AI 状态`
7. `贡献人`
8. `日期`

Additional columns to the right, available through horizontal scrolling:

- `语义摘要`
- `检索词`
- `别名 / 同义词`
- `适用场景`
- `风险标签`

Table interaction requirements:

- Column widths are draggable
- Row density is adjustable
- Horizontal scrolling is supported cleanly
- The table should visually resemble a spreadsheet rather than a card list

### 4. Search Flow

`查找` opens a separate search surface, not just inline filtering.

Recommended shape:

- Click `查找`
- Open a dedicated search page or modal-first route under the ledger flow
- Enter query
- Search across both:
  - human-entered fields
  - AI semantic fields
- Show dedicated result rows with keyword/semantic hits highlighted

The result surface should still look table-first.

### 5. Add/Edit Flow

`添加` and `编辑` use the same form surface.

Recommended behavior:

- Click `添加`
- Open a temporary form panel on the same page
- Filling starts in `基础信息`
- Operator triggers `生成 AI 语义`
- Form shows AI suggestions
- Operator edits AI fields if needed
- Only after operator confirmation can the record be committed into the table

Editing an existing row reopens the same form with existing values prefilled.

## Add/Edit Form Design

The form is a temporary surface, not a permanent drawer. It may slide in from the right or open as an anchored same-page panel, but it must feel like a transient data-entry sheet.

### Form Sections

#### A. 基础信息

- 名称 / 关键词
- 答案
- 类别
- 详情

#### B. 图片 / 附件

- Drag-and-drop upload area
- Attachment list
- Add attachment button
- Delete attachment button for each attachment
- Optional image note / caption field

#### C. AI 语义层

- AI 状态
- 语义摘要
- 检索词
- 别名 / 同义词
- 适用场景
- 风险标签

### AI Semantic Workflow

This is mandatory before final save.

Flow:

1. Operator enters text-based core content
2. Operator clicks `生成 AI 语义`
3. System generates semantic suggestions from text-first inputs
4. Operator reviews and modifies semantic fields
5. Operator may click `重新生成`
6. Operator confirms the semantic layer
7. Operator submits the full record

Required actions:

- `生成 AI 语义`
- `重新生成`
- `应用建议`
- `手动修改`
- `确认录入`
- `取消`

### Dynamic Fields Rule

Any repeatable UI must have symmetric add/remove controls.

Examples:

- Add alias -> alias item must have delete
- Add tag -> tag item must have delete
- Add image -> image item must have delete
- Add attachment -> attachment item must have delete

This is a hard product rule to avoid dead-end form states.

## Input Rules For AI

AI semantic generation should treat text as the primary source.

### Primary Inputs

- 名称 / 关键词
- 答案
- 类别
- 详情

### Secondary Inputs

- 图片
- 附件
- 图片说明 / 附件说明

Interpretation rule:

- Text drives semantic extraction
- Images only enrich or support semantic interpretation
- Image-only records should not be considered valid for semantic generation

## Data Presentation Rules

To make the knowledge base legible at scale:

- `名称 / 关键词` and `答案` should stay pinned toward the left
- `详情` and semantic fields may truncate in the grid and expand in the form
- Image/attachment cells should show compact thumbnails or attachment chips
- AI status should be visually simple:
  - 未生成
  - 已生成待确认
  - 已确认

## System Behavior

### Save States

- Draft local form state should not immediately create a table row
- Only confirmed submission writes the row into the ledger
- Cancel should close the form and discard unsaved temporary changes unless explicitly preserved later

### Duplicate Protection

Duplicate checks remain part of the governed flow and can run:

- before final save into ledger, or
- before submit-to-review, depending on current implementation boundaries

This redesign should not remove duplicate warnings.

### Review Submission

The redesign changes the entry UI, not the downstream governance model.

Existing governed actions should remain available after a record exists:

- save draft
- create update draft
- submit to review

## Implementation Shape

### Route Strategy

- Keep `knowledge-library` classic page unchanged
- Rebuild only `knowledgeView=ledger`
- Add a dedicated search results surface under the ledger route

### Frontend Slices

Expected areas to redesign:

- `apps/web/src/app/workbench-host.tsx`
  - keep immersive rendering for the ledger route
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`
  - rebuild into spreadsheet-first layout
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.css`
  - replace current workspace-heavy styling
- table-specific components
  - pivot from card-like rows to spreadsheet-like cells
- add/edit form component
  - extract reusable entry form
- search results page/component
  - dedicated search result rendering

### Suggested Component Boundaries

- `KnowledgeLibraryLedgerPage`
- `KnowledgeLibraryLedgerToolbar`
- `KnowledgeLibraryLedgerGrid`
- `KnowledgeLibraryLedgerSearchPage`
- `KnowledgeLibraryEntryForm`
- `KnowledgeLibrarySemanticSection`
- `KnowledgeLibraryAttachmentField`

## Error Handling

- AI generation failure must not close the form
- Upload failure must leave the rest of the form intact
- Cancel must always be available
- Repeatable field deletion must be immediate and obvious
- Search with no results should show an explicit empty state in the search page

## Testing

### Render and Routing

- ledger route renders without system shell header/nav
- ledger route renders spreadsheet-style grid structure
- search action opens dedicated result surface
- add action opens same-page form surface

### Form Behavior

- add and edit share the same form
- cancel closes the form
- AI semantic section appears before final save
- confirm save is blocked until AI semantic layer exists or is explicitly confirmed
- repeatable fields support both add and delete

### Table Behavior

- required columns render in priority order
- hidden/overflow columns remain reachable through horizontal scrolling
- row density control changes row styling state
- column resize state updates client-side width model

### Search

- search result surface includes hits from base text fields
- search result surface includes hits from semantic fields

## Rollout Notes

- Existing experimental ledger UI work in the current branch should be treated as superseded by this redesign.
- Implementation should prefer replacing the current workspace metaphor rather than incrementally polishing it.

