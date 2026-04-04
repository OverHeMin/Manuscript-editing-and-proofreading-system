# Release Manifest Template

Use this template for each staging or production release so the operator, backup set, migration audit result, health results, and rollback decision all live in one repo-owned record.

Predeploy validation in Phase 10G treats this markdown file as a machine-checkable contract.

Required before `pnpm verify:production-preflight -- --manifest <path>`:

- Complete every field in `Release Summary` and `Change Scope`.
- If `Schema change required` is `yes`, fill in `PostgreSQL backup artifact`, `Restore point / snapshot ID`, and `Backup verified by`.
- If `Upload root or object storage impact` is `yes`, fill in at least one storage snapshot field: `Object storage backup artifact` or `Upload root snapshot`.
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

## Backup And Restore Point

- PostgreSQL backup artifact:
- Object storage backup artifact:
- Upload root snapshot:
- Restore point / snapshot ID:
- Backup verified by:

## Pre-Deploy Checks

- `pnpm verify:production-preflight -- --manifest <path-to-this-manifest>`
- `pnpm verify:production-preflight:strict`
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
