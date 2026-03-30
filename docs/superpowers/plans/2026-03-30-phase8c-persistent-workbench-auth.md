# Phase 8C Persistent Workbench Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real session-based web login/logout flow for the workbench and wire the existing governance workbenches to the persistent API runtime.

**Architecture:** Extend the shared HTTP auth runtime contract so demo and persistent runtimes both support session lookup and logout, then expose minimal auth session routes from the API. On the web side, split demo bootstrap from persistent auth bootstrap so `local` keeps the fast auto-login path while `dev|staging|prod` uses a real login shell and current-session fetch.

**Tech Stack:** TypeScript, node:test, Vite/React, existing browser HTTP client, current demo/persistent API runtime split.

---

### Task 1: Add Session Read/Logout API Contract

**Files:**
- Modify: `apps/api/src/http/demo-auth-runtime.ts`
- Modify: `apps/api/src/http/persistent-auth-runtime.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Test: `apps/api/test/http/http-server.spec.ts`
- Test: `apps/api/test/http/persistent-http-server.spec.ts`

- [ ] **Step 1: Write failing HTTP tests for current session and logout**
- [ ] **Step 2: Run targeted HTTP tests and verify failure**
  Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/http/http-server.spec.ts ./test/http/persistent-http-server.spec.ts`
- [ ] **Step 3: Extend `HttpAuthRuntime` with optional session read and logout support**
- [ ] **Step 4: Add `GET /api/v1/auth/session` and `POST /api/v1/auth/logout`**
- [ ] **Step 5: Re-run targeted HTTP tests and verify pass**

### Task 2: Build Persistent Web Auth Client

**Files:**
- Create: `apps/web/src/features/auth/auth-api.ts`
- Create: `apps/web/src/app/persistent-session.ts`
- Modify: `apps/web/src/vite-env.d.ts`
- Test: `apps/web/test/persistent-session.spec.ts`

- [ ] **Step 1: Write failing tests for session bootstrap, login, logout, and mode resolution**
- [ ] **Step 2: Run targeted web tests and verify failure**
  Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/persistent-session.spec.ts`
- [ ] **Step 3: Implement persistent auth API helpers and session bootstrap helpers**
- [ ] **Step 4: Re-run targeted web tests and verify pass**

### Task 3: Replace DEV-only App Shell With Mode-aware Workbench Host

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/persistent-auth-shell.tsx`
- Modify: `apps/web/src/app/app.css`
- Test: `apps/web/test/workbench-host-routing.spec.ts`

- [ ] **Step 1: Add the failing host-mode tests for local vs persistent shell behavior**
- [ ] **Step 2: Run targeted tests and verify failure**
- [ ] **Step 3: Implement persistent login shell with current-session bootstrap and logout action**
- [ ] **Step 4: Keep `local` mode demo bootstrap unchanged**
- [ ] **Step 5: Re-run targeted tests and verify pass**

### Task 4: Verify Governance Workbenches Still Operate Under Real Session

**Files:**
- Modify: `apps/web/src/features/knowledge/knowledge-api.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts`
- Modify: `apps/web/src/features/learning-governance/learning-governance-api.ts`
- Modify: `apps/web/.env.example`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`
- Test: `apps/web/test/learning-review-api.spec.ts`

- [ ] **Step 1: Write or extend tests around real-session request flow as needed**
- [ ] **Step 2: Remove forged body assumptions where the browser client no longer needs them**
- [ ] **Step 3: Verify knowledge review and learning review still work against cookie-backed API**
- [ ] **Step 4: Re-run targeted API/web tests**

### Task 5: Runtime Contract And Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Document `local` vs `dev|staging|prod` web auth behavior**
- [ ] **Step 2: Document that persistent web mode now requires backend session bootstrap instead of fake dev host gating**
- [ ] **Step 3: Re-run smoke commands**
  Run:
  - `pnpm --filter @medical/api run smoke:boot`
  - `pnpm --filter @medsys/web run smoke:boot`

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/api test -- http`
- [ ] Run: `pnpm --filter @medsys/web test`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- Web local mode still auto-bootstraps demo reviewer sessions
- Web persistent mode supports current-session bootstrap, login, and logout
- Non-local mode no longer renders the old placeholder-only shell
- Knowledge review and learning review workbenches remain usable with real backend session cookies
- API demo and persistent runtimes share a consistent session read/logout contract
