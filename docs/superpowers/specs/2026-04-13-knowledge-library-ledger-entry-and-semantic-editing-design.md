# Knowledge Library Ledger Entry And Semantic Editing Design

**Date**

2026-04-13

**Status**

Draft for written review

**Goal**

Design a dedicated `knowledge-library` subpage that feels like an online sheet for rapid knowledge entry and maintenance, while preserving the existing governed draft/review model and adding two controlled AI accelerators:

- AI-assisted intake from pasted source material
- single-record semantic editing for the currently selected knowledge item

## Final Design Decisions

The validated decisions for this design are:

- The new experience is a dedicated subpage mode inside `knowledge-library`, not a new top-level workbench id.
- The preferred shape is `sheet-first`: left-side knowledge table, right-side editable workspace.
- The page must optimize for `quick new record` as the primary first action.
- The page must support both entry paths:
  - manual entry first
  - AI parse intake as a second primary action
- AI semantic capability is needed in two bounded forms:
  - AI parse intake to bootstrap a draft from pasted source text
  - single-record semantic editing for one selected record at a time
- First version must be real and connected to the current knowledge library backend, not a mock-only prototype.
- AI must never directly overwrite governed records without human confirmation.
- Review approval stays in the existing `knowledge-review` workbench; the new page remains an authoring and preparation surface.

## Context

The current repository already has a working `knowledge-library` web page and real persistence/runtime support for:

- listing knowledge assets
- keyword and semantic query modes
- loading asset/revision detail
- creating and updating draft revisions
- deriving a new draft from an approved asset
- replacing rich content blocks
- regenerating and confirming semantic layers
- duplicate detection
- submitting drafts for review

However, the existing page is governance-heavy and detail-panel-heavy. It does not deliver the "online table knowledge base" interaction model the user wants for daily entry and maintenance.

There is also an important product truth in the current backend:

- `semantic-layer regenerate/confirm` exists
- but the current server-side generation path is heuristic/draft-building, not a true instruction-driven AI assistant

So the requested AI experience cannot be satisfied by relabeling the current semantic layer controls. First version needs explicit AI suggestion endpoints or equivalent backend extension.

## User-Validated Product Preferences

The following preferences were explicitly validated during brainstorming:

- preferred overall direction: `sheet-first table page`
- preferred implementation level: `real connected first version`
- preferred AI scope: both single-record AI editing and future batch potential, but first version focuses on single-record AI editing
- preferred first action on page load: `quick add a new record`
- preferred new-record entry model:
  - manual entry is the default primary path
  - AI parse intake is available beside it

## Problem Statement

The current knowledge library experience misses the target in four ways:

1. It does not feel like a knowledge ledger.
   The list is not the dominant interaction surface, so operators cannot browse and edit with the same speed as a sheet-style tool.

2. It does not privilege fast entry.
   The page is more comfortable for governed detail management than for "I want to add one more knowledge item right now."

3. The current semantic controls are too technical and too narrow.
   They expose a semantic layer concept, but not a natural-language assistant workflow for the current record.

4. The current UI shape does not separate three distinct editing jobs clearly enough:
   - field authoring
   - semantic refinement
   - rich content block maintenance

## Scope

### In Scope

- a new `knowledge-library` subpage mode for sheet-style entry and editing
- a table-first layout with row selection and right-side editable workspace
- unsaved local composer state for new records before the first server save
- manual quick-entry flow
- AI parse intake flow that produces a suggestion draft
- single-record semantic editing flow that produces a suggestion patch
- explicit workspace tabs:
  - fields
  - semantic
  - content blocks
- reuse of current governed draft/review lifecycle
- reuse of current duplicate-check behavior
- clear handling of AI unavailable / AI failed states

### Out of Scope

- bulk AI cleanup across many records
- spreadsheet-style inline cell editing across the full table
- collaborative cursors / multi-user presence
- custom columns, formulas, summary views, pivot-style analytics
- moving review approval into this page
- replacing the existing classic `knowledge-library` page on day one

## Route And Entry Strategy

This design intentionally ships as a dedicated subpage mode under the existing workbench shell.

### Workbench Strategy

- Keep `workbenchId = knowledge-library`
- Add a route-level subpage discriminator, recommended as:
  - `knowledgeView=classic | ledger`

Recommended hashes:

- `#knowledge-library`
- `#knowledge-library?knowledgeView=ledger`
- `#knowledge-library?knowledgeView=ledger&assetId=...`
- `#knowledge-library?knowledgeView=ledger&assetId=...&revisionId=...`

### Rollout Strategy

First release should preserve the existing page as `classic` and add the new page as `ledger`.

This satisfies the user's request for "a dedicated subpage to try this" while avoiding a forced cutover. If the new surface works well, later rollout can promote `ledger` to the default landing mode.

## Target Information Architecture

The new `ledger` subpage has three major regions.

### 1. Top Command Bar

Responsibilities:

- search input
- keyword / semantic query mode toggle
- `New Record` primary action
- `AI Parse Intake` secondary primary action
- optional view switch between `classic` and `ledger`

Design intent:

- fast entry actions are visible before any record is selected
- search and entry live on the same horizontal control plane

### 2. Left Knowledge Ledger

Responsibilities:

- display the knowledge table as the primary browsing surface
- show the current visible list for the active search/query mode
- support row selection
- keep the selected record visually locked while editing

Recommended default columns:

- row index
- title / keyword
- answer / canonical summary
- kind
- semantic status
- contributor or updated-at marker

This area is not a full spreadsheet engine in V1. Row selection is the core behavior; editing happens in the right workspace.

### 3. Right Editing Workspace

This is not a read-only detail pane. It is the actual working area for the selected or unsaved record.

Tabs:

- `Fields`
- `Semantic`
- `Content Blocks`

## Editing Workspace Tab Design

### Fields Tab

Default tab for both new entry and existing-record maintenance.

Responsibilities:

- title
- canonical text / answer
- summary
- knowledge kind
- module scope
- manuscript types
- sections
- risk tags
- discipline tags
- aliases
- source metadata
- effective / expires timing
- structured bindings

This tab must make manual entry fast. The user should be able to start with the smallest practical set of fields, then fill the rest incrementally.

### Semantic Tab

Purpose:

- provide a single-record natural-language AI assistant
- show the current semantic layer status and latest suggestion state
- let the user regenerate, patch, compare, and confirm semantic output

The semantic tab should be able to update:

- semantic layer fields:
  - page summary
  - retrieval terms
  - retrieval snippets
  - table semantics
  - image understanding
- limited metadata suggestions when appropriate:
  - summary
  - aliases
  - sections
  - risk tags
  - discipline tags

The semantic tab should not directly mutate the most identity-heavy fields in V1 without explicit human edit:

- title
- canonical text
- knowledge kind
- module scope

Those fields stay user-owned in the `Fields` tab or AI-owned only during initial parse intake suggestion.

### Content Blocks Tab

Purpose:

- maintain the existing rich-space model
- support text/table/image blocks
- support block-level semantics already supported by the backend

This preserves the current repository direction where complex knowledge is richer than one plain text field.

## Entry Flows

### Flow A: Manual New Record

1. User clicks `New Record`
2. UI opens an unsaved local composer in the right workspace
3. User fills minimum required fields
4. User clicks `Save Draft`
5. Frontend calls `createDraftAndLoad`
6. After the first save, the record becomes a normal governed draft revision
7. User can continue editing fields, semantic layer, and content blocks

Why local unsaved state is required:

- current backend draft creation expects meaningful input, not a blank server record
- immediate server creation on button click would force low-quality empty drafts

### Flow B: AI Parse Intake

1. User clicks `AI Parse Intake`
2. A bounded intake panel opens in the right workspace
3. User pastes source material and optional hints
4. Backend returns a suggestion payload
5. UI maps the suggestion into the same local composer model used by manual entry
6. User reviews and edits the suggestion
7. User explicitly saves the draft

The AI parse path must not create or submit a governed draft automatically.

### Flow C: Existing Record Semantic Editing

1. User selects a row in the ledger
2. User opens the `Semantic` tab
3. User enters a natural-language instruction for this record
4. Backend returns a suggestion patch
5. UI shows a reviewable draft state
6. User accepts, edits further, or discards
7. User explicitly saves and optionally confirms the semantic layer

## AI Interaction Model

The AI model in V1 must be suggestion-only and review-first.

### AI Parse Intake Contract

The intake assistant should return a structured suggestion bundle:

- suggested fields
- suggested content blocks
- suggested semantic layer
- confidence / warning notes when available

Suggested fields may include:

- title
- canonicalText
- summary
- knowledgeKind
- moduleScope
- manuscriptTypes
- sections
- riskTags
- disciplineTags
- aliases

### Single-Record Semantic Edit Contract

The semantic assistant should accept:

- revision id
- current revision detail snapshot
- operator instruction text

It should return:

- suggested semantic layer patch
- optional limited metadata patch
- optional explanation / warnings

### AI Trust Boundaries

- AI never directly writes the approved runtime projection
- AI never bypasses draft/review status transitions
- AI never auto-submits to review
- AI output is always reviewable and discardable
- if AI is unavailable, the page remains fully useful via manual entry

## Backend And API Design

### Reused Existing Endpoints

The new subpage should reuse current knowledge library endpoints for:

- list
- detail
- draft create
- draft update
- derived draft create
- content block replace
- semantic layer regenerate
- semantic layer confirm
- duplicate check
- submit for review
- image upload

### New Backend Capability Required

First version needs two new AI-oriented capabilities because the existing semantic draft builder is heuristic-only.

#### 1. Intake Suggestion Endpoint

Recommended shape:

- `POST /api/v1/knowledge/library/ai-intake`

Request:

- raw source text
- optional source label / source link
- optional operator hints

Response:

- `suggestedDraft`
- `suggestedContentBlocks`
- `suggestedSemanticLayer`
- `warnings`

This endpoint does not persist anything by itself.

#### 2. Single-Record Semantic Suggestion Endpoint

Recommended shape:

- `POST /api/v1/knowledge/revisions/:revisionId/semantic-layer/assist`

Request:

- instruction text
- optional target scopes

Response:

- `suggestedSemanticLayer`
- `suggestedFieldPatch`
- `warnings`

This endpoint also does not persist anything by itself.

### Semantic Regenerate Fallback

The existing `regenerateSemanticLayer` flow should remain available as a non-AI fallback. It can continue to build a heuristic draft from current revision content when the operator wants a baseline semantic rebuild without invoking an AI assistant.

## Duplicate Detection Behavior

Duplicate detection should remain active in the new page.

Recommended behavior:

- run debounced duplicate checks once local draft state contains enough signal
- surface strong matches in the right workspace
- keep the existing submit-time acknowledgement guardrail

The AI parse intake path should not bypass duplicate checks. Suggested drafts should flow through the same duplicate logic before submit.

## Error Handling

### AI Failure

If AI parse or semantic assist fails:

- keep the user's current local draft state intact
- show a clear failure notice in the active workspace
- keep manual editing available immediately

### Unsaved Draft Safety

If the user starts a new local draft and navigates away:

- warn before destructive discard
- allow explicit discard
- do not silently erase local work

### Save Failure

If a draft save fails:

- preserve the local composer state
- preserve AI suggestion state if present
- avoid clearing the workspace or changing row selection

## Testing Strategy

### Web Tests

- route parsing for `knowledgeView=ledger`
- local unsaved composer behavior
- manual new-record save flow
- AI parse suggestion mapping into local composer state
- semantic assist suggestion application and discard
- tab switching between fields / semantic / content blocks
- duplicate warning behavior in the ledger workflow

### API Tests

- intake suggestion endpoint returns structured suggestions without persistence
- semantic assist endpoint returns structured suggestions without persistence
- AI-disabled / AI-unavailable behavior fails open
- existing semantic regenerate path still works as fallback

### Smoke / Integration

One real browser smoke should cover:

1. open `knowledge-library` ledger mode
2. create a draft from manual entry
3. save it
4. open semantic tab
5. apply a semantic suggestion or fallback regenerate
6. save / confirm semantic changes
7. submit to review

## Acceptance Criteria

V1 is successful when all of the following are true:

- there is a dedicated `knowledge-library` ledger subpage accessible from the workbench shell
- the page visually behaves like a knowledge table first, not a governance form first
- `New Record` is the dominant primary action
- `AI Parse Intake` exists beside manual entry and produces a reviewable suggestion draft
- selecting a row opens a real editable workspace on the right
- the right workspace has three tabs:
  - fields
  - semantic
  - content blocks
- single-record semantic AI editing works as a suggestion flow, not an auto-write flow
- the governed draft/review lifecycle remains unchanged
- AI unavailable states degrade to manual authoring instead of blocking the page
- the existing classic page still remains reachable during the first rollout

## Risks And Guardrails

- Do not fake the AI scope by relabeling the current heuristic semantic regenerate path as an instruction-driven assistant.
- Do not replace the existing page outright in the first release; keep this as a dedicated subpage mode.
- Do not let AI directly mutate approved runtime knowledge without explicit draft save and review confirmation.
- Do not force spreadsheet-style inline editing into V1; it will expand scope without improving the main user outcome.
- Do not create blank server-side drafts on `New Record`; use local unsaved composer state until the first meaningful save.

## Planning Readiness

This design is ready for implementation planning because it fixes:

- the product shape
- the entry priority
- the route strategy
- the right-side workspace structure
- the AI trust boundary
- the backend delta between current capability and requested AI behavior
- the first-release scope limit

The next step should be an implementation plan that decomposes:

- routing and host changes
- new ledger page/component structure
- local composer state model
- AI suggestion API contracts
- web tests and browser smoke coverage
