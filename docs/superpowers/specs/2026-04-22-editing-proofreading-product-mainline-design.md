# 2026-04-22 Editing And Proofreading Product Mainline Design

**Date**

2026-04-22

**Status**

Written after re-evaluating the latest proofreading and manuscript-workbench changes. This is the current long-term product design baseline.

**Goal**

Treat editing and proofreading as real product mainlines that will continue to be used in day-to-day work, not as one-off customer-demo surfaces.

The customer presentation remains important, but it is only an acceptance scenario for capabilities that should already deserve to exist in the long-term product.

## 1. Product Principle

### 1.1 No demo-only features

This package must not introduce:

- demo-only pages
- demo-only state models
- demo-only metrics
- demo-only shortcuts that will not be used in normal operations later

Every change must satisfy this question:

`Will editing, proofreading, governance, or delivery still need this capability after the customer demo is over?`

If the answer is no, the capability should not be built.

### 1.2 Customer display is an acceptance scenario, not the primary design goal

The system still needs to present four things clearly to the customer:

- AI control
- rule and knowledge participation
- proofreading residual learning
- real DOCX delivery

But these should be the visible result of the real product mainline, not a separate presentation layer.

## 2. Locked Product Decisions

### 2.1 Editing and proofreading remain part of one durable workbench family

The manuscript workbench remains the main operational surface for:

- current manuscript access
- current result access
- governed execution entry
- proofreading confirmation
- final publication handoff

This is not a temporary demo desk. It is the long-term operator workspace.

### 2.2 Proofreading confirmation is now a formal product step

The latest code changes already establish that proofreading is no longer only:

- create draft
- confirm final
- publish final

It is now a more truthful mainline:

- generate proofreading output
- open a dedicated confirmation child page
- review item-level corrections
- choose explicit operator decisions
- publish `human_final_docx`
- route reusable value into governance

This direction should be kept and strengthened, not treated as a demo feature.

### 2.3 Residual analysis remains proofreading-only for now

The residual-learning loop should stay in `proofreading` only.

This is still the correct product boundary because:

- proofreading now has the strongest human-confirmation step
- proofreading already owns the final text-settlement stage
- proofreading has the cleanest place to compare AI suggestions and final human decisions

Editing should not receive residual analysis in this package.

### 2.4 `human_final_docx` remains the final deliverable manuscript

The final manuscript that matters for real operations is:

- `human_final_docx`

The following assets remain important, but they are supporting assets, not the final delivery artifact:

- `edited_docx`
- `proofreading_draft_report`
- `final_proof_annotated_docx`
- issue or review reports

### 2.5 LibreOffice remains a compatibility dependency only

LibreOffice should continue to mean:

- `.doc` to `.docx` normalization support

It should not be described as:

- an AI capability
- a proofreading engine
- a core product selling point when the manuscript is already `.docx`

### 2.6 Metrics must remain truthful and operational

The system should expose:

- retrieval quality
- governed-hit evidence
- Harness validation state
- candidate routing state
- publication and writeback outcomes

The system should not expose:

- fake universal per-run accuracy
- unsupported claims that the model self-trains from manuscripts

## 3. Current Baseline After Latest Code Changes

The repo has moved forward since the earlier demo-first thinking. The latest proofreading and workbench changes already establish a stronger long-term baseline.

### 3.1 Real manuscript detail and confirmation flows now exist

`apps/web/src/features/manuscript-workbench/manuscript-workbench-detail.tsx` now introduces:

- real asset detail routing
- document preview and report preview handling
- visible editing change ledger extraction
- dedicated proofreading confirmation rendering
- item-level proofreading decision actions

This means the product already has a real child-page model for manuscript detail work.

### 3.2 Human-final publication now consumes confirmation decisions

`apps/api/src/modules/proofreading/proofreading-service.ts` now accepts:

- item-level proofreading confirmation decisions

and uses them to:

- materialize `human_final_docx`
- route reusable decisions into governed hits
- observe residual issues based on human-confirmation deltas

This is a major shift: the human-final stage is no longer only a file-export action. It is now a governance-aware product step.

### 3.3 Governed execution evidence is already partially surfaced

The workbench already exposes read-only execution context including:

- resolved model id
- routing policy version
- execution profile id
- provider readiness
- runtime binding readiness

and also shows governed module binding data such as:

- execution profile
- retrieval preset
- runtime binding

This means AI control evidence exists, but it is still fragmented between multiple cards.

### 3.4 Rule, knowledge, residual, and Harness backbones already exist

The system already has real long-term backbones for:

- governed hits
- review-item routing
- residual issues
- Harness validation
- candidate creation
- rule-center and knowledge-center governance

So the remaining work is not to invent a learning loop. It is to make the existing loop coherent and operationally understandable from the workbench outward.

## 4. Updated Problem Statement

The real product problem is no longer:

`Can the system fake these four capabilities well enough for one customer presentation?`

The real product problem is:

`How do we make the editing and proofreading mainlines truthful, durable, governable, and operationally legible, so the same product can be used after the customer presentation without rework?`

That problem breaks into four long-term gaps.

### 4.1 The final manuscript asset chain is real, but still not explicit enough

The system can already produce and download the relevant manuscript artifacts.

What still needs strengthening is:

- clearer operator posture for each asset type
- clearer separation between current manuscript, working result, annotated proofreading result, and final deliverable
- stronger visibility into preview versus download versus publish actions

This is long-term product value because operators will need this every day, not only in front of customers.

### 4.2 AI control evidence exists, but it is too fragmented for routine trust

The system already stores the governed evidence. The gap is not missing governance.

The gap is that operators still do not get one clear answer to:

`Why was this run governed, and what exactly constrained it?`

That gap matters for:

- internal troubleshooting
- external explanation
- repeatability
- change auditing

### 4.3 Rule and knowledge participation is real, but still split across surfaces

The current system can already show:

- knowledge hits
- governed hits
- retrieval-quality evidence

But these are still split between:

- manuscript workbench
- workbench summary
- rule center

This makes the mainline harder to understand than it should be.

### 4.4 Proofreading residual learning is real, but the loop is still centered too far downstream

Proofreading now has two meaningful residual-learning sources:

- governed proofreading output
- human-confirmation deltas at publication time

This is strong long-term product behavior.

But the operator still has to look too far downstream to understand:

- what residual issue was created
- whether Harness has validated it
- whether it became a candidate
- where it went next

That makes the loop operationally correct, but too indirect.

## 5. Final Product Direction

The product should move forward in five durable workstreams.

### Workstream 1: Asset Truth And Delivery Mainline

Primary purpose:

- make the manuscript asset chain explicit and durable

The workbench must keep telling the operator:

- what is the current manuscript
- what is the current module result
- what is the proofreading annotated asset
- what is the final publishable manuscript

This is not presentation copy. It is the core handoff truth of the system.

### Workstream 2: Governed Execution Evidence Layer

Primary purpose:

- turn governed execution evidence into a permanent trust layer for operators

The workbench should expose, in one coherent reading path:

- execution profile
- prompt or instruction lineage
- model routing policy version
- resolved model
- retrieval preset
- runtime binding id
- provider readiness
- runtime binding readiness

This should answer:

`Why can I trust that this run used the intended governed setup?`

### Workstream 3: Rule And Knowledge Participation Layer

Primary purpose:

- make rule and knowledge participation visible as part of the mainline, not as an afterthought

The operator should be able to understand:

- which rules mattered in this run
- which knowledge assets were referenced
- what the retrieval-quality posture looks like
- which issues moved into review or governance

### Workstream 4: Proofreading Confirmation To Governance Loop

Primary purpose:

- make the proofreading confirmation stage the authoritative bridge between text settlement and governance

This workstream should preserve and strengthen the current direction:

- item-level confirmation
- manual adjustment when needed
- explicit route-to-rule or route-to-knowledge actions
- publication of `human_final_docx`
- residual observation from meaningful human deltas

This is the strongest long-term self-improving behavior in the current product and should stay centered in proofreading.

### Workstream 5: Compatibility And Preview Resilience

Primary purpose:

- prevent document-format and preview readiness from becoming hidden operational failures

The product should truthfully expose:

- whether the source is already `.docx`
- whether normalization is required
- whether normalization is blocked because LibreOffice is unavailable
- whether preview is ready or still pending normalization

This is a real production concern, not a demo concern.

## 6. What Should Not Change

The following boundaries should remain intact.

### 6.1 No editing residual loop in this package

Editing should stay focused on:

- real edited artifact generation
- visible change ledger
- governed execution evidence

Residual analysis remains a proofreading responsibility.

### 6.2 No separate demo page

The work should continue inside:

- manuscript workbench
- review-items
- rule-center and knowledge-center governance surfaces

### 6.3 No fake metric packaging

Retrieval quality, Harness validation, governed hits, and candidate routing are all valuable.

They should remain:

- operational metrics
- governance evidence
- learning evidence

They should not be turned into unsupported claims about universal manuscript accuracy.

## 7. Acceptance Criteria

This design is successful only when all of the following are true.

### 7.1 Real manuscript mainline

- operators can clearly identify manuscript asset roles across editing and proofreading
- `human_final_docx` remains the explicit final delivery artifact
- preview, download, and publish actions remain truthful and stable

### 7.2 Governed trust layer

- the workbench can explain governed execution in one readable path
- operators can distinguish governed state from bare execution posture
- readiness failures are readable without backend digging

### 7.3 Participation and evidence

- rule and knowledge participation is visible from the mainline
- retrieval-quality evidence remains available and clearly framed
- governed-hit and review routing evidence is not hidden behind engineering-only language

### 7.4 Proofreading governance loop

- proofreading confirmation remains item-based
- reusable decisions can route into governance
- residual observation from human-confirmation deltas remains in place
- the operator can understand where the residual or governance outcome went next

### 7.5 Compatibility resilience

- `.doc` normalization status is truthful
- preview readiness versus normalization waiting state is explicit

## 8. Delivery Order

The implementation order should now follow long-term product value, not customer-show sequencing.

1. keep the real asset and publication chain solid
2. consolidate governed execution evidence into a durable operator layer
3. consolidate rule and knowledge participation evidence
4. pull residual and Harness outcome visibility closer to the proofreading mainline
5. harden normalization and preview readiness posture

## 9. Success Definition

The product is successful when it can truthfully say:

- `Editing and proofreading are real long-term workflows, not temporary demo flows.`
- `The final manuscript is produced through a governed and human-confirmed mainline.`
- `Rule, knowledge, residual, and Harness behavior all contribute to a durable governance loop.`
- `The same capabilities that are shown to customers are the capabilities operators will keep using afterward.`

## 10. Thread Handoff Summary

Any future implementation thread must preserve these boundaries:

- optimize for long-term product use, not demo-only presentation
- keep proofreading confirmation and `human_final_docx` as core product steps
- keep residual analysis in proofreading only
- keep LibreOffice framed as compatibility support only
- keep rule, knowledge, residual, and Harness signals truthful and operational

If scope pressure appears, the correct tradeoff order is:

1. preserve the real manuscript asset chain
2. preserve governed execution explainability
3. preserve rule and knowledge participation visibility
4. preserve proofreading governance and residual loop truth
5. defer anything that smells like demo-only UI or duplicate desks
