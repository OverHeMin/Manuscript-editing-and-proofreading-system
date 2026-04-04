# Phase 10G Release And Migration Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a bounded local-first release and migration reliability layer that can detect schema drift, classify repairable migration history problems, validate release manifests, and tighten the predeploy contract without introducing a cloud release control plane.

**Architecture:** Add a dedicated migration-audit module and CLI inside `apps/api`, then compose it with the existing repository-owned release contract script and release manifest template. Keep migration repair explicit, preserve current startup and runtime behavior, and harden only the release/migration operating boundary.

**Tech Stack:** TypeScript, Node.js, PostgreSQL, `tsx`, `node:test`, markdown docs, existing release-contract and migration tooling.

---

## Scope Notes

- Do not add automatic deploy, automatic rollback, or cloud release orchestration.
- Do not let Admin Governance Console or Evaluation Workbench become a release control plane.
- Do not change the manuscript mainline, routing control plane, or verification-ops contract to depend on the new reliability tooling.
- Keep migration audit read-only by default; explicit operator actions may still use the existing bounded migrate-time normalization path.
- Prefer additive scripts and focused tests over large refactors of current runtime startup.

## Planned File Structure

- Migration reliability core:
  - Create: `apps/api/src/database/migration-ledger.ts`
  - Create: `apps/api/src/database/migration-audit.ts`
  - Modify: `apps/api/src/database/scripts/migrate.ts`
  - Create: `apps/api/src/database/scripts/migration-doctor.ts`
  - Modify: `apps/api/test/database/support/migrate-process.ts`
  - Modify: `apps/api/test/database/schema.spec.ts`
  - Create: `apps/api/test/database/migration-doctor.spec.ts`
- Release contract and manifest guards:
  - Modify: `scripts/production-release-contract.mjs`
  - Modify: `scripts/production-release-contract.spec.mjs`
  - Modify: `docs/operations/release-manifest-template.md`
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `package.json`
  - Modify: `apps/api/package.json`

## Planned Tasks

### Task 1: Add A Repo-Owned Migration Audit And Doctor

**Files:**
- Create: `apps/api/src/database/migration-ledger.ts`
- Create: `apps/api/src/database/migration-audit.ts`
- Modify: `apps/api/src/database/scripts/migrate.ts`
- Create: `apps/api/src/database/scripts/migration-doctor.ts`
- Modify: `apps/api/test/database/support/migrate-process.ts`
- Create: `apps/api/test/database/migration-doctor.spec.ts`

- [ ] **Step 1: Write the failing migration-audit tests**

Add coverage that proves:

```ts
assert.equal(result.status, "clean");
assert.deepEqual(result.blockingMigrations, []);
assert.deepEqual(result.repairableMigrations, []);
```

Add repairability assertions for:

- known legacy checksum mismatch
- unknown checksum mismatch
- unknown database migration version
- pending repository migrations that are not history corruption

- [ ] **Step 2: Run the targeted migration-audit tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/database/migration-doctor.spec.ts
```

Expected: FAIL because no migration-audit module or doctor CLI exists yet.

- [ ] **Step 3: Implement the migration ledger, audit logic, and doctor CLI**

Implementation rules:

- centralize repository migration file discovery and checksum calculation
- centralize accepted legacy checksum variants
- classify results as `clean`, `repairable`, or `blocked`
- keep the doctor CLI read-only by default
- keep migrate-time legacy normalization behavior bounded and explicit

- [ ] **Step 4: Re-run the targeted migration-audit tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/database/migration-doctor.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the migration-audit slice**

Run:

```bash
git add apps/api/src/database/migration-ledger.ts apps/api/src/database/migration-audit.ts apps/api/src/database/scripts/migrate.ts apps/api/src/database/scripts/migration-doctor.ts apps/api/test/database/support/migrate-process.ts apps/api/test/database/migration-doctor.spec.ts
git commit -m "feat: add migration doctor reliability checks"
```

### Task 2: Tighten Schema Coverage And Legacy Repair Guarantees

**Files:**
- Modify: `apps/api/test/database/schema.spec.ts`

- [ ] **Step 1: Write the failing schema and repair assertions**

Add coverage that proves:

- migration bookkeeping includes the current release-reliability migration set
- legacy checksum repair cases still pass
- migration history drift remains blocking when not explicitly repairable

- [ ] **Step 2: Run the targeted schema tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test --test-reporter=spec test/database/schema.spec.ts
```

Expected: FAIL until schema coverage and repair assertions match the new reliability contract.

- [ ] **Step 3: Update schema coverage and repair tests**

Implementation rules:

- align index expectations with actual PostgreSQL index names
- keep checksum mismatch coverage focused on root-cause behavior
- add explicit repair coverage for accepted legacy checksums only

- [ ] **Step 4: Re-run the targeted schema tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test --test-reporter=spec test/database/schema.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the schema-reliability slice**

Run:

```bash
git add apps/api/test/database/schema.spec.ts
git commit -m "test: harden schema reliability coverage"
```

### Task 3: Add Release Manifest Validation And Predeploy Guards

**Files:**
- Modify: `scripts/production-release-contract.mjs`
- Modify: `scripts/production-release-contract.spec.mjs`
- Modify: `docs/operations/release-manifest-template.md`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `package.json`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write the failing release-contract tests**

Add coverage that proves:

```js
assert.equal(validation.status, "ok");
assert.equal(validation.schemaChangeRequired, true);
assert.deepEqual(validation.missingFields, []);
```

Add failure assertions for:

- missing release summary fields
- schema-changing manifest without PostgreSQL backup artifact
- storage-impacting manifest without storage snapshot metadata
- predeploy strict mode failing when manifest says `schema change = no` but pending migrations exist

- [ ] **Step 2: Run the targeted release-contract tests and confirm they fail**

Run:

```bash
node --test scripts/production-release-contract.spec.mjs
```

Expected: FAIL because manifest validation and migration-aware predeploy guards do not exist yet.

- [ ] **Step 3: Implement manifest validation and guarded predeploy integration**

Implementation rules:

- keep markdown release manifests as the source document
- accept an explicit `--manifest <path>` option
- validate only the fields that should be complete at predeploy time
- compose migration doctor output into predeploy only when explicitly requested or when a manifest is supplied
- do not auto-run deploy, rollback, or remote actions

- [ ] **Step 4: Re-run the targeted release-contract tests and confirm they pass**

Run:

```bash
node --test scripts/production-release-contract.spec.mjs
```

Expected: PASS.

- [ ] **Step 5: Re-run the end-to-end targeted reliability checks**

Run:

```bash
pnpm --filter @medical/api run typecheck
pnpm --filter @medical/api exec node --import tsx --test test/database/migration-doctor.spec.ts
pnpm --filter @medical/api exec node --import tsx --test --test-reporter=spec test/database/schema.spec.ts
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
node --test scripts/production-release-contract.spec.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the release-reliability slice**

Run:

```bash
git add scripts/production-release-contract.mjs scripts/production-release-contract.spec.mjs docs/operations/release-manifest-template.md README.md docs/OPERATIONS.md package.json apps/api/package.json apps/api/test/database/schema.spec.ts
git commit -m "feat: harden release and migration reliability"
```
