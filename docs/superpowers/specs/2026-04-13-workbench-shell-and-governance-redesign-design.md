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
- the rule center should evolve into `rule center 2.0` with one lightweight home page and five working subpages:
  - `large template ledger`
  - `journal template ledger`
  - `general package ledger`
  - `medical package ledger`
  - `original-edited extraction`
- large templates should manage manuscript-family governance
- journal templates should manage journal-specific or scenario-specific specialization
- general and medical packages should become first-class governed assets with table-first maintenance
- rule-center authoring and maintenance should follow the same simple, table-first, AI-assisted interaction model as the knowledge library

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

This section supersedes both:

- the earlier split that used separate general and medical module pages
- the later simplified three-page ledger proposal

The approved direction is now `rule center 2.0`: a rule-governance hub that is simple to operate like the knowledge library, but structured deeply enough to manage large templates, journal templates, general packages, medical packages, extraction, AI semantics, and downstream Harness validation.

### Main page

The main rule-center page should be lightweight and should only provide:

- small overview metrics
- entry points to the five working subpages
- optionally a compact recent activity list
- recent pending AI confirmations
- recent package changes waiting for Harness verification

It should not provide:

- full editing forms
- candidate confirmation surfaces
- large management introductions
- duplicate buttons that already exist in the left navigation

### Rule center 2.0 information architecture

The approved page family is:

- `rule-center home`
- `large template ledger`
- `journal template ledger`
- `general package ledger`
- `medical package ledger`
- `original-edited extraction`

All five working pages should share one interaction pattern:

- compact toolbar above the table
- dense ledger as the primary surface
- same-page temporary form for add and edit
- dedicated search results surface
- built-in AI semantic layer before final save or publish

### 1. `large template ledger`

Purpose:

- manage manuscript-family-level template governance
- represent the `big template` concept the user requested
- map naturally onto the existing `template family` backend model
- define which package families and execution scopes a manuscript family should inherit
- serve as the top container for journal templates

Each row should answer:

- what manuscript family this template governs
- which execution modules it applies to
- which general packages it includes
- which medical packages it includes
- whether it is draft, active, archived, or pending verification

### 2. `journal template ledger`

Purpose:

- manage journal-specific or scenario-specific specialization under a large template
- represent the `small template` concept the user requested
- map onto the existing `journal template profile` backend model
- keep journal-level constraints easy to see and easy to modify

Each row should answer:

- which large template it belongs to
- which journal or scenario it targets
- what additional requirements override or refine the parent family
- which packages it reuses or narrows
- whether it is active for selection in manuscript flows

### 3. `general package ledger`

Purpose:

- manage reusable cross-manuscript governed packages
- centralize what the user currently thinks of as `general package`
- absorb package maintenance that is currently scattered or hidden in admin surfaces
- keep package maintenance table-first and simple

Typical package families here include:

- title and heading structure
- abstract and keyword norms
- punctuation and full-width / half-width conventions
- reference formatting
- figure and table caption rules
- common wording normalization

### 4. `medical package ledger`

Purpose:

- manage reusable medical-specialized governed packages
- centralize what the user currently thinks of as `medical specialized package`
- provide deeper introspection and configuration than the current surfaces allow

Typical package families here include:

- statistical description parsing
- statistical inference checks
- diagnostic-study metric checks
- survival-analysis wording and number checks
- meta-analysis structure and indicator checks
- ethics and registration requirements

### 5. `original-edited extraction`

Purpose:

- upload original and edited manuscripts
- create extraction tasks
- view extraction output
- run AI semantic understanding
- confirm candidate intake
- route approved candidates into:
  - large template drafts
  - journal template drafts
  - general package drafts
  - medical package drafts

### Large template and journal template hierarchy

The approved hierarchy is:

`large template -> journal template -> governed packages -> manuscript execution`

Expected mapping to current backend reality:

- `large template` corresponds to `template family`
- `journal template` corresponds to `journal template profile`
- package sets attach beneath those layers and are later activated through governed runtime and Harness controls

This means the product direction is compatible with the current repository model and should not require a total backend rewrite before the UI improves.

### Package-ledger behavior

The package ledgers should not feel like developer consoles.

Recommended behavior:

- one shared page shell
- one shared toolbar
- one shared ledger pattern
- a detail panel or temporary form that stays simple to edit
- AI semantic assistance before save
- clear provenance and downstream usage visibility

### Rule-center forms must match knowledge-library simplicity

The user explicitly wants the rule center to feel as easy to use as the knowledge library.

That means:

- no expert-only permanent side drawers
- no giant all-in-one authoring console as the main interaction mode
- no making operators memorize hidden relationships before they can save a record

Required form behavior:

- add and edit reuse the same form surface
- cancel always closes the form cleanly
- repeatable fields must support both add and delete
- AI semantic generation happens inside the form
- the operator can modify the AI semantic output before save
- records should not be committed until the operator accepts the semantic layer

### AI semantic layer inside rule-center authoring

AI semantic assistance should not be limited to extraction candidates.

It should also support:

- large template authoring
- journal template authoring
- general package authoring
- medical package authoring

Suggested AI semantic blocks:

- what this asset governs
- where it applies
- where it should not apply
- risk boundaries
- suggested parent or child relationships
- recommended Harness verification scope

The operator flow should remain:

1. enter or paste the human-authored content
2. click `generate AI semantics`
3. review and edit the AI interpretation
4. confirm the semantic layer
5. save the governed draft

### Knowledge review and quality optimization linkage

The user wants the knowledge-review and quality-optimization lines to call each other more often. That is the correct direction.

Rule center 2.0 should add explicit bidirectional linkage:

- approved knowledge can generate:
  - package draft candidates
  - template recommendations
  - extraction enrichment hints
- recurring quality findings can generate:
  - knowledge candidates
  - package-improvement candidates
  - review-backlog items

This should create a visible governance chain:

`knowledge review -> package draft -> template binding -> Harness validation -> runtime use -> quality finding -> knowledge feedback`

### Package provenance and inspectability

Operators should be able to inspect and tune governed packages, not just list them.

Each package detail surface should expose:

- basic metadata
- applicable manuscript families
- applicable journal templates
- execution scope
- source knowledge references
- source extraction task or candidate
- downstream template usage
- recent quality hits
- latest Harness comparison state

### Configurable versus engine-owned package logic

The user asked whether general and medical packages can expose parsing-layer details for adjustment. The answer should be yes, but with clear boundaries.

#### Operator-configurable package layer

These should be editable through the rule center:

- terminology dictionaries
- alias maps
- unit maps
- threshold ranges
- pattern sets
- section applicability
- exclusion conditions
- review escalation thresholds
- examples and counterexamples
- AI semantic summaries
- risk labels

#### Engine-owned parser layer

These should remain repo-owned and tested in code:

- low-level numeric parsing
- table-structure traversal
- formula extraction
- cross-cell and cross-section reconciliation logic
- complex statistical expression parsing core

The product rule is:

- operators can tune governed parameters
- operators should not be editing raw parser code in the browser

### Medical package deepening

The medical package ledger should support stronger statistical and medical analysis packages.

Recommended first families:

- `statistical description package`
- `statistical inference package`
- `diagnostic metrics package`
- `survival analysis package`
- `meta-analysis package`
- `ethics and registration package`

For example, a statistical package should be able to govern:

- `n (%)`
- `mean ± SD`
- `median (IQR)`
- `P value`
- `95% CI`
- `OR / RR / HR`
- sensitivity / specificity / AUC

The operator should be able to view and modify:

- accepted notation variants
- preferred normalization output
- suspicious-value thresholds
- unit expectations
- manual-review triggers
- known false-positive guards

### Package detail tabs

To make package behavior explainable and editable, each package should expose a detail page or form tabs such as:

- `overview`
- `semantic layer`
- `parse scope`
- `dictionary and units`
- `thresholds and boundaries`
- `examples and false positives`
- `knowledge links`
- `Harness evidence`
- `version history`

### Extraction candidate flow

The extraction page remains the AI confirmation boundary.

Approved flow:

`upload original + edited manuscript -> extract candidates -> AI semantic understanding -> human edit and confirm -> intake into template or content-module draft`

The AI semantic layer belongs between extraction and formal governance intake.

### Harness relationship

Rule center should become the primary authoring and maintenance surface for packages and templates.

Harness should remain the activation, comparison, and rollback surface.

That means:

- create and edit in rule center
- validate and compare in Harness
- activate and roll back through governed environment controls

This keeps authoring simple while preserving operational safety.

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
4. rule center lands on a compact home page with entrances to exactly five working subpages
5. rule center supports `large templates`, `journal templates`, `general packages`, `medical packages`, and `original-edited extraction` as first-class governed surfaces
6. Harness becomes the single in-product home for environment and experiment controls
7. management overview no longer duplicates domain-owned content
8. `screening / editing / proofreading` share one layout family with a narrow queue rail and a dominant central canvas
9. normal manuscript upload no longer depends on mandatory manual manuscript-type selection
10. AI type recognition can drive automatic matching of governed template and runtime assets
11. batch upload exists and enforces a default per-batch cap of `10` on both frontend and backend
12. rule center authoring uses the same simple table-plus-form-plus-AI-semantic interaction model as the knowledge library
13. knowledge review and quality optimization can exchange governed candidates and provenance links
14. medical packages expose configurable parsing and threshold layers without turning parser code into freeform browser-authored logic

## Superseded Or Adjusted Prior Decisions

This document updates and partially supersedes earlier assumptions in:

- `docs/superpowers/specs/2026-04-08-current-workbench-ui-refresh-design.md`
- `docs/superpowers/specs/2026-04-13-knowledge-library-multidimensional-ledger-redesign-design.md`
- `docs/superpowers/specs/2026-04-13-rule-center-ledger-governance-redesign-design.md`

Specific corrections:

- knowledge-library ledger should keep the global shell
- rule center should use a home page plus five working subpages rather than the earlier three-page or separate-module variants
- page-level introductions should be removed broadly across workbench pages
- Harness ownership should be centralized in Harness rather than duplicated in management overview pages
- rule center should absorb package maintenance that is currently too hidden inside admin-governance surfaces
- rule-center forms should gain the same AI semantic confirmation posture already approved for the knowledge library

## Recommended Next Step

After this integrated design is approved in writing, the next step should be a concrete implementation plan covering:

1. shared shell cleanup and page-header reduction
2. knowledge-library main/subpage navigation alignment
3. rule-center home page and five-subpage restructuring
4. rule-center package authoring simplification and AI semantic forms
5. knowledge-review and quality-optimization linkage
6. Harness consolidation and live control exposure
7. manuscript workbench layout unification
8. AI manuscript-type recognition and governed auto-binding
9. batch-upload guardrail enforcement
