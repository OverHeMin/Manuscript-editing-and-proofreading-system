# Proofreading Word-Like Workbench Design

## Goal

Rebuild the proofreading result subpage into a real Word-like human verification workbench.

This round only covers the proofreading result subpage and human confirmation page. It does not redesign the outer proofreading landing page.

The primary product target is:

- left side feels like Word, not a fake web article viewer
- right side feels like a focused issue sidebar, not a generic admin form
- issue selection, document location, manual confirmation, and governed publish all stay in one smooth loop

## Why Now

The current proofreading subpage already has the governed flow and the human confirmation actions, but it still misses the user's core expectation:

- the page is not truly document-first
- the proofreading workspace is embedded under the larger workbench shell instead of standing as a dedicated task surface
- the left side is still rendered as custom text blocks rather than a real document-grade reading surface
- issue location is conceptually present but not presented like a Word-style mark-and-review experience

If we keep extending the current custom web rendering path, later editing and screening will also drift away from real editorial habits. The repository already contains OnlyOffice-backed preview session capability, so the smallest correct move is to elevate that capability into the proofreading workbench instead of building a more elaborate fake Word layer.

## Scope

### In Scope

- convert the proofreading result subpage into a dedicated Word-like review workbench
- use the existing OnlyOffice document preview capability as the left-side primary manuscript surface
- keep the right side as a focused proofreading issue sidebar with confirmation actions
- add visible issue marks on the left-side document area
- show total issue count at the top of the right-side workbench
- keep the governed flow:
  - proofreading draft
  - human confirmation
  - human final publish
  - optional route to rule candidate
  - optional route to knowledge candidate
- preserve later reuse potential for editing and screening without implementing those modules in this round

### Out of Scope

- redesigning the outer proofreading main page
- redesigning editing or screening subpages in this round
- changing proofreading AI routing strategy
- changing residual learning semantics
- changing document asset authority rules
- introducing direct end-user editing inside OnlyOffice save-back mode

## Approaches Considered

### A. Continue Custom Web Rendering

Keep the current left side as custom text and block rendering, then polish it until it looks more like Word.

Rejected because:

- it only imitates Word visually
- table and image handling will continue to feel wrong
- long-manuscript positioning and future module reuse will remain fragile

### B. OnlyOffice Left, Governed Sidebar Right

Use a real document preview surface on the left and keep a governed issue-and-confirmation sidebar on the right.

Chosen because:

- it matches user habit most closely
- tables and images remain document-native instead of being flattened into fake web structure
- it is the smallest change that moves the product toward a shared document-first interaction model for proofreading, editing, and screening

### C. Full Word/WPS Clone Overlay

Try to fully recreate a Word-like chrome with deep floating comment behavior and custom overlays everywhere.

Rejected for this round because:

- it is too large for the current scope
- it adds visual and interaction complexity before the core proofreading loop is stabilized

## Design

### 1. Workbench Boundary

The proofreading result subpage should become a dedicated task surface once an asset-based proofreading result route is opened.

The page should still keep the global left navigation, but the content area should stop showing the full outer proofreading workbench controls above the result detail. The active task surface should behave like a document review workspace, not like a nested section under the intake and execution form.

This means the proofreading result route should render a document-first layout directly:

- left: manuscript review surface
- right: issue sidebar

The user should feel they have entered the review room, not a secondary panel inside a larger admin screen.

### 2. Left Side Document Surface

The left side should use the existing OnlyOffice-backed preview session as the primary manuscript view.

The user requirement here is explicit: this surface must feel like Word, not like a custom webpage pretending to be a manuscript.

Requirements:

- manuscript content is shown through the document preview path rather than custom proofreading block rendering
- tables, images, and other non-paragraph assets remain in their original document structure
- the view stays read-oriented for this round; human decisions still happen through the governed right-side workflow

This change intentionally shifts the product from block simulation to document-native review.

### 3. Left Side Issue Marks

The left side must not be a clean passive preview. Issues found by proofreading must be visibly marked.

Two layers of marking are required:

1. Content mark
   - paragraph issues: highlight the relevant text span or nearest text region
   - table issues: highlight the table region first; finer cell-level targeting can be added when reliable anchors are available
   - image or caption issues: highlight the image frame or caption paragraph

2. Position mark
   - show a lightweight position marker tied to the issue index so the user can quickly see where issues are distributed in the document

Interaction rules:

- clicking an issue in the right sidebar scrolls the left document surface to the issue and activates its mark
- clicking a left-side mark should focus the corresponding issue card on the right when technically feasible in the current preview integration
- confirmed items keep a visible processed state instead of disappearing immediately

The product goal is not just "issue exists in data". The issue must be findable on the manuscript surface.

### 4. Right Side Sidebar Header

The right-side workbench must start with an immediate count summary so the operator understands the scale of the manuscript at a glance.

The top of the sidebar must show:

- total issues found
- severity breakdown
- current filtered count

Recommended structure:

- `共发现 N 项问题`
- `高 X · 中 Y · 低 Z`
- `当前显示 A / 共 N`

This total count is a hard requirement because the user wants instant situational awareness before processing individual items.

### 5. Right Side Sidebar Structure

The right side should be a focused review sidebar, visually closer to a Word-style review pane than a dashboard card list.

The sidebar should contain:

- top header with issue counts and lightweight actions
- filter row for severity and status
- stacked issue cards
- bottom publish area

Each issue card should show:

- issue index
- severity
- location
- current confirmation status
- original text
- issue explanation or basis
- suggested change

Actions per issue:

- `采纳`
- `采纳并手改`
- `驳回`
- `仅人工处理`
- `升级处理`
- `转规则候选`
- `转知识候选`

When `采纳并手改` is selected, the manual edit input expands inline inside the same issue card.

This keeps the operator in one continuous verification rhythm instead of bouncing through modals.

### 6. Save and Publish Behavior

The right side should support low-friction progress retention.

Rules:

- per-issue decisions should auto-save into human confirmation draft state
- `保存进度` remains as an explicit safety action, but ordinary confirmation should not rely on manual save after every click
- `重新审稿` should refresh the proofreading review set without silently erasing confirmed human work

`发布人工终稿` stays as the single bottom-level final action.

Publish gating:

- blocking issues cannot remain unresolved
- `采纳并手改` items cannot publish without manual edited text

This preserves the existing governed `draft -> human confirmation -> final manuscript` path.

### 7. Learning and Candidate Handoff

This page must keep the governed learning path real, not decorative.

After human confirmation:

- `转规则候选` routes the item into the rule candidate pipeline
- `转知识候选` routes the item into the knowledge candidate pipeline

The intended residual-learning behavior stays:

- governed template, rule, and knowledge hits should not be re-counted as free residual learning
- only the parts surfaced or clarified by the human confirmation process should become candidate writeback material

This keeps the proofreading workbench tied to actual governance outcomes rather than disconnected UI state.

### 8. Future Reuse Boundary

This round implements proofreading only, but the structure should intentionally become the shared direction for later editing and screening detail pages:

- left-side document-native surface
- right-side module-specific issue or action sidebar
- governed publish or handoff action at the bottom

The shared direction is important. The implementation, however, must remain scoped to proofreading in this round.

## Acceptance Checks

1. Opening a proofreading result asset route enters a dedicated proofreading review workbench rather than showing the full outer proofreading control surface above the detail.
2. The left side uses the existing OnlyOffice document preview capability as the primary manuscript surface.
3. Issues found by proofreading are visibly marked on the left document surface.
4. Clicking an issue on the right locates and activates the corresponding left-side issue mark.
5. The top of the right sidebar shows total issue count plus severity breakdown.
6. The right sidebar supports `采纳`、`采纳并手改`、`驳回`、`仅人工处理`、`升级处理`、`转规则候选`、`转知识候选`.
7. `采纳并手改` expands inline manual edit input in the current issue card.
8. Per-issue confirmation state can be retained without forcing manual save after every action.
9. `发布人工终稿` remains governed and is disabled when blocking requirements are unmet.
10. `转规则候选` and `转知识候选` continue to feed the governed candidate pipelines.

## Notes

This is intentionally a product-direction correction, not a full-platform rewrite.

The repository already has OnlyOffice preview-session capability and a governed proofreading confirmation flow. The design goal is to reconnect those two existing strengths into a review experience that matches actual editorial habit.
