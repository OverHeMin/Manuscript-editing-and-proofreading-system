# DOCX Source Block Resolver Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live screening, editing, and proofreading runs consume real DOCX text blocks so structural rules and quality checks can trigger outside of test-only stubs.

**Architecture:** Add a shared DOCX source-block resolver backed by the existing `extract_docx_structure.py` worker output, normalize raw worker blocks into module-facing `EditorialTextBlock[]`, and map reference sections to `reference_entry` blocks. Then wire that resolver into the runtime bootstrap paths for the three modules without changing payload contracts or governance routing.

**Tech Stack:** TypeScript, Node test runner with `tsx`, existing document pipeline worker scripts, API runtime bootstrap

---

### Task 1: Lock DOCX Block Normalization In Tests

**Files:**
- Create: `apps/api/test/document-pipeline/python-docx-source-block-resolver.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`

- [ ] **Step 1: Write a failing resolver test for section and block-kind mapping**

Lock one minimal worker payload that includes:

- a results heading
- a results paragraph with statistical text
- a references heading emitted as a plain paragraph
- a reference paragraph

Expected normalized output:

- results heading -> `section = "results"`, `block_kind = "heading"`
- results paragraph -> `section = "results"`, `block_kind = "paragraph"`
- references heading -> `section = "reference"`, `block_kind = "heading"`
- reference paragraph -> `section = "reference"`, `block_kind = "reference_entry"`

- [ ] **Step 2: Run the resolver test and verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/document-pipeline/python-docx-source-block-resolver.spec.ts`

Expected: FAIL because the resolver does not exist yet.

- [ ] **Step 3: Write a failing proofreading service test for live reference-rule hits**

Add a focused service-level test that uses the real resolver with a fake worker payload and asserts a proofreading run emits a failed check for a `normalize_reference_entry` rule without injecting `proofreadingSourceBlockResolver` by hand.

- [ ] **Step 4: Run the focused proofreading test and verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: FAIL because the service runtime still has no real source-block resolver path.


### Task 2: Implement The Shared DOCX Source Block Resolver

**Files:**
- Create: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/support/workbench-runtime.ts`

- [ ] **Step 1: Add a worker-backed resolver with injectable runner**

The resolver should:

- resolve the asset storage path inside the upload root
- call `extract_docx_structure.py`
- normalize raw worker `blocks`
- classify headings/paragraphs into module-facing `EditorialTextBlock`

- [ ] **Step 2: Map reference sections to `reference_entry`**

Use bounded heuristics:

- recognize `References/参考文献` headings even when they arrive as plain paragraphs
- keep results headings mapped to `results`
- treat paragraphs under the reference section as `reference_entry`

- [ ] **Step 3: Wire the resolver into runtime bootstrap**

Pass the shared resolver to:

- screening manuscript-quality source blocks
- editing manuscript-quality source blocks
- proofreading source blocks

Use the existing runtime `uploadRootDir`; do not change service payload contracts.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/document-pipeline/python-docx-source-block-resolver.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: PASS


### Task 3: Verify The Slice

**Files:**
- Test: `apps/api/test/document-pipeline/python-docx-source-block-resolver.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-report.spec.ts`
- Test: `apps/api/test/proofreading/proofreading-rule-checker.spec.ts`
- Test: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Run the bounded API regression subset**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/document-pipeline/python-docx-source-block-resolver.spec.ts ./test/proofreading/proofreading-rule-checker.spec.ts ./test/proofreading/proofreading-rule-report.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the persistent runtime regression slice**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/http/persistent-workbench-http.spec.ts`

Expected: PASS or, if this suite is too broad/noisy, replace with the smallest focused persistent-workbench test subset that exercises governed proofreading.

- [ ] **Step 3: Run API typecheck**

Run: `pnpm --filter @medical/api typecheck`

Expected: exit 0

- [ ] **Step 4: Sanity-check scope**

Confirm this slice:

- activates real source blocks for live module execution
- unlocks structural proofreading hits and reference-section matching in runtime
- does not add new governance states, schemas, or rule-center panels
