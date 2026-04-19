# Homepage Hero Hierarchy Design

**Date**

2026-04-19

**Goal**

Adjust the unauthenticated homepage hero so the product name `医学稿件处理系统` becomes the dominant visual headline, while the current oversized long sentence is reduced into supporting copy that no longer overwhelms the layout.

## Current Structure We Must Design Around

- `apps/web/src/app/persistent-auth-shell.tsx`
- `apps/web/src/app/app.css`
- `apps/web/test/persistent-auth-shell.spec.tsx`

The current entrance already uses the right overall composition we want to keep:

- left hero copy area
- right login card
- dark premium visual language
- metrics and visual support cards under the main copy

The problem is only hierarchy inside the left hero block. The long sentence currently occupies the `h1`, which makes the first screen feel heavy and pushes the actual system name into a visually weak eyebrow position.

## Scope

This design covers:

- homepage hero text hierarchy on the unauthenticated entrance
- hero copy structure in `PersistentAuthShellView`
- typography and spacing rules for the hero title and supporting copy
- a regression test that locks the new headline structure

This design does not cover:

- login card redesign
- right-side visual card redesign
- route changes
- authentication flow changes
- broader shell restyling

## Core Decisions

### 1. Promote The Product Name To The Main Headline

`医学稿件处理系统` should move from a small eyebrow into the primary headline position.

This is the most direct way to make the entrance read like a product rather than a paragraph. It also shortens the visual anchor on first load and improves scanability on both desktop and mobile.

### 2. Reduce The Long Statement Into A Supporting Subtitle

The oversized long statement should no longer be the `h1`.

It should be rewritten into a shorter supporting line that communicates capability without taking over the screen. The approved direction is:

- headline: `医学稿件处理系统`
- supporting subtitle: `初筛、编辑、校对与知识入库的一体化工作台`

### 3. Keep The Existing Explanatory Paragraph

The current descriptive paragraph under the hero brand should remain as supporting body copy. It already explains the scenario well, and it does not need to compete with the headline.

### 4. Tighten The Hero Typography

The hero should keep the existing premium tone, but with clearer hierarchy:

- larger and stronger title for the system name
- smaller subtitle with lower contrast than the title
- tighter line length and line breaks so the copy area does not feel crowded
- mobile sizing tuned so the text block no longer dominates the viewport

## Acceptance Criteria

- The rendered hero contains `医学稿件处理系统` as the main headline text.
- The previous oversized long headline is replaced by a shorter subtitle.
- The hero still renders the existing left-right shell structure.
- The change is covered by a focused auth-shell regression test.
