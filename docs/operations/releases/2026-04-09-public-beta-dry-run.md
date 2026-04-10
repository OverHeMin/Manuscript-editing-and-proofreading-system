# Release Manifest

## Release Summary

- Environment: production-dry-run
- Operator: codex
- Date: 2026-04-10
- Commit SHA: 474a99c
- Release branch / tag: codex/public-beta-task1-semantic-persistence

## Change Scope

- Release purpose: Dry-run the public-beta harness release gate with repo-owned evidence before the final release rehearsal.
- Services touched: api, web, docs
- Schema change required: `no`
- Upload root or object storage impact: `no`
- Secret rotation required: `no`

## Secret Rotation And Upgrade Rehearsal

- Secret rotation notes: Not required for this dry-run manifest.
- Secret rotation verified by: Not required for this dry-run manifest.
- Upgrade rehearsal required: `no`
- Upgrade rehearsal environment: Not required for this dry-run manifest.
- Upgrade rehearsal evidence: Not required for this dry-run manifest.
- Upgrade rehearsal verified by: Not required for this dry-run manifest.

## Backup And Restore Point

- PostgreSQL backup artifact: Not required for this dry-run manifest.
- Object storage backup artifact: Not required for this dry-run manifest.
- Upload root snapshot: Not required for this dry-run manifest.
- Restore point / snapshot ID: Not required for this dry-run manifest.
- Backup verified by: Not required for this dry-run manifest.

## AI Release Gate

- Harness release gate required: `yes`
- Gold set versions covered: version-published-2
- Evaluation suites covered: suite-ops-1
- Finalized run IDs: run-12
- Recommendation statuses: recommended
- Manual promotion decision: approved
- Approved by: codex
- Evidence notes or URI: Candidate run `run-12` in `suite-ops-1` is the promotable dry-run evidence anchor, compared against baseline `run-11` in `apps/web/test/evaluation-workbench-page.spec.tsx`. Published gold set `version-published-2` is the current release-freeze-ready dataset anchor in `apps/web/test/harness-datasets-workbench-page.spec.tsx`.

## Pre-Deploy Checks

- `pnpm verify:production-preflight -- --manifest docs/operations/releases/2026-04-09-public-beta-dry-run.md`
- `pnpm verify:production-preflight:strict`
- `pnpm verify:production-upgrade-rehearsal -- --manifest docs/operations/releases/2026-04-09-public-beta-dry-run.md`
- `pnpm --filter @medical/api run db:migration-doctor -- --json`
- `pnpm verify:production-preflight`
- `pnpm --filter @medical/api run db:migrate`
- Additional environment-specific checks: Final rehearsal completed on 2026-04-10. `pnpm verify:production-upgrade-rehearsal -- --manifest docs/operations/releases/2026-04-09-public-beta-dry-run.md`, `pnpm verify:production-preflight:strict`, and `pnpm verify:production-preflight -- --manifest docs/operations/releases/2026-04-09-public-beta-dry-run.md` all passed against the local-first dry-run release shape.

## Deploy Execution

- Deployment command / platform action: Dry-run only. No deployment executed in Task 9.
- Persistent API startup command: Dry-run only. No persistent startup executed in Task 9.
- Notes: Task 10 kept this release shape operator-owned and local-first. Because schema, storage, and secret changes all remained `no`, backup, migration execution, and rollback stayed documented no-op branches for this rehearsal, while the strict preflight and release gates were exercised successfully.

## Post-Deploy Checks

- `pnpm verify:production-postdeploy -- --base-url <base-url>`
- Manual workbench smoke: `pnpm verify:manuscript-workbench` passed on 2026-04-10.
- Browser or operator spot checks: Included in the passing manuscript workbench gate and Playwright smoke set on 2026-04-10.

## Rollback Decision

- Rollback required: `no`
- Decision owner: codex
- Trigger / observation: Dry-run only. Rehearsal confirmed this release shape remains no-schema, no-storage, and no-secret-rotation, so rollback stayed a documented no-op path.
- Rollback action taken: None. No deployment or migration was executed in this rehearsal.
- Post-rollback verification: Not applicable for this no-op rollback branch.
- Outcome: Final rehearsal completed. Manifest-aware preflight, strict preflight, and manuscript workbench release gate all passed on 2026-04-10.

## Residual Gaps Before Final Rehearsal

- Production IDs still pending: Real production finalized run IDs and gold-set IDs will replace `run-12`, `suite-ops-1`, and `version-published-2` during the final release rehearsal after the production-bound evidence pack is selected.
- Final chosen gold set still pending: Current dry-run cites `version-published-2` as the only repo-visible release-freeze-ready anchor, but the final production freeze baseline is still to be confirmed in Task 10.
- Notes / owner: Owner is codex for this dry-run artifact. No validator gaps or hidden manual steps remain; the only remaining manual actions are choosing the final production evidence IDs and confirming the production-bound gold set before real release.
