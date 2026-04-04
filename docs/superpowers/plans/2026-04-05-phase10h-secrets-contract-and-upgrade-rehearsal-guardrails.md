# Phase 10H Secrets Contract And Upgrade Rehearsal Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a bounded repo-owned production-hardening slice that blocks known unsafe production secret defaults, requires explicit secret-rotation and upgrade-rehearsal proof in release manifests, and exposes one local-first rehearsal guard command.

**Architecture:** Extend the existing persistent runtime contract and production release contract rather than introducing a new control plane. Keep the new behavior additive, operator-owned, and local-first by validating known unsafe defaults, validating manifest proof fields, and printing rehearsal sequences without auto-deploying anything.

**Tech Stack:** TypeScript, Node.js, `tsx`, `node:test`, markdown docs, existing persistent runtime and release-contract tooling.

---

## Scope Notes

- Do not add deploy automation, rollback automation, or remote secret rotation.
- Do not add hosted secret-manager dependencies.
- Do not make manuscript runtime success depend on any new rehearsal tool.
- Keep rehearsal planning read-only by default.
- Prefer additive contract modules and focused tests over runtime refactors.

## Planned File Structure

- Secret contract and startup hardening:
  - Create: `apps/api/src/ops/persistent-secret-contract.ts`
  - Modify: `apps/api/src/ops/persistent-runtime-contract.ts`
  - Modify: `apps/api/test/ops/persistent-runtime-contract.spec.ts`
- Release manifest and rehearsal guards:
  - Modify: `scripts/production-release-contract.mjs`
  - Modify: `scripts/production-release-contract.spec.mjs`
  - Modify: `package.json`
  - Modify: `docs/operations/release-manifest-template.md`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add A Persistent Secret Contract

**Files:**
- Create: `apps/api/src/ops/persistent-secret-contract.ts`
- Modify: `apps/api/src/ops/persistent-runtime-contract.ts`
- Modify: `apps/api/test/ops/persistent-runtime-contract.spec.ts`

- [ ] **Step 1: Write the failing secret-contract tests**

Add coverage that proves:

```ts
assert.throws(
  () => resolvePersistentRuntimeContract({...}),
  /object_storage_access_key/i,
);
```

Add failure assertions for:

- `OBJECT_STORAGE_ACCESS_KEY=minioadmin` in `staging` or `production`
- `OBJECT_STORAGE_SECRET_KEY=minioadmin123` in `staging` or `production`

Add passing assertions for:

- the same values still being tolerated in `development`
- explicit non-placeholder object-storage credentials in `production`

- [ ] **Step 2: Run the targeted runtime-contract tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/ops/persistent-runtime-contract.spec.ts
```

Expected: FAIL because the new secret contract does not exist yet.

- [ ] **Step 3: Implement the persistent secret contract and runtime integration**

Implementation rules:

- keep the guard list explicit and repository-owned
- only block known unsafe placeholder/default values
- keep `development` and `test` behavior unchanged
- surface actionable error messages from the existing runtime contract path

- [ ] **Step 4: Re-run the targeted runtime-contract tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/ops/persistent-runtime-contract.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the secret-contract slice**

Run:

```bash
git add apps/api/src/ops/persistent-secret-contract.ts apps/api/src/ops/persistent-runtime-contract.ts apps/api/test/ops/persistent-runtime-contract.spec.ts
git commit -m "feat: add persistent secret contract guardrails"
```

### Task 2: Add Manifest Hardening For Secret Rotation And Rehearsal

**Files:**
- Modify: `scripts/production-release-contract.mjs`
- Modify: `scripts/production-release-contract.spec.mjs`

- [ ] **Step 1: Write the failing release-contract tests**

Add coverage that proves:

```js
assert.equal(validation.upgradeRehearsalRequired, true);
assert.deepEqual(validation.missingFields, []);
```

Add failure assertions for:

- `secret rotation required = yes` without rotation proof fields
- `schema change required = yes` but `upgrade rehearsal required = no`
- `upgrade rehearsal required = yes` without rehearsal environment/evidence/verifier

- [ ] **Step 2: Run the targeted release-contract tests and confirm they fail**

Run:

```bash
node --test scripts/production-release-contract.spec.mjs
```

Expected: FAIL because the stronger manifest and rehearsal rules do not exist yet.

- [ ] **Step 3: Implement manifest hardening inside the release contract**

Implementation rules:

- keep markdown manifests as the source record
- require explicit yes/no decisions instead of implied rehearsal intent
- keep validation additive to the existing 10G manifest contract
- do not introduce remote API calls or deploy actions

- [ ] **Step 4: Re-run the targeted release-contract tests and confirm they pass**

Run:

```bash
node --test scripts/production-release-contract.spec.mjs
```

Expected: PASS.

### Task 3: Add A Repo-Owned Upgrade Rehearsal Guard And Docs

**Files:**
- Modify: `scripts/production-release-contract.mjs`
- Modify: `scripts/production-release-contract.spec.mjs`
- Modify: `package.json`
- Modify: `docs/operations/release-manifest-template.md`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Write the failing rehearsal-guard tests**

Add coverage that proves:

```js
assert.equal(plan.status, "ready");
assert.match(plan.steps[0].command, /verify:production-preflight/);
```

Add failure assertions for:

- missing `--manifest` for rehearsal planning
- manifest that requires rehearsal but is still incomplete

- [ ] **Step 2: Run the targeted release-contract tests and confirm they fail**

Run:

```bash
node --test scripts/production-release-contract.spec.mjs
```

Expected: FAIL until the rehearsal guard exists.

- [ ] **Step 3: Implement the rehearsal guard, package script, and docs**

Implementation rules:

- keep the rehearsal guard read-only by default
- print a local-first bounded operator sequence instead of auto-executing deployment
- document how the new command fits with 10A and 10G
- keep the new docs explicit that this is not a deploy control plane

- [ ] **Step 4: Re-run the end-to-end targeted 10H verification set**

Run:

```bash
pnpm --filter @medical/api run typecheck
pnpm --filter @medical/api exec node --import tsx --test test/ops/persistent-runtime-contract.spec.ts test/ops/persistent-startup-preflight.spec.ts
node --test scripts/production-release-contract.spec.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the rehearsal-and-docs slice**

Run:

```bash
git add scripts/production-release-contract.mjs scripts/production-release-contract.spec.mjs package.json docs/operations/release-manifest-template.md README.md docs/OPERATIONS.md docs/superpowers/specs/2026-04-05-phase10h-secrets-contract-and-upgrade-rehearsal-guardrails-design.md docs/superpowers/plans/2026-04-05-phase10h-secrets-contract-and-upgrade-rehearsal-guardrails.md
git commit -m "feat: add production secret and rehearsal guardrails"
```
