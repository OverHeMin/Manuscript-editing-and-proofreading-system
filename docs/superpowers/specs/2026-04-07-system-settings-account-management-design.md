# 2026-04-07 System Settings Account Management Design

## Goal

Turn `system-settings` from a placeholder into a usable internal-trial settings surface, and close the current account-management gap in persistent deployments.

After this phase:

- operators can bootstrap the first persistent admin account on a fresh server
- admins can manage user accounts from the web workbench
- `system-settings` is a real page instead of an empty placeholder

## Scope

This phase covers:

- persistent admin bootstrap CLI for first-account creation and later password reset
- persistent user-management API for admins
- `apps/web` `system-settings` account-management page
- account list, create, profile update, role change, password reset, disable, and re-enable flows
- session revocation after password reset or account disable
- audit coverage for account-management actions

This phase does not cover:

- password-recovery email flows
- MFA / SSO / LDAP
- general system-configuration editing beyond account management
- mini program account-management UI
- self-service profile editing for non-admin users

## Current State

The repository already has the core persistence needed for account management:

- `users`, `auth_sessions`, and `login_attempts` PostgreSQL tables
- bcrypt password hashing
- persistent login / session / logout HTTP endpoints
- role seeding for `admin`, `screener`, `editor`, `proofreader`, `knowledge_reviewer`, and `user`

The remaining gaps are operational and product-facing:

1. fresh persistent deployments seed roles but do not seed any users
2. there is no admin API or web UI to create or maintain accounts
3. `system-settings` appears in left navigation but falls through to the placeholder renderer

## Proposed Approach

### 1. Bootstrap the first admin outside the web UI

Add a small persistent-runtime CLI under `apps/api/src/database/scripts/` for account bootstrap and emergency maintenance.

The CLI is the operational entrypoint for:

- first admin creation on a clean environment
- password reset when no admin can log in
- break-glass disable / re-enable support

The CLI should reuse existing repository and hashing logic instead of introducing a parallel auth path.

### 2. Add a focused admin user-management service

Add a dedicated service layer for admin account operations rather than overloading login logic.

Responsibilities:

- list users with status and role metadata
- create users with normalized username and hashed password
- update display name and role
- reset password
- disable or re-enable a user
- revoke active sessions when required
- record audit entries for all privileged account changes

The service should sit on top of PostgreSQL-backed repositories and avoid changing the current login/session contract unless needed for account disable and password reset enforcement.

### 3. Make `system-settings` a dedicated account-management workbench

Keep `Admin Console` focused on governance registries and agent tooling. Use `System Settings` as the operator-facing account-management page.

This keeps navigation semantics clear:

- `admin-console`: governance, model, prompt, runtime, and release controls
- `system-settings`: platform account operations for internal trial

## API Design

Add admin-only endpoints on the persistent HTTP surface:

- `GET /api/v1/system-settings/users`
- `POST /api/v1/system-settings/users`
- `POST /api/v1/system-settings/users/:userId/profile`
- `POST /api/v1/system-settings/users/:userId/password-reset`
- `POST /api/v1/system-settings/users/:userId/disable`
- `POST /api/v1/system-settings/users/:userId/enable`

Response shape should stay simple and page-oriented:

- user list items include `id`, `username`, `display_name`, `role`, `status`, `created_at`, `updated_at`
- mutations return the updated user record or a narrow success envelope

Only `admin` sessions can call these routes.

## Persistence Design

The current `users` table already stores `status`, but the repository only reads active users and only saves active rows. This phase should extend persistence support so that admin-management flows can:

- list active and disabled users
- update user status without losing the row
- find a user by id regardless of status for admin operations
- keep login reads restricted to active users

`auth_sessions` should also gain an admin-support operation to revoke all active sessions for a given user id.

`login_attempts` should be cleared on password reset and disable/enable transitions so the operator view does not leave stale lockout state behind.

## Web Design

Route `system-settings` to a new dedicated page instead of the placeholder renderer.

The page should stay intentionally narrow for V1 internal trial and contain four sections:

1. overview cards
   - total users
   - active users
   - disabled users
   - admin users
2. user list
   - username
   - display name
   - role
   - status
   - last updated time
3. create account form
   - username
   - display name
   - role
   - initial password
4. selected user actions
   - edit display name
   - change role
   - reset password
   - disable / enable

The page should use the same controller-first pattern as the existing governance pages:

- thin browser HTTP client
- workbench controller that aggregates list + mutation reloads
- page component with explicit loading, error, and mutation states

## Safety Rules

This phase should enforce the following guardrails:

- only admins can access the page or API
- usernames are normalized to lowercase
- password reset revokes all active sessions for that user
- disabling a user revokes all active sessions for that user
- the last active admin cannot be disabled
- the last active admin cannot be demoted to a non-admin role
- the acting admin cannot accidentally lock the platform out of admin access

These rules are important for internal-trial operations because there is no separate super-admin console yet.

## Audit Contract

Record audit events for:

- user create
- user profile update
- role change
- password reset
- user disable
- user enable

Audit metadata should include at minimum:

- acting admin id
- target user id
- target username
- previous role or status when applicable
- resulting role or status

## Bootstrap CLI Contract

Provide a minimal CLI that supports:

- create or upsert user
- set role
- set password
- disable user
- enable user

The CLI should be explicit and fail closed:

- require username
- require role for create
- require password for create or reset
- refuse unknown roles
- print a clear summary of the resulting user state

This keeps first-deploy operations unblocked even before any admin can sign in.

## Data Flow

### First Persistent Deployment

1. operator runs migrations
2. operator runs the account bootstrap CLI to create the first admin
3. admin signs in through persistent web auth
4. admin opens `System Settings`
5. admin creates the rest of the internal-trial accounts in the UI

### Password Reset

1. admin selects a user
2. admin submits a new password
3. backend hashes the password
4. backend clears prior active sessions and login-attempt lockout state
5. backend records an audit entry
6. user must sign in again with the new password

### Disable User

1. admin disables a user
2. backend verifies this is not the last active admin
3. backend changes status to `disabled`
4. backend revokes active sessions and clears lockout state
5. backend records an audit entry

## Testing Strategy

### API and Persistence

- repository tests for mixed-status user reads and writes
- session-revocation tests for password reset and disable
- HTTP tests for list/create/update/reset/disable/enable
- guardrail tests for last-admin protection
- bootstrap CLI tests for argument validation and user upsert behavior

### Web

- routing test proving `system-settings` no longer renders the placeholder
- controller tests for overview loading and mutation reload behavior
- page rendering tests for create form, user list, and action states
- error-state tests for failed privileged mutations

## Rollout Notes

This phase is intentionally the minimum needed for internal trial.

It enables the recommended release posture:

- deploy persistent runtime
- bootstrap the first admin with CLI
- publish the internal-trial build to the server
- continue follow-up development locally without blocking account operations in the trial environment

## Acceptance Criteria

- fresh persistent deployments can create the first admin without database hand edits
- `system-settings` renders a real account-management page
- admins can create, update, reset, disable, and re-enable accounts from the web UI
- disabling or password-resetting a user invalidates active sessions
- last-admin lockout protections are enforced
- all new flows are covered by targeted API and web tests
