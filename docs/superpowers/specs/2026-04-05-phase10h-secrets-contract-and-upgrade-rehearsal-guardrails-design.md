# Phase 10H Secrets Contract And Upgrade Rehearsal Guardrails Design

**Date:** 2026-04-05  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Harden the repository-owned production contract around secret placeholder protection and upgrade rehearsal proof so production-like releases stop depending on human memory for obvious secret and rehearsal mistakes.

## 1. Goal

Phase 10H is still not a business-feature phase.

Its job is to make the production hardening lane more explicit without turning the repository into a deploy control plane.

In this minimal slice:

- production-like runtimes should reject known placeholder or default secret values before startup
- release manifests should capture whether secret rotation or upgrade rehearsal is required
- schema-, storage-, or secret-affecting releases should stop pretending rehearsal is optional when it is actually required
- operators should have one repo-owned rehearsal guard that validates intent and prints the expected local-first verification sequence

In one sentence:

`Phase 10H` should turn secret hygiene and upgrade rehearsal from "remember to do this" into a bounded repository contract.

## 2. Why This Phase Exists

By the end of Phase 10G, the repository already has:

- persistent runtime startup preflight
- release manifest validation
- migration doctor classification
- repo-owned predeploy and postdeploy contract scripts

What still remains risky is the gap between "release reliability" and "production hardening":

- `staging` and `production` still only reject one known placeholder secret (`ONLYOFFICE_JWT_SECRET`)
- object-storage credentials can still silently remain on local development defaults
- release manifests mention secret rotation, but they do not yet enforce enough metadata to prove it was planned
- release manifests mention schema and storage impact, but they do not yet force an explicit rehearsal decision
- operators still lack one repo-owned command that says "for this release shape, here is the rehearsal contract you must satisfy"

Phase 10H exists to close that gap without introducing CI/CD orchestration, hosted secrets platforms, or automatic release actions.

## 3. Recommended Option

### Option A: Keep production hardening inside docs only

Pros:

- smallest change

Cons:

- leaves secret hygiene and rehearsal discipline dependent on operator memory
- repeats the same avoidable production mistake class

Not recommended.

### Option B: Add bounded repo-owned secret and rehearsal guardrails

Pros:

- stays local-first and repository-owned
- builds naturally on Phase 10A and Phase 10G
- hardens operator discipline without creating a remote control plane

Cons:

- adds more contract validation and operator-facing script surface

Recommended.

### Option C: Jump straight to deploy automation and managed secret rotation

Pros:

- could centralize more production behavior later

Cons:

- too broad for the next safe slice
- risks turning the repository into a deployment control plane before the hardening contract is stable

Out of scope.

## 4. Hard Boundaries

### 4.1 Repository-owned and local-first

This phase may add:

- placeholder secret guardrails
- release-manifest rehearsal validation
- repo-owned rehearsal planning scripts

It must not require:

- hosted secret managers
- cloud deployment platforms
- remote-only release dashboards

### 4.2 No automatic deployment, rollback, or secret mutation

This phase may block a startup or release.
It must not:

- auto-run deployment
- auto-run rollback
- auto-rotate secrets
- write secret values back into runtime configuration

### 4.3 Main runtime remains unchanged by default

The manuscript mainline, routing control plane, and verification-ops contract remain intact.
Phase 10H may harden the production contract around them, but it must not make them synchronous dependencies of a new deployment controller.

### 4.4 Rehearsal must stay operator-owned

The repository may:

- require an explicit rehearsal decision
- require rehearsal evidence for higher-risk releases
- print the bounded verification sequence to follow

It must not:

- promote rehearsal output into auto-release
- auto-decide rollback
- auto-apply migrations in a production target

### 4.5 Secret validation should only block on known unsafe defaults

The goal is to catch obvious placeholder/default misuse, not to pretend the repository can fully solve secret governance.

This phase should block:

- known placeholder values
- known local development default credentials in `staging` or `production`

It should not try to infer every weak secret or become a general secret scanner.

## 5. Core Objects

### 5.1 Persistent Secret Contract Result

A bounded result describing whether the configured persistent runtime is using:

- acceptable production-like values
- known placeholder/default values that must be rejected

### 5.2 Release Manifest Hardening Result

A manifest validation result extended with:

- whether secret rotation is required
- whether upgrade rehearsal is required
- which proof fields are missing for those decisions

### 5.3 Upgrade Rehearsal Guard

A repo-owned command that:

- reads one release manifest
- validates the manifest against the current release shape
- prints the standard rehearsal sequence for that release

Important rule:

- this command is a guard and planner, not a deployment orchestrator

## 6. Recommended Architecture

### 6.1 Persistent Secret Contract Layer

Extend the persistent runtime contract so `staging` and `production` reject known unsafe values.

Recommended initial guard set:

- `ONLYOFFICE_JWT_SECRET=change-me-in-prod`
- `OBJECT_STORAGE_ACCESS_KEY=minioadmin`
- `OBJECT_STORAGE_SECRET_KEY=minioadmin123`

This is intentionally narrow.
It should be easy to audit and hard to misread.

### 6.2 Release Manifest Hardening Layer

Extend the release manifest contract so it records:

- `Secret rotation required`
- `Upgrade rehearsal required`
- the proof fields needed when either answer is `yes`

Recommended behavior:

- if `secret rotation required = yes`, require explicit secret-rotation notes and verification owner
- if `schema change required = yes`, `storage impact = yes`, or `secret rotation required = yes`, then `upgrade rehearsal required` must be `yes`
- when `upgrade rehearsal required = yes`, require rehearsal environment, evidence, and verifier metadata

### 6.3 Upgrade Rehearsal Guard Layer

Extend the repo-owned release contract with one rehearsal command that:

1. validates the manifest
2. validates the stronger rehearsal rules
3. prints a local-first operator sequence for the release shape

The rehearsal output should compose existing repo-owned commands such as:

- manifest-aware predeploy verification
- strict migration checks
- persistent startup preflight
- migration execution in the rehearsal environment
- postdeploy readiness verification

It should not attempt to perform remote deployment.

### 6.4 Runbook And Docs Layer

README and OPERATIONS docs should explain:

- which placeholder/default secrets are blocked in `staging` and `production`
- which release shapes require rehearsal
- how rehearsal remains human-owned and local-first
- how Phase 10H still avoids becoming deploy automation

## 7. Manual Work That Remains Human

Even after this slice lands, these remain human-owned:

- choosing the real secret values
- deciding the rotation window
- executing the actual deployment
- executing rollback
- deciding whether rehearsal evidence is sufficient

## 8. Related Capability Lane

This phase advances:

- `Production Operations And Security Platform`

It builds on:

- `Phase 10A` production-operations baseline
- `Phase 10G` release and migration reliability hardening

It explicitly does not absorb:

- model-routing governance
- retrieval completion
- durable orchestration
- privacy and OCR work
