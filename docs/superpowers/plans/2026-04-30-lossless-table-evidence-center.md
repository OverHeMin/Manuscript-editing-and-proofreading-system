# Lossless Table Evidence Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent runtime TableEvidenceCenter that preserves native DOCX table OOXML, exposes lossless character/style evidence, and lets proofreading AI consume structured table evidence without mutating table content.

**Architecture:** Add a document-pipeline runtime evidence center parallel to the existing knowledge-base table evidence workflow. The center extracts and caches lossless DOCX table evidence, proofreading consumes AI-readable table payloads plus deterministic checks, and UI presents table evidence cards while all table mutation remains comment-only or disabled.

**Tech Stack:** TypeScript API modules, existing document asset repositories, Python DOCX worker using OOXML parsing, React manuscript workbench, existing proofreading deep pass orchestration, existing test runners for API/web/worker.

---

## File Structure and Boundaries

### New runtime document-pipeline files

- `apps/api/src/modules/document-pipeline/table-evidence-center.ts`
  - Owns `getOrCreateSnapshot({ manuscriptId, assetId })`.
  - Computes/uses `docxHash + parserVersion` cache key.
  - Calls worker adapter and repository.

- `apps/api/src/modules/document-pipeline/table-evidence-record.ts`
  - Runtime contracts for `TableEvidenceSnapshot`, `TableEvidenceTable`, `TableEvidenceCell`, `TableEvidenceCharacter`, `AiReadableTablePayload`, status, warnings, and storage refs.
  - Must not reuse knowledge review statuses.

- `apps/api/src/modules/document-pipeline/table-evidence-repository.ts`
  - Repository interface and in-memory implementation if the runtime has demo/in-memory patterns.
  - Persistent implementation may be added near existing persistent runtime wiring.

- `apps/api/src/modules/document-pipeline/table-evidence-worker-adapter.ts`
  - TypeScript adapter that invokes the Python worker and normalizes output.

- `apps/api/src/modules/document-pipeline/table-evidence-payload-builder.ts`
  - Builds AI-readable, token-bounded payloads from full evidence snapshots.

- `apps/api/src/modules/document-pipeline/table-evidence-validator.ts`
  - Assigns `complete | partial | unsupported | failed` and warning codes.

### Worker files

- Modify `apps/worker-py/src/document_pipeline/parse_docx.py`
  - Extract table-level raw OOXML, row/cell/run paths, hashes, character evidence, raw XML facts.
  - Must preserve raw text in authority/character evidence without normalization.

- Create or modify `apps/worker-py/src/document_pipeline/extract_table_evidence.py`
  - Dedicated worker entrypoint if cleaner than extending `extract_docx_structure.py`.

### Proofreading files

- Modify `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Include table evidence snapshot in proofreading artifacts.

- Modify `apps/api/src/modules/proofreading/proofreading-slice-builder.ts`
  - Table slices include structured `aiReadableTablePayload`; flat text remains fallback only.

- Modify `apps/api/src/modules/proofreading/deep-proofreading-contracts.ts`
  - Extend slice context to carry table evidence IDs and payload refs.

- Modify `apps/api/src/modules/proofreading/deep-proofreading-pass-runner.ts`
  - Pass structured table context into `proofreadingAiPlanService.createPlan`.

- Modify `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
  - Update prompt contract to require table/cell/char anchors.

- Modify `apps/api/src/modules/proofreading/table-data-deterministic-checker.ts`
  - Add lossless evidence checks while preserving existing fact-ledger checks.

### Web files

- Modify `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  - Add proofing table evidence panel entry point.

- Create `apps/web/src/features/manuscript-workbench/proofreading-table-evidence-panel.tsx`
  - Displays table evidence cards, special characters, style spans, and confidence/status.

- Modify relevant API client/types under `apps/web/src/features/manuscripts` or `apps/web/src/features/manuscript-workbench` if current patterns require.

### Tests and fixtures

- Create real DOCX fixtures under the existing API/worker test fixture convention after confirming current test directories.
- Add unit tests for worker extraction, TypeScript normalization, center caching, proofreading slice payload, deterministic checks, and web rendering.

---

## Task 0: Re-sync branch and verify baseline

**Files:** none

- [ ] **Step 1: Fetch latest main**

Run:

```powershell
git fetch origin
git status --short --branch
```

Expected: branch is `codex/lossless-table-evidence-design`; no implementation changes except design docs.

- [ ] **Step 2: Rebase or merge latest main only if needed**

Run one of:

```powershell
git merge origin/main
```

Expected: no conflicts. If conflicts occur in design docs only, resolve by preserving final design and plan.

- [ ] **Step 3: Inspect package scripts**

Run:

```powershell
Get-Content package.json
Get-Content apps/api/package.json
Get-Content apps/web/package.json
```

Expected: identify exact test/typecheck commands before implementation.

---

## Task 1: Add runtime table evidence contracts

**Files:**
- Create: `apps/api/src/modules/document-pipeline/table-evidence-record.ts`
- Test: `apps/api/test/document-pipeline/table-evidence-record.spec.ts`

- [ ] **Step 1: Write contract tests**

Create tests that assert runtime status is independent from curated knowledge statuses and that character classes include required medical-table characters.

Required assertions:

```ts
import { describe, expect, it } from "vitest";
import {
  tableEvidenceCharacterClasses,
  tableEvidenceSnapshotStatuses,
} from "../../src/modules/document-pipeline/table-evidence-record.ts";

describe("runtime table evidence contracts", () => {
  it("uses runtime fidelity statuses", () => {
    expect(tableEvidenceSnapshotStatuses).toEqual([
      "complete",
      "partial",
      "unsupported",
      "failed",
    ]);
  });

  it("classifies medical table characters without collapsing symbols", () => {
    expect(tableEvidenceCharacterClasses).toContain("half_space");
    expect(tableEvidenceCharacterClasses).toContain("full_space");
    expect(tableEvidenceCharacterClasses).toContain("nbsp");
    expect(tableEvidenceCharacterClasses).toContain("en_dash");
    expect(tableEvidenceCharacterClasses).toContain("minus");
    expect(tableEvidenceCharacterClasses).toContain("tab");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run the repository's API test command for this file.

Expected: fail because `table-evidence-record.ts` does not exist.

- [ ] **Step 3: Add contracts**

Implement `table-evidence-record.ts` with:

```ts
export const tableEvidenceSnapshotStatuses = [
  "complete",
  "partial",
  "unsupported",
  "failed",
] as const;

export type TableEvidenceSnapshotStatus =
  (typeof tableEvidenceSnapshotStatuses)[number];

export const tableEvidenceCharacterClasses = [
  "normal",
  "half_space",
  "full_space",
  "nbsp",
  "tab",
  "line_break",
  "en_dash",
  "em_dash",
  "hyphen",
  "minus",
  "symbol",
  "control",
] as const;

export type TableEvidenceCharacterClass =
  (typeof tableEvidenceCharacterClasses)[number];

export interface TableEvidenceCharacter {
  index: number;
  char: string;
  codePoint: string;
  unicodeName?: string;
  charClass: TableEvidenceCharacterClass;
  sourceRunId: string;
  preserved: true;
  visible: boolean;
}

export interface TableEvidenceStyleSpan {
  runId: string;
  startIndex: number;
  endIndex: number;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
  scriptPosition?: "superscript" | "subscript" | string;
  fontFamily?: string;
  fontSizePt?: number;
}

export interface TableEvidenceRun {
  runId: string;
  runPath: string;
  rawRunXml: string;
  runHash: string;
  text: string;
  characters: TableEvidenceCharacter[];
  styleSpan: TableEvidenceStyleSpan;
}

export interface TableEvidenceCell {
  cellId: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  columnSpan: number;
  tcPath: string;
  rawTcXml: string;
  tcHash: string;
  text: string;
  paragraphs: Array<{ paragraphId: string; pPath: string; rawPXml: string; pHash: string }>;
  runs: TableEvidenceRun[];
  characters: TableEvidenceCharacter[];
  styleSpans: TableEvidenceStyleSpan[];
  borderXml?: string;
  shadingXml?: string;
  widthXml?: string;
  verticalAlignXml?: string;
  mergeXml?: string;
}

export interface AiReadableTablePayloadCell {
  cellId: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  columnSpan: number;
  text: string;
  characterClasses: Array<Pick<TableEvidenceCharacter, "index" | "char" | "codePoint" | "charClass">>;
  styleSpans: TableEvidenceStyleSpan[];
}

export interface AiReadableTablePayload {
  tableId: string;
  caption?: string;
  notes?: string[];
  rowCount: number;
  columnCount: number;
  cells: AiReadableTablePayloadCell[];
  specialCharacterWarnings: string[];
  lowConfidenceReasons: string[];
}

export interface TableEvidenceTable {
  tableId: string;
  ordinal: number;
  bodyPath: string;
  ooxmlHash: string;
  rawTblXmlStorageRef?: string;
  rawTblXml?: string;
  rowCount: number;
  columnCount: number;
  cells: TableEvidenceCell[];
  aiPayload: AiReadableTablePayload;
  fidelityReport: {
    status: TableEvidenceSnapshotStatus;
    warnings: string[];
  };
}

export interface TableEvidenceSnapshot {
  snapshotId: string;
  manuscriptId: string;
  assetId: string;
  sourceStorageKey: string;
  docxHash: string;
  parserVersion: string;
  createdAt: string;
  status: TableEvidenceSnapshotStatus;
  tables: TableEvidenceTable[];
  warnings: string[];
}
```

- [ ] **Step 4: Run focused tests**

Expected: contract tests pass.

---

## Task 2: Implement lossless worker extraction for native DOCX tables

**Files:**
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Create or modify: `apps/worker-py/src/document_pipeline/extract_table_evidence.py`
- Test: worker/API fixture tests based on existing test conventions

- [ ] **Step 1: Add failing fixture test for character preservation**

Create a test DOCX fixture or programmatically build one with a native table containing:

- half-width space ` `
- full-width space `　`
- NBSP `\u00A0`
- tab
- hyphen `-`
- en dash `–`
- em dash `—`
- minus `−`
- `±`
- `χ²`
- italic `P`
- superscript `2`

Expected extraction assertions:

```python
assert cell["characters"][0]["codePoint"].startswith("U+")
assert any(ch["charClass"] == "full_space" for ch in cell["characters"])
assert any(ch["charClass"] == "nbsp" for ch in cell["characters"])
assert any(ch["charClass"] == "en_dash" for ch in cell["characters"])
assert any(ch["charClass"] == "minus" for ch in cell["characters"])
assert any(span.get("italic") is True for span in cell["styleSpans"])
assert any(span.get("scriptPosition") for span in cell["styleSpans"])
```

- [ ] **Step 2: Run test and confirm failure**

Expected: fail because current worker lacks table-level lossless fields and character classes.

- [ ] **Step 3: Add helper functions in Python worker**

Implement helpers equivalent to:

```python
def sha256_text(value: str) -> str:
    import hashlib
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def codepoint(char: str) -> str:
    return "U+" + format(ord(char), "04X")


def classify_table_character(char: str) -> str:
    if char == " ":
        return "half_space"
    if char == "　":
        return "full_space"
    if char == "\u00A0":
        return "nbsp"
    if char == "\t":
        return "tab"
    if char in {"\n", "\r"}:
        return "line_break"
    if char == "–":
        return "en_dash"
    if char == "—":
        return "em_dash"
    if char == "-":
        return "hyphen"
    if char == "−":
        return "minus"
    if ord(char) < 32:
        return "control"
    if not char.isalnum() and not char.isspace():
        return "symbol"
    return "normal"
```

- [ ] **Step 4: Preserve raw text track**

Ensure authority/character evidence uses raw run text and does not call `normalize_table_cell_text`.

Use normalized text only for existing semantic fields.

- [ ] **Step 5: Emit table, cell, paragraph, run paths and hashes**

For each native table emit:

- `bodyPath`: stable ordinal path like `word/document.xml/body/tbl[3]`
- `rawTblXml`
- `ooxmlHash`
- `tcPath`
- `rawTcXml`
- `tcHash`
- `runPath`
- `rawRunXml`
- `runHash`
- `charRange`

- [ ] **Step 6: Run worker tests**

Expected: character preservation, raw XML, and hash tests pass.

---

## Task 3: Add TableEvidenceCenter and repository/cache

**Files:**
- Create: `apps/api/src/modules/document-pipeline/table-evidence-center.ts`
- Create: `apps/api/src/modules/document-pipeline/table-evidence-repository.ts`
- Create: `apps/api/src/modules/document-pipeline/table-evidence-worker-adapter.ts`
- Create: `apps/api/src/modules/document-pipeline/table-evidence-validator.ts`
- Test: `apps/api/test/document-pipeline/table-evidence-center.spec.ts`

- [ ] **Step 1: Write failing cache test**

Test behavior:

```ts
it("reuses a snapshot when asset hash and parser version match", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const worker = { extract: vi.fn().mockResolvedValue(buildCompleteSnapshot()) };
  const center = new TableEvidenceCenter({ repository, worker, parserVersion: "lossless-v1" });

  await center.getOrCreateSnapshot({ manuscriptId: "m1", assetId: "a1" });
  await center.getOrCreateSnapshot({ manuscriptId: "m1", assetId: "a1" });

  expect(worker.extract).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add repository interface**

Include methods:

```ts
findByAssetHash(input: { assetId: string; docxHash: string; parserVersion: string }): Promise<TableEvidenceSnapshot | undefined>;
save(snapshot: TableEvidenceSnapshot): Promise<TableEvidenceSnapshot>;
```

- [ ] **Step 3: Add center**

`getOrCreateSnapshot` should:

1. Resolve asset storage key.
2. Compute DOCX hash from source bytes.
3. Check repository by `assetId + docxHash + parserVersion`.
4. Call worker on cache miss.
5. Validate status.
6. Save and return snapshot.

- [ ] **Step 4: Add validator**

Validator returns:

- `complete` only when table XML, cell XML, paths, hashes, and characters exist for all native tables.
- `partial` when table exists but some non-critical style evidence is missing.
- `unsupported` for non-native/image/OCR/known unsupported structures.
- `failed` for extraction errors.

- [ ] **Step 5: Run API focused tests**

Expected: center caching and status tests pass.

---

## Task 4: Integrate runtime table evidence into proofreading artifacts

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/proofreading/deep-proofreading-contracts.ts`
- Modify: constructor/runtime wiring files where `ProofreadingService` is instantiated
- Test: `apps/api/test/proofreading/proofreading-table-evidence-artifacts.spec.ts`

- [ ] **Step 1: Write failing artifact test**

Test that a proofreading draft run with a DOCX asset calls `TableEvidenceCenter.getOrCreateSnapshot` and stores the snapshot on proofreading artifacts.

- [ ] **Step 2: Add optional dependency to ProofreadingService**

Add constructor option:

```ts
tableEvidenceCenter?: Pick<TableEvidenceCenter, "getOrCreateSnapshot">;
```

- [ ] **Step 3: Extend artifact type**

Add:

```ts
tableEvidenceSnapshot?: TableEvidenceSnapshot;
```

- [ ] **Step 4: Call center during artifact build**

In `buildProofreadingRunArtifacts`, after resolving source asset and before deep proofreading orchestration, call the center if available.

- [ ] **Step 5: Graceful fallback**

If extraction fails, store a failed/unsupported snapshot or warnings; do not block non-table proofreading.

- [ ] **Step 6: Run focused tests**

Expected: artifact test passes; existing proofreading tests still pass.

---

## Task 5: Replace table slice flattening with structured table payload

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-slice-builder.ts`
- Modify: `apps/api/src/modules/proofreading/deep-proofreading-contracts.ts`
- Modify: `apps/api/src/modules/proofreading/deep-proofreading-orchestrator.ts`
- Modify: `apps/api/src/modules/proofreading/deep-proofreading-pass-runner.ts`
- Test: `apps/api/test/proofreading/proofreading-table-slice-payload.spec.ts`

- [ ] **Step 1: Write failing slice test**

Given a table evidence snapshot, assert table slice contains:

```ts
expect(tableSlice.tableEvidence?.tableId).toBe("table-1");
expect(tableSlice.tableEvidence?.aiReadableTablePayload.cells[0].cellId).toBe("table-1-cell-0-0");
expect(tableSlice.text).toContain("fallback");
```

- [ ] **Step 2: Extend slice contract**

Add optional field:

```ts
tableEvidence?: {
  snapshotId: string;
  tableId: string;
  aiReadableTablePayload: AiReadableTablePayload;
  fidelityReport: TableEvidenceTable["fidelityReport"];
};
```

- [ ] **Step 3: Update slice builder input**

Accept `tableEvidenceSnapshot?: TableEvidenceSnapshot` and match evidence table by `tableId`.

- [ ] **Step 4: Update pass runner**

Pass `tableEvidence` into `sliceContext`:

```ts
sliceContext: {
  id: slice.id,
  sliceKind: slice.sliceKind,
  text: slice.text,
  tableIds: slice.tableIds,
  sourceBlockIndexes: slice.sourceBlockIndexes,
  tableEvidence: slice.tableEvidence,
}
```

- [ ] **Step 5: Run focused tests**

Expected: slice payload test passes.

---

## Task 6: Update AI proofreading prompt contract for table evidence

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-ai-plan-service.ts`
- Test: `apps/api/test/proofreading/proofreading-ai-table-payload.spec.ts`

- [ ] **Step 1: Write failing payload serialization test**

Assert `buildProofreadingUserPayload` or its public call path includes `deepProofreading.sliceContext.tableEvidence.aiReadableTablePayload` when supplied.

- [ ] **Step 2: Update system prompt**

Add instructions:

- When `deepProofreading.sliceContext.tableEvidence` exists, use it as the authoritative table reading input.
- Do not infer table cell content from flattened text when structured payload is present.
- Anchor table issues to `tableId`, `cellId`, and character ranges.
- Use `verify_fact` for medical data/statistical changes.

- [ ] **Step 3: Update schema guidance**

Ensure `documentLocator.anchorKind` supports `table_cell` and includes `tableId`, `rowKey`, `columnKey`, and evidence keys already present in existing schema.

- [ ] **Step 4: Run tests**

Expected: AI payload contains table evidence and prompt tests pass.

---

## Task 7: Upgrade deterministic table checks

**Files:**
- Modify: `apps/api/src/modules/proofreading/table-data-deterministic-checker.ts`
- Test: `apps/api/test/proofreading/table-data-deterministic-checker.spec.ts`

- [ ] **Step 1: Add failing tests for special characters and styles**

Cases:

- `P - value` uses hyphen where rule expects en dash or minus distinction.
- Cell contains NBSP next to number.
- Cell contains italic `P` missing or present.
- Cell contains superscript `2` in `χ²`.

- [ ] **Step 2: Preserve existing fact-ledger behavior**

Do not remove existing conflict-to-issue behavior.

- [ ] **Step 3: Add evidence-based checks**

Read `TableEvidenceSnapshot` or selected table evidence and emit candidate issues with:

- `source: "deterministic_check"`
- `passKind: "data_statistics_units_and_tables"`
- `anchor.documentLocator.anchorKind: "table_cell"`
- `tableId`, `cellId`, and quote.

- [ ] **Step 4: Gate noisy checks**

Only report special-character/spacing issues when they match explicit configured policy or high-risk medical/statistical patterns. Avoid flagging every NBSP globally.

- [ ] **Step 5: Run focused tests**

Expected: new deterministic findings pass and existing tests remain green.

---

## Task 8: Add proofreading table evidence panel

**Files:**
- Create: `apps/web/src/features/manuscript-workbench/proofreading-table-evidence-panel.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: relevant web types/API mappers for proofreading findings if needed
- Test: web component test if existing test setup supports it

- [ ] **Step 1: Write failing render test**

Render a table issue with evidence and assert visible:

- table ID
- cell ID
- original cell text
- special character marker
- style span label
- fidelity status

- [ ] **Step 2: Implement panel component**

Props:

```ts
interface ProofreadingTableEvidencePanelProps {
  findings: Array<{
    itemId: string;
    title: string;
    tableId?: string;
    cellId?: string;
    quote?: string;
    specialCharacters?: Array<{ char: string; codePoint: string; charClass: string }>;
    styleSpans?: Array<{ text?: string; italic?: boolean; scriptPosition?: string }>;
    fidelityStatus?: string;
  }>;
}
```

- [ ] **Step 3: Wire into workbench**

Place it in proofreading review/detail area, not in knowledge-base table evidence workspace.

- [ ] **Step 4: OnlyOffice behavior**

For table findings, button opens original/annotated DOCX preview and keeps side panel evidence visible. Do not promise direct cell selection unless existing OnlyOffice API supports it.

- [ ] **Step 5: Run web focused tests/typecheck**

Expected: component compiles and renders evidence.

---

## Task 9: Add real DOCX fixtures and P0/P1 acceptance tests

**Files:**
- Add fixtures under existing test fixture directory after confirming convention
- Add worker/API tests under existing test directories

- [ ] **Step 1: Create or locate fixture generation helper**

Use existing test dependencies if available. If no helper exists, generate DOCX fixtures with Python `zipfile` and minimal OOXML for native tables.

- [ ] **Step 2: Add required fixture matrix**

Fixtures must cover:

1. Basic three-line table.
2. Multi-level header table.
3. Merged-cell table.
4. Table with notes.
5. Half-width, full-width, NBSP spaces.
6. Hyphen, en dash, em dash, minus sign.
7. Italic and superscript/subscript variables.
8. Greek letters and statistical symbols.
9. Embedded object inside a cell.
10. Complex border, width, alignment, shading.
11. Header/footer table.
12. Revision-mark table.
13. Nested table.
14. Large table for token-budget behavior.
15. Hash drift after asset update.

- [ ] **Step 3: Add P0 tests**

Assert reproducible table/cell/run hashes and preserved characters.

- [ ] **Step 4: Add P1 tests**

Assert AI payload answers row/column/cell/special character/style span requirements.

- [ ] **Step 5: Run fixture tests**

Expected: P0/P1 tests pass.

---

## Task 10: Keep curated knowledge table evidence stable

**Files:**
- Test: `apps/api/test/knowledge/table-full-fidelity-snapshot.spec.ts` or existing equivalent
- Possibly modify bridge code only if needed

- [ ] **Step 1: Add regression test**

Assert existing knowledge full-fidelity snapshot builder still accepts `DocumentStructureTableSnapshot` and produces the current mandatory fact groups.

- [ ] **Step 2: Ensure no status collision**

Assert runtime statuses are not used by curated knowledge review contracts.

- [ ] **Step 3: Add optional converter only if needed**

If the implementation needs to pass runtime table evidence into knowledge review, add an explicit converter named like `convertRuntimeTableEvidenceToKnowledgeEvidenceDraft` and keep it human-review gated.

- [ ] **Step 4: Run knowledge/table-evidence tests**

Expected: existing knowledge-base table evidence flow remains green.

---

## Task 11: Verification pass

**Files:** none unless tests reveal bugs

- [ ] **Step 1: Run focused API tests**

Run all new and touched API tests.

Expected: pass.

- [ ] **Step 2: Run worker tests**

Run worker Python tests covering DOCX extraction.

Expected: pass.

- [ ] **Step 3: Run web tests/typecheck**

Run focused component tests and typecheck.

Expected: pass.

- [ ] **Step 4: Run integration smoke**

Create or use a sample DOCX manuscript with native table, run proofreading draft, confirm:

- table evidence snapshot exists;
- table slice payload reaches AI planning input or mocked AI call;
- deterministic table issues appear;
- UI panel renders evidence;
- no table content mutation occurs.

- [ ] **Step 5: Document residual risks**

In final handoff, explicitly state unsupported phase-1 cases: image tables, OCR tables, WPS pseudo-tables, automatic medical data patching, direct OnlyOffice cell selection if unsupported.

---

## Self-Review

Spec coverage:

- Runtime TableEvidenceCenter: Tasks 1, 3.
- Lossless DOCX extraction: Tasks 2, 9.
- Proofreading AI table payload: Tasks 4, 5, 6.
- Deterministic table checks: Task 7.
- UI and OnlyOffice evidence review: Task 8.
- Knowledge/rule center non-regression: Task 10.
- Verification: Task 11.

Known execution note:

- This plan intentionally does not enable active table patching in the first implementation wave. Patch guard types may be introduced later, but mutation remains `comment_only` until evidence extraction and review UX pass.
