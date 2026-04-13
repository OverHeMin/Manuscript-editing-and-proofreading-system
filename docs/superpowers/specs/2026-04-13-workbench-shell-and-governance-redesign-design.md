# 2026-04-13 Workbench Shell And Governance Redesign Design

**Date**

2026-04-13

**Status**

Draft for written review

**Goal**

Unify the approved redesign direction across the shell, knowledge library, rule center, Harness, and the three manuscript workbenches so the system behaves like one coherent operations product instead of several unrelated consoles.

This design locks five user-approved outcomes:

- keep the global left navigation
- remove large page-internal intro and hero sections
- make knowledge and governance pages ledger-first and table-first
- make `screening / editing / proofreading` share one consistent desk layout
- let AI classify manuscript type after upload and auto-bind the matching governed assets

## Why This Consolidation Is Needed

The repository now contains several partially valid design directions created on different days:

- shell refresh
- knowledge-library ledger redesign
- rule-center ledger redesign
- manuscript-workbench quality and governance redesign

Those documents no longer fully agree with the latest approved direction.

The latest product guidance is clear:

1. the global shell stays
2. page-level marketing-style intros should go away
3. knowledge library keeps a main page plus a dedicated subpage
4. rule center keeps a lightweight main page plus three dedicated subpages
5. Harness content should live in Harness, not be duplicated elsewhere
6. manuscript operations should feel like one family with the same working posture

This document is the integration layer that future implementation should follow.

## Approved Product Decisions

The following decisions are treated as final input for implementation.

### 1. Shared shell

- keep the global left navigation
- keep the authenticated workbench shell
- do not remove the system-wide sidebar
- remove page-internal introduction blocks, large descriptive hero cards, and oversized summary bands that consume working space
- each page body should prioritize the operator's actual working surface

### 2. Knowledge library

- the knowledge library remains a two-level experience:
  - a main page
  - a dedicated multidimensional-ledger subpage
- only the knowledge-library flow should include an explicit main-page and subpage round-trip action
- the ledger subpage remains table-first
- the earlier decision to remove the global shell from the knowledge ledger is superseded

### 3. Rule center

- the rule-center main page should keep only compact overview data and entrances
- the rule center should use exactly three working subpages:
  - `template ledger`
  - `original-edited extraction`
  - `content module ledger`
- `general modules` and `medical specialized modules` should no longer be separate top-level rule-center landing pages
- those two classes should be handled within the content-module ledger flow

### 4. Harness

- Harness-related controls and status should be centralized inside the Harness page
- duplicate Harness content in management overview pages should be removed, minimized, or relocated
- the Harness page must expose real configuration controls instead of only summaries

### 5. Manuscript workbenches

- `screening / editing / proofreading` should use one shared page pattern
- they should not add return-home buttons inside the page
- they should avoid large internal intro sections
- the layout should follow the approved image direction:
  - narrow queue and search rail
  - dominant central working canvas
  - lighter action row for low-frequency actions
  - no always-open oversized right column

### 6. Manuscript upload and type recognition

- normal upload should not require the operator to manually choose manuscript type up front
- after upload, AI should classify the manuscript type
- the system should then auto-select the matching template family, rule package, module bundle, retrieval preset, and runtime binding
- manual correction remains available only as an override or when confidence is low

### 7. Batch upload guardrail

- batch upload is required
- early-stage default cap is `10` manuscripts per batch
- the limit must be enforced on both frontend and backend
- the limit should be configurable later without redesigning the workflow

## Shared Layout Rules

These rules apply across the redesigned workbench pages.

### 1. No page-level intro panels

Do not render large descriptive blocks at the top of each page that restate what the page is for.

Examples of disallowed patterns:

- hero cards
- large prose introductions
- oversized statistic blocks that push the work surface below the fold
- repeated explanatory banners on every subpage

Allowed replacements:

- a compact title row
- a small status strip when operationally necessary
- a compact metric row when the page is an overview page

### 2. Table-first governance pages

For knowledge library and rule-center subpages:

- the main body should be a table or ledger
- high-frequency actions live above the table
- add, delete, search, import, apply, and confirm actions should be compact and easy to scan
- forms should appear as temporary in-page layers, not permanent side drawers

### 3. Scroll behavior

Long pages should not become endlessly tall.

Required behavior:

- each major content region may own its own scroll area
- queue panels, ledger bodies, and detail canvases should be allowed to scroll independently where appropriate
- internal scrolling should preserve header and action visibility

### 4. Visual density

Working pages should prefer density over decoration.

Rules:

- keep table chrome light
- use spacing intentionally but not lavishly
- minimize oversized badges and large count tiles
- keep actions close to the content they control

### 5. No duplicated navigation buttons

If a destination already exists in the global left navigation, do not repeat it as a large in-page jump button unless that flow truly needs local round-trip navigation.

Exception:

- knowledge library may keep its explicit main-page and subpage round-trip action because it intentionally switches between an entry page and a dedicated ledger page

## Knowledge Library Design Adjustments

The current knowledge-library ledger redesign remains directionally valid, but these latest decisions refine it.

### Main page and subpage behavior

- the knowledge-library main page acts as the entry surface
- the multidimensional ledger remains the main data-entry and browsing subpage
- both surfaces keep the global left navigation
- only this feature family gets an explicit round-trip button between main page and ledger subpage

### Ledger page rules

- the ledger stays spreadsheet-like
- the toolbar stays minimal:
  - `Add`
  - `Delete`
  - `Search`
- the table remains the primary surface
- the temporary add/edit form remains the only entry form
- AI semantic review remains mandatory before final commit into the ledger

### AI semantic editing position

The operator flow must be:

1. enter the human-authored content
2. trigger AI semantic generation
3. review the AI semantic result
4. modify the AI semantic fields if needed
5. confirm the semantic layer
6. only then save the record into the ledger

This is the approved place for AI semantic adjustment. It happens inside the reusable add/edit form before the row is committed.

### Input priority for AI

AI should interpret:

- text as the primary semantic source
- images and attachments as supporting evidence only

This means operators should enter core meaning in text fields. Images may support but must not be the only meaningful input.

## Rule Center Redesign

This section supersedes today's earlier rule-center split that used separate general and medical module pages.

### Main page

The main rule-center page should be lightweight and should only provide:

- small overview metrics
- entry points to the three working subpages
- optionally a compact recent activity list

It should not provide:

- full editing forms
- candidate confirmation surfaces
- large management introductions
- duplicate buttons that already exist in the left navigation

### Three working subpages

#### 1. `template ledger`

Purpose:

- manage templates as governed containers
- reuse module assets
- duplicate and publish templates
- bind templates into manuscript flows

#### 2. `original-edited extraction`

Purpose:

- upload original and edited manuscripts
- create extraction tasks
- view extraction output
- run AI semantic understanding
- confirm candidate intake

#### 3. `content module ledger`

Purpose:

- manage all governed content modules in one table-first surface
- include both `general modules` and `medical specialized modules`
- distinguish them by type, filter, tag, or segmented view inside the same page family

### Content-module ledger behavior

The content-module ledger should not flatten all modules into one undifferentiated list.

Recommended behavior:

- one shared page shell
- one shared toolbar
- one shared ledger pattern
- visible classification for:
  - `general`
  - `medical_specialized`

Allowed implementations:

- segmented tabs inside the same page
- a type switch above the table
- a filter chip row

Not allowed:

- two separate top-level landing pages again

### Extraction candidate flow

The extraction page remains the AI confirmation boundary.

Approved flow:

`upload original + edited manuscript -> extract candidates -> AI semantic understanding -> human edit and confirm -> intake into template or content-module draft`

The AI semantic layer belongs between extraction and formal governance intake.

## Harness And Admin Consolidation

### Harness page responsibilities

The Harness page should become the single home for Harness-specific operations.

Required controls visible in-page:

- execution profile
- runtime binding
- routing version
- retrieval preset
- manual review policy

This should use the real editable environment controls that already exist in the repository, not a placeholder summary card.

### Admin overview direction

If the management overview page duplicates content that now has a clear home in:

- rule center
- knowledge library
- Harness
- manuscript workbenches

then that duplicate content should be removed or dramatically reduced.

Recommended direction:

- reduce admin overview to only cross-cutting signals that do not naturally belong elsewhere
- if a signal already has a domain owner, keep it in that owner's page instead

## Manuscript Workbench Family Redesign

`screening / editing / proofreading` should become a visibly unified family.

### Shared page pattern

Each of the three pages should use:

- a compact top action row
- a narrow left queue and search region
- a dominant central working region
- optional transient overlays or modals for low-frequency actions

Avoid:

- large hero areas
- permanently expanded right-side control drawers
- bespoke layout patterns that make each stage feel like a different product

### Shared layout anatomy

#### Left rail

Use for:

- quick search
- queue switching
- manuscript list
- status filtering

This region should be compact and scrollable.

#### Central canvas

Use for:

- manuscript content
- structured issue review
- evidence panels
- stage-specific action details

This region is the primary page body and should receive most of the width.

#### Low-frequency actions

Use modals, action bars, or lightweight contextual panels for:

- advanced settings
- secondary exports
- batch actions
- exception handling

The default page should not dedicate permanent width to low-frequency tools.

### No return button

The manuscript workbench pages should not add a return button inside the page body.

Navigation should rely on:

- the global left navigation
- stage-to-stage workbench flow

## Manuscript Type Auto-Recognition Design

### Problem

The current governed runtime already relies heavily on manuscript type, but the upload flow still requires manual type input.

### Approved redesign

Replace the normal manual manuscript-type selection with an AI-first classification step after upload.

### Desired flow

1. operator uploads one or more manuscripts
2. system extracts initial signals from the manuscript
3. AI predicts manuscript type with confidence
4. system resolves:
   - template family
   - rule package
   - content-module bundle
   - retrieval preset
   - runtime binding
5. operator sees the resolved package and only intervenes if a correction is needed

### Manual override rules

Manual override should exist, but only as:

- a visible correction control when confidence is low
- an explicit override action for experienced operators

It should not remain the mandatory first step for every upload.

## Batch Upload Guardrail Design

Batch upload belongs in the manuscript workbench family and must remain safe in early release.

### Required rules

- support batch upload in the UI
- cap each batch at `10` manuscripts by default
- reject larger batches on the backend even if the UI is bypassed
- expose a clear validation message when the limit is exceeded
- make the limit configurable through future settings rather than hardcoding it into page copy

### Operator posture

The product should communicate:

- batch processing is supported
- capacity is intentionally limited in the current phase
- the restriction protects runtime stability and review quality

## Technical Alignment With Current Repository

The implementation should align with the existing codebase instead of creating parallel shells.

### Shared shell and routing

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/app/workbench-navigation.ts`
- `apps/web/src/features/auth/workbench.ts`

### Knowledge library

- `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`
- `apps/web/src/features/knowledge-library/knowledge-library-ledger-page.tsx`

### Rule center

- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- `apps/web/src/features/template-governance/template-governance-overview-page.tsx`
- `apps/web/src/features/template-governance/template-governance-template-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-extraction-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- `apps/web/src/features/template-governance/template-governance-navigation.ts`

### Harness

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- `apps/web/src/features/admin-governance/harness-environment-editor.tsx`

### Manuscript workbenches

- `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-batch-drawer.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench-controls.tsx`
- `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`

### Backend manuscript-type and governed-resolution flow

- `apps/api/src/modules/manuscripts/manuscript-lifecycle-service.ts`
- `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- `apps/api/src/modules/shared/module-run-support.ts`
- `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`

## Acceptance Criteria

The redesign is successful for implementation planning if all of the following remain true:

1. the global left navigation remains in place across the system
2. page-internal hero and intro sections are removed from working pages
3. knowledge library keeps a main page and a dedicated ledger subpage, with explicit round-trip navigation only for that family
4. rule center lands on a compact overview page with entrances to exactly three working subpages
5. `general modules` and `medical specialized modules` are handled inside the content-module ledger flow, not as separate rule-center landing pages
6. Harness becomes the single in-product home for environment and experiment controls
7. management overview no longer duplicates domain-owned content
8. `screening / editing / proofreading` share one layout family with a narrow queue rail and a dominant central canvas
9. normal manuscript upload no longer depends on mandatory manual manuscript-type selection
10. AI type recognition can drive automatic matching of governed template and runtime assets
11. batch upload exists and enforces a default per-batch cap of `10` on both frontend and backend

## Superseded Or Adjusted Prior Decisions

This document updates and partially supersedes earlier assumptions in:

- `docs/superpowers/specs/2026-04-08-current-workbench-ui-refresh-design.md`
- `docs/superpowers/specs/2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md`
- `docs/superpowers/specs/2026-04-13-rule-center-ledger-governance-redesign-design.md`

Specific corrections:

- knowledge-library ledger should keep the global shell
- rule center should use three subpages rather than separate general and medical top-level module pages
- page-level introductions should be removed broadly across workbench pages
- Harness ownership should be centralized in Harness rather than duplicated in management overview pages

## Recommended Next Step

After this integrated design is approved in writing, the next step should be a concrete implementation plan covering:

1. shared shell cleanup and page-header reduction
2. knowledge-library main/subpage navigation alignment
3. rule-center overview and three-ledger restructuring
4. Harness consolidation and live control exposure
5. manuscript workbench layout unification
6. AI manuscript-type recognition and governed auto-binding
7. batch-upload guardrail enforcement
