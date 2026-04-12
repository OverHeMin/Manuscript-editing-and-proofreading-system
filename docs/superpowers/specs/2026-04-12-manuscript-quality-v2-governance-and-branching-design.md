# Manuscript Quality V2 Governance And Branching Design

**Date:** 2026-04-12  
**Status:** Draft for review  
**Applies to:** `general_proofreading` V2 and `medical_specialized` V2

---

## 1. Goal

Lock the non-negotiable V2 constraints before implementation starts, so the next phase:

- does not continue on `codex/harness-control-plane-p0`
- does not break the current governed manuscript flow
- does not collapse quality analyzers, knowledge assets, rule assets, and Harness control into one mixed layer
- does make the configurable parts of the quality system maintainable from the backend
- does make both V2 lines governable by Harness after they land

---

## 2. Approved Scope Decisions

The following decisions are already approved and should be treated as fixed input:

1. V2 is split into two independent subprojects:
   - `general_proofreading` V2
   - `medical_specialized` V2
2. Recommended execution order:
   - `general_proofreading` V2 first
   - `medical_specialized` V2 second
3. `general_proofreading` V2 starts with the medical-research article style layer only, not all manuscript genres.
4. V2 stays advisory-first and must not change governance authority.
5. V2 should use deterministic rules and structural templates as the primary mechanism, not a large-model-first design.
6. After V2 lands, Harness must be able to control and evaluate these modules.

---

## 3. Non-Negotiable V2 Constraints

### 3.1 System boundary constraints

- Do not merge quality analyzers into the knowledge library.
- Do not merge quality analyzers into the editorial rule library.
- Do not let Harness become the place where analyzer logic itself is authored.
- Keep the four layers distinct:
  - knowledge assets
  - rule assets
  - quality analyzer assets
  - Harness control and evaluation

### 3.2 Runtime constraints

- Existing `screening`, `editing`, and `proofreading` flows must remain business-complete even if a new V2 quality scope degrades.
- New V2 findings must continue to use conservative action ladders and structured issue outputs.
- High-risk medical judgments still cannot be auto-decided by the new V2 layer.

### 3.3 Delivery constraints

- Do not continue V2 work on `codex/harness-control-plane-p0`.
- Do not mix quality V2 implementation commits with active Harness control-plane commits.
- Do not make backend maintainability depend on editing Python or TypeScript source in production.

---

## 4. What Must Become Backend-Maintainable

The user requirement is not "edit analyzer source code in the browser."
The correct V2 target is: keep the analyzer engines in code, but move the configurable analyzer assets into governed backend-managed records.

### 4.1 Backend-editable quality asset types

V2 should make these maintainable from the backend or workbench:

- phrase dictionaries
- sensitive term lists
- terminology mapping tables
- regex pattern sets
- section or genre templates
- indicator unit maps
- magnitude or threshold ranges
- comparison-direction templates
- issue taxonomy mapping
- action or severity mapping
- analyzer enablement toggles
- analyzer version metadata

### 4.2 Code-owned engine responsibilities

These should remain repo-owned engines, not free-form backend-authored logic:

- table structure parsing
- `n(%)` back-calculation
- mean and standard-deviation tolerant parsing
- cross-section comparison matching
- core sentence or group extraction heuristics
- issue normalization and action-ladder enforcement

### 4.3 Resulting V2 architecture principle

V2 should follow:

`engine code + governed quality assets + governed activation + Harness evaluation`

not:

`hardcoded analyzer logic only`

and not:

`arbitrary backend-authored executable analyzer code`

---

## 5. General V2 Design Constraint

`general_proofreading` V2 should become a style-package layer for medical research manuscripts, but still remain separate from `medical_specialized`.

Its V2 job is to cover:

- article-style identification for medical research manuscripts
- section expectation hints
- style-strength and tone consistency
- abstract or result or conclusion writing posture checks
- genre-specific wording suspicion signals

Its V2 job is not to take over:

- medical fact checking
- medical data validation
- statistical conclusion adjudication
- ethics or privacy final judgment

---

## 6. Medical V2 Design Constraint

`medical_specialized` V2 should continue from the current V1 plus V1.5 base and move toward governed, maintainable, configurable medical analyzer assets.

Its V2 job should include:

- configurable indicator dictionaries and unit bindings
- configurable medical comparison templates
- configurable count and range constraint sets
- configurable issue-family thresholds and activation switches
- deeper table-text and cross-section consistency packages that still remain advisory

Its V2 job should not include:

- unconstrained large-model medical judging
- automatic knowledge write-back
- automatic rule write-back
- unrestricted medical conclusion rewriting

---

## 7. Harness Requirement

Harness is not optional after V2.

Both V2 lines should only be considered complete when Harness can control:

- whether a quality package is enabled
- which published analyzer-asset version is active
- which module scopes consume it
- which environment receives it
- what evaluation dataset measures it
- how candidate and baseline versions compare
- whether rollout is accepted, held, or rolled back

### 7.1 Minimal Harness contract for V2

Harness should be able to reference a quality package by:

- package kind
- package name
- published version
- target scopes
- environment binding
- evaluation binding
- rollback target

### 7.2 Acceptance gate

No V2 line should be treated as truly landed unless:

1. it can run in the governed manuscript flow
2. it can be activated and deactivated cleanly
3. it can be compared in Harness
4. it can be rolled back without code surgery

---

## 8. Branching Strategy

### 8.1 Immediate rule

Freeze `codex/harness-control-plane-p0` as a mixed branch that should not absorb new V2 work.

### 8.2 Recommended branch split

Use the current closeout state only as a source snapshot, then split into dedicated branches:

1. `codex/manuscript-quality-v1-closeout`
   - quality-only closeout and boundary cleanup
2. `codex/general-proofreading-v2-style-package`
   - general V2 only
3. `codex/medical-specialized-v2-governed-assets`
   - medical V2 only
4. `codex/manuscript-quality-v2-harness-binding`
   - Harness activation, version binding, evaluation, and rollback linkage for the two V2 lines

### 8.3 Why this split is safer

- It prevents another mixed push from the active Harness control-plane branch.
- It keeps quality design work reviewable by itself.
- It makes later rollback and PR review much cleaner.
- It reduces the chance of repeating the earlier remote-branch confusion with a branch that mixes unrelated themes.

---

## 9. Existing UI Foundation To Reuse

The current repo already contains usable foundations that V2 should build on instead of replacing:

- Knowledge workbench:
  - `apps/web/src/features/knowledge-library/`
  - `apps/web/src/features/knowledge-review/`
- Rule and template governance workbench:
  - `apps/web/src/features/template-governance/`
- Admin and Harness governance surfaces:
  - `apps/web/src/features/admin-governance/`

Therefore V2 should extend the governance model with a new quality-asset family, not invent a separate disconnected admin surface.

---

## 10. Definition Of Done For V2 Planning

Before implementation starts, the V2 plan set must preserve all of the following:

- the user's original analyzer ideas are still represented
- backend maintenance of configurable analyzer assets is designed in from the start
- Harness control is an explicit required output, not a later nice-to-have
- the branch strategy avoids continuing on `codex/harness-control-plane-p0`
- the current V1 and V1.5 behavior remains compatible during rollout

---

## 11. Immediate Next Step

After review of this design, the next document should be a V2 implementation-plan set with three linked pieces:

1. shared quality-asset model and admin-governance substrate
2. `general_proofreading` V2 implementation plan
3. `medical_specialized` V2 implementation plan, including Harness binding as a required completion gate
