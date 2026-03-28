# Phase 7B Knowledge Review Web Workbench Design

## Goal

Build the first real reviewer-facing Web workbench page for governed knowledge review, using the contracts completed in Phase 7A. The page should let `knowledge_reviewer` and `admin` users process the pending knowledge queue efficiently without exposing raw admin tooling or requiring route-heavy navigation.

## Scope

This phase covers the first Web page shell only:

- a left-side pending review queue
- a right-side detail panel for the selected knowledge item
- inline approve / reject actions with review note support
- inline review history
- typed workbench entry integration for the approved roles

This phase does not cover:

- WeChat UI implementation
- a full admin console redesign
- broad multi-page information architecture
- advanced saved views, grouping, or assignment workflows

## Confirmed Decisions

The following decisions were validated during brainstorming:

- Layout: `A` master-detail desk
- Review completion: auto-advance to the next queue item
- Detail panel: includes review history in v1
- Queue controls: include keyword search plus basic filters
- Page goal: real data-backed minimum usable page, not a static shell

## Product Shape

### Page Structure

The workbench is a single review desk with two persistent regions.

#### Left: Pending Review Queue

Purpose:

- keep reviewers anchored in the queue
- support fast scanning and triage
- preserve context while the right panel updates

Contents:

- keyword search
- status filter
- knowledge kind filter
- module filter
- queue count
- list items with compact summary metadata

Each queue item should show enough context for rapid selection:

- title
- knowledge kind
- module scope
- manuscript type scope when helpful
- evidence level if present
- lightweight risk/template hints if present

#### Right: Review Detail Panel

Purpose:

- show everything needed to make a review decision without leaving the page

Sections:

1. `Knowledge Detail`
2. `Review History`
3. `Review Action Panel`

The detail section should render:

- title
- canonical text
- summary
- evidence level
- source type and source link
- routing scope
- template bindings

The history section should render:

- submitted-for-review events
- approval events
- rejection events
- review notes
- event timestamps
- actor role labels

The action section should render:

- review note input
- approve button
- reject button
- in-flight disabled state
- success / error feedback

## Interaction Model

### Selection

- when the page loads, fetch the pending queue first
- if the queue has items, auto-select the first item
- when a user clicks an item in the queue, the right panel updates to that item

### Review Actions

- approve and reject actions are executed inline from the right panel
- review note remains optional, but the UI should encourage a note on rejection
- while an action is in progress, the action buttons are disabled

### Auto-Advance

After a successful approve or reject:

- remove the current item from the pending queue
- refresh history state if needed
- automatically select the next item in the filtered queue
- if no items remain, show the empty state on the right panel

This choice favors throughput for reviewers handling many items in sequence.

## Filtering Behavior

The queue supports the following first-version controls:

- keyword search
- status filter
- knowledge kind filter
- module filter

Rules:

- filter changes re-fetch the queue data source
- if the current item disappears from the filtered result set, switch to the first remaining item
- if no result remains, keep the filters visible and show a no-results state

## Data Flow

The page should consume the Phase 7A contracts directly.

### Required Web Clients

The page depends on:

- `listPendingKnowledgeReviewItems`
- `listKnowledgeReviewActions`
- `approveKnowledgeItem`
- `rejectKnowledgeItem`

No new parallel Web data slice should be introduced. The existing `knowledge` feature remains the single typed client entry.

### Load Sequence

1. load the pending queue
2. if non-empty, choose the active item
3. render detail using the queue item payload
4. fetch the selected item review history
5. allow approve / reject actions

The detail panel should prefer already-loaded queue fields and only fetch additional supporting data if later phases genuinely need it.

## Role Exposure

Only these roles should see the workbench entry:

- `admin`
- `knowledge_reviewer`

All other roles must not see the entry in the typed workbench registry.

The workbench continues to consume the typed entry system introduced in Phase 7A rather than reintroducing loose string-based navigation.

## Error Handling

### Queue Load Failure

- left side shows a recoverable error state with retry
- right side keeps the last stable selection if present, otherwise shows neutral empty state

### History Load Failure

- detail content remains visible
- history section shows local error state and retry affordance
- action panel remains usable

### Review Action Failure

- do not advance selection
- keep the review note content intact
- show error feedback close to the action area

### Auto-Advance Failure

- if the next item cannot be resolved after a successful action, leave the queue visible and require a manual click

## Empty States

### No Pending Items

Show:

- queue empty message
- right-side empty guidance
- no active action buttons

### No Filter Results

Show:

- explicit “no matching items” message
- preserve active filters
- right panel returns to empty filtered state

## UI Tone And Visual Direction

The page should feel like a serious reviewer desk rather than a generic admin dashboard.

Direction:

- clear hierarchy
- compact but not cramped
- emphasis on readability of knowledge text
- strong separation between queue context and decision context
- subtle operational tone, not flashy

The first page should prioritize function over ornament while still avoiding a visually flat “table dump” look.

## Reuse Boundary For WeChat

This Web page does not need to be mirrored visually in WeChat, but the following concepts should stay reusable:

- pending review queue contract
- selected item detail contract
- review history contract
- approve / reject action contract

The page-specific layout and panel state stay Web-only.

## Acceptance Criteria

- `knowledge_reviewer` and `admin` can access the workbench entry
- the queue shows real pending-review knowledge items
- users can search and filter the queue
- selecting an item renders detail, history, and actions in one page
- approve transitions the item out of the queue and advances to the next item
- reject returns the item to `draft`, removes it from the queue, and advances
- failed actions do not lose review notes
- empty and error states are explicit and recoverable

## Implementation Guidance

This phase should stay intentionally small:

- one workbench page shell
- one queue/detail composition
- one clear state model

Do not expand into a full review platform during implementation. The point of this phase is to establish the durable page pattern that later knowledge, learning, and evaluation workbenches can follow.
