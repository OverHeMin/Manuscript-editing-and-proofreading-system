# Current Workbench UI Refresh Design

**Date**

2026-04-08

**Goal**

Refresh the web UI around the system as it exists today, not around an earlier imagined IA. The redesign should make the shell immediately communicate the four priority work areas `初筛 / 编辑 / 校对 / 知识库`, keep governance surfaces available but visually quieter, and preserve the current route, page-family, and API boundaries.

## Why A New Design Pass Is Needed

The repository has now grown into a clearer product shape than it had when the first UI refresh note was written:

- The manuscript pipeline is already a real page family: `submission / screening / editing / proofreading`.
- The knowledge line is already a second family: `knowledge-review / learning-review`.
- Governance and operations are already a third family: `admin-console / template-governance / evaluation-workbench / harness-datasets / system-settings`.

The main problem is no longer missing module structure. The main problem is that the shell still renders all visible workbenches as one flat list, so the user does not feel the intended hierarchy.

## Current Structure We Must Design Around

### Shared Shell

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/app.css`
- `apps/web/src/app/persistent-auth-shell.tsx`
- `apps/web/src/features/auth/workbench.ts`

### Manuscript Family

- `apps/web/src/features/manuscript-workbench/*`
- Route IDs: `submission`, `screening`, `editing`, `proofreading`

### Knowledge Family

- `apps/web/src/features/knowledge-review/*`
- `apps/web/src/features/learning-review/*`
- Route IDs: `knowledge-review`, `learning-review`

### Governance And Operations Family

- `apps/web/src/features/admin-governance/*`
- `apps/web/src/features/template-governance/*`
- `apps/web/src/features/evaluation-workbench/*`
- `apps/web/src/features/harness-datasets/*`
- Route IDs: `admin-console`, `template-governance`, `evaluation-workbench`, `harness-datasets`, `system-settings`

## Scope

This design covers:

- shared authenticated shell
- login shell styling
- shell navigation hierarchy
- manuscript pipeline pages
- knowledge review and learning review pages
- governance and operations pages
- role-aware visibility and emphasis
- motion and polish rules

This design does not cover:

- a brand-new proofreading issue-board UI
- route rewrites
- API contract rewrites
- backend permission rewrites
- full i18n infrastructure

## Core Decisions

### 1. Keep The Existing Architecture

Do not replace:

- `WorkbenchHost`
- hash-based route switching
- `resolveWorkbenchRenderKind`
- current page family ownership

This remains a presentation-layer redesign.

### 2. Express The Product As Three Families

The UI should explicitly present the product as:

1. Manuscript mainline
2. Knowledge desks
3. Governance and operations

This is more faithful to the current repository than a single flat sidebar.

### 3. Promote Four Core Pillars In The Shell

For admin and staff-facing shells, the visually dominant shell layer should foreground:

- `初筛` -> route `screening`
- `编辑` -> route `editing`
- `校对` -> route `proofreading`
- `知识库` -> route `knowledge-review`

Important nuance:

- `知识库` is the pillar.
- `知识审核` and `学习复核` are subordinate work modes inside that family.
- `learning-review` should remain a route, but it should no longer compete with the four pillars as a peer in the primary shell emphasis.

### 4. Separate Governance From Daily Work

Admin-only surfaces should remain available, but live in a quieter management zone:

- `管理控制台`
- `模板治理`
- `评测工作台`
- `数据集`
- `系统设置`

This zone should look calmer and more operational, not like the primary editorial path.

### 5. Distinguish General Accounts From Back-Office Roles

General accounts should not inherit the admin/editorial shell.

Role presentation rules:

- `user`: only show `我的稿件` and future user-safe areas
- `screener`: only show `初筛`
- `editor`: only show `编辑`
- `proofreader`: only show `校对`
- `knowledge_reviewer`: show `知识库`, with access to `知识审核 / 学习复核`
- `admin`: show the four pillars plus the management zone

### 6. Change The Admin Default Landing Point

The admin default should move from `admin-console` to `screening`.

Reason:

- the first impression should be an editorial workbench, not a settings console
- governance surfaces remain one click away without owning the homepage posture

### 7. Use Black-Gold As Shell Identity, Not As Reading Background

The approved visual direction remains:

- warmer black-gold shell
- paper-like working surfaces
- restrained premium motion

Application rule:

- dark and gold belong to shell identity, navigation, section headers, emphasis, and summary cards
- dense reading and form work stays on light paper surfaces

## Information Architecture

### Primary Shell Layer

The shell should expose one dominant primary rail or primary cluster for:

- `初筛`
- `编辑`
- `校对`
- `知识库`

These items should feel like the product's main destinations, not like ordinary sidebar rows.

### Secondary Layer Inside Knowledge

When `知识库` is active, show a local second-level switch for:

- `知识审核`
- `学习复核`

This keeps knowledge work first-class without flattening every route into the same rank.

### Management Zone

Below the primary cluster, render a visually quieter grouped block for:

- `管理控制台`
- `模板治理`
- `评测工作台`
- `数据集`
- `系统设置`

### General User Shell

General users should see a simpler shell that does not imitate the back-office shell:

- one clear `我的稿件` destination
- the same brand language
- much lower navigational density

## Visual System

### Palette

Recommended token direction:

- shell black: `#141311`
- shell raised black: `#1b1815`
- warm gold: `#d7bf86`
- quiet gold: `#8f7a49`
- paper: `#f6f1e8`
- paper raised: `#fffaf2`
- ink: `#1f2a36`
- secondary text: `#5e6670`
- warm border: `#d9c9a7`

### Typography

- shell titles: serif or editorial-feeling display accent, used sparingly
- body and dense controls: stable sans-serif for readability
- avoid decorative typography in queues, forms, tables, and evidence panels

### Surface Rules

- shell and navigation may use black-gold
- cards stay warm-light with restrained borders
- tables and detailed panels stay plain, quiet, and highly readable
- governance panels use the same system but lower warmth and lower contrast drama

## Page Family Guidance

### Manuscript Family

Desired feeling:

- editorial desk
- guided but not cluttered
- premium, calm, high-trust

Emphasis:

- top summary band
- current manuscript identity
- next action and latest result
- readiness / posture / handoff blocks

Avoid:

- overly dark forms
- decorative panels around dense controls

### Knowledge Review

Desired feeling:

- high-density review desk
- scanning efficiency first
- gold only as selection and action emphasis

Emphasis:

- queue state
- active item
- action outcome

Avoid:

- ornamental card stacks that slow visual parsing

### Learning Review

Desired feeling:

- bridge between review and governed writeback
- primary review path first
- admin utilities clearly secondary

Emphasis:

- pending queue
- selected candidate
- approval and writeback handoff

Avoid:

- letting the utility panel visually outrank the actual review flow

### Governance And Operations

Desired feeling:

- structured console
- audited, systematic, quiet
- still consistent with the same brand

Emphasis:

- summary metrics
- grouped panels
- stable control surfaces

Avoid:

- making governance pages feel like the main product homepage

## Motion

Use motion only where it improves orientation:

- shell load: short fade and lift
- nav active change: soft highlight transition
- cards: subtle hover lift or tint
- disclosure panels: short expand/collapse transition

Do not use:

- dramatic page wipes
- heavy stagger on dense lists
- motion that delays work

Reduced motion support is required.

## Implementation Impact

Expected code impact remains limited to presentation and shell metadata:

- `apps/web/src/app/workbench-host.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/src/app/app.css`
- `apps/web/src/app/persistent-auth-shell.tsx`
- `apps/web/src/features/auth/workbench.ts`
- page-family CSS files
- a small shell-navigation helper if needed

No business API changes are required for this refresh.

## Acceptance Criteria

- Admin users land in an editorial-facing shell, not a governance-first shell.
- The shell visibly foregrounds `初筛 / 编辑 / 校对 / 知识库`.
- `知识库` is clearly first-class and no longer feels buried under governance.
- Governance surfaces remain available but clearly separated from daily work.
- General users do not see admin-only work areas.
- Manuscript, knowledge, and governance families look related but not identical.
- Black-gold is used to create identity and polish without hurting readability.
- Motion improves perceived smoothness without reducing efficiency.

## Status

This design supersedes the earlier UI refresh assumptions for implementation work. Future UI implementation should follow the current repository structure described here, not the older flat-shell assumptions.
