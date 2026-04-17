# 2026-04-17 Harness Minimal Alignment Package Design

**Date**

2026-04-17

**Status**

Approved in conversation as the current implementation slice

**Goal**

Close the remaining gap between the approved Harness IA baseline and the current code without reopening broader governance IA work.

In one sentence:

`Keep the existing singular Harness route, but make the page feel like one true operator workspace instead of a results page with a bolted-on control section.`

## Background

The approved baseline already landed most of the product direction:

- `管理总览` is lightweight
- Harness owns one singular management nav entry
- real control widgets live under Harness
- dataset entry no longer needs to be a separate management product

The current code is therefore **functionally close**, but still leaves three operator-facing mismatches:

1. the page composition still feels stacked instead of unified
2. `Manuscript Type` still reads as a fixed derived value instead of a visible scope boundary the operator can switch
3. the dataset surface is owned by Harness in routing, but still reads like a reused sibling workbench rather than part of the same working loop

## Implementation Slice

This implementation is intentionally smaller than the original 2026-04-16 Harness alignment project.

It only covers the minimum work needed to make the current Harness page match the approved IA more honestly.

### In Scope

- reshape the current Harness page into a clearer three-region working layout
- keep suite/history/dataset entry grouped in the left working region
- keep comparison, release posture, and selected-run evidence in the center region
- keep governed controls in a dedicated right-side control plane
- make `Manuscript Type` selectable within the available Harness scope profiles for the chosen module
- expose the active template-family scope as a visible derived boundary
- keep dataset work inside the same Harness-owned experience and make the embedded dataset mode feel intentional
- update focused tests to lock the new page shape and scope boundary behavior

### Out Of Scope

- redesigning admin gateway cards
- changing Harness backend contracts
- redesigning dataset CRUD beyond the current queue, provenance, and export flow
- redesigning rule center, knowledge library, or manuscript workbench
- changing the singular `Harness 控制` navigation posture

## Product Decisions

### 1. Keep the singular Harness route

The operator still enters through the existing Harness workbench route and its internal section state.

No new top-level route or management entry is introduced.

### 2. Make the page read as one working surface

The page should now read as:

- left: where I pick the scope of work and inspect recent activity
- center: where I judge whether the candidate is actually better or worse
- right: where I change the governed environment and decide whether to promote

The user should not feel that the control plane starts "after" the main page.

### 3. Treat manuscript type as part of scope selection

`Module` alone is not enough for the operator mental model.

The Harness editor should surface:

- module
- manuscript type
- derived template family

`Template Family` may remain derived/read-only in this slice, but it must be shown so the operator can see which real Harness scope they are modifying.

### 4. Keep dataset work in the same loop

The dataset section remains an internal Harness view, but the overview and runs sections should also visibly acknowledge dataset ownership through a first-class sidebar entry rather than a detached afterthought card.

## Target Page Shape

### Top strip

A compact operational strip remains at the top and can continue to use summary cards.

This slice does not require a brand-new strip component.

### Left region

The left region should contain:

- Harness internal section switcher
- dataset ownership entry
- suite selection
- recent finalized history

### Center region

The center region should contain:

- delta summary
- comparison posture
- release gate summary
- selected run / evidence context
- embedded dataset workbench when the active internal section is `datasets`

### Right region

The right region should contain:

- scope summary
- environment editor
- candidate run launcher
- activation / rollback controls

## Acceptance Criteria

This slice is aligned only if all of the following are true:

- the Harness page still owns one singular nav destination
- the page visually reads as a unified working surface rather than a stacked results page plus side section
- `Manuscript Type` is no longer read-only in the environment editor
- the active template-family scope is visible when adjusting the environment
- dataset work still feels owned by Harness in both routing and page composition
- no unrelated governance modules are changed as a side effect
