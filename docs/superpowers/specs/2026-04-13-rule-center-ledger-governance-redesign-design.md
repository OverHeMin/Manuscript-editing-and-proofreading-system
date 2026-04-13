# Rule Center Ledger Governance Redesign Design

**Date**

2026-04-13

**Status**

Draft for written review

**Goal**

Redesign the current `template-governance` workbench into a ledger-first rule center that matches the newly validated knowledge-library interaction model:

- a lightweight overview homepage
- four dedicated subpages with table-first interaction
- a two-step extraction flow for `original draft + edited draft`
- controlled AI semantic confirmation before any module or template enters governance

The redesign must preserve the current governed lifecycle and existing backend capabilities wherever possible, while reorganizing the product around higher-density tables, simpler forms, and clearer responsibilities.

## Final Design Decisions

The validated decisions for this design are:

- the current `template-governance` workbench should remain the top-level shell
- the new experience should be split into:
  - `overview`
  - `template ledger`
  - `extraction ledger`
  - `general module ledger`
  - `medical specialized module ledger`
- the overview page should show only summary data and entry points, not editing surfaces
- the first release should use a `candidate hub` model:
  - extract candidates first
  - show AI semantic understanding second
  - require human confirmation third
  - then route into governed ledgers
- templates are containers
- modules are reusable building blocks consumed by templates
- `general modules` and `medical specialized modules` must be managed on separate pages
- AI semantic functionality is required, but only in bounded suggestion-first form
- the main operator interaction model should be:
  - top toolbar
  - sheet-like table as the page body
  - in-page modal/form layer for add/edit flows
- right-side long-lived drawers are explicitly not wanted

## Context

The current `template-governance` page has grown into a single large workbench that mixes together:

- template family authoring
- journal template profiles
- module template maintenance
- rule set authoring
- prompt template maintenance
- knowledge binding
- example-driven rule package extraction and compile workflow

This creates three product problems:

1. It does not match the validated table-first operating style the user wants.
2. It hides the most important workflow boundaries inside one oversized page.
3. It makes the extraction workflow feel like a technical authoring console instead of a governed intake pipeline.

There is also a structural opportunity in the current codebase:

- extraction already exists via:
  - `createRulePackageExampleSourceSession`
  - `loadRulePackageWorkspace`
  - `previewRulePackageDraft`
  - `previewRulePackageCompile`
  - `compileRulePackagesToDraft`
- semantic candidate editing already exists in bounded form via `semantic_draft`
- template, module, rule set, and knowledge governance endpoints already exist

So this redesign is primarily a product architecture and information architecture change, not a full backend reset.

## User-Validated Product Preferences

The following product choices were explicitly validated during brainstorming:

- the rule center should split into separate subpages
- the overview page should retain only summary metrics and subpage entry points
- extraction should use a two-step confirmation flow
- templates should be the main container layer
- modules should be reusable assets assembled into templates
- general modules and medical specialized modules should be separated into two different ledgers
- the table itself should be the primary page body
- tool buttons should live above the table
- add/edit should open a same-page form layer rather than a persistent drawer
- search should lead to a dedicated results state rather than only inline filtering
- AI semantic review is mandatory
- AI review must happen after extraction and before governed intake
- text and DOCX are the preferred structured inputs; images are supporting evidence only

## Terminology Clarification

This redesign introduces a crucial terminology split so implementation does not collide with current code meanings.

### Existing Execution Modules

The current codebase already uses `TemplateModule` for runtime execution stages:

- `screening`
- `editing`
- `proofreading`

These remain valid and should not be renamed in the first implementation pass.

### New Governed Content Modules

This redesign uses `module` in a new product sense:

- reusable governed content assets
- stored and reviewed independently
- later assembled into templates

These should be modeled as `governed content modules` in design and implementation discussions.

Recommended product terminology:

- `execution module`: current runtime stage, one of `screening | editing | proofreading`
- `content module`: new reusable governed asset
- `general content module`: reusable across manuscript families and journals
- `medical specialized content module`: medically specific reusable asset
- `template`: a container that references one or more content modules and targets one or more execution modules

This separation is mandatory. Otherwise the redesign will blur reusable content assets with runtime stage routing.

## Problem Statement

The current rule center misses the target in five ways:

1. It is not ledger-first.
   Operators cannot treat templates, modules, and extraction tasks as high-density tables.

2. It collapses multiple independent jobs into one page.
   Browsing, extraction, semantic confirmation, template composition, and module maintenance all compete in one workbench.

3. It does not place AI semantic confirmation at the correct risk boundary.
   The most valuable AI step should sit between extraction and intake, not after formal publication and not hidden inside an expert-only console.

4. It does not reflect the product hierarchy the user wants.
   The user wants `module -> template -> manuscript application`, not another undifferentiated governance surface.

5. It does not create a clear home for extraction-derived artifacts.
   The current rule package authoring shell is powerful, but it still behaves like a rule engineering workbench rather than a governed candidate hub.

## Scope

### In Scope

- add a dedicated overview subpage for rule center entry and metrics
- add four dedicated ledger subpages:
  - `template ledger`
  - `extraction ledger`
  - `general module ledger`
  - `medical specialized module ledger`
- keep table-first page layouts consistent across all subpages
- add in-page form/modal flows for add/edit/create actions
- redesign extraction into a task table plus candidate confirmation workflow
- introduce AI semantic confirmation before intake into templates or modules
- support three candidate destinations:
  - `general module`
  - `medical specialized module`
  - `template skeleton`
- support template composition from both module ledgers
- support template application initiation to manuscripts as a governed binding action
- preserve traceability from extraction task to candidate to module/template draft
- preserve governed draft and publish lifecycles

### Out of Scope

- replacing all backend governance object models in one pass
- full spreadsheet inline editing for every table cell
- bulk AI cleanup across many extraction candidates
- OCR-first or screenshot-first extraction as a primary path
- direct AI publication of templates or modules
- direct execution against manuscript text from the template ledger
- moving final review approval into the new ledgers

## Route And Entry Strategy

This redesign should remain under the existing `template-governance` workbench shell.

### Workbench Strategy

- keep `workbenchId = template-governance`
- add a route-level discriminator, recommended as:
  - `templateGovernanceView=classic | overview | template-ledger | extraction-ledger | general-module-ledger | medical-module-ledger`

Recommended hashes:

- `#template-governance`
- `#template-governance?templateGovernanceView=overview`
- `#template-governance?templateGovernanceView=template-ledger`
- `#template-governance?templateGovernanceView=extraction-ledger`
- `#template-governance?templateGovernanceView=general-module-ledger`
- `#template-governance?templateGovernanceView=medical-module-ledger`

### Rollout Strategy

First release should preserve the existing workbench as `classic` and add the new ledger surfaces beside it.

This mirrors the already-validated knowledge library rollout strategy:

- safe introduction of a dedicated new subpage
- no forced cutover on day one
- easy operator comparison between old and new surfaces

If the ledger redesign performs well, later rollout can promote `overview` as the default landing state.

## Target Information Architecture

The redesigned rule center has five page modes.

### 1. Overview

Responsibilities:

- show aggregate counts and health indicators
- act as the entry hub into the four working ledgers
- surface only a small set of high-signal metrics

Recommended metrics:

- total templates
- total general modules
- total medical specialized modules
- pending extraction candidates
- published templates
- recent successful extraction runs

The overview page must not contain:

- long authoring forms
- semantic editing panels
- three-column workbench layouts
- hidden side drawers

### 2. Template Ledger

Responsibilities:

- manage templates as governed containers
- compose templates from selected content modules
- manage template draft/version/publish state
- initiate template-to-manuscript application

### 3. Extraction Ledger

Responsibilities:

- manage extraction tasks
- accept `original + edited` intake pairs
- show extraction candidates
- host AI semantic confirmation
- route confirmed candidates into governed destinations

### 4. General Module Ledger

Responsibilities:

- manage reusable cross-domain content modules
- preserve source traceability and usage references
- support insertion into templates

### 5. Medical Specialized Module Ledger

Responsibilities:

- manage reusable medical-specific content modules
- preserve medical evidence/risk framing
- support insertion into templates

## Shared Ledger Page Pattern

All four working subpages should use one consistent interaction shell:

- top toolbar
- table as the page body
- same-page modal/form layer for create/edit operations

The redesign intentionally rejects:

- persistent right drawers
- long-lived split panes as the default interaction model
- bespoke controls on every page

### Shared Toolbar Principles

Each ledger toolbar should contain only the page's highest-frequency actions.

Examples:

- search
- add
- delete
- import or extract
- add to template
- apply template

Low-frequency expert actions should move into row actions, overflow menus, or legacy `classic` mode.

### Shared Search Principles

Search should not be implemented as only a passive front-end table filter.

Recommended behavior:

- search opens a dedicated results state inside the current ledger
- the results state is still table-first
- the active query remains visible and editable
- operators can continue row actions from the results state

This keeps search aligned with the user's preference that a lookup should feel like a distinct working context, not just a hidden row subset.

### Shared Table Principles

Each ledger table should support:

- horizontal scrolling
- fixed first column where useful
- resizable columns
- compact and standard row height modes
- row selection
- empty, loading, and error states that do not collapse the layout

The first version does not need full spreadsheet editing. The table is the dominant browsing surface, not a formula engine.

### Shared Form Principles

Each create/edit flow should open an in-page form layer.

Requirements:

- cancel closes the form cleanly
- repeatable fields must support both add and delete
- drag-and-drop upload is supported when files are part of the flow
- forms should minimize required fields while preserving governance quality

## Overview Page Design

The overview page is intentionally simple.

### Layout

- top metrics strip
- entry card/button row for the four subpages
- optional recent activity list below the fold

### Allowed Interactions

- open one of the four ledgers
- inspect summary counts
- optionally jump to the newest failed extraction task or newest unpublished template

### Explicit Non-Goals

- no inline editing
- no semantic editing
- no extraction uploads
- no module/template authoring forms

## Extraction Ledger Design

The extraction ledger is the most important new page. It should become the system's `candidate hub`.

### Two Primary States

The page has two major states:

1. `task list state`
2. `candidate confirmation state`

### Task List State

Responsibilities:

- display all extraction tasks as a table
- launch new extraction intake
- reopen an existing task
- retry failed tasks

Recommended columns:

- task name
- original file
- edited file
- manuscript type
- extraction status
- candidate count
- pending confirmation count
- updated at

Toolbar actions:

- `Search Tasks`
- `New Extraction Task`
- `Delete Task`

### New Extraction Task Form

The form should be short and structured:

- task name
- manuscript type
- original draft upload
- edited draft upload
- optional journal/template hint
- optional notes

Input priority:

- primary: `DOCX / Word`
- secondary: pasted structured text
- supporting only: screenshots or images

### Candidate Confirmation State

Opening a task switches the page into a candidate table for that task.

Recommended columns:

- candidate name
- candidate kind
- suggested destination
- AI one-line understanding
- confidence marker
- confirmation status
- evidence summary
- action

Toolbar actions:

- `Search Candidates`
- `Back To Tasks`
- `Delete Candidate`

### Candidate Confirmation Form

This is the core AI review surface. It should open in the same page as a modal/form layer.

Required fields and controls:

- candidate name
- candidate type
- AI one-line understanding
- applicability scope
- before/after evidence
- non-applicable boundaries
- human review conditions
- suggested destination
- `Confirm Intake`
- `Hold`
- `Reject`
- `Delete Candidate`

AI semantic editing happens here and nowhere else in V1.

### AI Semantic Editing Rules

The form should allow two modes per field:

- direct human edit
- `Rewrite With AI` for that one field block

Good AI-managed fields:

- one-line understanding
- applicability
- non-applicable boundaries
- human review conditions
- explanation copy

Human-owned or system-owned fields in V1:

- candidate type
- source evidence linkage
- task identity
- original/edited file pairing
- final destination choice

### Candidate Destinations

After confirmation, a candidate may enter:

- `general module draft`
- `medical specialized module draft`
- `template skeleton draft`

Recommended default behavior:

- most extraction outputs should become module drafts
- only candidates that clearly represent a whole composed structure should become template skeleton drafts

## General Module Ledger Design

The general module ledger manages reusable cross-domain content modules.

### What Belongs Here

Examples:

- heading hierarchy normalization
- abstract and keyword structure
- reference formatting expectations
- numeric/statistical phrasing norms
- three-line table general conventions
- bilingual punctuation or wording normalization

### Toolbar Actions

- `Search Modules`
- `New Module`
- `Delete Module`
- `Add To Template`

### Recommended Columns

- module name
- module category
- applicable manuscript types
- applicable sections
- source
- template usage count
- status
- updated at

### Module Form

The module form should optimize for reusable content rather than technical authoring payloads.

Recommended fields:

- module name
- module category
- applicable manuscript types
- applicable sections
- rule or intent summary
- execution guidance or checklist
- before/after examples
- source notes

If the module is intake-created from extraction, the form should be prefilled from the confirmed candidate rather than recreated from scratch.

## Medical Specialized Module Ledger Design

The medical specialized module ledger is structurally similar to the general module ledger, but adds medical-specific governance framing.

### What Belongs Here

Examples:

- case report structure expectations
- clinical study statistical expression rules
- ethics and informed consent requirements
- trial registration language
- diagnostic-study indicator framing
- disease/drug/test naming normalization
- meta-analysis and evidence-reporting structures

### Toolbar Actions

- `Search Medical Modules`
- `New Medical Module`
- `Delete Module`
- `Add To Template`

### Recommended Columns

- module name
- medical scenario
- manuscript type
- evidence level
- risk level
- source
- template usage count
- status

### Module Form

Recommended fields:

- module name
- medical scenario
- applicable manuscript types
- evidence level
- risk level
- rule or intent summary
- human review conditions
- non-applicable boundaries
- before/after examples
- source notes

This ledger should preserve the fact that some medical modules carry materially different evidence and review burden than general modules.

## Template Ledger Design

Templates are governed containers that compose content modules and later bind into manuscript execution flows.

### What A Template Is

A template is not a full freeform rule editor in this redesign.

A template should primarily hold:

- base metadata
- applicable manuscript type and journal/scope
- selected general modules
- selected medical specialized modules
- applicable execution modules
- version and lifecycle state

### Toolbar Actions

- `Search Templates`
- `New Template`
- `Duplicate Template`
- `Delete Template`
- `Apply To Manuscript`

### Recommended Columns

- template name
- manuscript type
- status
- version
- general module count
- medical module count
- journal or scenario scope
- last applied at

### Template Form

The form should be one modal with four clear sections:

1. basic information
2. selected general modules
3. selected medical specialized modules
4. application scope and notes

Module selection should use either:

- a pick table with checkboxes
- or a selected list with add/remove controls

The form should not force operators to author module internals from inside the template page.

### Template Creation Paths

The first release should support three entry paths:

- create from blank
- duplicate existing template
- create skeleton from extraction-confirmed candidates

These three paths cover the user's request for more template reuse without collapsing extraction and template authoring into one screen.

## Template Application Flow

Applying a template to a manuscript should be treated as a governed binding action, not direct manuscript mutation from the template page.

### Template Application Form

Recommended fields:

- target manuscript
- execution module scope
- whether to replace existing binding
- notes

### Result

Submitting the form should create a template binding/application record.

Execution still happens in the manuscript workbench or governed runtime layer, not inside the template ledger.

This preserves separation of concerns:

- template ledger manages composition and governance
- manuscript workbench manages execution against manuscript assets

## Cross-Page Navigation And Traceability

The redesign should make the business chain explicit:

`extraction task -> confirmed candidate -> module/template draft -> template composition -> manuscript application`

Required navigation links:

- extraction candidate can open the resulting module draft
- extraction candidate can open the resulting template skeleton
- module row can show which extraction task created it
- module row can show which templates use it
- template row can show which module rows it references

This traceability is a major governance benefit and should not be treated as optional polish.

## AI Semantic Layer Design

AI is required, but it must remain a bounded accelerator.

### AI Responsibilities In V1

AI may:

- generate a semantic understanding draft after extraction
- help rewrite one candidate field block at a time
- suggest the most likely intake destination

AI may not:

- publish templates or modules automatically
- overwrite published assets
- bypass human confirmation
- execute directly on manuscript content from these ledgers
- treat screenshots as the primary extraction substrate

### AI Position In The Workflow

AI must sit between extraction and governance intake:

`extract -> AI semantic draft -> human edit/confirm -> governed destination`

This is the correct risk boundary because it allows:

- meaningful acceleration
- visible evidence review
- clean intake control
- no hidden publication side effects

## Recommended Candidate State Model

### Extraction Task Status

- `pending`
- `extracting`
- `awaiting_confirmation`
- `partially_confirmed`
- `completed`
- `failed`

### Candidate Status

- `extracted`
- `ai_semantic_ready`
- `editing`
- `confirmed_pending_intake`
- `intaken_to_general_module`
- `intaken_to_medical_module`
- `intaken_to_template_skeleton`
- `rejected`
- `retry_required`

### Module And Template Status

- `draft`
- `pending_review`
- `published`
- `archived`

The key governance principle is:

- candidate confirmation is not publication
- module/template intake is not final release

## Data Contract Recommendations

The first implementation pass should avoid replacing every backend type. Instead it should add a small set of product-facing envelopes above existing contracts.

### 1. Extraction Task View Model

Recommended shape:

- task id
- task name
- original asset summary
- edited asset summary
- manuscript type
- optional journal hint
- status
- candidate counts
- timestamps

### 2. Candidate Intake Envelope

Current `RulePackageCandidateViewModel` is a strong base, but the product layer should enrich it with:

- display candidate type
- suggested destination
- confirmation status
- source task id
- resulting module/template draft id when created

### 3. Governed Content Module View Model

Recommended shared core fields for both ledgers:

- module id
- module class: `general | medical_specialized`
- name
- category or scenario
- manuscript type scope
- execution module scope
- summary
- examples
- evidence or risk framing where applicable
- source linkage
- usage counts
- lifecycle status

### 4. Template Composition View Model

Recommended core fields:

- template id
- name
- manuscript type
- optional journal or scenario scope
- selected general module ids
- selected medical module ids
- execution module scope
- version
- status

## Error Handling

The first release must handle failure states explicitly.

### Extraction Errors

- invalid or missing file pair
- unsupported file format
- extraction pipeline failure
- retriable task restart

### AI Errors

- AI semantic generation failure must not block manual editing
- AI low-confidence output should be surfaced as a caution state
- field-level AI rewrite failure should not destroy existing edits

### Intake Conflicts

Examples:

- same-name module already exists
- highly similar template draft already exists
- referenced module has been archived before intake completes

Recommended conflict actions:

- create new draft
- merge into existing draft
- create as sibling copy

### Application Errors

- failed template binding should not mutate the manuscript
- template and module assets must remain unchanged on binding failure

## Testing Strategy

The redesign should be validated with a mix of unit, controller, and browser tests.

### Unit And State Tests

- route parsing for `templateGovernanceView`
- per-ledger toolbar state
- modal/form open-close behavior
- candidate state transitions
- destination routing logic

### Controller Tests

- overview metrics loading
- extraction task listing and task reopen
- candidate confirmation and intake routing
- module/template creation from confirmed candidates
- template composition persistence

### Browser Tests

Minimum end-to-end coverage should prove:

1. overview opens and routes to all four ledgers
2. extraction task can be created from `original + edited` DOCX
3. extraction candidates render in a table
4. one candidate can be semantically edited and confirmed
5. the candidate can intake into a chosen module ledger
6. a template can be composed from selected modules
7. template application can create a manuscript binding record

## Rollout Strategy

Recommended rollout is phased.

### Phase 1

- add the new view discriminator
- introduce overview page
- keep `classic` intact

### Phase 2

- deliver extraction ledger first
- because it is the highest-value workflow shift and best reuse target for existing extraction code

### Phase 3

- deliver both module ledgers

### Phase 4

- deliver template ledger composition and manuscript application initiation

### Phase 5

- consider promoting the ledger overview to the default rule-center landing page

## Acceptance Criteria

The redesign is successful for first release if all of the following are true:

1. operators can enter `template-governance` and land on a simple overview with summary metrics and entry points
2. operators can create an extraction task from original and edited documents
3. extraction output appears as candidates in a dedicated confirmation table
4. operators can review and edit AI semantic understanding for a single candidate before intake
5. confirmed candidates can intake into either:
   - general module drafts
   - medical specialized module drafts
   - template skeleton drafts
6. operators can compose a template from selected general and medical modules
7. operators can initiate a governed template application to a manuscript
8. every resulting asset keeps traceability back to the extraction task or manual creation path

## Open Implementation Notes

The following should be treated as implementation design constraints:

- reuse the existing extraction backend rather than replacing it
- separate `content module` from existing runtime `TemplateModule`
- keep AI suggestion-only in first release
- preserve the current governed publish flow
- maintain a safe fallback path through `classic` mode during rollout

## Recommended Next Step

After this design is approved in writing, the next step should be to create an implementation plan that breaks the work into:

1. routing and shell restructuring
2. extraction ledger and candidate hub
3. module ledger data models and views
4. template composition ledger
5. browser QA and rollout hardening
