# Release Manifest Template

Use this template for each staging or production release so the operator, backup set, migration audit result, health results, and rollback decision all live in one repo-owned record.

Predeploy validation in Phase 10G treats this markdown file as a machine-checkable contract.
Phase 10H extends that contract with secret-rotation proof and upgrade-rehearsal proof.
Phase 10I adds a repo-owned AI release gate record for harness evidence and manual promotion approval.

Required before `pnpm verify:production-preflight -- --manifest <path>`:

- Complete every field in `Release Summary` and `Change Scope`.
- If `Schema change required` is `yes`, fill in `PostgreSQL backup artifact`, `Restore point / snapshot ID`, and `Backup verified by`.
- If `Upload root or object storage impact` is `yes`, fill in at least one storage snapshot field: `Object storage backup artifact` or `Upload root snapshot`.
- If `Secret rotation required` is `yes`, fill in `Secret rotation notes` and `Secret rotation verified by`.
- If schema, storage, or secret changes are involved, set `Upgrade rehearsal required` to `yes` and fill in the rehearsal environment, evidence, and verifier.
- If `Harness release gate required` is `yes`, fill in `Gold set versions covered`, `Evaluation suites covered`, `Finalized run IDs`, `Recommendation statuses`, `Manual promotion decision`, and `Approved by`.
- Keep this manifest local-first and repo-owned. It records operator intent and evidence; it does not trigger deployment, rollback, or release automation.

## Release Summary

- Environment:
- Operator:
- Date:
- Commit SHA:
- Release branch / tag:

## Change Scope

- Release purpose:
- Services touched:
- Schema change required: `yes` / `no`
- Upload root or object storage impact: `yes` / `no`
- Secret rotation required: `yes` / `no`

## Secret Rotation And Upgrade Rehearsal

- Secret rotation notes:
- Secret rotation verified by:
- Upgrade rehearsal required: `yes` / `no`
- Upgrade rehearsal environment:
- Upgrade rehearsal evidence:
- Upgrade rehearsal verified by:

## Backup And Restore Point

- PostgreSQL backup artifact:
- Object storage backup artifact:
- Upload root snapshot:
- Restore point / snapshot ID:
- Backup verified by:

## AI Release Gate

- Harness release gate required: `yes` / `no`
- Gold set versions covered:
- Evaluation suites covered:
- Finalized run IDs:
- Recommendation statuses:
- Manual promotion decision:
- Approved by:
- Evidence notes or URI:

## Pre-Deploy Checks

- `pnpm verify:production-preflight -- --manifest <path-to-this-manifest>`
- `pnpm verify:production-preflight:strict`
- `pnpm verify:production-upgrade-rehearsal -- --manifest <path-to-this-manifest>`
- `pnpm --filter @medical/api run db:migration-doctor -- --json`
- `pnpm verify:production-preflight`
- `pnpm --filter @medical/api run db:migrate`
- Additional environment-specific checks:

## Deploy Execution

- Deployment command / platform action:
- Persistent API startup command:
- Notes:

## Post-Deploy Checks

- `pnpm verify:production-postdeploy -- --base-url <base-url>`
- Manual workbench smoke:
- Browser or operator spot checks:

## Rollback Decision

- Rollback required: `yes` / `no`
- Decision owner:
- Trigger / observation:
- Rollback action taken:
- Post-rollback verification:
- Outcome:

## Residual Gaps Before Final Rehearsal

- Production IDs still pending:
- Final chosen gold set still pending:
- Notes / owner:
