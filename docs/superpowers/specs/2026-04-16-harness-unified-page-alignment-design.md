# 2026-04-16 Harness Unified Page Alignment Design

**Date**

2026-04-16

**Status**

Approved in conversation as the implementation baseline

**Goal**

Align `Harness` with the newer internal-trial IA:

- keep `管理总览` as a lightweight gateway page
- move real Harness operations back into one owned `Harness` page
- keep run history and dataset entry inside the same Harness-owned experience instead of scattering them across separate destinations

In one sentence:

`Harness` should become one coherent operator home again, while `管理总览` stays light.

## User-Approved Baseline

The approved baseline for implementation is:

`新版 IA（推荐）：保留现在的轻量 管理总览，把真实控制区、运行历史、数据集入口都收回一个 Harness 页面。`

This means the current lightweight `管理总览` direction remains valid, but the current Harness implementation is still incomplete because the owned page does not yet contain the real control surface.

## Why This Change Is Needed

The current repository contains two partially conflicting Harness directions.

### Direction A: lightweight management gateway

This is already reflected in the current `管理总览` page:

- small entry cards
- small read-only snapshots
- no embedded heavy control plane

This direction is correct and should stay.

### Direction B: Harness as the single home for Harness-specific work

This is also the approved direction, but it has not fully landed.

The current `Harness` page still behaves more like an evaluation results workbench:

- overview
- comparison
- history

Meanwhile, the real editable control pieces exist in code but are not actually integrated into the current owned Harness page:

- environment editor
- candidate run launcher
- activation / rollback gate

The result is an in-between state:

- `管理总览` is already thin
- but `Harness` still does not own the full workflow

That mismatch is exactly what this implementation should fix.

## Scope

### In Scope

- consolidate real Harness operations into the owned Harness page
- keep `管理总览` as a light gateway
- make run history and dataset entry discoverable from the same Harness-owned page
- connect the existing real control components into the owned Harness experience
- update routing, navigation, and focused tests so the IA stays coherent

### Out Of Scope

- redesigning rule center
- redesigning knowledge library
- redesigning manuscript workbench internals
- changing backend Harness contracts unless a small adaptation is strictly required for the page integration
- changing the underlying governed environment model
- introducing a brand-new top-level workbench family

## Product Decisions

The following decisions are locked for this implementation.

### 1. `管理总览` stays light

`管理总览` remains:

- a gateway page
- a read-only cross-cutting snapshot surface
- an entrance to owned workbench pages

It should not become:

- a second Harness console
- a duplicate rule-authoring page
- a parameter wall

### 2. Harness owns the full operator loop

The owned Harness page should cover the full operator loop in one place:

- inspect the target scope
- adjust governed environment selections
- preview candidate environment
- launch candidate-bound run
- inspect latest evidence and comparison posture
- activate or roll back
- jump into dataset work from the same owned area

### 3. One Harness page, not scattered destinations

The user should no longer feel like Harness is split across:

- one page for summaries
- another page for runs
- another page for datasets
- another hidden place for real environment control

Implementation may still use internal sections, tabs, or bounded subviews, but the operator mental model must be:

`I am still inside Harness.`

### 4. Real controls must be visible in the owned page

The owned Harness page must expose the real five-part governed environment controls:

- execution profile
- runtime binding
- routing version
- retrieval preset
- manual review policy

Those controls are not optional summaries. They are the reason the page exists.

### 5. Dataset work stays under Harness ownership

Dataset entry should remain reachable from Harness and conceptually owned by Harness.

Implementation may still reuse the existing dataset workbench component, but the IA should read as:

`Harness -> 数据与样本`

not as a disconnected sibling product.

## Recommended Page Shape

The approved target shape is a three-region Harness working page.

### Top strip

A compact top strip may show:

- suite count
- run count
- dataset count
- current scope / status

This strip should stay small and operational.

### Left region

The left region should cover:

- suite selection
- recent run history
- dataset entry link or embedded dataset section entry

This region answers:

`我现在看哪套验证、哪次运行、从哪里进入数据与样本？`

### Center region

The center region should cover:

- result comparison
- regression posture
- evidence summary
- latest run context

This region answers:

`这次候选环境和基线相比，到底变好了还是变坏了？`

### Right region

The right region should cover the real control plane:

- environment selection
- candidate preview
- candidate run action
- activation / rollback

This region answers:

`我要怎么改 live scope，以及改之前怎么先验证？`

## Routing And Navigation Rules

### Owned navigation posture

The left navigation should continue to expose one management entry for Harness.

That management entry should continue to feel singular:

- `Harness 控制`

### Internal sectioning

Implementation may still use section state for:

- overview
- runs
- datasets

But those states should behave as internal views of Harness, not as separate products competing for ownership.

### Dataset compatibility

Existing deep links and routing compatibility may be preserved if needed, but user-facing navigation should prefer the singular Harness experience.

## Implementation Boundaries

To reduce risk to other ongoing work, implementation should stay bounded to:

- Harness-owned pages and components
- shared routing only where Harness navigation depends on it
- admin gateway links that point into Harness
- focused Harness tests

It should avoid opportunistic edits to:

- knowledge library behavior
- rule-center behavior
- manuscript-workbench behavior

unless a Harness link target or compatibility path strictly requires a small adjustment.

## Acceptance Criteria

This redesign is aligned only if all of the following are true:

- `管理总览` remains a lightweight gateway page
- the owned Harness page exposes the real five-part governed environment controls
- the owned Harness page contains run history and comparison posture as part of the same experience
- dataset entry is clearly under Harness ownership
- the user does not need to mentally switch between multiple unrelated Harness destinations to complete one workflow
- routing and navigation still work for existing Harness entry points
- no unrelated knowledge-library, rule-center, or manuscript-workbench behavior is changed as a side effect

## Minimal Verification Targets

Focused verification for this implementation should cover:

- `workbench-host` routing into Harness
- `admin-governance` entry links into Harness
- Harness overview / runs / datasets compatibility behavior
- real Harness control components rendering from the owned page
- dataset entry still reachable from the owned Harness experience

## Notes For Implementation Planning

The codebase already contains reusable control components that should be integrated rather than re-invented:

- `harness-environment-editor.tsx`
- `harness-quality-lab.tsx`
- `harness-activation-gate.tsx`

The main design problem is not missing capability.

The main design problem is ownership and composition:

- the right capability exists
- but it is not currently composed into the owned Harness experience

That makes this a page-alignment and integration task, not a full subsystem rewrite.
