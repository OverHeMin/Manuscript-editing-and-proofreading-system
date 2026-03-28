# Phase 4 Agent Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire screening, editing, and proofreading through an admin-governed `Agent Runtime` layer with module-level `AgentProfile`, `RuntimeBinding`, `SandboxProfile`, `ToolPermissionPolicy`, `AgentExecutionLog`, and admin-only verification hooks.

**Architecture:** Keep Phase 3 `ModuleExecutionProfile` as the canonical business-context source, then add a second additive governance layer for runtime execution. Resolve runtime, profile, tool permissions, and verification expectations through a dedicated `GovernedAgentContextResolver`, and record one `AgentExecutionLog` per real module run without weakening current execution-tracking or learning-governance guarantees.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing in-memory repositories, current execution-governance/execution-tracking modules, current web feature-client pattern.

---

## Scope Notes

- This phase is still backend-first and admin-first.
- Business users remain consumers of wrapped screening/editing/proofreading flows only.
- `superpowers`, `gstack`, and `subagent` stay fixed as platform responsibilities; this phase productizes those responsibilities into governed system assets instead of changing the role model.
- The Phase 4 admin verification surface should stop at registry + typed-client + evidence-log level. It should not try to ship a full browser-runner orchestration UI in the same cut.

## Planned File Structure

- Modify: `packages/contracts/src/agent-tooling.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/type-tests/agent-tooling-phase4.test.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-record.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-repository.ts`
- Modify: `apps/api/src/modules/agent-runtime/in-memory-agent-runtime-repository.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-service.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-api.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-record.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-repository.ts`
- Modify: `apps/api/src/modules/tool-gateway/in-memory-tool-gateway-repository.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-service.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-api.ts`
- Create: `apps/api/src/modules/sandbox-profiles/sandbox-profile-record.ts`
- Create: `apps/api/src/modules/sandbox-profiles/sandbox-profile-repository.ts`
- Create: `apps/api/src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts`
- Create: `apps/api/src/modules/sandbox-profiles/sandbox-profile-service.ts`
- Create: `apps/api/src/modules/sandbox-profiles/sandbox-profile-api.ts`
- Create: `apps/api/src/modules/sandbox-profiles/index.ts`
- Create: `apps/api/src/modules/agent-profiles/agent-profile-record.ts`
- Create: `apps/api/src/modules/agent-profiles/agent-profile-repository.ts`
- Create: `apps/api/src/modules/agent-profiles/in-memory-agent-profile-repository.ts`
- Create: `apps/api/src/modules/agent-profiles/agent-profile-service.ts`
- Create: `apps/api/src/modules/agent-profiles/agent-profile-api.ts`
- Create: `apps/api/src/modules/agent-profiles/index.ts`
- Create: `apps/api/src/modules/runtime-bindings/runtime-binding-record.ts`
- Create: `apps/api/src/modules/runtime-bindings/runtime-binding-repository.ts`
- Create: `apps/api/src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts`
- Create: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- Create: `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
- Create: `apps/api/src/modules/runtime-bindings/index.ts`
- Create: `apps/api/src/modules/tool-permission-policies/tool-permission-policy-record.ts`
- Create: `apps/api/src/modules/tool-permission-policies/tool-permission-policy-repository.ts`
- Create: `apps/api/src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts`
- Create: `apps/api/src/modules/tool-permission-policies/tool-permission-policy-service.ts`
- Create: `apps/api/src/modules/tool-permission-policies/tool-permission-policy-api.ts`
- Create: `apps/api/src/modules/tool-permission-policies/index.ts`
- Create: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Create: `apps/api/src/modules/agent-execution/agent-execution-repository.ts`
- Create: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
- Create: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Create: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Create: `apps/api/src/modules/agent-execution/index.ts`
- Create: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Create: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Create: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Create: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Create: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Create: `apps/api/src/modules/verification-ops/index.ts`
- Create: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/test/agent-runtime/agent-runtime-registry.spec.ts`
- Modify: `apps/api/test/tool-gateway/tool-gateway.spec.ts`
- Create: `apps/api/test/sandbox-profiles/sandbox-profile-registry.spec.ts`
- Create: `apps/api/test/agent-profiles/agent-profile-registry.spec.ts`
- Create: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`
- Create: `apps/api/test/tool-permission-policies/tool-permission-policy.spec.ts`
- Create: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
- Create: `apps/api/test/verification-ops/verification-ops.spec.ts`
- Create: `apps/api/test/modules/governed-agent-context-resolver.spec.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`
- Modify: `apps/web/src/features/agent-runtime/types.ts`
- Modify: `apps/web/src/features/agent-runtime/agent-runtime-api.ts`
- Modify: `apps/web/src/features/agent-runtime/index.ts`
- Modify: `apps/web/src/features/tool-gateway/types.ts`
- Modify: `apps/web/src/features/tool-gateway/tool-gateway-api.ts`
- Modify: `apps/web/src/features/tool-gateway/index.ts`
- Create: `apps/web/src/features/sandbox-profiles/types.ts`
- Create: `apps/web/src/features/sandbox-profiles/sandbox-profile-api.ts`
- Create: `apps/web/src/features/sandbox-profiles/index.ts`
- Create: `apps/web/src/features/agent-profiles/types.ts`
- Create: `apps/web/src/features/agent-profiles/agent-profile-api.ts`
- Create: `apps/web/src/features/agent-profiles/index.ts`
- Create: `apps/web/src/features/runtime-bindings/types.ts`
- Create: `apps/web/src/features/runtime-bindings/runtime-binding-api.ts`
- Create: `apps/web/src/features/runtime-bindings/index.ts`
- Create: `apps/web/src/features/tool-permission-policies/types.ts`
- Create: `apps/web/src/features/tool-permission-policies/tool-permission-policy-api.ts`
- Create: `apps/web/src/features/tool-permission-policies/index.ts`
- Create: `apps/web/src/features/agent-execution/types.ts`
- Create: `apps/web/src/features/agent-execution/agent-execution-api.ts`
- Create: `apps/web/src/features/agent-execution/index.ts`
- Create: `apps/web/src/features/verification-ops/types.ts`
- Create: `apps/web/src/features/verification-ops/verification-ops-api.ts`
- Create: `apps/web/src/features/verification-ops/index.ts`
- Create: `apps/web/src/features/phase4-agent-runtime.type-test.ts`

### Task 1: Extend Shared Agent Tooling Contracts For Phase 4

**Files:**
- Modify: `packages/contracts/src/agent-tooling.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/agent-tooling-phase4.test.ts`

- [ ] **Step 1: Write the failing type test**

```ts
import type {
  SandboxProfile,
  AgentProfile,
  RuntimeBinding,
  ToolPermissionPolicy,
  AgentExecutionLog,
  EvaluationSuite,
  EvaluationRun,
  ReleaseCheckProfile,
  VerificationCheckProfile,
} from "../src/index.js";

export const sandboxProfileModeCheck: SandboxProfile["sandbox_mode"] = "workspace_write";
export const agentProfileRoleCheck: AgentProfile["role_key"] = "gstack";
export const runtimeBindingStatusCheck: RuntimeBinding["status"] = "active";
export const toolPolicyModeCheck: ToolPermissionPolicy["default_mode"] = "read";
export const executionLogStatusCheck: AgentExecutionLog["status"] = "completed";
export const evaluationSuiteTypeCheck: EvaluationSuite["suite_type"] = "regression";
export const evaluationRunStatusCheck: EvaluationRun["status"] = "passed";
export const releaseCheckProfileTypeCheck: ReleaseCheckProfile["check_type"] =
  "deploy_verification";
export const verificationProfileTypeCheck: VerificationCheckProfile["check_type"] =
  "browser_qa";
```

- [ ] **Step 2: Run typecheck to verify missing exports fail**

Run: `pnpm --filter @medical/contracts typecheck`  
Expected: FAIL because the Phase 4 agent-governance contracts do not exist yet

- [ ] **Step 3: Implement the minimal shared contracts**

Implementation rules:

- extend `AgentRuntime` with explicit publish lifecycle and sandbox metadata
- add `SandboxProfile`
- add `AgentProfile`
- add `RuntimeBinding`
- add `ToolPermissionPolicy`
- add `AgentExecutionLog`
- add `EvaluationSuite`
- add `EvaluationRun`
- add `ReleaseCheckProfile`
- add `VerificationCheckProfile` and `VerificationEvidence`
- keep the contracts admin-governed and additive; do not weaken current business-module contracts

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medical/contracts typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add phase 4 agent tooling contracts"
```

### Task 2: Strengthen Runtime And Tool Catalog Governance

**Files:**
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-record.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-repository.ts`
- Modify: `apps/api/src/modules/agent-runtime/in-memory-agent-runtime-repository.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-service.ts`
- Modify: `apps/api/src/modules/agent-runtime/agent-runtime-api.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-record.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-repository.ts`
- Modify: `apps/api/src/modules/tool-gateway/in-memory-tool-gateway-repository.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-service.ts`
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-api.ts`
- Test: `apps/api/test/agent-runtime/agent-runtime-registry.spec.ts`
- Test: `apps/api/test/tool-gateway/tool-gateway.spec.ts`

- [ ] **Step 1: Write the failing governance tests**

Add expectations for:

- runtime publish/activate flow
- one active runtime per adapter or named runtime slot
- runtime lookups filtered by module
- tool catalog supports Phase 4 scopes such as `browser_qa`, `benchmark`, and `deploy_verification`
- tool catalog remains admin-only

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- agent-runtime`  
Expected: FAIL because runtime publish lifecycle and lookup helpers are missing

Run: `pnpm --filter @medical/api test -- tool-gateway`  
Expected: FAIL because Phase 4 scopes and policy lookups are missing

- [ ] **Step 3: Implement the minimal registry hardening**

Implementation rules:

- preserve the current admin-only boundary
- add explicit `publishRuntime` or equivalent activate path; do not leave production runtimes in ad-hoc `draft`
- expand the tool catalog enum carefully instead of overloading old values
- expose lookup helpers the binding layer can use directly

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- agent-runtime`  
Expected: PASS

Run: `pnpm --filter @medical/api test -- tool-gateway`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/agent-runtime apps/api/src/modules/tool-gateway apps/api/test/agent-runtime apps/api/test/tool-gateway
git commit -m "feat: harden agent runtime and tool catalog governance"
```

### Task 3: Add Sandbox Profiles, Agent Profiles, Runtime Bindings, And Tool Permission Policies

**Files:**
- Create: `apps/api/src/modules/sandbox-profiles/*`
- Create: `apps/api/src/modules/agent-profiles/*`
- Create: `apps/api/src/modules/runtime-bindings/*`
- Create: `apps/api/src/modules/tool-permission-policies/*`
- Test: `apps/api/test/sandbox-profiles/sandbox-profile-registry.spec.ts`
- Test: `apps/api/test/agent-profiles/agent-profile-registry.spec.ts`
- Test: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`
- Test: `apps/api/test/tool-permission-policies/tool-permission-policy.spec.ts`

- [ ] **Step 1: Write the failing registry tests**

Test for:

- only `admin` can create or activate records
- `SandboxProfile` captures filesystem/network/tool risk posture and can be archived without mutating active history
- `AgentProfile` can represent fixed platform roles such as `superpowers`, `gstack`, and `subagent`
- one active `RuntimeBinding` exists per `module + manuscript_type + template_family_id`
- `RuntimeBinding` can only reference active runtime, active sandbox profile, published prompt/skill assets, and active tool permission policy
- `ToolPermissionPolicy` defaults to read-first and can restrict high-risk tools to explicit allowlists

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- agent-profile`  
Expected: FAIL because the module does not exist yet

Run: `pnpm --filter @medical/api test -- sandbox-profile`  
Expected: FAIL because the module does not exist yet

Run: `pnpm --filter @medical/api test -- runtime-binding`  
Expected: FAIL because the module does not exist yet

Run: `pnpm --filter @medical/api test -- tool-permission-policy`  
Expected: FAIL because the module does not exist yet

- [ ] **Step 3: Implement the minimal admin registries**

Implementation rules:

- keep `SandboxProfile` as an explicit governed asset instead of burying sandbox metadata inside runtime records
- keep records immutable by version once active; prefer archive + republish over in-place mutation
- separate tool catalog from tool permission policy
- bind module runtime choice additively on top of Phase 3 execution governance instead of folding everything into `ModuleExecutionProfile`
- allow Phase 4 bindings to reference Phase 3 `prompt_template_id` and `skill_package_ids` without duplicating those assets

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- agent-profile`  
Expected: PASS

Run: `pnpm --filter @medical/api test -- sandbox-profile`  
Expected: PASS

Run: `pnpm --filter @medical/api test -- runtime-binding`  
Expected: PASS

Run: `pnpm --filter @medical/api test -- tool-permission-policy`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/sandbox-profiles apps/api/src/modules/agent-profiles apps/api/src/modules/runtime-bindings apps/api/src/modules/tool-permission-policies apps/api/test/sandbox-profiles apps/api/test/agent-profiles apps/api/test/runtime-bindings apps/api/test/tool-permission-policies
git commit -m "feat: add phase 4 runtime bindings sandbox profiles and tool permission policies"
```

### Task 4: Add Governed Agent Context Resolution

**Files:**
- Create: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Test: `apps/api/test/modules/governed-agent-context-resolver.spec.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
test("resolver returns the active runtime binding with profile, runtime, tool policy, and verification expectations", async () => {
  const context = await resolveGovernedAgentContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    actorId: "admin-1",
    actorRole: "admin",
    jobId: "job-1",
    manuscriptRepository,
    executionGovernanceService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    toolPermissionPolicyService,
  });

  assert.equal(context.agentProfile.role_key, "subagent");
  assert.equal(context.runtime.id, "runtime-1");
  assert.equal(context.toolPolicy.id, "policy-1");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- governed-agent-context-resolver`  
Expected: FAIL because the resolver does not exist

- [ ] **Step 3: Implement the resolver**

Implementation rules:

- take the existing Phase 3 execution context as input instead of recomputing prompt/skill selections from scratch
- fail explicitly when no active `RuntimeBinding` exists for the current governed module scope
- return the chosen runtime, profile, sandbox profile, tool policy, and required verification hooks together
- keep role exposure admin-controlled; business-module callers should only receive the governed result they need

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- governed-agent-context-resolver`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/shared apps/api/test/modules/governed-agent-context-resolver.spec.ts
git commit -m "feat: add governed agent context resolver"
```

### Task 5: Add Agent Execution Logs And Wire The Three Business Modules

**Files:**
- Create: `apps/api/src/modules/agent-execution/*`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`
- Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`

- [ ] **Step 1: Write the failing execution-log tests**

Add expectations for:

- one `AgentExecutionLog` per real module run
- the log stores `runtime_id`, `agent_profile_id`, `runtime_binding_id`, `tool_permission_policy_id`, `execution_snapshot_id`, and `verification_evidence_ids`
- proofreading final confirmation reuses the draft-stage governed log linkage instead of silently creating an unrelated final-only log

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- agent-execution`  
Expected: FAIL because the module does not exist yet

Run: `pnpm --filter @medical/api test -- modules`  
Expected: FAIL because module outputs do not include Phase 4 runtime metadata yet

- [ ] **Step 3: Implement the execution log layer and module integration**

Implementation rules:

- do not replace Phase 3 `ModuleExecutionSnapshot`; log records should reference it
- record which runtime, profile, sandbox, and tool policy governed the run
- screening/editing can emit final results directly
- proofreading final confirmation must preserve linkage to the draft log and draft snapshot
- add module response fields additively: `agent_runtime_id`, `agent_profile_id`, `agent_execution_log_id`

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- agent-execution`  
Expected: PASS

Run: `pnpm --filter @medical/api test -- modules`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/agent-execution apps/api/src/modules/screening apps/api/src/modules/editing apps/api/src/modules/proofreading apps/api/test/agent-execution apps/api/test/modules
git commit -m "feat: route manuscript modules through governed agent runtime"
```

### Task 6: Add Verification Ops Registry And Admin Typed Web Clients

**Files:**
- Create: `apps/api/src/modules/verification-ops/*`
- Modify: `apps/web/src/features/agent-runtime/*`
- Modify: `apps/web/src/features/tool-gateway/*`
- Create: `apps/web/src/features/sandbox-profiles/*`
- Create: `apps/web/src/features/agent-profiles/*`
- Create: `apps/web/src/features/runtime-bindings/*`
- Create: `apps/web/src/features/tool-permission-policies/*`
- Create: `apps/web/src/features/agent-execution/*`
- Create: `apps/web/src/features/verification-ops/*`
- Test: `apps/api/test/verification-ops/verification-ops.spec.ts`
- Test: `apps/web/src/features/phase4-agent-runtime.type-test.ts`

- [ ] **Step 1: Write the failing verification and web type tests**

Expected types:

```ts
type VerificationCheckType = "browser_qa" | "benchmark" | "deploy_verification";
type AgentExecutionStatus = "queued" | "running" | "completed" | "failed";
type EvaluationSuiteType = "regression" | "release_gate";
```

Add a dedicated web type-test that imports all new admin feature clients together.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: FAIL because the verification registry does not exist yet

Run: `pnpm --filter @medsys/web typecheck`  
Expected: FAIL because the new Phase 4 admin clients do not exist yet

- [ ] **Step 3: Implement the minimal admin-only verification slice**

Implementation rules:

- store `VerificationCheckProfile`, `ReleaseCheckProfile`, `EvaluationSuite`, and `EvaluationRun` as explicit admin-only records
- store `VerificationEvidence` as auditable links or records, not raw browser-runner internals
- make `ReleaseCheckProfile` the named release-verification asset and `EvaluationSuite` / `EvaluationRun` the named regression-evidence assets instead of hiding them behind generic blobs
- keep the web layer page-less for now: typed feature clients only
- update the existing `agent-runtime` and `tool-gateway` web clients to match new API surfaces instead of creating duplicate admin registries

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: PASS

Run: `pnpm --filter @medsys/web typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/verification-ops apps/api/test/verification-ops apps/web/src/features/agent-runtime apps/web/src/features/tool-gateway apps/web/src/features/sandbox-profiles apps/web/src/features/agent-profiles apps/web/src/features/runtime-bindings apps/web/src/features/tool-permission-policies apps/web/src/features/agent-execution apps/web/src/features/verification-ops apps/web/src/features/phase4-agent-runtime.type-test.ts
git commit -m "feat: add phase 4 admin verification and runtime clients"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/contracts typecheck`
- [ ] Run: `pnpm --filter @medical/api test -- agent-runtime`
- [ ] Run: `pnpm --filter @medical/api test -- tool-gateway`
- [ ] Run: `pnpm --filter @medical/api test -- sandbox-profile`
- [ ] Run: `pnpm --filter @medical/api test -- agent-profile`
- [ ] Run: `pnpm --filter @medical/api test -- runtime-binding`
- [ ] Run: `pnpm --filter @medical/api test -- tool-permission-policy`
- [ ] Run: `pnpm --filter @medical/api test -- governed-agent-context-resolver`
- [ ] Run: `pnpm --filter @medical/api test -- agent-execution`
- [ ] Run: `pnpm --filter @medical/api test -- verification-ops`
- [ ] Run: `pnpm --filter @medical/api test -- modules`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- Screening, editing, and proofreading each resolve through an active Phase 4 `RuntimeBinding` in addition to the existing Phase 3 execution profile.
- `AgentProfile`, `RuntimeBinding`, and `ToolPermissionPolicy` remain admin-governed and do not leak raw runtime control to business users.
- `SandboxProfile` remains a first-class governed asset and each agent execution log can answer which sandbox policy actually applied.
- Real module runs emit `AgentExecutionLog` records that can answer which runtime, profile, tool policy, and verification evidence were used.
- Proofreading final confirmation preserves the draft-stage agent-execution linkage.
- Admin verification hooks are stored as explicit `ReleaseCheckProfile`, `EvaluationSuite`, `EvaluationRun`, and evidence references, ready for later deeper `gstack`-style integration.
- Web code stays consistent with the current repo pattern: typed feature clients first, no premature page implementation.
