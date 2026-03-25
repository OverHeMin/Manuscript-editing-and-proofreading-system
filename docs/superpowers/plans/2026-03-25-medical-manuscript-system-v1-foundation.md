# Medical Manuscript System V1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end foundation of the medical manuscript system: repo scaffold, core domain models, document intake pipeline, knowledge/template governance, AI routing, and the first runnable module backbone.

**Architecture:** Use a `pnpm` monorepo with `apps/web`, `apps/api`, and `apps/worker-py`. Keep file assets, jobs, templates, knowledge, and audits as first-class domain objects. Route all AI work through a centralized model gateway and all document outputs through versioned `DocumentAsset` records.

**Tech Stack:** React + Vite + Ant Design, NestJS, FastAPI, PostgreSQL + pgvector, Redis, MinIO/S3-compatible storage, LibreOffice, python-docx, OCRmyPDF, PaddleOCR.

---

## Planned File Structure

- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `apps/web/`
- Create: `apps/api/`
- Create: `apps/worker-py/`
- Create: `packages/contracts/`
- Create: `packages/config/`
- Create: `packages/prompts/`
- Create: `packages/ui/`
- Create: `docs/superpowers/specs/`
- Create: `docs/superpowers/plans/`
- Create: `infra/docker-compose.yml`

### Task 1: Monorepo Scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `packages/contracts/package.json`
- Create: `infra/docker-compose.yml`
- Test: `package.json` scripts

- [ ] **Step 1: Write the failing workspace bootstrap check**

Expected files:

```text
pnpm-workspace.yaml
apps/web/package.json
apps/api/package.json
packages/contracts/package.json
```

- [ ] **Step 2: Run bootstrap command to confirm repo is not initialized**

Run: `pnpm install`
Expected: FAIL because workspace files are missing

- [ ] **Step 3: Create the minimal workspace files**

Create a workspace with:

- root scripts: `lint`, `typecheck`, `test`
- workspace packages under `apps/*` and `packages/*`

- [ ] **Step 4: Run install again**

Run: `pnpm install`
Expected: PASS and lockfile created

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json apps packages infra
git commit -m "chore: scaffold monorepo foundation"
```

### Task 2: Shared Contracts and Enums

**Files:**
- Create: `packages/contracts/src/manuscript.ts`
- Create: `packages/contracts/src/assets.ts`
- Create: `packages/contracts/src/templates.ts`
- Create: `packages/contracts/src/knowledge.ts`
- Create: `packages/contracts/src/learning.ts`
- Create: `packages/contracts/src/model-routing.ts`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/*.ts`

- [ ] **Step 1: Write failing type tests for core enums and interfaces**

```ts
import { AssetType, ManuscriptStatus } from "../src";

export const manuscriptStatusCheck: ManuscriptStatus = "uploaded";
export const assetTypeCheck: AssetType = "original";
```

- [ ] **Step 2: Run typecheck to verify missing exports fail**

Run: `pnpm --filter @medical/contracts typecheck`
Expected: FAIL because interfaces and enums do not exist

- [ ] **Step 3: Implement minimal shared contracts**

Define:

- manuscript statuses
- asset types
- template states
- knowledge states
- learning candidate states
- model registry interfaces

- [ ] **Step 4: Run typecheck again**

Run: `pnpm --filter @medical/contracts typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add shared domain contracts"
```

### Task 3: Database Schema and Migrations

**Files:**
- Create: `apps/api/prisma/schema.prisma` or `apps/api/src/database/schema/*`
- Create: `apps/api/src/database/migrations/*`
- Create: `apps/api/src/database/seeds/roles.seed.ts`
- Test: `apps/api/test/database/*.spec.ts`

- [ ] **Step 1: Write failing schema tests for core tables**

Tables to assert:

- `manuscripts`
- `document_assets`
- `jobs`
- `template_families`
- `module_templates`
- `knowledge_items`
- `learning_candidates`
- `model_registry`
- `audit_logs`

- [ ] **Step 2: Run database test to verify tables are missing**

Run: `pnpm --filter @medical/api test -- database`
Expected: FAIL with missing schema or migration

- [ ] **Step 3: Implement initial schema and migration**

Include indexes for:

- manuscript status
- asset lookup by manuscript
- knowledge search filters
- template lookup by type and module

- [ ] **Step 4: Run migration and tests**

Run: `pnpm --filter @medical/api db:migrate && pnpm --filter @medical/api test -- database`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add initial database schema"
```

### Task 4: Auth, Roles, and Audit Base

**Files:**
- Create: `apps/api/src/auth/*`
- Create: `apps/api/src/users/*`
- Create: `apps/api/src/audit/*`
- Create: `apps/web/src/features/auth/*`
- Test: `apps/api/test/auth/*.spec.ts`

- [ ] **Step 1: Write failing auth tests**

Test for:

- password hashing
- login failure limit
- role-based permission guard
- audit record on login

- [ ] **Step 2: Run auth tests to confirm failure**

Run: `pnpm --filter @medical/api test -- auth`
Expected: FAIL

- [ ] **Step 3: Implement auth and audit minimal slice**

Include:

- local username/password auth
- `admin`, `screener`, `editor`, `proofreader`, `knowledge_reviewer`, `user`
- audit service for sensitive actions

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- auth`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: add auth roles and audit base"
```

### Task 5: Manuscript, Asset, and Job Backbone

**Files:**
- Create: `apps/api/src/modules/manuscripts/*`
- Create: `apps/api/src/modules/assets/*`
- Create: `apps/api/src/modules/jobs/*`
- Create: `apps/web/src/features/manuscripts/*`
- Test: `apps/api/test/manuscripts/*.spec.ts`

- [ ] **Step 1: Write failing manuscript lifecycle tests**

Test for:

- upload manuscript record creation
- original asset creation
- job creation
- current asset pointer updates

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- manuscripts`
Expected: FAIL

- [ ] **Step 3: Implement minimal manuscript + asset + job APIs**

Endpoints:

- `POST /api/v1/manuscripts/upload`
- `GET /api/v1/manuscripts/:id`
- `GET /api/v1/manuscripts/:id/assets`
- `GET /api/v1/jobs/:id`

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @medical/api test -- manuscripts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: add manuscript asset and job backbone"
```

### Task 6: Document Normalization and Preview Adapters

**Files:**
- Create: `apps/worker-py/src/document_pipeline/*`
- Create: `apps/api/src/modules/document-pipeline/*`
- Create: `apps/web/src/features/document-preview/*`
- Test: `apps/worker-py/tests/document_pipeline/test_normalize.py`

- [ ] **Step 1: Write failing normalization test**

```python
def test_doc_file_is_queued_for_docx_normalization():
    assert normalize_job["target_type"] == "docx"
```

- [ ] **Step 2: Run worker test to confirm failure**

Run: `pytest apps/worker-py/tests/document_pipeline/test_normalize.py -v`
Expected: FAIL

- [ ] **Step 3: Implement normalization adapter**

Include:

- doc/docx sniffing
- LibreOffice conversion adapter
- asset creation for `normalized_docx`
- preview metadata generation

- [ ] **Step 4: Run tests**

Run: `pytest apps/worker-py/tests/document_pipeline/test_normalize.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker-py apps/api apps/web
git commit -m "feat: add document normalization pipeline"
```

### Task 7: Knowledge and Template Governance Core

**Files:**
- Create: `apps/api/src/modules/knowledge/*`
- Create: `apps/api/src/modules/templates/*`
- Create: `apps/web/src/features/knowledge/*`
- Create: `apps/web/src/features/templates/*`
- Test: `apps/api/test/knowledge/*.spec.ts`
- Test: `apps/api/test/templates/*.spec.ts`

- [ ] **Step 1: Write failing governance tests**

Test for:

- create knowledge draft
- approve knowledge
- create template family
- create module template draft
- publish template as admin only

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter @medical/api test -- knowledge templates`
Expected: FAIL

- [ ] **Step 3: Implement governance slice**

Include:

- knowledge CRUD + review
- template family CRUD
- module template drafts
- template publish endpoint guarded for `admin`

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @medical/api test -- knowledge templates`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: add knowledge and template governance core"
```

### Task 8: AI Gateway and Model Registry

**Files:**
- Create: `apps/api/src/modules/ai-gateway/*`
- Create: `apps/api/src/modules/model-registry/*`
- Create: `apps/web/src/features/model-registry/*`
- Test: `apps/api/test/ai-gateway/*.spec.ts`

- [ ] **Step 1: Write failing model routing tests**

Test for:

- module default model resolution
- template override resolution
- blocked model rejection
- audit on model selection

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- ai-gateway`
Expected: FAIL

- [ ] **Step 3: Implement minimal model gateway**

Include:

- model registry CRUD
- whitelist enforcement
- model resolution order
- audit record for each call

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- ai-gateway`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: add model registry and ai gateway"
```

### Task 9: Screening, Editing, and Proofreading Module Slice

**Files:**
- Create: `apps/api/src/modules/screening/*`
- Create: `apps/api/src/modules/editing/*`
- Create: `apps/api/src/modules/proofreading/*`
- Create: `apps/worker-py/src/module_runners/*`
- Create: `apps/web/src/features/screening/*`
- Create: `apps/web/src/features/editing/*`
- Create: `apps/web/src/features/proofreading/*`
- Test: `apps/api/test/modules/*.spec.ts`

- [ ] **Step 1: Write failing module behavior tests**

Verify:

- screening produces final report asset
- editing produces final docx asset
- proofreading produces draft asset then requires confirmation for final asset

- [ ] **Step 2: Run module tests to confirm failure**

Run: `pnpm --filter @medical/api test -- modules`
Expected: FAIL

- [ ] **Step 3: Implement minimal module orchestration**

Include:

- template lookup
- knowledge package retrieval
- ai gateway call
- asset creation per module rule
- proofreading confirmation endpoint

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @medical/api test -- modules`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/worker-py apps/web
git commit -m "feat: add core manuscript processing modules"
```

### Task 10: PDF Consistency and Learning Governance Slice

**Files:**
- Create: `apps/api/src/modules/pdf-consistency/*`
- Create: `apps/api/src/modules/learning/*`
- Create: `apps/worker-py/src/pdf_pipeline/*`
- Create: `apps/web/src/features/pdf-consistency/*`
- Create: `apps/web/src/features/learning-review/*`
- Test: `apps/worker-py/tests/pdf_pipeline/test_consistency.py`
- Test: `apps/api/test/learning/*.spec.ts`

- [ ] **Step 1: Write failing tests**

Verify:

- pdf consistency issues are emitted
- learning snapshot requires human-final asset
- learning candidate requires de-identification pass
- only `knowledge_reviewer` can approve candidate

- [ ] **Step 2: Run tests to confirm failure**

Run: `pytest apps/worker-py/tests/pdf_pipeline/test_consistency.py -v`

Run: `pnpm --filter @medical/api test -- learning`

Expected: FAIL

- [ ] **Step 3: Implement minimal PDF + learning slice**

Include:

- TOC/body heading extraction interface
- issue list persistence
- reviewed case snapshot creation
- learning candidate generation
- review endpoints

- [ ] **Step 4: Run tests**

Run: `pytest apps/worker-py/tests/pdf_pipeline/test_consistency.py -v && pnpm --filter @medical/api test -- learning`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/worker-py apps/web
git commit -m "feat: add pdf consistency and learning governance"
```

### Task 11: Ops, Security, and Delivery Baseline

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `apps/api/.env.example`
- Create: `apps/web/.env.example`
- Create: `apps/worker-py/.env.example`
- Create: `README.md`
- Create: `docs/OPERATIONS.md`
- Test: `infra` smoke commands

- [ ] **Step 1: Write failing smoke checklist**

Checklist must verify:

- Postgres reachable
- Redis reachable
- object storage reachable
- API boots
- Web boots
- worker boots

- [ ] **Step 2: Run local stack boot and confirm missing pieces fail**

Run: `docker compose -f infra/docker-compose.yml up -d`
Expected: FAIL until services and env examples are defined

- [ ] **Step 3: Implement baseline ops files**

Include:

- docker compose for Postgres/Redis/MinIO
- `.env.example` files
- bootstrap README
- operations runbook

- [ ] **Step 4: Run smoke checks**

Run: `docker compose -f infra/docker-compose.yml up -d && pnpm lint && pnpm typecheck`
Expected: PASS or actionable failure list

- [ ] **Step 5: Commit**

```bash
git add infra README.md docs apps
git commit -m "chore: add ops and delivery baseline"
```

## Execution Notes

- Build the foundation in phases, but do not skip the schema, auth, audit, asset, and template governance layers.
- Keep production logic behind published templates and approved knowledge only.
- Do not allow learning outputs or experimental models into production paths without the release gates from the spec.
- Use TDD for each slice and commit after each task.
