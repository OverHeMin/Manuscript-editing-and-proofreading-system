# Phase 10G Release And Migration Reliability Hardening Design

**Date:** 2026-04-04  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Harden the repository-owned release and migration contract so schema drift, checksum mismatch, incomplete release manifests, and repairable migration history problems are detected early and handled through bounded local-first operator workflows.

## 1. Goal

Phase 10G is not a feature-delivery phase.

Its job is to make the current production-facing contract harder to misuse:

- migration history drift should stop surprising operators late in a release
- release manifests should stop being optional prose that can be half-filled
- repairable migration history problems should be classified clearly before deploy
- schema-changing releases should have an explicit backup and restore-point gate

In one sentence:

`Phase 10G` should turn release and migration reliability from a mostly documented process into a repository-verified operating contract.

## 2. Why This Phase Exists

By the end of Phase 10F, the repository already has:

- persistent runtime startup preflight
- `/healthz` and `/readyz`
- release manifest templates
- governed migrations up through harness datasets, retrieval quality, and harness adapters
- a production release contract script

What still remains risky is the gap between "documented" and "enforced":

- a historical migration file can drift and only be noticed when database tests or a release database fail
- operators can run a schema-changing release without one machine-checkable backup gate
- release manifests can exist but still be incomplete enough to be operationally useless
- repairable migration checksum mismatches can be confused with unrecoverable drift

Phase 10G exists to close that reliability gap without introducing a cloud deployment control plane.

## 3. Recommended Option

### Option A: Keep fixing migration and release issues one-off

Pros:

- smallest immediate change

Cons:

- preserves operator memory as the real control plane
- repeats the same failure class each time a new migration or release edge appears

Not recommended.

### Option B: Add bounded repository-owned release and migration reliability guards

Pros:

- keeps the system local-first and repo-owned
- makes drift and repairability explicit before deploy
- aligns with Phase 10A's operating-contract direction

Cons:

- adds more operational validation code to maintain

Recommended.

### Option C: Jump directly to CI/CD automation and remote release orchestration

Pros:

- could centralize more release behavior later

Cons:

- too broad for this slice
- risks creating a new release control plane before the repository contract itself is stable

Out of scope.

## 4. Hard Boundaries

### 4.1 Repository-owned and local-first

This phase may add:

- local migration audit tooling
- release manifest validation
- repo-owned release guards

It must not require:

- hosted deployment control planes
- cloud migration dashboards
- remote-only release orchestration

### 4.2 No automatic deployment or rollback

This phase may block a release or classify it as unsafe.
It must not:

- auto-run production deployment
- auto-run rollback
- auto-apply destructive recovery actions

### 4.3 Main runtime remains unchanged by default

The manuscript execution path, routing control plane, and verification-ops contract remain intact.
Phase 10G may harden release and migration procedures around them, but it must not repurpose those systems into a release control plane.

### 4.4 Repair must stay explicit

The system may identify:

- clean migration history
- repairable legacy mismatch
- blocking drift

But any mutation beyond the existing bounded migrate-time normalization path must stay explicit and operator-invoked.

### 4.5 Schema-changing releases require stronger proof

If a release intends to change schema or storage layout, the repository should require stronger manifest completeness and backup metadata than a code-only release.

## 5. Core Objects

### 5.1 Migration Ledger Snapshot

A repo-owned view of:

- migration files present in the repository
- normalized checksums
- known legacy checksum variants

### 5.2 Migration Audit Result

A structured result classifying a database as:

- clean
- repairable
- blocked

and describing:

- pending repo migrations
- repairable legacy checksum rows
- blocking checksum mismatches
- unknown database migration versions

### 5.3 Release Manifest Validation Result

A structured report describing whether a manifest is complete enough for the declared release shape, especially when schema or storage changes are involved.

### 5.4 Release Reliability Contract

A bounded operator flow that composes:

- manifest validation
- migration audit
- existing predeploy checks
- existing postdeploy readiness checks

without becoming a deployment orchestrator.

## 6. Recommended Architecture

### 6.1 Migration Reliability Layer

Add a dedicated migration-audit module and CLI that can:

- read repository migration files and normalized checksums
- compare them with `schema_migrations`
- classify drift as `clean`, `repairable`, or `blocked`
- distinguish pending migrations from history corruption

Important rule:

- pending migrations are not the same thing as corrupted migration history

### 6.2 Release Manifest Guard Layer

Strengthen the release contract by validating release manifest completeness before the existing predeploy steps run.

Recommended behavior:

- code-only releases need a minimal complete summary
- schema-changing releases additionally require backup and restore-point metadata
- storage-impacting releases additionally require storage snapshot metadata

This should stay markdown-compatible with the existing manifest template rather than introducing a new external release system.

### 6.3 Predeploy Reliability Layer

Extend the current release contract so predeploy can optionally compose:

1. manifest validation
2. migration audit
3. existing workspace validation steps

The output should remain repository-owned and scriptable.

### 6.4 Documentation And Runbook Layer

README and OPERATIONS docs should explain:

- when to run migration audit
- what counts as repairable versus blocking drift
- which manifest fields are mandatory for schema-changing releases
- how Phase 10G still avoids automatic deploy or rollback behavior

## 7. Manual Work That Remains Human

Even after Phase 10G lands, these remain human-owned:

- deciding whether to proceed after a warning-only release signal
- deciding whether a repairable migration issue should be normalized now or deferred
- approving rollback
- choosing backup scope and restore action

## 8. Related Capability Lane

This phase advances:

- `Production Operations / Release Reliability`

It builds on:

- `Phase 10A` production-operations baseline
- `Phase 10D` governed dataset migrations
- `Phase 10E` retrieval migrations
- `Phase 10F` harness adapter migrations
