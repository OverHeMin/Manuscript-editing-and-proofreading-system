# Phase 10B Model Governance Routing Linkage Design

**Date:** 2026-04-03  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Close the model-governance loop by letting `Admin Governance Console` manage approved model-routing policy for `module + template_family` scope, consume evidence from `Evaluation Workbench`, and let live runtime read only the activated policy without introducing automatic model promotion.

## 1. Goal

Phase 10B is not the phase that lets the system automatically switch models.

Its job is to establish a governed human-approved loop across four layers:

- `Evaluation Workbench` produces inspectable evaluation evidence
- `Admin Governance Console` turns that evidence into routing policy decisions
- live runtime reads only activated routing policy
- execution and fallback outcomes write back into audit and evaluation history

The intended outcome is:

- model-routing decisions stop living in ad hoc defaults or informal operator memory
- approved policy can actually affect live runtime behavior
- every routing change remains traceable to evidence, approver, activation, and runtime outcomes

In one sentence:

`Phase 10B` should deliver a human-approved model-governance loop, not an autonomous model-optimization system.

## 2. Current Gap

The repository already has important foundations:

- `Model Registry` direction in `05-ai-model-routing-and-evaluation.md`
- runtime-binding verification linkage from Phase 9R
- governed evaluation-run seeding from Phase 9S
- inline governed run check execution and machine evidence from Phase 9T
- real `Evaluation Workbench` and `Admin Governance Console` surfaces

What is still missing is the routing-governance bridge:

- there is no first-class routing policy object for `module` or `template_family` scope
- evaluation evidence does not yet flow into an explicit routing decision object
- live runtime does not yet read an approved routing-policy layer
- fallback rules are not yet governed as versioned policy
- there is no durable audit chain from evaluation evidence -> routing approval -> runtime resolution -> fallback outcome

This leaves model governance only partially realized:

- the system can register models
- the system can produce evaluation evidence
- the system cannot yet govern which approved model policy is live for a bounded scope

## 3. Recommended Option

Three broad approaches were considered:

### Option A: Governance loop only, without runtime policy enforcement

Create policy drafts, approvals, and evidence linkage, but keep live runtime using current defaults.

Pros:

- smallest behavior change
- lowest immediate runtime risk

Cons:

- leaves the loop incomplete
- creates a governance dashboard that does not actually govern runtime behavior

Not recommended.

### Option B: Human-approved routing policy that live runtime reads

Let `Admin Governance Console` own policy authoring and activation, let `Evaluation Workbench` supply evidence, and let live runtime read only activated policy for `module + template_family` scope.

Pros:

- closes the governance loop without introducing autonomous switching
- preserves clear boundaries between evidence production, policy approval, and runtime execution
- directly fits the retained-capability map for `Phase 10B`

Cons:

- requires new persistence, runtime resolution, and admin-workbench behavior

Recommended.

### Option C: Strong automation with automatic promotion or rollback

Let evaluation results directly promote, demote, gray-release, or roll back models.

Pros:

- closest to a future autonomous governance vision

Cons:

- too broad for this slice
- would mix routing governance with orchestration and production-automation concerns
- would violate the current Phase 10 boundary discipline

Out of scope.

## 4. Core Scope And Boundaries

Phase 10B should be read through four hard boundaries.

### 4.1 Decision model

This phase supports:

- human-approved routing decisions
- evidence-linked policy drafts
- approved fallback rules
- runtime consumption of activated policy

This phase does **not** support:

- automatic model promotion
- automatic rollback
- automatic gray-release expansion

### 4.2 Governance entry point

The primary decision surface is:

- `Admin Governance Console`

`Evaluation Workbench` remains:

- an evidence-producing and evidence-inspection surface

It should not become the primary model-governance control plane.

### 4.3 Policy granularity

The only routing scopes supported in Phase 10B are:

- `module`
- `template_family`

This phase explicitly excludes:

- manuscript-type-level routing policy
- per-knowledge-item routing policy
- one-off runtime overrides as a first-class control path

### 4.4 Runtime behavior

Live runtime should:

- read only `active` routing policy
- resolve `template_family` policy before `module` default policy
- execute only pre-approved fallback rules

Live runtime should not:

- invent new routing policy
- auto-promote a candidate model
- auto-switch because quality appears weaker without an explicit failure condition

## 5. Core Objects

Phase 10B should keep model governance decomposed into separate responsibilities rather than mixing everything into runtime binding.

### 5.1 Model Registry Entry

This remains the governed asset record for an available model version.

It should at minimum describe:

- `provider`
- `model_name`
- `model_version`
- `allowed_modules`
- `is_prod_allowed`
- `fallback_model_id` or equivalent compatibility metadata

It answers:

- what this model is
- where it may legally run

It does **not** answer:

- which scope should currently use it

### 5.2 Model Routing Policy

This is the primary new governance object in Phase 10B.

It should represent a routing rule for exactly one scope:

- one `module`
- or one `template_family`

Each policy should have versioned content including:

- `primary_model_id`
- ordered `fallback_model_ids`
- `evaluation_requirements`
- linked evidence references
- operator change notes
- lifecycle `status`

It answers:

- which approved model policy is supposed to govern this scope

### 5.3 Policy Decision Record

Decision actions should be stored separately from the policy version payload.

It should capture decisions such as:

- `submit_for_review`
- `approve`
- `reject`
- `activate`
- `rollback`
- `supersede`

Each record should retain:

- actor
- timestamp
- reason
- evidence references

It answers:

- who made which governance move and why

### 5.4 Evaluation Evidence Link

Phase 10B should not duplicate the repository's evaluation storage.

Instead, routing policy should reference existing evaluation assets such as:

- evaluation suites
- evaluation runs
- evidence packs
- recommendation summaries

This layer is only the linkage between governance and evidence.

### 5.5 Runtime Resolution Result

At execution time, runtime should resolve two independent governance layers:

- `Runtime Binding`: runtime, sandbox, tool, and verification-expectation bundle
- `Routing Policy`: primary model and approved fallback order

This separation is important:

- `runtime binding` answers how execution is governed
- `routing policy` answers which approved model path is selected

## 6. Policy Lifecycle

Phase 10B should use a simple but explicit lifecycle for routing policy versions:

`draft -> pending_review -> approved -> active -> superseded`

It should also support:

- `pending_review -> rejected`
- `active -> rolled_back`

Rules:

- runtime may read only `active` policy versions
- `approved` is not automatically `active`
- rollback must not erase history
- superseding a version must preserve the old policy as historical evidence

## 7. Data Flow

The intended flow for Phase 10B is:

### 7.1 Evidence production

`Evaluation Workbench` and the existing Phase 9 governed run chain continue to produce:

- suites
- runs
- machine evidence
- evidence packs
- recommendation summaries

This answers:

- how a model performed for a scope-relevant evaluation path

### 7.2 Governance intake

`Admin Governance Console` reads that evidence and presents it by:

- `module`
- `template_family`
- candidate model versus current model
- fallback relevance and failure signals

### 7.3 Policy draft creation

An operator creates or updates a routing-policy draft that includes:

- scope
- primary model
- fallback order
- evidence references
- change reason

### 7.4 Review and activation

The draft moves through:

- `pending_review`
- `approved`
- `active`

Every transition must produce a `Policy Decision Record`.

### 7.5 Runtime resolution

At execution time, runtime resolves policy in this order:

1. matching `template_family` active policy
2. matching `module` active policy
3. existing default model configuration fallback

### 7.6 Outcome writeback

Execution records should write back:

- which policy version was matched
- which scope was matched
- which model was actually used
- whether fallback occurred
- why fallback occurred

This closes the loop from:

`evidence -> decision -> activation -> runtime usage -> evidence and audit trail`

## 8. Fallback Rules

Phase 10B allows runtime fallback only as a governed technical-failure path.

### 8.1 Allowed fallback behavior

Fallback may be used only when:

- the fallback order was already present in the active policy
- the primary model encounters a concrete runtime failure such as:
  - provider unavailability
  - timeout
  - rate limit
  - upstream API error

### 8.2 Disallowed fallback behavior

Runtime must not fallback automatically because:

- output quality appears weaker
- a heuristic suspects the result is poor
- evaluation history suggests another model might be better

Those are governance questions for later phases, not runtime autonomy in Phase 10B.

### 8.3 Fallback safeguards

Fallback execution should be constrained by:

- an ordered fallback list
- bounded fallback count per task
- explicit audit fields for:
  - original model
  - fallback model
  - failure trigger
  - final outcome

## 9. Gray-Release Rules

Phase 10B may support controlled activation boundaries, but only under explicit human control.

Supported forms:

- activate in `staging` first
- activate in `production` only for explicitly chosen `module` or `template_family` scope

Not supported in this phase:

- automatic percentage rollout
- automatic expansion from gray to full traffic
- automatic rollback from gray
- score-driven automatic policy promotion

If deeper release automation is needed later, it belongs to later orchestration or production-hardening phases.

## 10. Persistence Boundaries

Phase 10B should introduce a dedicated persistence boundary for routing policy rather than overloading existing runtime-binding storage.

Recommended entities:

### 10.1 `model_routing_policies`

Logical policy identity and scope record.

Should capture:

- policy ID
- scope kind (`module` or `template_family`)
- scope value
- current active version pointer, if any

### 10.2 `model_routing_policy_versions`

Immutable version payloads.

Should capture:

- policy ID
- version number or version ID
- primary model
- ordered fallback list
- linked evidence references
- release notes
- status

### 10.3 `model_routing_policy_decisions`

Action log for governance moves.

Should capture:

- policy version
- decision kind
- actor
- reason
- evidence references
- timestamp

### 10.4 Additive `agent_execution_log` extension

`AgentExecutionLog` should capture routing-governance usage for auditability, including:

- matched routing-policy version ID
- matched scope kind and scope value
- actual model used
- whether fallback occurred
- fallback reason

Phase 10B should avoid creating a separate routing-execution log unless a future phase proves the existing execution log is insufficient.

## 11. Runtime Resolution Boundary

At live execution time, the system should resolve two governance layers in parallel:

- `Runtime Binding`
- `Model Routing Policy`

The model-routing resolver should:

1. determine template-family context if available
2. look for an active `template_family` policy
3. otherwise look for an active `module` policy
4. otherwise use the current default model path

This phase should not rewrite `RuntimeBinding` into the model-routing source of truth.

## 12. Admin And Workbench Responsibilities

### 12.1 Admin Governance Console

This is the authoritative operator surface for:

- browsing candidate evidence for routing changes
- drafting policy
- submitting for review
- approving
- activating
- rolling back

It should also show:

- current active model by scope
- fallback chain
- linked evidence
- prior decisions and supersession history

### 12.2 Evaluation Workbench

This remains the evidence surface.

It should support:

- evidence inspection
- comparison signals
- recommendation summaries
- links that governance can cite

It should **not** directly activate routing policy.

## 13. Verification Strategy

Phase 10B must prove three facts:

- policy can be governed end-to-end
- runtime can read active policy safely
- policy use and fallback remain auditable

### 13.1 Contract and service tests

Add tests proving:

- policy lifecycle transitions are valid
- only `active` policy can be resolved by runtime
- `template_family` outranks `module`
- rejected, rolled-back, or superseded versions are not used as live policy

### 13.2 Persistence tests

Add tests proving:

- policy versions and decision records round-trip correctly
- rollback preserves history instead of overwriting it
- execution log additions persist correctly

### 13.3 Runtime integration tests

Add tests proving:

- screening, editing, and proofreading can resolve the correct active model
- approved fallback executes only for allowed runtime-failure conditions
- no-policy scenarios safely use the existing default path

### 13.4 Admin and workbench tests

Add tests proving:

- `Admin Governance Console` can create, review, activate, and roll back policy
- evidence references can be attached to policy versions
- `Evaluation Workbench` can provide evidence context without becoming the control plane

### 13.5 Browser verification

Add at least one browser-level path proving:

`inspect evidence -> create policy draft -> approve and activate -> trigger governed execution -> inspect routing hit and fallback audit`

## 14. Main Risks

The main risks in Phase 10B are boundary failures, not just code failures.

### 14.1 Boundary expansion

Risk:

- the phase grows into automatic promotion, rollout automation, or rollback orchestration

Mitigation:

- keep all routing changes human-approved
- keep activation separate from approval

### 14.2 Object mixing

Risk:

- `runtime binding` and `routing policy` get merged into one confusing governance object

Mitigation:

- preserve separate ownership and persistence boundaries

### 14.3 Evidence-light approval

Risk:

- operators approve policy without durable evidence references

Mitigation:

- require evidence linkage on approval actions

### 14.4 Precedence ambiguity

Risk:

- `module` and `template_family` policy conflict at runtime

Mitigation:

- codify precedence as `template_family > module > existing default`

### 14.5 Fallback drift

Risk:

- runtime performs repeated or unclear fallback changes

Mitigation:

- bounded fallback count
- explicit trigger categories
- additive execution-log audit

## 15. Out Of Scope

Phase 10B explicitly excludes:

- automatic model promotion
- automatic gray-release expansion
- automatic rollback
- manuscript-type-level strategy
- knowledge-item-level strategy
- one-off operator override control planes
- async workers or `Temporal`
- turning `Evaluation Workbench` into the governance control plane

These belong to later phases such as deeper evaluation operations, orchestration, or production hardening.

## 16. Expected Outcome

After Phase 10B:

- the repository will have a first-class governed routing-policy layer
- model-routing changes will require evidence and human approval
- live runtime will be able to consume activated policy instead of relying only on static defaults
- fallback behavior will become governed and auditable
- model governance, evaluation evidence, and runtime behavior will finally form one traceable loop

That is the intended scope of this phase.
