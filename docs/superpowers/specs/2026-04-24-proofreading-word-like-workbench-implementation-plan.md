# Proofreading Word-Like Workbench Implementation Plan

## Goal

Implement the proofreading result subpage in two truthful stages:

1. Stage 1 ships a genuinely usable human-review workbench inside the current repository constraints.
2. Stage 2 upgrades that workbench into the true Word-like / OnlyOffice-backed version the product direction requires.

This plan is intentionally scoped to the proofreading result subpage and human confirmation page only.

## Locked Boundaries

- Keep `screening`, `editing`, and `proofreading` separate.
- Keep the governed path `proofreading draft -> human confirmation -> human final`.
- Do not blur human-review UI work with residual-learning semantics, template governance, or model-routing redesign.
- Do not claim a true OnlyOffice workbench before the repository has a real embeddable document session contract.
- Do not open unrestricted in-document editing in this work. Human confirmation remains governed through the right-side workflow.

## Truthful Feasibility Baseline

### Stage 1 is implementable on the current codebase

The repository already has:

- a proofreading detail layout and issue workbench shell
- structured proofreading confirmation items
- publish gating for human final
- governed rule-candidate and knowledge-candidate handoff
- block-level location mapping through proofreading source blocks

Stage 1 should therefore ship by strengthening the existing proofreading workbench rather than replacing the architecture.

### Stage 2 is implementable, but only after missing foundations are added

The repository already has a read-only, metadata-oriented preview-session contract, but it does not yet have:

- a real OnlyOffice web embedding layer
- an embeddable preview-session contract that returns document config, token, session metadata, and event-bridge support
- stable paragraph / table / image anchors for proofreading issues
- document-native issue marks and event bridging between the document surface and the right-side issue rail

Stage 2 is therefore a planned repository upgrade, not a toggle hidden in current code.

## Delivery Sequence

1. Finish Stage 1 and stabilize it with tests and browser acceptance.
2. Add the Stage 2 backend and contract foundation before changing the left-side UI to claim true Word-like behavior.
3. Upgrade the proofreading workbench to the real document-native version only after the Stage 2 gate is satisfied.

## Stage 1: Shippable Human-Review Workbench

### Stage 1 Product Promise

After Stage 1:

- opening a proofreading result route feels like entering a dedicated review room, not a nested panel under the larger proofreading page
- the operator sees a simplified left manuscript pane and a right issue workbench
- the right side shows total issue count, severity summary, and filtering
- the left side supports visible issue marks and dependable block-level location jumps
- human confirmation decisions can be saved and restored
- governed publish and governed candidate handoff still work

Stage 1 does not claim a real OnlyOffice document surface. It claims a truthful, simplified, high-utility proofreading review workbench.

### Stage 1 Workstream 1: Dedicated Review Workspace Tightening On The Existing Detail Route

Strengthen the current proofreading detail route so that `proofreading_workspace` and `proofreading_confirmation` feel like a dedicated review workspace inside the existing shell.

This is an incremental workbench tightening task, not a route-system rewrite. The existing proofreading detail state, split layout, issue selection, and manual-edit expansion already exist and should be reused.

Implementation intent:

- keep the global left navigation untouched
- hide the outer proofreading intake / template / execution controls while the dedicated review workspace is active
- keep the browser-visible result route and existing detail-kind semantics
- suppress the outer proofreading intake / template / execution clutter while the dedicated review workspace is active
- avoid route-system rewrites in Stage 1 unless the current shell structure makes them strictly necessary

Primary files:

- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx`

### Stage 1 Workstream 2: Right-Side Issue Rail Enhancement

Enhance the existing right-side issue rail into a focused review rail.

Required additions:

- header summary:
  - total issue count
  - severity breakdown
  - current filtered count
- filter controls:
  - severity
  - status
- clearer card anatomy:
  - issue index
  - severity
  - location
  - source / issue type
  - original text
  - suggestion
  - current decision status
- inline actions:
  - `采纳`
  - `采纳并手改`
  - `驳回`
  - `仅人工处理`
  - `升级处理`
  - `转规则候选`
  - `转知识候选`
- inline manual edit expansion for `采纳并手改`
- visible processed state instead of silently collapsing confirmed issues

This is an incremental front-end enhancement task, not a workflow semantics rewrite or a replacement of the existing proofreading workbench.

### Stage 1 Workstream 3: Confirmation Draft Persistence Foundation

Make proofreading confirmation state durable. Current local `useState` is not enough.

Implementation direction:

- first define an explicit proofreading-owned `confirmation draft` storage object and its save / load contract
- keep this confirmation draft object separate from `publishHumanFinal()` side effects and separate from the publish job payload as the sole source of truth
- allow the implementation phase to choose the smallest truthful storage shape, but require that it be:
  - mutable before publish
  - readable on reload
  - bounded to the proofreading module
  - safe under the current authority chain
- hydrate the right-side rail from persisted draft data on reload
- keep `发布人工终稿` as a separate final action
- keep auto-save low-risk:
  - debounce client-side save
  - retain an explicit `保存进度` action as a safety net

Required non-goals for this workstream:

- saving progress must not create a final asset
- saving progress must not trigger candidate handoff
- saving progress must not write residual learning outputs
- saving progress must not change publish authority or final-manuscript ownership

Why this path:

- the workbench already reads job payload and confirmation decisions
- the current proofreading chain already stores confirmation decisions in publish job payload
- an explicit proofreading-owned confirmation draft object keeps the change bounded to the existing module and authority chain without pretending publish payload is already a draft store

Primary files:

- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/proofreading/proofreading-api.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/web/src/features/proofreading/proofreading-api.ts`
- `apps/web/src/features/proofreading/types.ts`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controller.ts`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

### Stage 1 Workstream 4: Left Manuscript Pane Upgrade Under Current Constraints

Keep the Stage 1 left side block-based, but make it feel like a simplified manuscript surface rather than a debug list.

Required behavior:

- remove low-value technical strings from the operator-facing manuscript pane
- make the manuscript pane read-first and calmer
- add issue marks tied to the current issue rail selection
- preserve location jumps from right to left
- add processed / selected visual states on the manuscript side
- keep table and image blocks truthful if they already exist in the extracted block stream, but do not fake document-native rendering

This work should not overbuild a fake Word editor. It should improve clarity and usability while staying honest about the current left-side technology.

### Stage 1 Workstream 5: Publish, Handoff, and Governance Integrity

Keep the governed chain real while upgrading the UI.

Required checks:

- unresolved blocking issues still disable publish
- `采纳并手改` requires manual edited text before publish
- rule-candidate and knowledge-candidate routing still persist correctly
- no new shortcut bypasses `draft -> human confirmation -> human final`
- no accidental scope creep into prompt-candidate behavior for this UI round

This workstream is primarily verification plus small adapter changes, not a new governance design.

### Stage 1 Workstream 6: Test And Acceptance Coverage

Add targeted coverage at three levels.

Unit and integration:

- detail-page rendering for the dedicated review workspace state
- issue summary and filter behavior
- confirmation draft serialization and hydration
- publish gating with persisted confirmation state

HTTP and service:

- proofreading confirmation draft save / load API behavior
- proofreading publish integrity after saving draft state

Browser acceptance:

- open proofreading result subpage
- confirm that outer proofreading controls are hidden
- verify total issue count is shown
- click an issue and confirm left-side location movement
- save progress, refresh, and confirm decisions persist
- publish human final and confirm the chain still completes

## Stage 1 Acceptance Criteria

Stage 1 is complete only when all of the following are true:

1. The proofreading result subpage opens as a dedicated review workspace inside the existing shell.
2. The right rail shows total issue count, severity summary, and filtered count.
3. The right rail supports the current governed decision set without regressions.
4. `采纳并手改` expands inline in the current issue card.
5. Clicking an issue still moves the operator to the matching manuscript location on the left.
6. Confirmation progress can be saved and restored after reload.
7. Publish gating still blocks unresolved blocking conditions.
8. Rule-candidate and knowledge-candidate handoff still work after human confirmation.
9. Browser acceptance proves the review loop works end to end on a real proofreading sample.

## Stage 1 Explicit Non-Goals

- true OnlyOffice embedding
- document-native comment overlays
- paragraph-range or bookmark-grade anchor precision
- reverse click from left-side document marks into the right rail
- editing and screening parity implementation

## Stage 2 Gate

Stage 2 should not start until all of the following are true:

1. Stage 1 is shipped and stable.
2. The repository upgrades its existing read-only preview-session contract into a real embeddable document-session contract.
3. Proofreading issues can carry stable document anchors beyond `blockIndex`.
4. A document-surface event bridge exists or is proven viable for the chosen OnlyOffice integration path.

## Stage 2: True Word-Like / OnlyOffice Workbench

### Stage 2 Product Promise

After Stage 2:

- the left side becomes a real document-native review surface rather than block rendering
- proofreading issues can locate to stable paragraph / table / image anchors
- the document surface shows real visible issue marks
- the issue rail and the document surface can synchronize selection
- the workbench becomes the correct reusable direction for later editing and screening review pages

### Stage 2A: Foundation Spike

Before committing to full product behavior, Stage 2 must first prove the missing document foundation.

Stage 2A proves:

- the upgraded preview-session contract can mount a real document surface
- the chosen OnlyOffice integration path can support the required event bridge
- proofreading issue anchors can be upgraded beyond block-only positioning
- the document surface can be driven from right-side issue selection without breaking the governed flow

If Stage 2A fails, the repository must not claim visible document-native marks or left-to-right synchronization yet.

### Stage 2 Workstream 1: Preview-Session Contract Upgrade

Replace the current metadata-only preview session with a real embeddable session contract.

Required additions:

- document configuration for the front-end embed
- secure access token or equivalent session authorization material
- session id or correlation id for document events
- explicit mode support beyond simple `view` metadata
- clear support contract for read-only review mode in this product

Primary files:

- `packages/contracts/src/document-pipeline.ts`
- `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
- `apps/api/src/modules/document-pipeline/document-preview-service.ts`
- `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/web/src/features/document-preview/types.ts`
- `apps/web/src/features/document-preview/preview-api.ts`

### Stage 2 Workstream 2: OnlyOffice Review Surface Integration

Add the actual front-end document embed layer.

Required behavior:

- mount the embeddable document surface on the left side of the proofreading workbench
- support read-oriented review mode
- handle load failures and degraded fallback cleanly
- preserve the right-side governed workflow as the primary decision surface

This is where the product starts truthfully feeling like Word.

### Stage 2 Workstream 3: Stable Proofreading Anchor Model

Upgrade proofreading issue location from block-level approximation to stable document anchors.

Target anchor families:

- paragraph
- heading
- table
- table cell when reliably available
- image
- caption

Implementation direction:

- extend the proofreading issue contract
- generate anchors during proofreading issue normalization
- reuse document-structure extraction where possible
- keep fallback compatibility with block-level anchors while the system transitions

Primary files:

- `apps/api/src/modules/proofreading/proofreading-issue-contract.ts`
- `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/document-pipeline/document-structure-service.ts`

### Stage 2 Workstream 4: Issue-To-Document Mapping Layer

Bridge proofreading issues to the document surface through a dedicated mapping layer rather than implicit UI heuristics.

Required behavior:

- right-side issue selection resolves to a document anchor
- document anchor resolution can degrade gracefully when precision is unavailable
- the mapping layer exposes enough metadata for later editing and screening reuse

This workstream is the core dependency behind trustworthy document navigation.

### Stage 2 Workstream 5: Document-Native Marks And Navigation

Add real issue marks on the left-side document surface.

Required behavior:

- visible issue marks or comment-like cues in the document
- right-side issue click activates the matching document mark
- processed issues keep a visible processed state
- when technically viable, clicking a document mark focuses the matching issue card on the right

This work must be staged honestly:

1. right-to-left locate
2. visible mark activation
3. optional left-to-right synchronization

These behaviors belong to Stage 2B productization and should not be promised before Stage 2A proves the underlying event bridge.

### Stage 2 Workstream 6: Table And Image Precision Handling

Explicitly harden non-paragraph cases.

Required behavior:

- table issues target at least the correct table region
- image and caption issues target the correct object region or caption paragraph
- fallback handling is defined when exact cell or object precision is unavailable

This workstream is mandatory because one of the main reasons to move toward a real document surface is to stop flattening complex document content into fake article rendering.

### Stage 2 Workstream 7: Stage 2 Verification

Add verification that proves the true Word-like claim is real.

Contract and API:

- preview-session contract tests
- anchor serialization and hydration tests
- document mapping tests

Front-end:

- embed load tests
- degraded fallback tests
- right-to-left navigation tests
- optional left-to-right synchronization tests if implemented

Browser acceptance:

- real proofreading result page with document embed
- navigation for paragraph issues
- navigation for table issues
- navigation for image or caption issues when fixtures exist
- visible issue mark activation
- no regression in publish flow

## Stage 2 Acceptance Criteria

Stage 2 is complete only when all of the following are true:

1. The proofreading result workspace uses a true embeddable document surface on the left.
2. The preview-session contract returns the information required to mount that surface.
3. Proofreading issues carry stable anchors beyond block-only positioning.
4. Clicking a right-side issue activates the matching document location through the stable anchor model.
5. The left-side document surface shows visible issue marks.
6. Table and image-related issues no longer degrade into arbitrary nearby paragraph jumps when structured anchors exist.
7. The governed human-confirmation and publish chain still works after the document-surface upgrade.

## Stage 2B Explicit Promise Boundary

Stage 2B may claim the full Word-like workbench behavior only after Stage 2A is proven in code and verified in browser acceptance.

## Stage 2 Explicit Non-Goals

- unrestricted in-document free editing and save-back
- replacing the right-side governed confirmation rail with document-side direct editing
- redesigning editing and screening in the same implementation branch

## Cross-Cutting Risks And Controls

### Risk 1: Overpromising Word-like behavior before the contract exists

Control:

- Stage 1 stays block-based and says so explicitly
- Stage 2 is gated on real document-session support

### Risk 2: Breaking the governed publish chain while upgrading the UI

Control:

- Stage 1 and Stage 2 both keep publish gating tests and end-to-end acceptance

### Risk 3: Draft persistence becoming a fake local save

Control:

- persist confirmation draft state through proofreading-owned server contracts
- test refresh recovery explicitly

### Risk 4: Table and image precision remaining superficial

Control:

- anchor model explicitly includes non-paragraph types
- acceptance tests must include structured-content fixtures

## Final Done Condition

This initiative is done only when:

- Stage 1 ships a dedicated, durable, genuinely usable proofreading human-review workbench
- Stage 2 upgrades the left side into a truthful document-native review surface
- the end-to-end governed proofreading flow still works
- rule and knowledge candidate handoff still works
- the repository can honestly say the proofreading review experience is moving toward Word/OnlyOffice rather than imitating it with fragile custom rendering
