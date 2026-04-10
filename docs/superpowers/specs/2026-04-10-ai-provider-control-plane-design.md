# AI Provider Control Plane Design

**Date:** 2026-04-10  
**Status:** Proposed  
**Audience:** Product owner, backend governance, web governance, internal trial operators

---

## 1. Core Decision

Before continuing the broader public beta governance work, the system needs a dedicated
`AI Provider Control Plane`.

This phase should add a governed way to:

- store and manage shared AI provider connections inside the system
- store provider credentials in the system instead of requiring environment-only setup
- bind registered models to configured provider connections
- route different business modules to different models, including mixed domestic and foreign providers
- test connection readiness before live usage

One sentence:

`Keys, connections, models, and module routing must become separate layers.`

This phase is intentionally scoped for internal trial, not universal provider parity.

Required end-state for this phase:

- shared backend-managed connections work for `Qwen`, `DeepSeek`, and at least one foreign provider
- the system can mix those providers across `screening`, `editing`, and `proofreading`
- operators can test and inspect those connections before real jobs use them

Anything beyond that should only be included if it does not materially delay this scope.

---

## 2. Problem This Phase Solves

The current repository already has:

- `model registry`
- `legacy routing policy`
- governed model routing for module and template-family scope
- execution bundle resolution preview

But it does not yet have a true provider connection layer.

Today that means:

- models are treated mostly as static registry entries
- provider choice is too tightly coupled to the model record
- there is no first-class place for operators to enter or rotate API keys in the backend
- domestic providers such as `Qwen` and `DeepSeek` cannot be managed as first-class operational connections
- mixed routing is harder than it should be because the system cannot cleanly express `module -> model -> connection -> credential`

For internal trial, this is the wrong operator experience.

The operator goal is simple:

- open the backend
- configure one or more provider connections
- enter API keys
- register usable models against those connections
- assign different modules to different models
- verify the chosen combination is ready before real jobs use it

---

## 3. Recommended Four-Layer Model

### 3.1 Connection Control Layer

This layer owns operational provider connectivity.

It should answer:

- which AI endpoint are we calling
- which compatibility protocol does it use
- is it enabled
- when was it last tested
- did the last connectivity test pass

This layer should not decide:

- which module uses which model
- which prompt or template version is active

### 3.2 Model Definition Layer

This layer owns usable model entries.

It should answer:

- which model name is exposed to governance
- which modules it is allowed to serve
- whether it is production-allowed
- which connection it uses
- which fallback model is available

This layer should not store raw secrets.

### 3.3 Module Routing Layer

This layer owns business selection.

It should answer:

- which model `screening` uses
- which model `editing` uses
- which model `proofreading` uses
- which template-family or governed policy overrides the module default

This layer should keep using the existing routing concepts where possible.

### 3.4 Runtime Execution Layer

This layer turns governance choices into live API calls.

It should:

- resolve a governed model
- load the bound provider connection
- retrieve the encrypted credential
- choose the correct adapter by compatibility mode
- execute the request

This layer should fail clearly if required connection material is missing or disabled.

---

## 4. Map To The Current Repository

### Already Suitable To Reuse

- `apps/api/src/modules/model-registry/`
- `apps/api/src/modules/model-routing-governance/`
- `apps/api/src/modules/execution-resolution/`
- `apps/api/src/modules/runtime-bindings/`
- `apps/web/src/features/admin-governance/`
- `apps/web/src/features/system-settings/`

### Current Gaps

The repository does not yet show a complete self-service AI connection layer:

- no provider connection record in `prisma/schema.prisma`
- no credential storage abstraction for AI providers
- no system settings workbench section for provider connection management
- no model-registry binding from model entry to a managed connection
- no execution preview surface for connection readiness and source details

### Recommended New Surface

Add a new phase named:

`AI Provider Control Plane`

This phase should sit before the broader public beta harness and release-gate work,
because the system first needs a stable way to define what real AI backends exist.

---

## 5. Data Model

### 5.1 `AiProviderConnection`

Add a first-class connection table for operational provider configuration.

Recommended fields:

- `id`
- `name`
- `provider_kind`
- `compatibility_mode`
- `base_url`
- `enabled`
- `connection_metadata`
- `last_test_status`
- `last_test_at`
- `last_error_summary`
- `created_at`
- `updated_at`

`provider_kind` is for product semantics and backend presets.

In this phase:

- `openai` means the connection targets an OpenAI-operated endpoint and should be labeled and audited as `OpenAI`
- `openai_compatible` means the connection speaks an OpenAI-like protocol but is not an OpenAI-operated endpoint
- `qwen` and `deepseek` remain their own provider kinds for operator clarity even though they execute through the same compatibility mode in phase 1

For this phase, `provider_kind=openai` should only be allowed when the connection uses the official OpenAI endpoint preset.
If an administrator enters a custom `base_url`, the connection must be classified as `openai_compatible` instead.

`base_url` should store the provider API root used by runtime and testing:

- keep provider-required prefixes such as `/v1` when the endpoint requires them
- do not store request-specific paths such as `/chat/completions`
- normalize by trimming trailing slash before persistence

`connection_metadata` is for non-secret provider-specific settings such as:

- optional `test_model_name`
- optional `api_version`
- optional `deployment_name`
- other non-secret compatibility parameters

`last_test_status` in this phase should be narrowly defined as:

- `unknown`
- `passed`
- `failed`

Recommended first-pass values:

- `openai`
- `anthropic`
- `google`
- `azure_openai`
- `qwen`
- `deepseek`
- `openai_compatible`
- `local`

`compatibility_mode` is for runtime execution behavior.

Recommended first-pass values:

- `openai_responses`
- `openai_chat_compatible`
- `anthropic_messages`
- `google_generate_content`
- `azure_openai`

Phase-1 implementation scope must be narrower than the full enum surface.

This phase must fully support real execution for:

- `qwen`
- `deepseek`
- `openai`
- `openai_compatible`

This phase must fully support at least one working runtime adapter:

- `openai_chat_compatible`

Phase-1 mapping rule:

| Provider kind | Required compatibility mode | Execution requirement |
|---------------|-----------------------------|-----------------------|
| `qwen` | `openai_chat_compatible` | must work in phase 1 |
| `deepseek` | `openai_chat_compatible` | must work in phase 1 |
| `openai` | `openai_chat_compatible` | must work in phase 1 |
| `openai_compatible` | `openai_chat_compatible` | must work in phase 1 |

In other words, every provider required for internal trial executes through the same
`openai_chat_compatible` adapter in this phase. `provider_kind` affects presets, labels,
and audit grouping, but it does not create separate runtime adapter branches in phase 1.

A dedicated `openai_responses` adapter is forward-compatible but not required for phase completion.

The following may exist as reserved enum values or future presets, but they are not required
to have full adapter, form-specialization, or connectivity-test coverage in this phase:

- `anthropic`
- `google`
- `azure_openai`
- `local`
- `openai_responses`
- `anthropic_messages`
- `google_generate_content`

This design intentionally separates `provider_kind` from `compatibility_mode`.

That keeps the system flexible:

- `DeepSeek` and `Qwen` can start on `openai_chat_compatible`
- future domestic providers can be added without reworking the entire execution layer
- backend UI can still show provider-specific labels and presets

### 5.2 `AiProviderCredential`

Add a separate credential table for sensitive values.

Recommended fields:

- `id`
- `connection_id`
- `credential_ciphertext`
- `credential_mask`
- `credential_version`
- `last_rotated_at`
- `created_at`
- `updated_at`

This table should be `1:1` with `AiProviderConnection` for the first pass.

The system should:

- encrypt stored credentials at rest
- never return the full secret through list APIs
- expose only a masked preview such as `sk-***a562`
- support secret replacement without deleting the connection record

Credential rotation in this phase should overwrite the existing credential payload in place
while incrementing `credential_version`.

This phase does not require a separate credential history table.

If provider-specific extra fields are needed, they should live in structured encrypted payload,
not as many loosely protected plaintext columns.

Encryption should be handled at the application boundary using a system-managed master key
or equivalent protected secret source. This phase does not require full KMS integration, but
it does require that provider credentials are not stored or returned in plaintext.

For this phase, the master encryption key should come from a server-side environment variable.

For `openai_chat_compatible`, the minimum encrypted credential payload should be:

```json
{ "apiKey": "..." }
```

The runtime should send that credential as:

- `Authorization: Bearer <apiKey>`

Additional non-secret execution settings belong in `connection_metadata`, not in the encrypted credential payload.

### 5.3 Changes To `ModelRegistry`

`ModelRegistry` should evolve from a mostly static provider catalog into a usable execution model definition.

Recommended changes:

- add `connection_id`
- retain the existing `model_version` field as the stored optional version string
- keep `provider` temporarily for compatibility and migration
- eventually derive provider display from the bound connection

After this change, a model record means:

- a named model the governance layer is allowed to use
- bound to exactly one configured provider connection
- allowed for specific modules
- optionally bound to one fallback model through the existing `fallback_model_id` relationship

Examples:

- `qwen-max` -> `Qwen Production Connection`
- `deepseek-chat` -> `DeepSeek Primary Connection`
- `gpt-5.4` -> `OpenAI Global Connection`

### 5.4 Routing Records

Do not introduce a separate routing subsystem in this phase.

Keep using:

- legacy `ModelRoutingPolicy`
- governed `model-routing-governance` policies

The key change is that routing now points to model entries that themselves point to provider connections.

That is enough to support mixed routing without multiplying governance surfaces.

---

## 6. Admin Surface Design

### 6.1 `System Settings > AI Providers`

This is the right home for operational provider configuration.

This page should allow an administrator to:

- list existing provider connections
- create a new connection
- edit connection metadata
- save or rotate credentials
- enable or disable a connection
- run a connectivity test
- view the last test result and timestamp

This page should show:

- provider label
- connection name
- base URL
- compatibility mode
- enabled status
- masked key summary
- last test result

This page should not decide module routing.

### 6.2 `Admin Governance > Models & Routing`

This remains the right home for governance selection.

This page should allow an administrator to:

- create a model entry by selecting a configured provider connection
- view connection metadata alongside each model
- keep allowed-module and production-allowed controls
- optionally choose one fallback model using the existing model-registry fallback relationship
- assign different modules to different models
- preview resolved execution bundles

The model creation flow should change from:

- pick `provider`
- type `model name`

To:

- pick `connection`
- type `model name`
- optionally type `model version`, stored in the existing `model_version` field

### 6.3 Connectivity Test Contract

The connection test must use the same auth material and the same compatibility path the runtime will use.

For this phase, only `openai_chat_compatible` requires a fully implemented test contract.

That test should:

- use the configured base URL and encrypted credential
- require `connection_metadata.test_model_name`
- refuse to run when `test_model_name` is absent, returning a clear validation error to the admin UI
- run synchronously in the request path
- use one request attempt with `10s` timeout and no retry logic
- send one minimal real inference request to `POST {base_url}/chat/completions`
- use a tiny non-streaming payload with:
  - `model = connection_metadata.test_model_name`
  - `messages = [{ "role": "user", "content": "ping" }]`
  - `max_tokens = 1`
  - `temperature = 0`
- record request outcome, timestamp, and short error summary

Pass and fail semantics for this phase:

- `passed`: provider returns a valid success response for the probe request
- `failed`: network error, auth error, malformed response, invalid model, or provider error prevents a valid probe response
- `unknown`: no test has been run yet

The system should not use provider metadata endpoints as the primary probe for `openai_chat_compatible`,
because many compatible providers expose those inconsistently.

### 6.4 Execution Preview

The existing execution resolution preview is a strong foundation and should be extended, not replaced.

In addition to showing `resolved_model`, it should also show:

- resolved connection name
- provider kind
- compatibility mode
- enabled or disabled state
- last connection test status
- credential presence summary

That gives operators a practical answer to:

`If this module runs right now, which real backend will it hit, and is that backend ready?`

When a fallback model is configured, preview should also show:

- `primary model -> fallback model`

If the resolved model is still a legacy model without `connection_id` during migration step 1 or 2,
preview should show a `legacy_unbound` warning instead of blocking the workflow.

---

## 7. Runtime Resolution Model

The runtime path should become:

`module routing -> model registry entry -> provider connection -> encrypted credential -> adapter -> provider API`

### 7.1 Resolution Order

Resolution should continue to follow the current governance order:

- governed template-family policy
- governed module policy
- legacy template override
- legacy module default
- legacy system default

After a model is resolved, the runtime must additionally verify:

- the model has a bound connection
- the connection exists
- the connection is enabled
- the connection has valid credential material
- the adapter supports the connection compatibility mode

### 7.2 Adapter Strategy

First pass should prefer adapter-by-protocol, not adapter-by-brand.

That means:

- provider kind drives UI defaults and test helpers
- compatibility mode drives execution code paths

This keeps the system open for future expansion while keeping implementation scope controlled.

### 7.3 Readiness

The system already has a readiness observation pattern through execution resolution and runtime binding readiness.

This phase should extend that idea with provider connection readiness so the preview can surface:

- connection test health
- connection enablement state
- credential presence state
- adapter compatibility state

For this phase, connection test status is informational, not a hard runtime gate.

That means:

- `failed` test status does not by itself block execution
- `never tested` status does not by itself block execution
- preview and admin pages must show those states prominently
- runtime gating depends on structural requirements, not on the last test result

Runtime must still fail closed when structural requirements are missing:

- no bound connection
- missing connection record
- disabled connection
- missing valid credential
- unsupported compatibility mode

These fail-closed checks apply only after migration step 3 switches execution to connection-backed runtime.
During migration steps 1 and 2, legacy traffic remains valid even if active models do not yet have `connection_id`.

---

## 8. Security And Audit Requirements

This phase stores live provider credentials inside the system, so the security boundary must be explicit.

Minimum requirements:

- encrypt secrets at rest
- never echo full credentials back to the browser after save
- mask secrets in lists and detail responses
- restrict mutation endpoints to the `admin` role
- record audit logs for create, update, rotate, enable, disable, and test actions
- do not allow export endpoints that reveal raw credentials

Minimum audit-log payload for this phase:

- `actor`
- `action`
- `connection_id`
- optional `model_id`
- `timestamp`
- before or after summary metadata

For internal trial, credentials are intentionally system-shared, not per-user and not per-organization.

That is acceptable for this phase because:

- it matches the user-approved scope
- it keeps the operator workflow simple
- it reduces implementation surface before internal trial

It is not the final isolation model for a future multi-tenant product.

---

## 9. Error Handling Model

### 9.1 Configuration-Time Errors

Connection validation and connectivity testing should be visible but not overly blocking.

Recommended behavior:

- invalid form data blocks save
- connectivity test failure does not block save
- failed tests set `last_test_status = failed`
- untested connections remain `last_test_status = unknown`
- last error summary stays visible for operators

This allows operators to stage configuration before the provider is fully ready.

### 9.2 Execution-Time Errors

Execution should fail closed for missing critical provider state.

The runtime should reject execution when:

- no connection is bound
- the connection is missing
- the connection is disabled
- no valid credential is stored
- the compatibility mode has no adapter

The system should not silently jump to another provider unless a real fallback model has been explicitly governed.

Fallback semantics for this phase must be narrow and deterministic:

- fallback is allowed only when a valid primary model has already been resolved
- fallback is allowed only for transient provider-call failures such as timeout, rate limit, or upstream `5xx`
- fallback is not allowed for configuration errors such as missing connection, disabled connection, missing credential, or unsupported adapter
- fallback depth is one hop in this phase: `primary -> configured fallback`
- fallback configuration uses the existing `ModelRegistry.fallback_model_id` relationship
- every fallback event must be recorded in execution logs with the primary model, fallback model, reason, and timestamp

Execution preview should show the configured fallback chain, but preview does not simulate provider-failure behavior.

---

## 10. Testing Strategy

### 10.1 Unit Tests

Add unit coverage for:

- connection validation
- credential masking behavior
- model-to-connection binding validation
- compatibility mode adapter selection
- execution resolution with missing or disabled connection state

### 10.2 Integration Tests

Add integration coverage for:

- create connection
- save encrypted credential
- create model entry bound to connection
- resolve routing to the expected model and connection
- report readiness in execution preview
- run connectivity test and persist its result

### 10.3 Internal Trial Smoke Test

Before calling this phase ready for internal trial, operators should prove:

- at least one domestic provider works
- at least one foreign provider works
- different modules can resolve to different providers
- execution preview clearly shows the real backend path

Recommended validation set:

- `screening -> Qwen`
- `editing -> DeepSeek`
- `proofreading -> OpenAI`

---

## 11. Migration Plan

### 11.1 Step 1: Add New Tables Without Cutting Traffic

Add:

- `AiProviderConnection`
- `AiProviderCredential`
- nullable `connection_id` on `ModelRegistry`

Do not switch runtime execution yet.

### 11.2 Step 2: Add Admin Surfaces And Preview Support

Implement:

- provider management in `System Settings`
- model-to-connection selection in `Admin Governance`
- connection-aware execution preview

Existing model routing can remain functional during this step.

### 11.3 Step 3: Switch Runtime Execution To Connection-Backed Calls

Only after operators can populate real connections and bind active models should execution change to use:

- resolved model
- bound connection
- encrypted credential
- compatibility adapter

### 11.4 Step 4: Tighten Constraints After Backfill

After active production models are backfilled:

- require `connection_id` for production-allowed models
- reduce reliance on direct provider fields on model registry

This phased migration minimizes risk and avoids a hard cutover.

---

## 12. Explicit Non-Goals For This Phase

This phase should not attempt to solve everything about AI orchestration.

Out of scope:

- per-user credential isolation
- per-organization credential isolation
- automatic latency or cost-based provider switching
- highly granular routing such as per-journal or per-template prompt-level model selection
- harness-driven automatic production promotion
- comprehensive billing and usage analytics

These may become future phases, but they should not block internal-trial readiness.

---

## 13. Acceptance Criteria

This phase is successful when all of the following are true:

- an admin can configure shared provider connections in the backend
- an admin can store API keys in the system and only see masked values afterward
- an admin can run a provider connectivity test and inspect its latest result
- a model registry entry can bind to a configured provider connection
- `screening`, `editing`, and `proofreading` can each use different models
- execution preview shows both the resolved model and the real provider connection path
- runtime execution can resolve connection, credential, and adapter deterministically
- missing or disabled provider state fails clearly

---

## 14. Recommended Next Step

After this spec is approved, the implementation plan should focus on:

- schema and migration design
- backend service and repository boundaries
- admin UI information architecture
- execution preview contract updates
- rollout order for safe internal-trial adoption
