# Phase 11A Runtime Binding Readiness Preflight Design

**Date:** 2026-04-05  
**Status:** Proposed for immediate implementation after Phase 10 closeout  
**Scope:** Add one additive, read-only readiness report for runtime bindings so operators can see whether the active binding for a governed execution scope is still executable before the manuscript mainline hits a late runtime-resolution failure.

## 1. Goal

`Phase 10J-10W` closed the durable orchestration baseline:

- business completion is now separated from governed follow-up completion
- follow-up retries are bounded and restart-safe
- recovery and residual posture are locally observable

The next mainline-serving gap is earlier in the execution path:

- `runtime binding` activation already checks dependency state at activation time
- but active bindings can still drift later when upstream runtime, sandbox, prompt, skill, or execution-profile assets change
- the current system mostly discovers that drift only when governed execution resolves the agent context during real module execution

In one sentence:

`Phase 11A` should add a repo-owned, read-only readiness preflight for runtime bindings so execution-facing drift becomes explainable before it breaks governed mainline execution.

## 2. Why This Slice Exists

The repository already has:

- active runtime binding selection by `module + manuscript type + template family`
- governed module-context resolution
- governed agent-context resolution
- execution-profile publication rules
- runtime/sandbox/prompt/skill/policy registries with explicit status rules

What is missing is a narrow inspection layer that answers:

- which binding would mainline execution use right now
- whether that binding is still executable
- which exact dependency or compatibility rule is degraded
- whether the binding has drifted away from the active execution profile that the governed mainline would now resolve

This is a better next step than reopening orchestration under `10X+`, and it stays within the fresh `Agent Runtime Platform` lane without turning into a new control surface.

## 3. Recommended Option

### Option A: Tighten activation rules only

Pros:

- small surface area

Cons:

- only protects future activations
- does not explain drift in already-active bindings
- still leaves operators learning about readiness problems only after a failed execution or a failed activation attempt

Not recommended for this slice.

### Option B: Add a read-only readiness report over existing runtime-binding and execution-profile state

Pros:

- catches current active-scope drift before real execution
- keeps existing activation and routing contracts unchanged
- stays local-first and fail-open
- directly serves mainline execution safety without creating a new workbench or control plane

Cons:

- requires additive read-model logic across runtime binding and execution governance

Recommended.

### Option C: Build a larger runtime-control console or automatic remediation flow

Pros:

- could provide richer operator workflows later

Cons:

- expands into control-plane and workbench scope
- violates the current request to avoid peripheral-plane expansion

Out of scope.

## 4. Hard Boundaries

### 4.1 Read-only only

This phase may:

- inspect a specific binding by id
- inspect the currently active binding for a governed scope
- explain degraded dependency state and compatibility drift

This phase must not:

- auto-activate a binding
- auto-archive a binding
- auto-switch runtime, prompt, or skill assets
- auto-repair drift

### 4.2 Do not become a new execution gate

The readiness report is additive evidence.

It must not:

- change `createBinding`
- change `activateBinding`
- change runtime routing order
- change governed execution resolution rules
- become a hard startup prerequisite

If the new report path itself fails, the repository should degrade to the prior behavior rather than block existing execution or governance APIs.

### 4.3 Mainline-serving, not control-plane expansion

This slice exists to reduce late surprises on:

- `screening`
- `editing`
- `proofreading-final`
- any future governed module path that depends on the same binding contract

It does not create:

- a new admin dashboard
- a new workbench
- a routing control plane
- a release control plane

### 4.4 Keep existing authority boundaries

The new readiness report may read:

- runtime binding records
- runtime records
- sandbox profiles
- agent profiles
- tool permission policies
- prompt templates
- skill packages
- execution profiles
- verification and release check references already attached to the binding

It must not redefine ownership:

- `execution-governance` remains authoritative for execution profiles
- `prompt-skill-registry` remains authoritative for prompt and skill publication state
- `runtime-bindings` remains authoritative for activation state
- `verification-ops` remains authoritative for suites and check profiles

## 5. Readiness Questions To Answer

The report should answer the following questions for a binding or active scope:

1. Is there an active binding for this governed scope right now?
2. Are the binding's dependency assets still in the required lifecycle state?
3. Are those assets still compatible with the binding scope?
4. If the binding pins an `execution_profile_id`, does that profile still exist and remain active?
5. Does the binding's prompt / skill package set still align with the active execution profile for the same scope?
6. Are the binding's verification references still published or active?

## 6. Proposed Report Shape

The exact field names can stay implementation-sized, but the report should conceptually include:

- `scope`
- `binding`
- `status`
  - `ready`
  - `degraded`
  - `missing`
- `issues[]`
- `resolved_dependencies`
- `execution_profile_alignment`

Each issue should be machine-readable enough to support future local operators and tests, for example:

- `missing_active_binding`
- `runtime_not_active`
- `runtime_module_incompatible`
- `sandbox_not_active`
- `runtime_sandbox_mismatch`
- `agent_profile_not_published`
- `agent_profile_scope_mismatch`
- `tool_permission_policy_not_active`
- `prompt_template_not_published`
- `prompt_template_scope_mismatch`
- `skill_package_not_published`
- `skill_package_scope_mismatch`
- `verification_check_profile_not_published`
- `evaluation_suite_not_active`
- `release_check_profile_not_published`
- `execution_profile_missing`
- `execution_profile_not_active`
- `execution_profile_scope_mismatch`
- `binding_execution_profile_drift`
- `binding_prompt_drift`
- `binding_skill_package_drift`

The report is allowed to include multiple issues at once.
That is important because operators need the full readiness story, not only the first failure.

## 7. Recommended Architecture

### 7.1 Add a dedicated readiness service

Introduce one additive service near the runtime-binding module that:

- reads binding state by id
- resolves the active binding for a scope
- loads the referenced runtime assets
- optionally resolves the active execution profile for the same scope
- produces one readiness report object

This should be a new read-model layer, not a rewrite of existing activation logic.

### 7.2 Reuse existing services and repositories

The readiness service should reuse existing authoritative readers where practical:

- `RuntimeBindingService`
- `AgentRuntimeService`
- `SandboxProfileService`
- `AgentProfileService`
- `ToolPermissionPolicyService`
- `PromptSkillRegistryRepository` or service readers
- `ExecutionGovernanceService`
- `VerificationOpsRepository`

This keeps the contract aligned with real runtime state instead of duplicating state in another table.

### 7.3 Expose read-only API methods only

The minimal slice should expose:

- `getBindingReadiness(bindingId)`
- `getActiveBindingReadinessForScope(module, manuscriptType, templateFamilyId)`

These may be surfaced through the existing governance HTTP API, but no new UI is required in this phase.

### 7.4 Execution-profile drift is additive evidence

`runtime binding` already stores an optional `execution_profile_id`, but current activation rules do not fully validate its later runtime usefulness.

This phase should not retroactively harden activation behavior.
Instead, it should surface readiness issues such as:

- binding points to a missing or archived execution profile
- binding points to a profile whose prompt template differs from the active scope profile
- binding points to a profile whose skill package set differs from the active scope profile

That gives a mainline-serving operator signal without destabilizing current contracts.

## 8. Error Handling And Fail-Open Rules

### 8.1 No new persistent write path

The readiness report must not write:

- audit rows
- execution rows
- repair hints
- operator actions

This is an in-memory assembled report over existing persisted governance state.

### 8.2 Missing inspection capability must degrade cleanly

If the readiness route or service is unavailable:

- existing create/list/get/activate/archive binding behavior must continue unchanged
- existing governed execution behavior must continue unchanged
- the absence of readiness reporting is not itself a production blocker

### 8.3 Report all applicable issues when possible

Prefer a bounded multi-issue report over fail-fast throwing for the first mismatch.

That keeps the operator story useful and avoids a loop of repeated inspect-fix-inspect just to discover the next issue.

## 9. Out Of Scope

`Phase 11A` does not include:

- automatic remediation
- activation hardening
- boot-time readiness enforcement
- a new CLI control surface unless later needed for the same report
- workbench UI additions
- routing policy changes
- orchestration engine changes
- queue or worker infrastructure

## 10. Related Capability Lane

This slice advances:

- `Agent Runtime Platform`

It builds on:

- `2026-04-03-phase9r-runtime-binding-verification-linkage-design.md`
- `2026-04-03-retained-capability-phase-mapping.md`
- `2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- the current governed module and governed agent context resolvers in `apps/api`

It explicitly does not reopen:

- the closed `Phase 10` orchestration sequence
- harness expansion
- control-plane expansion
- release automation
