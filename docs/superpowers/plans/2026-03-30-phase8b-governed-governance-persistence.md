# Phase 8B Governed Governance Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first PostgreSQL-backed persistence layer for the governed reviewer/admin backbone so knowledge review, template governance, and learning writeback records survive restarts and can be served from the persistent API runtime.

**Architecture:** Keep the current service APIs and domain errors intact, but finish the missing governance schema and add PostgreSQL repository adapters for knowledge, template, and writeback registries. Then wire the persistent runtime to use those adapters for the review-oriented API surface while leaving the demo runtime untouched.

**Tech Stack:** TypeScript, node:test via `tsx`, PostgreSQL via `pg`, existing migration runner, current service/repository pattern, current demo vs persistent runtime split from Phase 8A.

---

## Scope Notes

- This phase is registry-first persistence, not full business-domain persistence.
- Demo runtime stays local-only and seeded.
- Persistent runtime becomes mixed-mode temporarily: auth plus governance slice in PostgreSQL, remaining domains additive as later work.
- Do not redesign the public API shapes for knowledge review or learning governance in this phase.
- Keep existing in-memory tests and implementations in place for domain-level behavior coverage.

## Planned File Structure

- Create: `apps/api/src/database/migrations/0005_governed_registry_persistence.sql`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Create: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`
- Create: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/index.ts`
- Create: `apps/api/test/templates/postgres-template-persistence.spec.ts`
- Create: `apps/api/src/modules/learning-governance/postgres-learning-governance-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/index.ts`
- Create: `apps/api/test/learning-governance/postgres-learning-governance-persistence.spec.ts`
- Create: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/prod-server.ts`
- Create: `apps/api/test/http/persistent-governance-http.spec.ts`
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

### Task 1: Finish The Governance Schema

**Files:**
- Create: `apps/api/src/database/migrations/0005_governed_registry_persistence.sql`
- Modify: `apps/api/test/database/schema.spec.ts`
- Test: `apps/api/test/database/schema.spec.ts`

- [ ] **Step 1: Write the failing schema assertions**

Extend the schema test to require:

- `knowledge_review_actions`
- `learning_writebacks`
- `knowledge_items.source_learning_candidate_id`
- `module_templates.source_learning_candidate_id`

Also require indexes for:

- `knowledge_review_actions (knowledge_item_id, created_at)`
- `learning_writebacks (learning_candidate_id, target_type, status)`

- [ ] **Step 2: Run the database tests to verify failure**

Run: `pnpm --filter @medical/api test -- database`
Expected: FAIL because the governance persistence schema is incomplete.

- [ ] **Step 3: Implement the migration**

Migration rules:

- keep changes additive
- do not rename or drop existing governance tables
- use nullable provenance columns where legacy rows may exist
- enforce foreign keys for `knowledge_item_id`, `learning_candidate_id`, and `template_family_id`

- [ ] **Step 4: Re-run the database tests**

Run: `pnpm --filter @medical/api test -- database`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations apps/api/test/database/schema.spec.ts
git commit -m "feat: add governed registry persistence schema"
```

### Task 2: Add PostgreSQL Knowledge Persistence

**Files:**
- Create: `apps/api/src/modules/knowledge/postgres-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/index.ts`
- Create: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`
- Test: `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`

- [ ] **Step 1: Write the failing PostgreSQL knowledge tests**

Add tests for:

- saving and loading a knowledge draft with routing arrays and provenance
- listing by status in stable review order
- saving and listing review actions with note-aware history
- preserving rollback behavior when review action writes fail

- [ ] **Step 2: Run the knowledge persistence test to verify failure**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/knowledge/postgres-knowledge-persistence.spec.ts`
Expected: FAIL because the PostgreSQL knowledge repositories do not exist yet.

- [ ] **Step 3: Implement the PostgreSQL adapters**

Implementation rules:

- keep service contracts unchanged
- map `"any"` manuscript scope explicitly
- clone arrays on reads
- sort review actions by `created_at` ascending to keep history deterministic

- [ ] **Step 4: Re-run knowledge tests**

Run: `pnpm --filter @medical/api test -- knowledge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/knowledge apps/api/test/knowledge
git commit -m "feat: add postgres-backed knowledge governance"
```

### Task 3: Add PostgreSQL Template Governance Persistence

**Files:**
- Create: `apps/api/src/modules/templates/postgres-template-repository.ts`
- Modify: `apps/api/src/modules/templates/index.ts`
- Create: `apps/api/test/templates/postgres-template-persistence.spec.ts`
- Test: `apps/api/test/templates/postgres-template-persistence.spec.ts`

- [ ] **Step 1: Write the failing PostgreSQL template tests**

Add tests for:

- creating and loading template families
- reserving concurrent version numbers safely
- publishing a newer template while archiving the prior published version
- storing `source_learning_candidate_id` provenance

- [ ] **Step 2: Run the template persistence test to verify failure**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/templates/postgres-template-persistence.spec.ts`
Expected: FAIL because the PostgreSQL template repositories do not exist yet.

- [ ] **Step 3: Implement the PostgreSQL template adapters**

Implementation rules:

- preserve current service-level publish semantics
- keep version reservation atomic
- return records in deterministic version order
- do not fold archive/publish logic into SQL-only magic that bypasses service rules

- [ ] **Step 4: Re-run template tests**

Run: `pnpm --filter @medical/api test -- templates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/templates apps/api/test/templates
git commit -m "feat: add postgres-backed template governance"
```

### Task 4: Add PostgreSQL Learning Writeback Persistence

**Files:**
- Create: `apps/api/src/modules/learning-governance/postgres-learning-governance-repository.ts`
- Modify: `apps/api/src/modules/learning-governance/index.ts`
- Create: `apps/api/test/learning-governance/postgres-learning-governance-persistence.spec.ts`
- Test: `apps/api/test/learning-governance/postgres-learning-governance-persistence.spec.ts`

- [ ] **Step 1: Write the failing PostgreSQL writeback tests**

Add tests for:

- saving and loading writeback drafts
- listing writebacks by candidate
- persisting applied metadata and created draft asset id
- rejecting duplicate active targets at the service layer while keeping repository reads deterministic

- [ ] **Step 2: Run the writeback persistence test to verify failure**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/learning-governance/postgres-learning-governance-persistence.spec.ts`
Expected: FAIL because the PostgreSQL writeback repository does not exist yet.

- [ ] **Step 3: Implement the PostgreSQL writeback adapter**

Implementation rules:

- keep duplicate-target prevention in the service layer
- repository list methods should sort by `created_at` ascending
- preserve optional `applied_by`, `applied_at`, and `created_draft_asset_id` fields

- [ ] **Step 4: Re-run learning governance tests**

Run: `pnpm --filter @medical/api test -- learning-governance`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/learning-governance apps/api/test/learning-governance
git commit -m "feat: add postgres-backed learning writebacks"
```

### Task 5: Wire The Persistent Runtime To Governance Persistence

**Files:**
- Create: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/prod-server.ts`
- Create: `apps/api/test/http/persistent-governance-http.spec.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing persistent governance HTTP test**

Add expectations for:

- persistent runtime knowledge review queue reading from PostgreSQL-backed governance repositories
- review actions surviving a server restart
- demo runtime behavior remaining unchanged

- [ ] **Step 2: Run the persistent governance HTTP test to verify failure**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/http/persistent-governance-http.spec.ts`
Expected: FAIL because the persistent runtime still uses in-memory governance repositories.

- [ ] **Step 3: Implement persistent governance runtime wiring**

Implementation rules:

- add a dedicated builder for persistent governance dependencies
- keep `createApiHttpServer` explicit about which runtime dependencies are demo vs persistent
- do not silently seed review data in persistent mode

- [ ] **Step 4: Re-run HTTP tests**

Run: `pnpm --filter @medical/api test -- http`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/http apps/api/test/http
git commit -m "feat: wire persistent governance runtime"
```

### Task 6: Align Docs And Runtime Contract

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Write the missing contract checklist**

Document the new runtime truth:

- persistent runtime now includes auth plus governed review persistence
- remaining non-persistent domains are still explicitly limited

- [ ] **Step 2: Update the docs**

Keep the repo docs explicit about:

- what is durable now
- what is still mixed-mode
- which commands start demo vs persistent runtime

- [ ] **Step 3: Re-run smoke and repo verification**

Run:

- `pnpm --filter @medical/api run smoke:boot`
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`
- `pnpm test`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/.env.example README.md docs/OPERATIONS.md
git commit -m "docs: align governed persistence runtime"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api test -- database`
- [ ] Run: `pnpm --filter @medical/api test -- knowledge`
- [ ] Run: `pnpm --filter @medical/api test -- templates`
- [ ] Run: `pnpm --filter @medical/api test -- learning-governance`
- [ ] Run: `pnpm --filter @medical/api test -- http`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- governed review schema fully covers knowledge review actions, template provenance, and learning writebacks
- knowledge review data is durable in PostgreSQL
- template governance state is durable in PostgreSQL
- learning writeback records are durable in PostgreSQL
- persistent runtime serves the governed review slice from PostgreSQL-backed repositories
- demo runtime remains loopback-only and in-memory
