# Phase 8A Auth And Persistent HTTP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current in-memory auth/runtime boundary with the first production-oriented persistent auth/session foundation so the API can run beyond the local demo mode while preserving local QA ergonomics.

**Architecture:** Keep the existing domain services and permission model, but split HTTP runtime responsibilities into two explicit paths: a local-only demo runtime and a persistent runtime backed by PostgreSQL auth tables. Introduce database-backed repositories for users, login attempts, sessions, and audit writes first, then add a production-capable HTTP server/bootstrap that consumes those repositories without breaking the current Phase 7B workbench flow.

**Tech Stack:** TypeScript, node:test via `tsx`, PostgreSQL via `pg`, existing migration runner, existing auth/audit services, existing HTTP server pattern.

---

## Scope Notes

- This phase is backend-first. It does not attempt to ship a full browser login screen or replace the current development bootstrap flow in `apps/web`.
- The existing demo runtime stays in place for local QA, but it must become clearly separate from the new persistent runtime path.
- The first production-oriented auth cut supports local username/password only. LDAP / SSO remain future integrations.
- Do not add token-based SPA auth, refresh-token rotation, or password reset UI in this phase.
- Every protected write path added in Phase 7B must continue to trust only the server-side session identity, not request-body identity fields.

## Planned File Structure

- Modify: `apps/api/src/database/migrations/0001_initial.sql`
- Create: `apps/api/src/database/migrations/0004_auth_persistence.sql`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/src/auth/auth-session-repository.ts`
- Create: `apps/api/src/auth/in-memory-auth-session-repository.ts`
- Create: `apps/api/src/auth/postgres-auth-session-repository.ts`
- Create: `apps/api/src/auth/postgres-login-attempt-store.ts`
- Create: `apps/api/src/audit/postgres-audit-service.ts`
- Create: `apps/api/src/users/postgres-user-repository.ts`
- Modify: `apps/api/src/auth/index.ts`
- Modify: `apps/api/src/audit/index.ts`
- Modify: `apps/api/src/users/index.ts`
- Create: `apps/api/test/auth/postgres-auth-persistence.spec.ts`
- Create: `apps/api/src/http/persistent-server-config.ts`
- Create: `apps/api/src/http/persistent-auth-runtime.ts`
- Create: `apps/api/src/http/prod-server.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/dev-server.ts`
- Modify: `apps/api/src/ops/smoke-boot.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/test/http/persistent-server-config.spec.ts`
- Create: `apps/api/test/http/persistent-http-server.spec.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`
- Modify: `apps/api/.env.example`
- Modify: `docs/OPERATIONS.md`
- Modify: `README.md`

### Task 1: Add Persistent Auth Schema Coverage

**Files:**
- Create: `apps/api/src/database/migrations/0004_auth_persistence.sql`
- Modify: `apps/api/test/database/schema.spec.ts`
- Test: `apps/api/test/database/schema.spec.ts`

- [ ] **Step 1: Write the failing schema assertions**

Extend the database schema test to require:

- `users`
- `auth_sessions`
- `login_attempts`

Expected columns:

- `users`: `id`, `username`, `display_name`, `role_key`, `password_hash`, `status`, `created_at`, `updated_at`
- `auth_sessions`: `id`, `user_id`, `provider`, `issued_at`, `expires_at`, `refresh_at`, `ip_address`, `user_agent`, `revoked_at`
- `login_attempts`: `username`, `failure_count`, `first_failed_at`, `last_failed_at`, `locked_until`

- [ ] **Step 2: Run the schema test to verify failure**

Run: `pnpm --filter @medical/api test -- database`
Expected: FAIL because the auth persistence tables do not exist yet

- [ ] **Step 3: Implement the migration**

Create `0004_auth_persistence.sql` with:

- `users` table referencing `roles`
- `auth_sessions` table referencing `users`
- `login_attempts` table keyed by normalized username
- lookup indexes for `users.username`, `auth_sessions.user_id`, and active session expiry lookup

Implementation rules:

- keep usernames normalized to lowercase
- make session revocation additive with `revoked_at`, not hard deletes
- do not overload `audit_logs` to store session state

- [ ] **Step 4: Re-run the schema test**

Run: `pnpm --filter @medical/api test -- database`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations apps/api/test/database/schema.spec.ts
git commit -m "feat: add auth persistence schema"
```

### Task 2: Add PostgreSQL-Backed Auth Repositories

**Files:**
- Create: `apps/api/src/auth/auth-session-repository.ts`
- Create: `apps/api/src/auth/in-memory-auth-session-repository.ts`
- Create: `apps/api/src/auth/postgres-auth-session-repository.ts`
- Create: `apps/api/src/auth/postgres-login-attempt-store.ts`
- Create: `apps/api/src/audit/postgres-audit-service.ts`
- Create: `apps/api/src/users/postgres-user-repository.ts`
- Modify: `apps/api/src/auth/index.ts`
- Modify: `apps/api/src/audit/index.ts`
- Modify: `apps/api/src/users/index.ts`
- Create: `apps/api/test/auth/postgres-auth-persistence.spec.ts`
- Test: `apps/api/test/auth/postgres-auth-persistence.spec.ts`

- [ ] **Step 1: Write the failing persistence tests**

Add tests for:

- finding and saving a user by normalized username
- recording and clearing login failures in PostgreSQL
- creating, loading, and revoking auth sessions
- writing audit records through the PostgreSQL audit service

- [ ] **Step 2: Run the auth persistence test to verify failure**

Run: `pnpm --filter @medical/api test -- auth`
Expected: FAIL because the PostgreSQL repository adapters do not exist yet

- [ ] **Step 3: Implement the repository adapters**

Implementation rules:

- use `pg` directly with focused query helpers
- keep interfaces aligned with current in-memory service contracts
- clone returned objects so callers cannot mutate repository state accidentally
- normalize usernames in the repository layer, not in every caller

- [ ] **Step 4: Re-run auth tests**

Run: `pnpm --filter @medical/api test -- auth`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth apps/api/src/audit apps/api/src/users apps/api/test/auth
git commit -m "feat: add postgres-backed auth repositories"
```

### Task 3: Add The Persistent HTTP Runtime Bootstrap

**Files:**
- Create: `apps/api/src/http/persistent-server-config.ts`
- Create: `apps/api/src/http/persistent-auth-runtime.ts`
- Create: `apps/api/src/http/prod-server.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/dev-server.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/test/http/persistent-server-config.spec.ts`
- Create: `apps/api/test/http/persistent-http-server.spec.ts`
- Modify: `apps/api/test/http/http-server.spec.ts`

- [ ] **Step 1: Write the failing runtime/config tests**

Add expectations for:

- persistent runtime only allowing `APP_ENV=staging|prod|development` style non-demo modes
- missing database-backed auth dependencies failing clearly at startup
- local login route issuing a durable session record
- protected routes still deriving `actorRole/requestedBy/appliedBy/createdBy` from the stored session instead of trusting the request body

- [ ] **Step 2: Run the HTTP tests to verify failure**

Run: `pnpm --filter @medical/api test -- http`
Expected: FAIL because the persistent runtime/config modules do not exist yet

- [ ] **Step 3: Implement the persistent runtime**

Implementation rules:

- keep `dev-server.ts` demo-only
- add a separate bootstrap for the persistent runtime
- reuse the existing route surface where possible
- store opaque session IDs in `auth_sessions`
- keep cookies `HttpOnly` and path-scoped
- do not remove the local demo login flow used by the current web workbench

- [ ] **Step 4: Re-run HTTP tests**

Run: `pnpm --filter @medical/api test -- http`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/http apps/api/package.json apps/api/test/http
git commit -m "feat: add persistent auth http runtime"
```

### Task 4: Tighten Ops And Smoke-Boot Expectations

**Files:**
- Modify: `apps/api/src/ops/smoke-boot.ts`
- Modify: `apps/api/.env.example`
- Modify: `docs/OPERATIONS.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing smoke expectations**

Define the new required auth/runtime environment knobs:

- persistent runtime port/host
- database-backed auth runtime mode
- session cookie secret or equivalent signing setting when introduced

- [ ] **Step 2: Run smoke boot to verify missing contract behavior**

Run: `pnpm --filter @medical/api run smoke:boot`
Expected: FAIL or emit actionable auth/runtime configuration gaps until the new contract is wired

- [ ] **Step 3: Implement ops updates**

Update:

- `smoke-boot.ts` to validate the persistent runtime prerequisites
- `.env.example` to show the new auth/runtime settings
- `README.md` and `docs/OPERATIONS.md` to distinguish demo runtime from persistent runtime

- [ ] **Step 4: Re-run smoke boot**

Run: `pnpm --filter @medical/api run smoke:boot`
Expected: PASS in the configured local stack

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ops/smoke-boot.ts apps/api/.env.example README.md docs/OPERATIONS.md
git commit -m "docs: align ops with persistent auth runtime"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api test -- database`
- [ ] Run: `pnpm --filter @medical/api test -- auth`
- [ ] Run: `pnpm --filter @medical/api test -- http`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- The database schema includes first-class persistent auth tables for users, sessions, and login attempt tracking.
- Auth, audit, and login-attempt services can run against PostgreSQL-backed repositories without changing higher-level business rules.
- The API exposes a distinct persistent runtime path that does not rely on in-memory demo state.
- Protected routes continue to trust only the server-side session identity for actor role and actor ID.
- Demo HTTP runtime remains available for local QA and is still clearly fenced off from production use.
- README and operations docs explain the difference between demo runtime and persistent runtime accurately.
