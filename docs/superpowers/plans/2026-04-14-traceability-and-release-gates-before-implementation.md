# Traceability And Release Gates Before Implementation

> **Purpose:** This document is the pre-implementation control sheet for the redesign rollout. It exists to answer two questions before coding starts:
>
> 1. Does each child plan trace back to the correct approved design input?
> 2. What hard gates prevent a repeat of "local preview still shows the old page" or "UI changed but CI/regression broke"?

---

## 1. Child Plan To Design Traceability

### 1. Shared entrance and shell

**Child plan**

- [2026-04-14-shared-shell-and-entrance-final-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-shared-shell-and-entrance-final-implementation.md)

**Primary design source**

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)

**Key approved outcomes that must be preserved**

- keep the global left navigation
- keep the authenticated shell
- premium Chinese-first login entrance
- compact shell header
- no oversized page-internal hero blocks

**Execution note**

- this child plan owns only the shell baseline
- `质量优化` may appear temporarily here as a compatibility nav item, but the later collaboration-and-recovery child plan is the source of truth for removing it from the normal major navigation

### 2. AI access and system settings

**Child plan**

- [2026-04-14-ai-access-and-system-settings-final-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-ai-access-and-system-settings-final-implementation.md)

**Primary design source**

- [2026-04-10-ai-provider-control-plane-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-10-ai-provider-control-plane-design.md)

**Key approved outcomes that must be preserved**

- `AI接入` and `账号与权限` split cleanly
- API key entry should be simple
- module-to-model binding belongs here
- temperature belongs here
- downstream pages should stop repeating provider/model/temperature controls

### 3. Rule center

**Child plan**

- [2026-04-14-rule-center-final-structure-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-rule-center-final-structure-implementation.md)

**Primary design source**

- [2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md)

**Secondary design source**

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)

**Key approved outcomes that must be preserved**

- rule center is ledger-first
- add/edit flow uses the five-step wizard
- rule entry stays simple like the knowledge library
- `回流候选` lives inside rule center
- advanced options are bounded, not permanently exposed

### 4. Knowledge library

**Child plan**

- [2026-04-14-knowledge-library-final-structure-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-knowledge-library-final-structure-implementation.md)

**Primary design source**

- [2026-04-14-knowledge-library-final-structure-and-entry-flow-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-knowledge-library-final-structure-and-entry-flow-design.md)

**Key approved outcomes that must be preserved**

- stays in shared shell
- table-first main page
- right-side temporary board
- tabs are `基础信息 / 内容材料 / AI语义层`
- AI-assisted intake is text-first
- confirm before entering table
- entries land as draft

### 5. Knowledge review and quality recovery

**Child plan**

- [2026-04-14-knowledge-review-and-quality-recovery-final-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-knowledge-review-and-quality-recovery-final-implementation.md)

**Primary design basis**

- latest approved conversation decisions already folded into this plan

**Supporting design sources**

- [2026-03-28-phase7b-knowledge-review-web-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-03-28-phase7b-knowledge-review-web-design.md)
- [2026-04-12-manuscript-quality-v2-governance-and-branching-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md)
- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-14-rule-center-final-structure-and-stepwise-entry-wizard-design.md)

**Key approved outcomes that must be preserved**

- `知识审核` stays short and easy to use
- `质量优化` does not remain a heavy top-level orphan page
- reusable recovery flow moves into `规则中心 -> 回流候选`
- old `learning-review` becomes compatibility handoff only

### 6. Manuscript workbenches

**Child plan**

- [2026-04-14-manuscript-workbench-final-desk-and-governed-intake-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-manuscript-workbench-final-desk-and-governed-intake-implementation.md)

**Primary design sources**

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)
- [2026-04-04-editorial-workbench-ui-refresh-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-04-editorial-workbench-ui-refresh-design.md)

**Supporting design source**

- [2026-04-12-manuscript-quality-v2-governance-and-branching-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md)

**Key approved outcomes that must be preserved**

- `初筛 / 编辑 / 校对` share one desk family
- batch processing stays
- batch cap remains `10`
- manuscript type is AI-detected after upload
- system auto-binds the base template family
- journal template is optional manual refinement
- large-template correction is secondary, not mandatory

### 7. Management overview and final Chinese acceptance

**Child plan**

- [2026-04-14-management-overview-thinning-and-final-chinese-acceptance-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-management-overview-thinning-and-final-chinese-acceptance-implementation.md)

**Primary design source**

- [2026-04-13-workbench-shell-and-governance-redesign-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-13-workbench-shell-and-governance-redesign-design.md)

**Supporting design source**

- [2026-03-30-phase8d-admin-governance-console-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-03-30-phase8d-admin-governance-console-design.md)

**Key approved outcomes that must be preserved**

- management overview is only a light gateway page
- Harness-specific work stays in Harness
- domain-owned content is not duplicated here
- safe user-facing English is translated to Chinese

---

## 2. Hard Release Gates

These gates are mandatory for every implementation phase. A phase is not complete unless all applicable gates pass.

### Gate A: Route ownership gate

For every redesigned page:

- the default route or default child view must point to the new page
- old pages may remain only as compatibility wrappers or deep-link handoff surfaces
- if an old page still renders as the normal entry, the phase is not complete

### Gate B: Old-surface retirement gate

Before closing a phase, verify all of the following:

- old entry components are no longer the default export path
- old route branches are either removed or explicitly marked as compatibility-only
- management, shell, and workbench navigation labels point to the new owned pages

### Gate C: Browser reality gate

Do not trust code diff alone.

Before claiming the phase works:

- start the local app from the current workspace
- open the real route in the browser
- verify the actual rendered page is the redesigned one
- verify the route/hash being tested is the real default route for that page family

If the browser still shows the old page, treat that as a blocker, not a cosmetic miss.

### Gate D: Regression gate

Every phase must pass:

- focused web tests for the touched page family
- focused API tests if contracts changed
- `typecheck` for touched apps

No phase should move forward with known failing tests or type errors.

### Gate E: Stability gate

No redesign change is accepted if it:

- breaks the existing core manuscript flow
- causes the shell to route to the wrong workbench
- introduces duplicate AI controls after centralization
- breaks compatibility links without a safe handoff

### Gate F: Final acceptance gate

After all phases are complete:

- run the full focused web suite defined in the final management-and-acceptance child plan
- run the final API suite defined there
- verify the final browser checklist across login, shell, rule center, knowledge library, knowledge review, manuscript workbenches, AI access, and management overview

---

## 3. Non-Negotiable Execution Rules

To reduce rework cost, implementation must follow these rules:

1. Do not implement out of phase order.
2. Do not skip child-plan tests just because a local visual change looks right.
3. Do not leave the old page as default "for now" and plan to switch it later.
4. Do not declare completion from screenshots or static markup alone.
5. Do not merge a page redesign if CI-equivalent local checks are failing.

---

## 4. Practical Meaning For This Rollout

What this means in practice:

- we will code by child plan, not by scattered page edits
- each child plan must match its traced design source above
- every phase must prove both "the new page exists" and "the old page is no longer the default page"
- final acceptance happens only after all child plans land and all regression gates pass

If any phase cannot satisfy these gates, it should stop and be corrected before the next phase starts.
