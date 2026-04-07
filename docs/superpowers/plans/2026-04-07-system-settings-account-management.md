# System Settings Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent-first account-management surface so operators can bootstrap the first admin on a fresh server and admins can manage user accounts from the `system-settings` web workbench.

**Architecture:** Keep the current login/session flow intact and add a focused admin-management layer on top of existing `users`, `auth_sessions`, and `login_attempts` persistence. Expose that layer through additive persistent HTTP routes plus a bootstrap CLI, then route `system-settings` to a dedicated Chinese account-management page. In demo mode, render a clear unsupported notice instead of falling through to the placeholder.

**Tech Stack:** TypeScript, Node test runner, PostgreSQL repositories, existing HTTP runtime contract, React server-rendering tests, Vite web workbench

---

Repository note: the working tree already contains unrelated edits. During execution and commit, stage only the files listed in this plan.

### Task 1: Add failing backend persistence and service tests

**Files:**
- Create: `apps/api/test/users/user-admin-service.spec.ts`
- Create: `apps/api/test/users/postgres-user-admin-repository.spec.ts`
- Modify: `apps/api/test/auth/postgres-auth-persistence.spec.ts`

- [ ] **Step 1: Write the failing user-admin service tests**

Cover these behaviors in `apps/api/test/users/user-admin-service.spec.ts`:

- creating a new user normalizes username and hashes the password
- resetting a password revokes all active sessions and clears login attempts
- disabling a user revokes sessions and clears login attempts
- disabling the last active admin fails
- demoting the last active admin fails

- [ ] **Step 2: Write the failing PostgreSQL repository tests**

Add `apps/api/test/users/postgres-user-admin-repository.spec.ts` assertions for:

- listing users with `active` and `disabled` status
- updating display name, role, and status without deleting the row
- counting active admins correctly

- [ ] **Step 3: Extend session persistence coverage for user-wide revocation**

In `apps/api/test/auth/postgres-auth-persistence.spec.ts`, add a failing test that creates two sessions for one user and expects a new user-wide revoke operation to mark both rows as revoked.

- [ ] **Step 4: Run the focused backend tests to verify RED**

Run: `node --import tsx --test ./test/users/user-admin-service.spec.ts ./test/users/postgres-user-admin-repository.spec.ts ./test/auth/postgres-auth-persistence.spec.ts`  
Expected: FAIL because the user-admin repository, service, and session-wide revoke support do not exist yet.

### Task 2: Implement backend user-admin persistence, guardrails, and audit logic

**Files:**
- Create: `apps/api/src/users/user-admin-repository.ts`
- Create: `apps/api/src/users/postgres-user-admin-repository.ts`
- Create: `apps/api/src/users/user-admin-service.ts`
- Modify: `apps/api/src/auth/auth-session-repository.ts`
- Modify: `apps/api/src/auth/postgres-auth-session-repository.ts`
- Modify: `apps/api/src/auth/permission-guard.ts`
- Modify: `apps/api/src/users/postgres-user-repository.ts`

- [ ] **Step 1: Add the admin-management repository contract**

Define repository methods for:

- `listAll()`
- `findByIdIncludingDisabled(userId)`
- `create(...)`
- `updateProfile(...)`
- `updatePasswordHash(...)`
- `updateStatus(...)`
- `countActiveAdmins()`

Keep the existing login-oriented `UserRepository` contract unchanged.

- [ ] **Step 2: Implement the PostgreSQL admin repository**

In `apps/api/src/users/postgres-user-admin-repository.ts`, implement SQL for:

- mixed-status user listing
- updates that preserve `created_at`
- active-admin counting
- status transitions using the existing `user_status` enum

- [ ] **Step 3: Add user-wide session revoke support**

Extend the auth-session repository contract with `revokeAllForUser(userId, revokedAt)` and implement it in the PostgreSQL session repository.

- [ ] **Step 4: Add the user-admin service and guardrail errors**

Implement a focused service that:

- hashes passwords with `BcryptPasswordHasher`
- revokes user sessions on password reset and disable
- clears login attempts with `PostgresLoginAttemptStore.clear(...)`
- blocks disabling or demoting the last active admin
- records audit entries for create, profile update, role change, password reset, disable, and enable

Create explicit errors for:

- duplicate username
- last-active-admin disable
- last-active-admin demotion

- [ ] **Step 5: Add a permission constant for account management**

Extend `apps/api/src/auth/permission-guard.ts` with a dedicated admin-only permission such as `system-settings.manage-users`, and keep the mapping limited to `admin`.

- [ ] **Step 6: Run the focused backend tests to verify GREEN**

Run: `node --import tsx --test ./test/users/user-admin-service.spec.ts ./test/users/postgres-user-admin-repository.spec.ts ./test/auth/postgres-auth-persistence.spec.ts`  
Expected: PASS.

### Task 3: Add failing persistent HTTP and CLI tests

**Files:**
- Modify: `apps/api/test/http/persistent-http-server.spec.ts`
- Modify: `apps/api/test/http/runtime-entrypoint-scripts.spec.ts`
- Create: `apps/api/test/http/system-settings-http.spec.ts`

- [ ] **Step 1: Add failing persistent system-settings HTTP tests**

In `apps/api/test/http/system-settings-http.spec.ts`, cover:

- listing users as admin
- creating a user
- updating display name and role
- resetting password
- disabling and re-enabling a user
- rejecting non-admin access
- rejecting last-admin disable

- [ ] **Step 2: Extend the persistent server tests for disabled-user session behavior**

In `apps/api/test/http/persistent-http-server.spec.ts`, add a failing test that disables a user after login and expects subsequent `/api/v1/auth/session` reads to return `401`.

- [ ] **Step 3: Add the failing CLI entrypoint contract test**

In `apps/api/test/http/runtime-entrypoint-scripts.spec.ts`, assert that `apps/api/package.json` exposes a script such as `db:manage-user` pointing at `./src/database/scripts/manage-user.ts`.

- [ ] **Step 4: Run the focused HTTP and CLI tests to verify RED**

Run: `node --import tsx --test ./test/http/system-settings-http.spec.ts ./test/http/persistent-http-server.spec.ts ./test/http/runtime-entrypoint-scripts.spec.ts`  
Expected: FAIL because the routes and CLI entrypoint do not exist yet.

### Task 4: Implement persistent HTTP routes and the bootstrap CLI

**Files:**
- Create: `apps/api/src/users/user-admin-api.ts`
- Create: `apps/api/src/database/scripts/manage-user.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add the user-admin API wrapper**

Create `apps/api/src/users/user-admin-api.ts` with route-facing methods for:

- `listUsers`
- `createUser`
- `updateUserProfile`
- `resetUserPassword`
- `disableUser`
- `enableUser`

- [ ] **Step 2: Wire the API into the persistent runtime**

In `apps/api/src/http/persistent-governance-runtime.ts`, construct the admin service and expose `userAdminApi` on the runtime object.

Keep `userAdminApi` optional on the shared `ApiServerRuntime` interface so the in-memory runtime does not need a full account-management implementation for this phase.

- [ ] **Step 3: Add route matching and handlers**

Update `apps/api/src/http/api-http-server.ts` to:

- match the six `/api/v1/system-settings/users...` routes
- require `system-settings.manage-users`
- delegate to `runtime.userAdminApi`
- map new guardrail errors to `409`
- return `404` if `userAdminApi` is unavailable in non-persistent contexts

- [ ] **Step 4: Implement the bootstrap CLI**

Create `apps/api/src/database/scripts/manage-user.ts` and support commands like:

- `create`
- `reset-password`
- `disable`
- `enable`

Use the same admin service and repository path as the HTTP routes. Load env defaults before opening the database connection.

- [ ] **Step 5: Expose the package script**

In `apps/api/package.json`, add:

- `db:manage-user`: `tsx ./src/database/scripts/manage-user.ts`

- [ ] **Step 6: Run the focused HTTP and CLI tests to verify GREEN**

Run: `node --import tsx --test ./test/http/system-settings-http.spec.ts ./test/http/persistent-http-server.spec.ts ./test/http/runtime-entrypoint-scripts.spec.ts`  
Expected: PASS.

### Task 5: Add failing workbench routing, controller, and page tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-routing.spec.ts`
- Create: `apps/web/test/system-settings-controller.spec.ts`
- Create: `apps/web/test/system-settings-workbench-page.spec.tsx`

- [ ] **Step 1: Extend routing tests for `system-settings`**

In `apps/web/test/manuscript-workbench-routing.spec.ts`, add failing assertions that:

- `isWorkbenchImplemented("system-settings") === true`
- `resolveWorkbenchRenderKind("system-settings") === "system-settings"`

- [ ] **Step 2: Add the failing controller tests**

In `apps/web/test/system-settings-controller.spec.ts`, cover:

- overview loading from `/api/v1/system-settings/users`
- create flow reload
- update profile reload
- reset password request
- disable / enable request

- [ ] **Step 3: Add the failing page rendering tests**

In `apps/web/test/system-settings-workbench-page.spec.tsx`, cover:

- overview cards and user list rendering in Chinese
- create form rendering in Chinese
- selected-user action controls in Chinese
- explicit demo-mode unsupported notice
- request error rendering

- [ ] **Step 4: Run the focused web tests to verify RED**

Run: `node --import tsx --test ./test/manuscript-workbench-routing.spec.ts ./test/system-settings-controller.spec.ts ./test/system-settings-workbench-page.spec.tsx`  
Expected: FAIL because `system-settings` still routes to the placeholder and the new controller/page files do not exist.

### Task 6: Implement the `system-settings` account-management workbench

**Files:**
- Create: `apps/web/src/features/system-settings/index.ts`
- Create: `apps/web/src/features/system-settings/types.ts`
- Create: `apps/web/src/features/system-settings/system-settings-api.ts`
- Create: `apps/web/src/features/system-settings/system-settings-controller.ts`
- Create: `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- Create: `apps/web/src/features/system-settings/system-settings-workbench.css`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`

- [ ] **Step 1: Add the system-settings view models and API client**

Create thin browser API helpers for:

- list users
- create user
- update profile
- reset password
- disable user
- enable user

Add user list and summary view-model types in `types.ts`.

- [ ] **Step 2: Add the controller**

Implement a controller that:

- loads the user list and derives overview counts
- reloads after each mutation
- keeps the selected user stable after refresh when possible

- [ ] **Step 3: Implement the page with Chinese copy**

Build a dedicated page that renders:

- overview cards
- user list
- create account form
- selected-user action form

Use direct Chinese labels in this new page instead of relying on the runtime translation bridge.

- [ ] **Step 4: Add demo-mode fallback behavior**

Use `resolveWorkbenchRuntimeMode(...)` to show a bounded Chinese notice that account management is only available against the persistent backend when the app is running in demo mode.

- [ ] **Step 5: Route `system-settings` to the new page**

Update `apps/web/src/app/workbench-routing.ts` and `apps/web/src/app/workbench-host.tsx` so `system-settings` no longer falls through to `placeholder`.

- [ ] **Step 6: Run the focused web tests to verify GREEN**

Run: `node --import tsx --test ./test/manuscript-workbench-routing.spec.ts ./test/system-settings-controller.spec.ts ./test/system-settings-workbench-page.spec.tsx`  
Expected: PASS.

### Task 7: Run bounded verification and commit only this work

**Files:**
- Modify: `docs/superpowers/plans/2026-04-07-system-settings-account-management.md`
- Modify: `docs/superpowers/specs/2026-04-07-system-settings-account-management-design.md`
- Create: `apps/api/src/users/user-admin-repository.ts`
- Create: `apps/api/src/users/postgres-user-admin-repository.ts`
- Create: `apps/api/src/users/user-admin-service.ts`
- Create: `apps/api/src/users/user-admin-api.ts`
- Create: `apps/api/src/database/scripts/manage-user.ts`
- Modify: `apps/api/src/auth/auth-session-repository.ts`
- Modify: `apps/api/src/auth/postgres-auth-session-repository.ts`
- Modify: `apps/api/src/auth/permission-guard.ts`
- Modify: `apps/api/src/users/postgres-user-repository.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/test/users/user-admin-service.spec.ts`
- Create: `apps/api/test/users/postgres-user-admin-repository.spec.ts`
- Modify: `apps/api/test/auth/postgres-auth-persistence.spec.ts`
- Create: `apps/api/test/http/system-settings-http.spec.ts`
- Modify: `apps/api/test/http/persistent-http-server.spec.ts`
- Modify: `apps/api/test/http/runtime-entrypoint-scripts.spec.ts`
- Create: `apps/web/src/features/system-settings/index.ts`
- Create: `apps/web/src/features/system-settings/types.ts`
- Create: `apps/web/src/features/system-settings/system-settings-api.ts`
- Create: `apps/web/src/features/system-settings/system-settings-controller.ts`
- Create: `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- Create: `apps/web/src/features/system-settings/system-settings-workbench.css`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/test/manuscript-workbench-routing.spec.ts`
- Create: `apps/web/test/system-settings-controller.spec.ts`
- Create: `apps/web/test/system-settings-workbench-page.spec.tsx`

- [ ] **Step 1: Run serial verification**

Run:

```bash
pnpm --filter @medical/api test
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web test
pnpm --filter @medsys/web typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 2: Spot-check the phase boundary**

Confirm the diff stays within this scope:

- no password-recovery email workflow
- no MFA / SSO / LDAP
- no general system-config editor
- no unrelated model-governance or manuscript-flow edits

- [ ] **Step 3: Selectively stage only the account-management files**

Do not stage the unrelated pre-existing worktree edits. Stage only the files listed in this plan.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-07-system-settings-account-management-design.md docs/superpowers/plans/2026-04-07-system-settings-account-management.md apps/api/src/users/user-admin-repository.ts apps/api/src/users/postgres-user-admin-repository.ts apps/api/src/users/user-admin-service.ts apps/api/src/users/user-admin-api.ts apps/api/src/database/scripts/manage-user.ts apps/api/src/auth/auth-session-repository.ts apps/api/src/auth/postgres-auth-session-repository.ts apps/api/src/auth/permission-guard.ts apps/api/src/users/postgres-user-repository.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/package.json apps/api/test/users/user-admin-service.spec.ts apps/api/test/users/postgres-user-admin-repository.spec.ts apps/api/test/auth/postgres-auth-persistence.spec.ts apps/api/test/http/system-settings-http.spec.ts apps/api/test/http/persistent-http-server.spec.ts apps/api/test/http/runtime-entrypoint-scripts.spec.ts apps/web/src/features/system-settings/index.ts apps/web/src/features/system-settings/types.ts apps/web/src/features/system-settings/system-settings-api.ts apps/web/src/features/system-settings/system-settings-controller.ts apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/system-settings/system-settings-workbench.css apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-host.tsx apps/web/test/manuscript-workbench-routing.spec.ts apps/web/test/system-settings-controller.spec.ts apps/web/test/system-settings-workbench-page.spec.tsx
git commit -m "feat: add system settings account management"
```
