# Release Manifest Template

Use this template for each staging or production release so the operator, backup set, health results, and rollback decision all live in one repo-owned record.

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
