# No-Mojibake Governed Proofreading Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AI provider, Harness quality gates, proofreading/editing validation, doc/docx conversion, complex table reconstruction, residual analysis, knowledge feedback loop, and rule-center simplification from a clean `origin/main` without introducing any mojibake/garbled Chinese text.

**Architecture:** Treat encoding safety as a release gate, not an afterthought. Every user-facing Chinese string must either be copied from a UTF-8 source file using safe tooling or generated through Unicode code points; no PowerShell Chinese string replacement is allowed. Work is split into small vertical slices with failing tests first, encoding scans after every slice, and one clean PR branch created from `origin/main`.

**Tech Stack:** pnpm monorepo, TypeScript API/web, Playwright browser tests, Node `--test`, Python document pipeline tests, GitHub PR branch workflow.

---

## Non-Negotiable Safety Rules

- Never edit Chinese text through PowerShell string literals.
- Use `apply_patch` for plain ASCII-only changes; use Python with explicit Unicode code points for Chinese text changes.
- After every task, run `pnpm.cmd run scan:mojibake` once that script exists.
- Do not force-push `main`.
- Do not reuse `codex/ai-key-auto-model-discovery` or `codex/ai-key-model-discovery-clean`.
- Do not migrate large dirty files wholesale from old branches.
- Prefer rebuilding features from `origin/main` by copying logic only after a targeted diff review.
- Commit after each passing slice so rollback points are obvious.

## PowerShell And UTF-8 Operating Charter

- PowerShell may run ASCII-only commands such as `git`, `pnpm.cmd`, `node`, and `python` invocations.
- Do not pass Chinese UI text, manuscript text, or regex replacement strings through PowerShell stdin, heredocs, `-Command` string interpolation, or `Set-Content` unless the content is ASCII-only.
- If a file needs Chinese content, write it from Node/Python file APIs using Unicode code points, `JSON.stringify`, or copy an already verified UTF-8 file byte-for-byte.
- Before any command that can display or transform text, set `$env:PYTHONIOENCODING='utf-8'`; do not rely on terminal rendering as proof of file correctness.
- Never use PowerShell as the source of truth for Chinese replacement text. Use `git show origin/main:path` for known-good existing text or code-point generated strings for new labels.
- Every UI/test/doc change containing Chinese must be followed by `pnpm.cmd run scan:mojibake` before staging.


## Branch And Remote Strategy

- Keep `origin/main` at current clean commit `a9bec5e` unless new upstream changes appear.
- Delete or abandon remote branches that contain mojibake after user confirmation:
  - `origin/codex/ai-key-auto-model-discovery`
  - `origin/codex/ai-key-model-discovery-clean`
- Create a new branch from fresh `origin/main`:
  - `codex/no-mojibake-governed-proofreading-rebuild`
- Open a new PR only after all gates pass and mojibake scan reports zero hits.

## File Responsibility Map

### Encoding Gate
- Create: `scripts/quality/scan-mojibake.mjs`
  - Scans changed text files and selected source trees for known mojibake characters, replacement chars, and repeated question-mark corruption.
- Modify: `package.json`
  - Adds `scan:mojibake` and includes it in release verification scripts.
- Create: `scripts/quality/scan-mojibake.spec.mjs`
  - Proves the scanner catches `U+5BB8 U+8336`, `U+93BF`, `U+7F02 U+682A U+8F91`, four question marks, and `U+FFFD` by generating those samples from code points inside the test.

### AI Provider And DeepSeek/Qwen Routing
- Modify: `apps/api/src/modules/ai-provider-connections/*`
  - Add model auto-discovery and OpenAI-compatible connectivity probes without storing real keys in code.
- Modify: `apps/api/src/http/api-http-server.ts`
  - Expose provider connection/autoconfig endpoints.
- Create/modify tests under `apps/api/test/ai-provider-connections/` and `apps/api/test/http/`.

### Harness Quality Gates
- Create: `apps/api/src/modules/harness-datasets/gold-set-assertion-runner.ts`
  - Evaluates expected findings, rule hits, knowledge citations, false-positive/false-negative accounting, residual checks, and manual review thresholds.
- Modify: `apps/api/src/modules/harness-datasets/index.ts`
- Modify tests: `apps/api/test/harness-datasets/harness-dataset-service.spec.ts`

### Proofreading Context Layers
- Modify: `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
  - Add explicit layers: local block, neighboring context, section context, full-text consistency, table/text consistency, residual/free-play pass, and final risk triage.
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Persist pass-run block context, context-window evidence, residual findings, knowledge/rule citations, and human-confirmation handoff.
- Modify tests under `apps/api/test/proofreading/`.

### Knowledge And Rule Feedback Loop
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/test/knowledge/knowledge-library-v1.spec.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Modify web rule/knowledge pages only through verified UTF-8 edits.

### Complex Table Reconstruction
- Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
- Modify: `apps/worker-py/src/document_pipeline/normalize.py`
- Modify tests: `apps/worker-py/tests/document_pipeline/test_table_patches.py`
- Modify API document normalization integration tests.

### Doc To Docx Auto Conversion
- Modify: `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify tests: `apps/api/test/document-pipeline/*`

### UI Simplification And Workbench Flow
- Modify: `apps/web/src/features/manuscript-workbench/*`
- Modify: `apps/web/src/features/template-governance/*`
- Modify: `apps/web/src/features/harness-datasets/*`
- Modify browser tests under `apps/web/playwright/`.

---

## Task 0: Clean-Room Branch And Rollback Preflight

**Files:**
- No source files.
- Record evidence in terminal output before feature work.

- [ ] **Step 1: Fetch and confirm remote baseline**

Run:

```powershell
git fetch origin --prune
git log --oneline --decorate --max-count=5 origin/main
git status --short --branch
```

Expected:
- `origin/main` is the intended clean base.
- Working tree is clean before branch creation.
- If dirty, stop and either commit unrelated work elsewhere or back it up before continuing.

- [ ] **Step 2: Record dirty branch evidence before deletion**

Run:

```powershell
git ls-remote --heads origin codex/ai-key-auto-model-discovery codex/ai-key-model-discovery-clean
git branch --show-current
git rev-parse origin/main
```

Expected:
- The old dirty branch SHAs are visible in terminal history before deletion.
- `origin/main` SHA is recorded as the rollback point.

- [ ] **Step 3: Reset local base to remote clean main**

Run only after Step 1 confirms no uncommitted work needs saving:

```powershell
git checkout main
git reset --hard origin/main
git status --short --branch
```

Expected:
- Local `main` equals `origin/main`.
- Working tree is clean.

- [ ] **Step 4: Create a new branch with a new name**

Run:

```powershell
git checkout -b codex/no-mojibake-governed-proofreading-rebuild
git status --short --branch
```

Expected:
- Current branch is `codex/no-mojibake-governed-proofreading-rebuild`.
- No old dirty branch is checked out.

- [ ] **Step 5: Remote rollback rules**

Rules:
- Do not delete old remote dirty branches until the user explicitly approves deletion.
- If a pushed feature branch becomes contaminated, do not force-push blindly. Prefer creating a new clean branch from `origin/main` and closing the contaminated PR.
- If the current new branch must be abandoned, preserve its SHA with `git rev-parse HEAD`, then create a new branch from `origin/main`.
- Never rewrite `origin/main`.

---

## Task 1: Create The Encoding Gate First

**Files:**
- Create: `scripts/quality/scan-mojibake.mjs`
- Create: `scripts/quality/scan-mojibake.spec.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing scanner tests**

Create `scripts/quality/scan-mojibake.spec.mjs` with tests that write temporary files containing these exact bad samples using Unicode escapes, not literal Chinese strings:

```js
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanMojibakeInFiles } from "./scan-mojibake.mjs";

test("scanMojibakeInFiles catches known mojibake and question-mark corruption", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "bad.tsx");
    const bad = [
      "const a = \"\\u5bb8\\u8336\\u81ea\\u52d5\";",
      "const b = \"\\u93bf\\u64cd\\u4f5c\";",
      "const c = \"\\u7f02\\u682a\\u8f91\";",
      `const d = ${JSON.stringify("?".repeat(4))};`,
      "const e = \"\\ufffd\";",
    ].join("\n");
    await writeFile(file, bad, "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.equal(result.hits.length, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanMojibakeInFiles allows normal Chinese and English", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "good.tsx");
    await writeFile(file, "const label = \"编辑规则：校对与知识回流\";\n", "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.deepEqual(result.hits, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test scripts/quality/scan-mojibake.spec.mjs`

Expected: FAIL because `scan-mojibake.mjs` does not exist.

- [ ] **Step 3: Implement scanner**

Create `scripts/quality/scan-mojibake.mjs`:

```js
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".md",
  ".css",
  ".html",
  ".py",
]);

const MOJIBAKE_TOKENS = [
  "\u5bb8\u8336",
  "\u93bf",
  "\u7f02\u682a\u8f91",
  "\u93cd\u2033",
  "\u95ab",
  "\u7035",
  "\u93c8",
  "\u9418",
  "\u93c2",
  "\u8930",
  "\u8d04",
  "\u7459",
  "\u9428",
  "\u9357",
  "\u95c2",
  "\u93c9",
].map((token) => JSON.parse(`"${token}"`));

export async function scanMojibakeInFiles(files) {
  const hits = [];
  for (const file of files) {
    if (!existsSync(file) || !isTextFile(file)) continue;
    const text = await readFile(file, "utf8");
    text.split(/\r?\n/u).forEach((line, index) => {
      const matched = MOJIBAKE_TOKENS.filter((token) => token && line.includes(token));
      if (matched.length || line.includes("?".repeat(4)) || line.includes("\ufffd")) {
        hits.push({ file, line: index + 1, text: line.trim(), matched });
      }
    });
  }
  return { hits };
}

function isTextFile(file) {
  const dot = file.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(file.slice(dot));
}

function changedFiles() {
  const output = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
    encoding: "utf8",
  });
  return output.split(/\r?\n/u).filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : changedFiles();
  const result = await scanMojibakeInFiles(files);
  for (const hit of result.hits) {
    console.log(`${hit.file}:${hit.line}: ${hit.text}`);
  }
  if (result.hits.length) process.exit(1);
}
```

- [ ] **Step 4: Add package script**

Modify root `package.json` scripts:

```json
"scan:mojibake": "node ./scripts/quality/scan-mojibake.mjs"
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
node --test scripts/quality/scan-mojibake.spec.mjs
pnpm.cmd run scan:mojibake
```

Expected: both PASS / no output from scanner.

Commit:

```powershell
git add package.json scripts/quality/scan-mojibake.mjs scripts/quality/scan-mojibake.spec.mjs
git commit -m "test: add mojibake release gate"
```

---

## Task 2: Rebuild AI Provider Auto Configuration

**Files:**
- Modify/Create in `apps/api/src/modules/ai-provider-connections/`
- Modify: `apps/api/src/http/api-http-server.ts`
- Test: `apps/api/test/ai-provider-connections/ai-provider-auto-configuration-service.spec.ts`
- Test: `apps/api/test/http/ai-provider-connections-http.spec.ts`

- [ ] **Step 1: Write tests first**

Add tests proving:
- DeepSeek base URL can be saved as `https://api.deepseek.com/v1`.
- Qwen/OpenAI-compatible base URL can be saved without persisting real submitted keys in fixtures.
- Model list fallback works when discovery endpoint is unavailable.
- No response body echoes API keys.

Run:

```powershell
pnpm.cmd --filter @medical/api exec node --import tsx --test test/ai-provider-connections/ai-provider-auto-configuration-service.spec.ts test/http/ai-provider-connections-http.spec.ts
```

Expected: FAIL until implementation exists.

- [ ] **Step 2: Implement minimal provider service**

Implementation rules:
- Redact keys in all returned DTOs.
- Store provider config through existing repository/service patterns.
- Use OpenAI-compatible `/models` probing only when explicitly requested.
- Never hardcode real keys.

- [ ] **Step 3: Verify and scan**

Run:

```powershell
pnpm.cmd --filter @medical/api typecheck
pnpm.cmd --filter @medical/api exec node --import tsx --test test/ai-provider-connections/ai-provider-auto-configuration-service.spec.ts test/http/ai-provider-connections-http.spec.ts
pnpm.cmd run scan:mojibake
```

Commit:

```powershell
git add apps/api/src/modules/ai-provider-connections apps/api/src/http/api-http-server.ts apps/api/test/ai-provider-connections apps/api/test/http/ai-provider-connections-http.spec.ts
git commit -m "feat: add safe ai provider auto configuration"
```

---

## Task 3: Rebuild Harness Content Quality Gates

**Files:**
- Create: `apps/api/src/modules/harness-datasets/gold-set-assertion-runner.ts`
- Modify: `apps/api/src/modules/harness-datasets/index.ts`
- Modify tests: `apps/api/test/harness-datasets/harness-dataset-service.spec.ts`
- Create/modify docs: `docs/HARNESS_QUALITY_GATES.md`

- [ ] **Step 1: Add failing gold-set tests**

Tests must assert:
- Gold set fixture contains at least 3 manuscripts or manuscript snippets: one terminology issue, one table/text consistency issue, and one statistical expression issue.
- Expected issue recall is calculated and fails below `0.80` for internal-test mode.
- Precision is calculated and fails below `0.60` when false positives dominate.
- Expected rule hit IDs are required for deterministic findings.
- Expected knowledge item IDs are required for knowledge-backed findings.
- False positives and false negatives are counted with item IDs and reasons.
- Manual review pass rate is reported and fails below `0.90` for high-risk findings.
- A run can fail content gates even if execution status is `passed`.

- [ ] **Step 2: Implement runner**

Implement `GoldSetAssertionRunner` as a pure function/service with no model calls.

- [ ] **Step 3: Wire into harness output**

Add content gate result to harness dataset execution response, preserving existing fields.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm.cmd --filter @medical/api exec node --import tsx --test test/harness-datasets/harness-dataset-service.spec.ts
pnpm.cmd --filter @medical/api typecheck
pnpm.cmd run scan:mojibake
```

Commit:

```powershell
git add apps/api/src/modules/harness-datasets apps/api/test/harness-datasets docs/HARNESS_QUALITY_GATES.md
git commit -m "feat: add content quality gates to harness datasets"
```

---

## Task 4: Rebuild Proofreading Context And Residual Layers

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-pass-run-record.ts`
- Modify tests under `apps/api/test/proofreading/`

- [ ] **Step 1: Add failing tests**

Tests must prove:
- Each chunk includes neighbor context metadata.
- A full-text consistency pass runs after chunk-level passes.
- Rule hits and knowledge citations are included in the prompt/context package.
- A residual/free-play pass runs after deterministic rules.
- Pass-run detail exposes block, context, residual, and citation evidence.

- [ ] **Step 2: Implement context packages**

Add typed structures for:
- `localBlockContext`
- `neighborContext`
- `sectionContext`
- `globalConsistencyContext`
- `ruleCitationContext`
- `knowledgeCitationContext`
- `residualAnalysisContext`

- [ ] **Step 3: Verify and commit**

Run:

```powershell
pnpm.cmd --filter @medical/api exec node --import tsx --test test/proofreading/proofreading-ai-plan-service.spec.ts test/proofreading/proofreading-bare-run.spec.ts
pnpm.cmd --filter @medical/api typecheck
pnpm.cmd run scan:mojibake
```

Commit:

```powershell
git add apps/api/src/modules/proofreading apps/api/test/proofreading
git commit -m "feat: add proofreading context and residual layers"
```

---

## Task 5: Rebuild Knowledge Feedback Loop

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/test/knowledge/knowledge-library-v1.spec.ts`
- Modify: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Modify web learning review tests if needed.

- [ ] **Step 1: Add failing tests**

Tests must prove:
- Manual confirmation creates a learning candidate.
- Residual finding moves through `detected -> human_confirmed -> candidate_created -> approved -> activated`.
- Candidate can be approved into knowledge/rule draft.
- Rejected candidate does not activate.
- Approved knowledge is retrievable by later proofreading context.
- Re-running the same gold set after activation increases rule/knowledge hit coverage or records a no-regression explanation.

- [ ] **Step 2: Implement service wiring**

Preserve existing review statuses and add only missing fields/routes.

- [ ] **Step 3: Verify and commit**

Run:

```powershell
pnpm.cmd --filter @medical/api exec node --import tsx --test test/knowledge/knowledge-library-v1.spec.ts test/learning-governance/learning-governance.spec.ts
pnpm.cmd --filter @medical/api typecheck
pnpm.cmd run scan:mojibake
```

Commit:

```powershell
git add apps/api/src/modules/knowledge apps/api/test/knowledge apps/api/test/learning-governance
git commit -m "feat: close proofreading learning feedback loop"
```

---

## Task 6: Rebuild Doc Conversion And Complex Table Reconstruction

**Files:**
- Modify: `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-source-block-resolver.ts`
- Modify: `apps/worker-py/src/document_pipeline/normalize.py`
- Modify: `apps/worker-py/src/document_pipeline/table_patches.py`
- Modify tests under `apps/api/test/document-pipeline/` and `apps/worker-py/tests/document_pipeline/`

- [ ] **Step 1: Add failing doc conversion tests**

Tests must prove:
- `.doc` upload is marked for normalization.
- `.doc` upload creates a normalized `.docx` asset automatically when the local converter is available.
- Converter-unavailable state returns a clear blocked reason and does not pretend conversion succeeded.
- Current asset pointers prefer normalized `.docx` for downstream modules.
- Windows local and CI paths are configurable through environment variables, not hardcoded.

- [ ] **Step 2: Add failing complex table tests**

Tests must prove:
- Merged cells survive reconstruction.
- Header rows survive reconstruction.
- Nested tables are detected and blocked from unsafe automatic rewrite unless fidelity metadata is complete.
- Cross-page table continuation is represented with continuation metadata.
- Footnotes/captions are preserved.
- Table-to-text consistency findings can reference row/column coordinates after reconstruction.
- Round-trip DOCX output can be reopened by the existing source-block resolver.
- Rebuilt table is flagged when fidelity is uncertain.

- [ ] **Step 3: Implement conversion/reconstruction**

Use existing document pipeline patterns. Keep deterministic reconstruction separate from AI edits.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm.cmd --filter @medical/api exec node --import tsx --test test/document-pipeline/document-normalization.spec.ts test/document-pipeline/python-docx-source-block-resolver.spec.ts test/http/workbench-http.spec.ts
python -m pytest apps/worker-py/tests/document_pipeline/test_normalize.py apps/worker-py/tests/document_pipeline/test_table_patches.py
pnpm.cmd run scan:mojibake
```

Commit:

```powershell
git add apps/api/src/modules/document-pipeline apps/api/test/document-pipeline apps/api/test/http/workbench-http.spec.ts apps/worker-py/src/document_pipeline apps/worker-py/tests/document_pipeline
git commit -m "feat: normalize doc uploads and preserve complex tables"
```

---

## Task 7: Rebuild UI Simplification With Browser Acceptance

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/*`
- Modify: `apps/web/src/features/template-governance/*`
- Modify: `apps/web/src/features/harness-datasets/*`
- Modify browser tests: `apps/web/playwright/admin-governance.spec.ts`, `apps/web/playwright/manuscript-handoff.spec.ts`, `apps/web/playwright/learning-review-flow.spec.ts`

- [ ] **Step 1: Add failing UI tests first**

Tests must prove:
- Rule center no longer shows duplicate low-value cards.
- Knowledge/rule entry routes still work.
- Manual confirmation subpage is reachable.
- Screening → editing → proofreading → manual confirmation → final output flow works.

- [ ] **Step 2: Implement UI changes safely**

For Chinese labels:
- Prefer copying from `origin/main` known-good files.
- If writing new labels, generate using code points or edit in UTF-8-safe editor only.
- Run scanner immediately after every changed UI file.

- [ ] **Step 3: Verify and commit**

Run:

```powershell
pnpm.cmd --filter @medsys/web typecheck
pnpm.cmd --filter @medsys/web run test:browser -- --browser=chromium playwright/admin-governance.spec.ts
pnpm.cmd --filter @medsys/web run test:browser -- --browser=chromium playwright/manuscript-handoff.spec.ts
pnpm.cmd --filter @medsys/web run test:browser -- --browser=chromium playwright/learning-review-flow.spec.ts
pnpm.cmd run scan:mojibake
```

Commit:

```powershell
git add apps/web/src apps/web/playwright apps/web/test
 git commit -m "feat: simplify governance ui and preserve workbench flow"
```

---

## Task 8: Real Model Acceptance Harness

**Files:**
- Create: `scripts/harness/proofreading-closure-preflight.mjs`
- Create: `scripts/harness/run-real-proofreading-acceptance.mjs`
- Create tests for both scripts.
- Modify: `package.json`

- [ ] **Step 1: Add failing harness script tests**

Tests must prove:
- Missing provider env fails clearly.
- Real API key is read only from env.
- Output summarizes issues found, rule hits, knowledge hits, residual findings, and final gate result.
- Script never logs the API key.

- [ ] **Step 2: Implement scripts**

Add package scripts:

```json
"verify:real-proofreading": "node --import ./apps/api/node_modules/tsx/dist/loader.mjs ./scripts/harness/run-real-proofreading-acceptance.mjs",
"verify:proofreading-preflight": "node ./scripts/harness/proofreading-closure-preflight.mjs"
```

- [ ] **Step 3: Verify and commit**

Run:

```powershell
node --test scripts/harness/proofreading-closure-preflight.spec.mjs scripts/harness/run-real-proofreading-acceptance.spec.mjs
pnpm.cmd run scan:mojibake
```

Manual real-provider gate before PR readiness:

```powershell
$env:REAL_ACCEPTANCE_PROVIDER='deepseek'
$env:REAL_ACCEPTANCE_BASE_URL='https://api.deepseek.com/v1'
$env:REAL_ACCEPTANCE_MODEL='deepseek-chat'
$env:REAL_ACCEPTANCE_API_KEY='<set in shell only>'
pnpm.cmd run verify:proofreading-preflight
pnpm.cmd run verify:real-proofreading
```

Expected:
- API key is never printed.
- Output includes model name, issue count, rule hit count, knowledge hit count, residual count, recall estimate, and final gate verdict.

Commit:

```powershell
git add package.json scripts/harness
git commit -m "feat: add real proofreading acceptance harness"
```

---

## Task 9: Final Full Verification And PR

**Files:**
- No feature files unless verification exposes a defect.

- [ ] **Step 1: Full local verification**

Run:

```powershell
pnpm.cmd run scan:mojibake
pnpm.cmd run verify:proofreading-preflight
pnpm.cmd run verify:real-proofreading
pnpm.cmd verify:manuscript-workbench
pnpm.cmd --filter @medsys/web exec node --import tsx --test ./test/onlyoffice-preview-surface.spec.ts ./test/template-governance-rule-ledger-page.spec.tsx
rg -n "<<<<<<<|=======|>>>>>>>|9243f4e0|ee555c|sk-[A-Za-z0-9_-]{20,}" .
git diff --check
git status --short --branch
```

Expected:
- Mojibake scan has zero hits.
- Workbench release gate passes.
- Focused tests pass.
- Secret scan finds only fake test keys, never user-provided real keys.
- `git diff --check` reports no whitespace/error marker issues.
- PR checks must pass on GitHub before merge. If `gh` is installed, run `gh pr checks --watch`; otherwise verify the Actions page manually.
- PR description must include the model used for real acceptance, elapsed time, issue count, gate verdict, and explicit `scan:mojibake` zero-hit evidence.

- [ ] **Step 2: Push new branch**

Run:

```powershell
git push -u origin codex/no-mojibake-governed-proofreading-rebuild
```

- [ ] **Step 3: Open PR**

If `gh` is unavailable, use:

```text
https://github.com/OverHeMin/Manuscript-editing-and-proofreading-system/pull/new/codex/no-mojibake-governed-proofreading-rebuild
```

PR description must include:
- Each verification command and result.
- `scan:mojibake` zero-hit evidence.
- Statement that old dirty branches are abandoned or deleted.

---

## Self-Review

- Spec coverage: The plan covers AI provider routing, Harness quality gates, gold set, residual analysis, knowledge feedback loop, complex table reconstruction, doc-to-docx auto conversion, UI simplification, manual confirmation flow, and real-model acceptance harness.
- Encoding risk: The first task creates a scanner before any feature work. Every later task requires scanner execution before commit.
- Remote safety: The plan does not force-push or reset `main`; dirty feature branches are deleted only after explicit user confirmation.
- Test discipline: Every feature task starts with failing tests and ends with targeted verification plus mojibake scan.
