# Manuscript Quality V1 Closeout

**Date:** 2026-04-12  
**Status:** Closeout note updated after V2 governance landing

---

## 1. Closeout Summary

- `general_proofreading` V1 baseline is landed in the current repository state.
- `medical_specialized` V1 baseline is landed in the current repository state, with bounded V1.5 table-aware and pure-text consistency extensions.
- `V2` governance is now also landed for manuscript-quality packages, without changing knowledge authority, rule authority, or Harness authority boundaries.
- The remaining closeout risk is not missing functionality; it is commit-boundary confusion because this worktree also contains parallel Harness changes.

---

## 2. Can These Modules Be Edited In The System Backend?

### 2.1 What is already editable in the system

- Knowledge assets already have backend and web workbench support.
- Editorial rule assets already have backend and web authoring or governance support.
- Manuscript workbench flows for `screening`, `editing`, and `proofreading` already exist.

Repo grounding:

- Knowledge and review workbench code exists under `apps/web/src/features/knowledge-library/`, `apps/web/src/features/knowledge-review/`, and related API routes in `apps/api/src/http/api-http-server.ts`.
- Editorial rule or template governance code exists under `apps/web/src/features/template-governance/` and `apps/api/src/modules/editorial-rules/`.

### 2.2 What is now first-class backend configurable

- Governed manuscript-quality assets now have backend and web workbench support:
  - `general_style_package`
  - `medical_analyzer_package`
  - runtime binding selection of active quality package versions
- The main operator-facing files are now:
  - `apps/web/src/features/admin-governance/general-style-package-editor.tsx`
  - `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
  - `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
  - `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
  - `apps/api/src/modules/manuscript-quality-packages/`

### 2.3 What still remains code-owned

- The deterministic parsing and issue engines inside `general_proofreading` and `medical_specialized` are still repo-owned code.
- Current engine logic still lives primarily in:
  - `apps/worker-py/src/manuscript_quality/general_proofreading.py`
  - `apps/worker-py/src/manuscript_quality/medical_specialized.py`
  - `apps/worker-py/src/manuscript_quality/general_style_package.py`
  - `apps/worker-py/src/manuscript_quality/medical_asset_runtime.py`
- This is intentional:
  - backend operators can add or edit governed dictionaries, templates, thresholds, and issue-policy mappings
  - high-risk parser changes and medical reasoning branches are not exposed as freeform executable backend logic

### 2.4 Is the current interaction UI convenient?

- For knowledge library and rule authoring: still the most mature part of the system.
- For manuscript-quality package maintenance: now meaningfully usable for backend operators because the assets are exposed as structured editors instead of code-only changes.
- For net-new analyzer logic or parser behavior: still not a pure no-code workflow, because those remain code-governed by design.
- The current state is best described as:
  - Knowledge and rules: backend or web workbench editable
  - Quality package assets: backend or web workbench editable
  - Quality analyzer engines: code-level editable
  - Quality outputs: available in payloads, reports, execution snapshots, and Harness-bound runtime configurations

---

## 3. Quality Module Boundary

### 3.1 Quality-owned files

- `packages/contracts/src/manuscript-quality.ts`
- `packages/contracts/src/manuscript-quality-packages.ts`
- `apps/api/src/database/migrations/0036_execution_snapshot_quality_findings_summary.sql`
- `apps/api/src/database/migrations/0037_manuscript_quality_package_governance.sql`
- `apps/api/src/database/migrations/0038_manuscript_quality_runtime_refs.sql`
- `apps/api/src/modules/manuscript-quality/`
- `apps/api/src/modules/manuscript-quality-packages/`
- `apps/api/test/manuscript-quality/`
- `apps/api/test/manuscript-quality-packages/`
- `apps/api/test/shared/general-style-package-fixture.ts`
- `apps/api/test/shared/medical-analyzer-package-fixture.ts`
- `apps/api/test/shared/medical-quality-fixture.ts`
- `apps/worker-py/src/manuscript_quality/`
- `apps/worker-py/tests/manuscript_quality/`
- `apps/web/src/features/admin-governance/general-style-package-editor.tsx`
- `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
- `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- `docs/superpowers/plans/2026-04-11-general-proofreading-pack-v1.md`
- `docs/superpowers/plans/2026-04-11-medical-specialized-modules-v1.md`
- `docs/superpowers/plans/2026-04-12-general-proofreading-v2-style-package.md`
- `docs/superpowers/plans/2026-04-12-medical-specialized-v2-governed-assets.md`
- `docs/superpowers/specs/2026-04-11-general-proofreading-pack-v1-design.md`
- `docs/superpowers/specs/2026-04-11-medical-specialized-modules-v1-design.md`
- `docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md`

### 3.2 Shared files touched by quality integration

- `packages/contracts/src/index.ts`
- `packages/contracts/src/governed-execution.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/editing/editing-service.ts`
- `apps/api/src/modules/screening/screening-service.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-record.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-readiness-service.ts`
- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- `apps/api/src/modules/editorial-execution/types.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- `apps/api/test/execution-tracking/postgres-execution-tracking-persistence.spec.ts`
- `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- `apps/api/test/editing/editing-medical-quality.spec.ts`
- `apps/api/test/screening/screening-medical-quality.spec.ts`

### 3.3 Parallel Harness or control-plane changes that should not be mixed into a quality-only commit

- `apps/api/src/modules/harness-control-plane/`
- `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
- `apps/api/src/modules/verification-ops/experiment-binding-guard.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/http/persistent-governance-runtime.ts`
- `apps/api/src/database/migration-ledger.ts`
- `apps/api/src/database/migrations/0035_harness_control_plane_rollback_history.sql`
- `apps/api/test/harness-control-plane/`
- `apps/api/test/execution-resolution/`
- `apps/api/test/http/http-server.spec.ts`
- `apps/api/test/http/persistent-governance-http.spec.ts`
- `apps/api/test/http/persistent-http-server.spec.ts`
- `apps/api/test/http/persistent-server-bootstrap.spec.ts`
- `apps/api/test/ops/persistent-runtime-contract.spec.ts`
- `apps/api/test/ops/persistent-startup-preflight.spec.ts`
- `apps/api/test/verification-ops/`

Clarification after V2:

- Harness now reads and compares runtime bindings that include quality package refs.
- That does not make Harness the owner of analyzer logic; Harness remains the governed activation, preview, diff, and rollback surface.
- Quality packages remain authored under the manuscript-quality package governance surface and are only referenced by Harness through runtime bindings.

### 3.4 Mixed files that need judgment when splitting commits

- `apps/api/src/database/migration-ledger.ts`
- `apps/api/test/database/schema.spec.ts`

Reason:

- They currently reflect both Harness-related migration movement and quality-related snapshot summary support.
- If a later split commit is needed, extract the quality migration separately from Harness rollback history changes.

---

## 4. Commit Split Recommendation

If you later want clean submission boundaries, the safest split is:

1. `general_proofreading` foundation plus shared contract and execution summary support
2. `medical_specialized` worker plus module integration and tests
3. quality package governance plus admin editors and runtime binding package refs
4. Harness and control-plane changes

---

## 5. Ignore List

- `tmp-http-red.log`
- `tmp-task3-red.txt`
- `tmp-task4-test-log.txt`

These are temporary artifacts and should not affect the quality-module closeout decision.
