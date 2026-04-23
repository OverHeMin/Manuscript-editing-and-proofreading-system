# 2026-04-23 Harness Single-Page Control Design

**Date**

2026-04-23

**Status**

Approved in conversation as the implementation baseline

**Goal**

Rebuild `Harness` into a true single-page control surface that:

- stays fully inside `Harness` ownership
- prioritizes global status before action
- avoids board-like card sprawl
- exposes only real, usable controls
- clearly separates editable controls from read-only status
- localizes user-facing copy into Chinese where safe

In one sentence:

`Harness` should become one aligned single-page governance console instead of a partial workbench plus hidden side controls.

## User-Approved Baseline

The approved baseline for implementation is:

`只做 Harness 本身；做完整治理台；第一页先看全局状态；采用一页到底的结构；页面区块之间允许左右和上下可调分隔条；能汉化的都汉化。`

Two additional decisions are locked:

- `滑块` means draggable splitters between regions, not chart sliders or cosmetic controls
- the page must not pretend that a read-only metric is a mutable setting

## Why This Change Is Needed

The current repository already has substantial real Harness capability, but it is misorganized.

### What already works today

The current owned Harness page already contains:

- run overview
- comparison posture
- release-gate summary
- run history
- selected run details
- real environment editing
- candidate preview
- candidate run launch
- activation and rollback

These are real governed actions, not mock controls.

### What exists but is not surfaced inside Harness

The repository also already contains Harness-adjacent governance capabilities that are implemented but not actually integrated into the owned Harness page:

- routing version draft / submit / approve / activate / rollback
- runtime binding creation and activation
- quality package publishing and binding context
- adapter health aggregation
- recent execution triage and execution evidence inspection

As a result, the user sees an incomplete control surface:

- some real controls are visible
- other real controls are hidden in a different governance surface
- some visible signals look like part of a total control plane but are only read-only summaries

That creates the exact “fake control center” problem this redesign must remove.

## Scope

### In Scope

- redesign the owned Harness page into one vertically unified single-page control surface
- keep all major Harness work in one page instead of scattered sibling-feeling pages
- keep global status first
- keep real mutable Harness controls in-page
- integrate missing implemented Harness governance capabilities where they belong
- clearly mark read-only Harness status as read-only
- preserve dataset work as part of Harness ownership
- localize safe user-facing Harness copy into Chinese
- support draggable left/right and top/bottom splitters for layout adjustment

### Out Of Scope

- redesigning non-Harness products such as rule center, knowledge library, or manuscript workbenches
- turning Harness into the global AI platform admin console
- moving foundational AI provider / model registry ownership into Harness
- changing backend contracts unless a small adaptation is strictly required for this page integration
- renaming route ids, query params, API field names, enum values, or stored programmatic identifiers just for localization

## Product Decisions

The following decisions are locked for implementation.

### 1. Harness becomes one true single page

`Harness` should no longer feel like:

- one page for history
- one route for datasets
- one hidden side rail for real control
- one separate governance page for missing pieces

Implementation may still use internal sections, but the operator mental model must remain:

`我还在 Harness 里。`

### 2. Status comes before action

The page should open with a global status region that answers:

- what environment is active now
- what candidate differences exist
- what risks or regressions need attention
- what health signals matter right now
- what the most recent validation outcome says

Only after that should the operator move into editing, validation, activation, rollback, or deeper governance work.

### 3. The page must not look like a board

The redesign must avoid a board-like or dashboard-tile posture.

This means:

- no card wall as the primary interaction model
- no equal-weight multi-column analytics homepage
- no “scan a board, then leave to do real work elsewhere” pattern

Instead, use one aligned working page with bounded regions and clear reading order.

### 4. Real control versus read-only status must be explicit

Every visible item must belong to one of three states:

- editable and submittable in Harness
- read-only status in Harness
- related but owned elsewhere

No item should be left ambiguous.

### 5. Chinese-first user copy

User-facing labels, headings, helper text, buttons, and status wording should be localized to Chinese where safe.

Do not localize:

- route ids
- query params
- API payload keys
- stored enum values
- internal ids used for programmatic wiring

## Capability Classification

### A. Editable in Harness

These must be visible as real controls that submit inside the Harness page:

- scope selection: module, manuscript type, template family
- execution profile
- runtime binding
- routing version
- retrieval preset
- manual review policy
- candidate environment preview
- candidate-bound verification launch
- candidate environment activation
- scope rollback
- runtime binding governance
- routing version governance
- quality package binding governance
- dataset export and dataset-version operations
- run-history filtering and run-detail inspection

### B. Read-only in Harness

These must remain visible but explicitly read-only:

- adapter health
- latest judge calibration outcome
- release-gate summary
- current active environment summary
- candidate-versus-active diff summary
- recent failure and anomaly summaries
- historical evidence-pack status
- historical recommendation outcomes
- run comparison posture summaries

### C. Related to Harness but owned elsewhere

These may be referenced in context, but Harness should not become their primary maintenance home:

- tool gateway registry
- sandbox profiles
- agent profiles
- agent runtimes
- AI provider connections
- model registry entries
- module default model settings

Harness may show which upstream asset is currently referenced, but should not absorb full CRUD ownership for these shared platform primitives.

## Recommended Page Shape

The approved page shape is a top-to-bottom single page with adjustable regions.

### Region 1: Global Status

Purpose:

- establish current active environment
- expose risk posture
- expose candidate delta posture
- expose current health and latest outcome

Recommended structure:

- left pane: active environment summary, release-gate readiness, current quality-package binding
- right pane: candidate diff, open risks, recent failures, adapter-health summary

Layout rule:

- a left/right draggable splitter controls width balance

### Region 2: Operator Actions

Purpose:

- let the operator change governed selections
- preview candidate environment
- run verification
- activate or roll back

Recommended structure:

- left pane: scope selector plus environment editor
- right pane: candidate preview summary, suite selection, run launch, activation gate, rollback action, operator reason

Layout rule:

- a left/right draggable splitter controls editing-versus-action emphasis

### Region 3: Run History

Purpose:

- inspect the chronological record without leaving Harness
- keep filters and details in the same page

Recommended structure:

- upper pane: run list, filters, sort, time-window controls
- lower pane: selected run details, evidence, comparison, linked sample context

Layout rule:

- a top/bottom draggable splitter controls list-versus-detail emphasis

### Region 4: Governance Configuration

Purpose:

- expose implemented Harness governance that currently lives outside the owned page

Recommended content groups:

- runtime bindings
- routing versions
- quality package governance
- release-check context
- execution evidence triage where it is clearly Harness-related

Rules:

- only real implemented mutations may appear as controls
- read-only governance signals must be marked accordingly
- low-frequency governance should remain visually secondary to the action regions above

### Region 5: Data And Samples

Purpose:

- preserve dataset ownership inside Harness
- keep sample governance in the same product context

Recommended content:

- draft versions
- published versions
- rubric assignment state
- publication/export records
- source provenance

Rule:

- this remains part of the same page, not a mentally separate sibling product

## Interaction Rules

### Splitters

The page should support:

- horizontal splitter behavior for left/right paired regions
- vertical splitter behavior for upper/lower history regions

The splitters are layout affordances only. They do not change business state.

### Section navigation

The page may include compact internal anchor links or sticky section shortcuts, but these must behave as in-page navigation, not as a multi-product tab shell.

### Honest affordances

If a capability is not wired for mutation:

- do not render it as a form control
- render it as read-only status or remove it from this page

### Error handling

For all mutable Harness actions:

- keep feedback local to the relevant region
- show success, failure, and loading states inline
- preserve current scope context after failure
- avoid redirecting the user to a different page to understand what failed

### Verification posture

The page must continue to support the governed operator loop:

- inspect state
- change candidate
- preview candidate
- validate candidate
- activate or roll back with explicit reason

No redesign should weaken that safety sequence.

## Technical Alignment With Current Repository

Primary implementation surfaces:

- `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- `apps/web/src/features/evaluation-workbench/harness-operator-section.tsx`
- `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- `apps/web/src/features/admin-governance/agent-tooling-governance-section.tsx`
- `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- `apps/web/src/features/admin-governance/admin-governance-controller.ts`

Supporting shared surfaces may require bounded updates where Harness depends on them:

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/workbench-routing.ts`
- `apps/web/src/features/auth/workbench.ts`

## Testing Requirements

Implementation should verify:

- Harness still renders current status, comparison, and history context
- real mutable Harness controls still submit correctly
- newly surfaced governance controls are real and wired
- read-only signals are presented honestly
- dataset ownership remains inside Harness
- user-facing copy is Chinese-first where safe
- no unrelated non-Harness page behavior is required to change

## Acceptance Criteria

The redesign is correct when all of the following are true:

1. An operator can stay inside one Harness page for status, editing, validation, activation, rollback, history, and datasets.
2. Implemented Harness capabilities that were previously hidden are now surfaced in the correct page region.
3. Read-only Harness signals no longer masquerade as editable controls.
4. The page reads as one aligned work surface, not a board or fragmented console.
5. Adjustable left/right and top/bottom splitters exist as layout controls.
6. Safe user-facing Harness copy is Chinese-first.
