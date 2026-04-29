# Table Evidence Asset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared DOCX table evidence asset workflow so knowledge library and rule center can upload, preview, correct, confirm, bind, and let AI read Word tables with full character, structure, and style fidelity.

**Architecture:** Add an independent `table-evidence` domain instead of extending the old textarea table block. The backend owns source files, immutable source snapshots, correction patches, confirmed snapshots, AI table packages, bindings, and release gates; the Python worker owns OOXML character and style extraction; React owns one shared evidence workspace used by both knowledge library and rule center. AI and published rules read only confirmed `table_evidence_revision_id` packages, never active assets or unconfirmed parsing output.

**Tech Stack:** TypeScript contracts, Node API modules, PostgreSQL JSONB migrations, Python OOXML worker, React/Vite shared feature components, Node test runner, pytest, Playwright browser checks.

---

## Review Inputs Folded In

The implementation must close the gaps found by the three subagents:

- Backend feasibility: current knowledge evidence packages are bound to `knowledge_item_id` and cannot be reused by rule center; implement a new first-class `TableEvidenceAsset / Revision / Binding` persistence model.
- Worker feasibility: current DOCX parsing already sees table cells, fragments, styles, `w:sym`, tab, and line breaks, but guarantee fields must stop using `strip()` or summary text as truth. `fragments + codepoints + paragraph boundaries` are the only character truth source.
- Frontend feasibility: the shared entry point exists through `KnowledgeLibraryRichContentEditor`, but the old `KnowledgeLibraryBlockTableEditor` is textarea based and cannot be upgraded into the guarantee path.
- AI/governance feasibility: the asset must not become a side attachment. `ai_table_package` must enter knowledge semantic generation, rule AI parsing, release gates, rule package compilation, and published rule revision locking.

## Locked Scope

- Guarantee path is `.docx` upload or drag-in only.
- Word/WPS clipboard HTML and dragged selected text are non-guarantee paths.
- Knowledge library and rule center can both create, save, bind, and reuse table evidence.
- No legacy data migration is required; existing knowledge/rule data is empty enough to replace the table entry model.
- Phase 1 includes full correction scope: text, run styles, structure, borders, alignments, captions, notes, invisible characters, invisible formatting, and special symbols.
- Similar characters are distinct facts: `-` U+002D, `–` U+2013 from Windows `Alt+0150`, `—` U+2014, `−` U+2212, full-width space U+3000, half-width space U+0020, NBSP U+00A0, tab, line break, paragraph boundary, superscript minus U+207B, and superscript digits such as U+00B9.
- `w:sym` must preserve decoded text, Unicode codepoints, original `w:char`, and original symbol font. Unknown legacy Symbol mappings get a blocking fidelity failure until manually confirmed.

## File Structure

### Contracts

- Create: `packages/contracts/src/table-evidence.ts`
  - Shared source file, asset, revision, binding, snapshot, patch, fidelity report, AI package, and API DTO types.
- Modify: `packages/contracts/src/index.ts`
  - Export `table-evidence.ts`.
- Modify: `packages/contracts/src/knowledge.ts`
  - Add `table_evidence_block` and block payload fields that reference a specific table evidence revision.
- Modify: `packages/contracts/src/rule-ai-intake.ts`
  - Extend evidence items with `confirmed_table_package`.
- Modify: `packages/contracts/src/editorial-rules.ts`
  - Allow linkage payloads to lock `table_evidence_revision_ids`.
- Create: `packages/contracts/type-tests/table-evidence.test.ts`
  - Compile-time contract coverage for table evidence blocks and rule AI evidence.

### Worker

- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
  - Add codepoints, invisible character classification, paragraph boundary fragments, and guarantee-safe text extraction.
- Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
  - Stop trimming guarantee fields; use fragment truth for source snapshots.
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
  - Add `codepoints`, `invisible_chars`, and paragraph boundary fragment types.
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
  - Preserve pure-whitespace guarantee values and new worker fields.
- Test: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`

### Backend Table Evidence Module

- Create: `apps/api/src/database/migrations/0060_table_evidence_assets.sql`
  - Add source files, assets, revisions, bindings, status enums, and `table_evidence_block` enum value.
- Create: `apps/api/src/modules/table-evidence/table-evidence-record.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-repository.ts`
- Create: `apps/api/src/modules/table-evidence/in-memory-table-evidence-repository.ts`
- Create: `apps/api/src/modules/table-evidence/postgres-table-evidence-repository.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-source-file-service.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-worker-adapter.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-package-builder.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-patch-service.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-service.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-api.ts`
- Create: `apps/api/src/modules/table-evidence/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
  - Wire repository, service, API, and HTTP routes.
- Test: `apps/api/test/table-evidence/table-evidence-service.spec.ts`
- Test: `apps/api/test/table-evidence/postgres-table-evidence-repository.spec.ts`
- Test: `apps/api/test/table-evidence/table-evidence-api.spec.ts`

### Knowledge Integration

- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
  - Add `table_evidence_block` and table evidence bindings in revision details.
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
  - Replace old table evidence gate for guarantee table blocks with table evidence revision confirmation checks.
- Modify: `apps/api/src/modules/knowledge/knowledge-ai-assist-service.ts`
  - Inject confirmed `ai_table_package` values into semantic generation.
- Modify: `apps/api/src/modules/knowledge/knowledge-content-block-normalizer.ts`
  - Normalize table evidence blocks without reading old `table_semantics` as truth.
- Test: `apps/api/test/knowledge/knowledge-table-evidence-governance.spec.ts`
- Test: `apps/api/test/knowledge/knowledge-ai-assist.spec.ts`

### Rule Center Integration

- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
  - Add locked `table_evidence_revision_ids` to `EditorialRuleLinkagePayload`.
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
  - Enforce publish/activation gates for confirmed revisions.
- Modify: `apps/api/src/modules/editorial-rules/rule-ai-parsing-service.ts`
  - Prompt and validate structured `confirmed_table_package`.
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
  - Compile locked table evidence revision IDs into package metadata.
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - Pass table evidence bindings through create, parse, publish, and compile flows.
- Test: `apps/api/test/editorial-rules/editorial-rule-table-evidence-governance.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-ai-parsing-service.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`

### Frontend Shared Feature

- Create directory: `apps/web/src/features/table-evidence/`
- Create: `apps/web/src/features/table-evidence/table-evidence-types.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-api.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-state.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-patch.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-upload-entry.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-picker.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-workspace.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-table-list.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-renderer.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-cell-editor.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-run-toolbar.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-structure-toolbar.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-format-panel.tsx`
- Create: `apps/web/src/features/table-evidence/invisible-character-overlay.tsx`
- Create: `apps/web/src/features/table-evidence/special-codepoint-inspector.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-diff-view.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-fidelity-panel.tsx`
- Create: `apps/web/src/features/table-evidence/index.ts`
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-evidence-gate.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Test: `apps/web/test/table-evidence-workspace.spec.tsx`
- Test: `apps/web/test/table-evidence-patch.spec.ts`
- Test: `apps/web/test/table-evidence-api.spec.ts`
- Test: `apps/web/test/knowledge-library-table-evidence.spec.tsx`
- Test: `apps/web/test/template-governance-table-evidence.spec.tsx`

## Invariants

- `source_snapshot` is immutable once a revision is created.
- `correction_patch` is the only editable user change record.
- `confirmed_snapshot` is generated from `source_snapshot + correction_patch`.
- `ai_table_package` is generated from `confirmed_snapshot`, not from textarea, HTML, OCR, or source summaries.
- Knowledge approval and rule publish gates must reject authoritative use of unconfirmed revisions.
- Published rules store exact `table_evidence_revision_id`; later active revision changes do not affect published rule behavior.
- Frontend invisible-character marks are display-only and never replace real text.
- Summary fields such as `text`, `display_text`, and `normalized_text` are derived views. They cannot overwrite fragments or codepoints.

## Task 1: Contracts And Type Tests

**Files:**
- Create: `packages/contracts/src/table-evidence.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/knowledge.ts`
- Modify: `packages/contracts/src/rule-ai-intake.ts`
- Modify: `packages/contracts/src/editorial-rules.ts`
- Test: `packages/contracts/type-tests/table-evidence.test.ts`

- [ ] **Step 1: Write the failing type test**

Add `packages/contracts/type-tests/table-evidence.test.ts`:

```ts
import type {
  ConfirmedAiTablePackage,
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceRevision,
  TableEvidenceTextRun,
} from "../src/table-evidence.js";
import type { KnowledgeContentBlock } from "../src/knowledge.js";
import type { RuleAiEvidenceItem } from "../src/rule-ai-intake.js";
import type { EditorialRuleLinkagePayload } from "../src/editorial-rules.js";

const run: TableEvidenceTextRun = {
  id: "run-1",
  kind: "text",
  text: "L⁻¹",
  codepoints: ["004C", "207B", "00B9"],
  style: { superscript: true, bold: false, italic: false },
  invisible_chars: [],
};

const packageRecord: ConfirmedAiTablePackage = {
  package_id: "pkg-1",
  asset_id: "asset-1",
  revision_id: "rev-1",
  revision_no: 1,
  source_file_asset_id: "file-1",
  authority: "authoritative",
  confirmation_status: "confirmed",
  fidelity_status: "confirmed",
  confirmed_by_human: true,
  parser: "python_docx_ooxml",
  parser_version: "table-evidence-v1",
  source_snapshot_hash: "sha256-source",
  confirmed_snapshot_hash: "sha256-confirmed",
  ai_table_package_hash: "sha256-package",
  caption: { text: "表1 Hcy 水平比较", runs: [run] },
  notes: [],
  structure: {
    row_count: 1,
    column_count: 1,
    header_depth: 1,
    merged_cells: [],
  },
  cells: [
    {
      cell_id: "cell-r0-c0",
      row: 0,
      column: 0,
      rowspan: 1,
      colspan: 1,
      role: "header",
      text: "Hcy（μmol·L⁻¹）",
      codepoints: [
        "0048",
        "0063",
        "0079",
        "FF08",
        "03BC",
        "006D",
        "006F",
        "006C",
        "00B7",
        "004C",
        "207B",
        "00B9",
        "FF09",
      ],
      paragraphs: [
        {
          id: "p-1",
          runs: [run],
          paragraph_boundary_after: true,
        },
      ],
      runs: [run],
      header_path: ["Hcy（μmol·L⁻¹）"],
      row_header_path: [],
      column_header_path: ["Hcy（μmol·L⁻¹）"],
      invisible_chars: [],
      style_summary: {
        bold: false,
        italic: false,
        script_positions: ["baseline", "superscript"],
        border_profile: "three_line_header",
        horizontal_alignment: "center",
        vertical_alignment: "center",
      },
    },
  ],
  fidelity_report: {
    status: "confirmed",
    failure_codes: [],
    unsupported_fact_groups: [],
    required_confirmations: [],
    invisible_chars_confirmed: true,
    special_symbols_confirmed: true,
  },
};

const asset: TableEvidenceAsset = {
  id: "asset-1",
  title: "Hcy table",
  source_file_asset_id: "file-1",
  source_file_name: "source.docx",
  source_kind: "docx_upload",
  parser: "python_docx_ooxml",
  parser_version: "table-evidence-v1",
  fidelity_status: "confirmed",
  active_revision_id: "rev-1",
  created_by: "user-1",
  created_at: "2026-04-29T00:00:00.000Z",
  updated_at: "2026-04-29T00:00:00.000Z",
};

const revision: TableEvidenceRevision = {
  id: "rev-1",
  table_evidence_asset_id: asset.id,
  revision_no: 1,
  source_snapshot: {
    snapshot_id: "source-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    caption: packageRecord.caption,
    notes: [],
    grid_cells: [],
    object_evidence: [],
    warnings: [],
  },
  correction_patch: { patch_id: "patch-1", operations: [] },
  confirmed_snapshot: {
    snapshot_id: "confirmed-1",
    source_snapshot_id: "source-1",
    row_count: 1,
    column_count: 1,
    caption: packageRecord.caption,
    notes: [],
    grid_cells: [],
  },
  ai_table_package: packageRecord,
  fidelity_report: packageRecord.fidelity_report,
  confirmation_status: "confirmed",
  confirmed_by: "user-1",
  confirmed_at: "2026-04-29T00:00:00.000Z",
  created_at: "2026-04-29T00:00:00.000Z",
};

const binding: TableEvidenceBinding = {
  id: "binding-1",
  table_evidence_asset_id: asset.id,
  table_evidence_revision_id: revision.id,
  target_type: "knowledge_revision",
  target_id: "knowledge-rev-1",
  binding_role: "source_evidence",
  created_at: "2026-04-29T00:00:00.000Z",
};

const block: KnowledgeContentBlock = {
  id: "block-1",
  revision_id: "knowledge-rev-1",
  block_type: "table_evidence_block",
  order_no: 0,
  status: "active",
  content_payload: {
    table_evidence_asset_id: asset.id,
    table_evidence_revision_id: revision.id,
    binding_id: binding.id,
  },
};

const ruleEvidence: RuleAiEvidenceItem = {
  kind: "confirmed_table_package",
  source_id: revision.id,
  authority: "authoritative",
  confirmed_table_package: packageRecord,
};

const linkage: EditorialRuleLinkagePayload = {
  table_evidence_revision_ids: [revision.id],
};

void block;
void ruleEvidence;
void linkage;
```

- [ ] **Step 2: Run the type test and verify it fails**

Run:

```bash
pnpm --filter @medical/contracts test
```

Expected: TypeScript fails because `table-evidence.ts`, `table_evidence_block`, `confirmed_table_package`, and `table_evidence_revision_ids` do not exist.

- [ ] **Step 3: Add table evidence contracts**

Create `packages/contracts/src/table-evidence.ts` with these exported types:

```ts
export type TableEvidenceSourceKind = "docx_upload";
export type TableEvidenceParser = "python_docx_ooxml";
export type TableEvidenceFidelityStatus = "pending" | "confirmed" | "needs_review";
export type TableEvidenceConfirmationStatus = "pending" | "confirmed" | "needs_review";
export type TableEvidenceAuthority = "authoritative" | "review_required" | "unavailable";
export type TableEvidenceBindingTargetType =
  | "knowledge_revision"
  | "editorial_rule"
  | "rule_draft";
export type TableEvidenceBindingRole =
  | "source_evidence"
  | "example"
  | "rule_basis"
  | "format_requirement";

export interface TableEvidenceSourceFile {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  byte_length: number;
  sha256: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface TableEvidenceAsset {
  id: string;
  title: string;
  source_file_asset_id: string;
  source_file_name: string;
  source_kind: TableEvidenceSourceKind;
  parser: TableEvidenceParser;
  parser_version: string;
  active_revision_id?: string;
  fidelity_status: TableEvidenceFidelityStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TableEvidenceInvisibleChar {
  kind:
    | "space"
    | "full_width_space"
    | "nbsp"
    | "tab"
    | "line_break"
    | "paragraph_boundary"
    | "leading_space"
    | "trailing_space"
    | "consecutive_space";
  codepoint: string;
  offset: number;
  length: number;
}

export interface TableEvidenceRunStyle {
  font_family?: string;
  font_size_pt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  script_position?: "baseline" | "superscript" | "subscript" | "mixed" | "unknown";
}

export interface TableEvidenceTextRun {
  id: string;
  kind: "text" | "symbol" | "tab" | "line_break" | "object" | "paragraph_boundary";
  text: string;
  codepoints: string[];
  style: TableEvidenceRunStyle;
  symbol_font?: string;
  symbol_char?: string;
  object_id?: string;
  object_kind?: string;
  invisible_chars: TableEvidenceInvisibleChar[];
}

export interface TableEvidenceParagraph {
  id: string;
  runs: TableEvidenceTextRun[];
  paragraph_boundary_after: boolean;
  style?: Record<string, unknown>;
}

export interface TableEvidenceCaption {
  text: string;
  label_text?: string;
  title_text?: string;
  runs: TableEvidenceTextRun[];
}

export interface TableEvidenceCellSnapshot {
  cell_id: string;
  row: number;
  column: number;
  rowspan: number;
  colspan: number;
  role: "header" | "stub" | "data" | "unknown";
  text: string;
  codepoints: string[];
  paragraphs: TableEvidenceParagraph[];
  runs: TableEvidenceTextRun[];
  header_path: string[];
  row_header_path: string[];
  column_header_path: string[];
  invisible_chars: TableEvidenceInvisibleChar[];
  style_summary: {
    bold?: boolean;
    italic?: boolean;
    script_positions?: string[];
    border_profile?: string;
    horizontal_alignment?: string;
    vertical_alignment?: string;
    three_line_role?: "top_rule" | "header_rule" | "bottom_rule" | "none";
  };
}

export interface TableSourceSnapshot {
  snapshot_id: string;
  table_id: string;
  source_file_asset_id: string;
  parser: TableEvidenceParser;
  parser_version: string;
  row_count: number;
  column_count: number;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  grid_cells: TableEvidenceCellSnapshot[];
  object_evidence: Record<string, unknown>[];
  warnings: string[];
}

export type TableCorrectionOperation =
  | {
      op: "replace_run_text";
      cell_id: string;
      paragraph_id: string;
      run_id: string;
      before_text: string;
      after_text: string;
      after_codepoints: string[];
    }
  | {
      op: "set_run_style";
      cell_id: string;
      paragraph_id: string;
      run_id: string;
      style: TableEvidenceRunStyle;
    }
  | {
      op: "set_cell_structure";
      cell_id: string;
      row: number;
      column: number;
      rowspan: number;
      colspan: number;
    }
  | {
      op: "set_cell_borders";
      cell_id: string;
      border_profile: string;
      border_payload: Record<string, unknown>;
    }
  | {
      op: "set_cell_alignment";
      cell_id: string;
      horizontal_alignment?: string;
      vertical_alignment?: string;
    }
  | {
      op: "replace_caption";
      caption: TableEvidenceCaption;
    }
  | {
      op: "replace_notes";
      notes: TableEvidenceParagraph[];
    }
  | {
      op: "confirm_special_symbols";
      cell_ids: string[];
      confirmed_symbol_run_ids: string[];
    }
  | {
      op: "confirm_invisible_chars";
      cell_ids: string[];
      confirmed_invisible_char_ids: string[];
    };

export interface TableCorrectionPatch {
  patch_id: string;
  operations: TableCorrectionOperation[];
}

export interface ConfirmedTableSnapshot {
  snapshot_id: string;
  source_snapshot_id: string;
  row_count: number;
  column_count: number;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  grid_cells: TableEvidenceCellSnapshot[];
}

export interface TableFidelityReport {
  status: TableEvidenceFidelityStatus;
  failure_codes: string[];
  unsupported_fact_groups: string[];
  required_confirmations: string[];
  invisible_chars_confirmed: boolean;
  special_symbols_confirmed: boolean;
}

export interface ConfirmedAiTablePackage {
  package_id: string;
  asset_id: string;
  revision_id: string;
  revision_no: number;
  source_file_asset_id: string;
  authority: TableEvidenceAuthority;
  confirmation_status: TableEvidenceConfirmationStatus;
  fidelity_status: TableEvidenceFidelityStatus;
  confirmed_by_human: boolean;
  confirmed_by?: string;
  confirmed_at?: string;
  parser: TableEvidenceParser;
  parser_version: string;
  source_snapshot_hash: string;
  confirmed_snapshot_hash: string;
  ai_table_package_hash: string;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  structure: {
    row_count: number;
    column_count: number;
    header_depth: number;
    merged_cells: Array<{
      cell_id?: string;
      row: number;
      column: number;
      rowspan: number;
      colspan: number;
    }>;
  };
  cells: TableEvidenceCellSnapshot[];
  fidelity_report: TableFidelityReport;
}

export interface TableEvidenceRevision {
  id: string;
  table_evidence_asset_id: string;
  revision_no: number;
  source_snapshot: TableSourceSnapshot;
  correction_patch: TableCorrectionPatch;
  confirmed_snapshot?: ConfirmedTableSnapshot;
  ai_table_package?: ConfirmedAiTablePackage;
  fidelity_report: TableFidelityReport;
  confirmation_status: TableEvidenceConfirmationStatus;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
}

export interface TableEvidenceBinding {
  id: string;
  table_evidence_asset_id: string;
  table_evidence_revision_id: string;
  target_type: TableEvidenceBindingTargetType;
  target_id: string;
  binding_role: TableEvidenceBindingRole;
  created_at: string;
}
```

- [ ] **Step 4: Export and integrate contracts**

Modify `packages/contracts/src/index.ts`:

```ts
export * from "./table-evidence.js";
```

Modify `KnowledgeContentBlock["block_type"]` in `packages/contracts/src/knowledge.ts`:

```ts
block_type: "text_block" | "table_block" | "table_evidence_block" | "image_block";
```

Modify `RuleAiEvidenceItem` in `packages/contracts/src/rule-ai-intake.ts`:

```ts
import type { ConfirmedAiTablePackage } from "./table-evidence.js";

export interface RuleAiEvidenceItem {
  kind:
    | "user_description"
    | "document_excerpt"
    | "diff_excerpt"
    | "table_snapshot"
    | "confirmed_table_package"
    | "image_understanding";
  text?: string;
  source_id?: string;
  authority?: "authoritative" | "review_required" | "unavailable";
  confirmed_table_package?: ConfirmedAiTablePackage;
}
```

Modify `EditorialRuleLinkagePayload` in `packages/contracts/src/editorial-rules.ts`:

```ts
table_evidence_revision_ids?: string[];
```

- [ ] **Step 5: Run contract tests**

Run:

```bash
pnpm --filter @medical/contracts test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/table-evidence.ts packages/contracts/src/index.ts packages/contracts/src/knowledge.ts packages/contracts/src/rule-ai-intake.ts packages/contracts/src/editorial-rules.ts packages/contracts/type-tests/table-evidence.test.ts
git commit -m "feat: add table evidence contracts"
```

## Task 2: Worker Character Fidelity

**Files:**
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/table_semantics.py`
- Modify: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`
- Test: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Test: `apps/worker-py/tests/document_pipeline/test_table_semantics.py`

- [ ] **Step 1: Add failing worker tests for invisible characters, dashes, and `w:sym`**

Append tests to `apps/worker-py/tests/document_pipeline/test_parse_docx.py`:

```py
def test_docx_table_fragments_preserve_invisible_characters_and_dashes():
    root = parse_document_xml(
        """
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                    xmlns:xml="http://www.w3.org/XML/1998/namespace">
          <w:body>
            <w:tbl>
              <w:tr>
                <w:tc>
                  <w:p>
                    <w:r><w:t xml:space="preserve"> A  B\u00a0C\u3000D–E—F−G </w:t></w:r>
                    <w:r><w:tab/></w:r>
                    <w:r><w:br/></w:r>
                    <w:r><w:t>H</w:t></w:r>
                  </w:p>
                  <w:p><w:r><w:t>next</w:t></w:r></w:p>
                </w:tc>
              </w:tr>
            </w:tbl>
          </w:body>
        </w:document>
        """
    )

    table = extract_tables(root)[0]
    cell = table["grid_cells"][0]
    fragments = cell["paragraphs"][0]["fragments"]

    assert fragments[0]["text"] == " A  B\u00a0C\u3000D–E—F−G "
    assert fragments[0]["codepoints"] == [
        "0020",
        "0041",
        "0020",
        "0020",
        "0042",
        "00A0",
        "0043",
        "3000",
        "0044",
        "2013",
        "0045",
        "2014",
        "0046",
        "2212",
        "0047",
        "0020",
    ]
    assert any(item["kind"] == "leading_space" for item in fragments[0]["invisible_chars"])
    assert any(item["kind"] == "consecutive_space" for item in fragments[0]["invisible_chars"])
    assert any(item["kind"] == "nbsp" for item in fragments[0]["invisible_chars"])
    assert any(item["kind"] == "full_width_space" for item in fragments[0]["invisible_chars"])
    assert fragments[1]["kind"] == "tab"
    assert fragments[1]["codepoints"] == ["0009"]
    assert fragments[2]["kind"] == "line_break"
    assert fragments[2]["codepoints"] == ["000A"]
    assert cell["paragraphs"][0]["paragraph_boundary_after"] is True


def test_docx_table_symbol_fragment_preserves_original_symbol_fields():
    root = parse_document_xml(
        """
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:tbl>
              <w:tr>
                <w:tc>
                  <w:p>
                    <w:r>
                      <w:sym w:font="Symbol" w:char="03BC"/>
                    </w:r>
                  </w:p>
                </w:tc>
              </w:tr>
            </w:tbl>
          </w:body>
        </w:document>
        """
    )

    table = extract_tables(root)[0]
    fragment = table["grid_cells"][0]["paragraphs"][0]["fragments"][0]

    assert fragment["kind"] == "symbol"
    assert fragment["text"] == "μ"
    assert fragment["codepoints"] == ["03BC"]
    assert fragment["symbol_font"] == "Symbol"
    assert fragment["symbol_char"] == "03BC"
```

Add this test to `apps/worker-py/tests/document_pipeline/test_table_semantics.py`:

```py
def test_table_semantics_uses_fragment_text_without_trimming_guarantee_fields():
    raw_rows = [
        [
            {
                "text": " A\u00a0 ",
                "paragraphs": [
                    {
                        "id": "p-1",
                        "text": " A\u00a0 ",
                        "paragraph_boundary_after": True,
                        "fragments": [
                            {
                                "id": "r-1",
                                "kind": "text",
                                "text": " A\u00a0 ",
                                "codepoints": ["0020", "0041", "00A0", "0020"],
                                "invisible_chars": [
                                    {"kind": "leading_space", "offset": 0, "length": 1, "codepoint": "0020"},
                                    {"kind": "nbsp", "offset": 2, "length": 1, "codepoint": "00A0"},
                                    {"kind": "trailing_space", "offset": 3, "length": 1, "codepoint": "0020"},
                                ],
                                "style": {},
                            }
                        ],
                    }
                ],
            }
        ]
    ]

    snapshot = build_table_semantic_snapshot(
        table_index=1,
        rows=raw_rows,
        caption=None,
        caption_paragraphs=[],
        notes=[],
        note_paragraphs=[],
        border_hints={},
    )

    assert snapshot["grid_cells"][0]["text"] == " A\u00a0 "
    assert snapshot["grid_cells"][0]["paragraphs"][0]["fragments"][0]["text"] == " A\u00a0 "
```

- [ ] **Step 2: Run worker tests and verify they fail**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_pipeline/test_parse_docx.py::test_docx_table_fragments_preserve_invisible_characters_and_dashes tests/document_pipeline/test_parse_docx.py::test_docx_table_symbol_fragment_preserves_original_symbol_fields tests/document_pipeline/test_table_semantics.py::test_table_semantics_uses_fragment_text_without_trimming_guarantee_fields -q
```

Expected: FAIL because `codepoints`, `invisible_chars`, paragraph boundary markers, and no-trim semantics are missing.

- [ ] **Step 3: Implement worker helpers**

In `apps/worker-py/src/document_pipeline/parse_docx.py`, add helpers near existing fragment helpers:

```py
def codepoints_for_text(text: str) -> list[str]:
    return [f"{ord(character):04X}" for character in text]


def classify_invisible_chars(text: str) -> list[dict]:
    entries: list[dict] = []
    previous_space_offset: int | None = None

    for offset, character in enumerate(text):
        codepoint = f"{ord(character):04X}"
        kind: str | None = None
        if character == " ":
            kind = "space"
        elif character == "\u3000":
            kind = "full_width_space"
        elif character == "\u00a0":
            kind = "nbsp"
        elif character == "\t":
            kind = "tab"
        elif character == "\n":
            kind = "line_break"

        if kind is not None:
            entries.append({"kind": kind, "codepoint": codepoint, "offset": offset, "length": 1})

        if character == " ":
            if offset == 0:
                entries.append({"kind": "leading_space", "codepoint": codepoint, "offset": offset, "length": 1})
            if offset == len(text) - 1:
                entries.append({"kind": "trailing_space", "codepoint": codepoint, "offset": offset, "length": 1})
            if previous_space_offset == offset - 1:
                entries.append({"kind": "consecutive_space", "codepoint": codepoint, "offset": previous_space_offset, "length": 2})
            previous_space_offset = offset
        else:
            previous_space_offset = None

    return entries
```

Update all inline fragment builders so every fragment includes:

```py
fragment["codepoints"] = codepoints_for_text(fragment["text"])
fragment["invisible_chars"] = classify_invisible_chars(fragment["text"])
```

For `w:tab` fragments set `text` to `"\t"`, `codepoints` to `["0009"]`, and `invisible_chars` to one `tab` entry.

For `w:br` fragments set `text` to `"\n"`, `codepoints` to `["000A"]`, and `invisible_chars` to one `line_break` entry.

For paragraph snapshots add `paragraph_boundary_after: True` and append this display-only boundary metadata to the paragraph object:

```py
"paragraph_boundary": {
    "kind": "paragraph_boundary",
    "codepoint": "PARA",
}
```

- [ ] **Step 4: Remove guarantee-path trimming**

In `apps/worker-py/src/document_pipeline/parse_docx.py`, keep existing summary text where needed for labels, but change guarantee grid cell fields to retain raw paragraph text:

```py
cell_text = "".join(
    fragment.get("text", "")
    for paragraph in paragraphs
    for fragment in paragraph.get("fragments", [])
)
raw_cell["text"] = cell_text
raw_cell["display_text"] = cell_text
raw_cell["normalized_text"] = normalize_for_search(cell_text)
```

In `apps/worker-py/src/document_pipeline/table_semantics.py`, replace guarantee cell text reads like:

```py
text = (raw_cell.get("text") or "").strip()
```

with:

```py
text = raw_cell.get("text") if isinstance(raw_cell.get("text"), str) else ""
```

Keep `strip()` only in non-authoritative classifier checks such as caption detection, never in snapshot truth fields.

- [ ] **Step 5: Extend TypeScript worker adapter types**

In `apps/api/src/modules/document-pipeline/document-structure-service.ts`, extend `DocumentStructureTableInlineFragment`:

```ts
codepoints?: string[];
invisible_chars?: Array<{
  kind: string;
  codepoint: string;
  offset: number;
  length: number;
}>;
```

Extend `DocumentStructureTableParagraphSnapshot`:

```ts
paragraph_boundary_after?: boolean;
paragraph_boundary?: {
  kind: "paragraph_boundary";
  codepoint: "PARA";
};
```

In `apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts`, read the new fields without dropping pure whitespace text. Add a dedicated helper:

```ts
function readGuaranteeString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
```

Use `readGuaranteeString` for fragment text, paragraph text, grid cell `text`, and display fields that are part of source snapshots. Keep `readOptionalString` for IDs and labels.

- [ ] **Step 6: Run worker and API type checks**

Run:

```bash
pnpm --filter @medical/worker-py exec python -m pytest tests/document_pipeline/test_parse_docx.py tests/document_pipeline/test_table_semantics.py -q
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/worker-py/src/document_pipeline/parse_docx.py apps/worker-py/src/document_pipeline/table_semantics.py apps/worker-py/tests/document_pipeline/test_parse_docx.py apps/worker-py/tests/document_pipeline/test_table_semantics.py apps/api/src/modules/document-pipeline/document-structure-service.ts apps/api/src/modules/document-pipeline/python-docx-structure-worker-adapter.ts
git commit -m "feat: preserve docx table character fidelity"
```

## Task 3: Database Schema And Repository

**Files:**
- Create: `apps/api/src/database/migrations/0060_table_evidence_assets.sql`
- Create: `apps/api/src/modules/table-evidence/table-evidence-record.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-repository.ts`
- Create: `apps/api/src/modules/table-evidence/in-memory-table-evidence-repository.ts`
- Create: `apps/api/src/modules/table-evidence/postgres-table-evidence-repository.ts`
- Create: `apps/api/src/modules/table-evidence/index.ts`
- Test: `apps/api/test/table-evidence/postgres-table-evidence-repository.spec.ts`
- Test: `apps/api/test/table-evidence/table-evidence-repository.spec.ts`

- [ ] **Step 1: Write repository behavior tests**

Create `apps/api/test/table-evidence/table-evidence-repository.spec.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTableEvidenceRepository } from "../../src/modules/table-evidence/index.ts";

test("table evidence repository stores immutable revisions and target bindings", async () => {
  const repository = new InMemoryTableEvidenceRepository();

  await repository.saveSourceFile({
    id: "file-1",
    storage_key: "uploads/2026/04/29/file.docx",
    file_name: "file.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byte_length: 128,
    sha256: "sha256-file",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:00:00.000Z",
  });

  await repository.saveAsset({
    id: "asset-1",
    title: "Table 1",
    source_file_asset_id: "file-1",
    source_file_name: "file.docx",
    source_kind: "docx_upload",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    fidelity_status: "pending",
    created_by: "user-1",
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  });

  await repository.saveRevision({
    id: "rev-1",
    table_evidence_asset_id: "asset-1",
    revision_no: 1,
    source_snapshot: {
      snapshot_id: "source-1",
      table_id: "table-1",
      source_file_asset_id: "file-1",
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      row_count: 1,
      column_count: 1,
      notes: [],
      grid_cells: [],
      object_evidence: [],
      warnings: [],
    },
    correction_patch: { patch_id: "patch-1", operations: [] },
    fidelity_report: {
      status: "pending",
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: ["invisible_chars", "special_symbols"],
      invisible_chars_confirmed: false,
      special_symbols_confirmed: false,
    },
    confirmation_status: "pending",
    created_at: "2026-04-29T00:00:00.000Z",
  });

  await repository.saveBinding({
    id: "binding-1",
    table_evidence_asset_id: "asset-1",
    table_evidence_revision_id: "rev-1",
    target_type: "knowledge_revision",
    target_id: "knowledge-rev-1",
    binding_role: "source_evidence",
    created_at: "2026-04-29T00:00:00.000Z",
  });

  const bindings = await repository.listBindingsForTarget("knowledge_revision", "knowledge-rev-1");
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].table_evidence_revision_id, "rev-1");

  const revision = await repository.findRevisionById("rev-1");
  assert.equal(revision?.source_snapshot.table_id, "table-1");
});
```

Create `apps/api/test/table-evidence/postgres-table-evidence-repository.spec.ts` following the existing postgres test harness pattern in `apps/api/test/knowledge/postgres-knowledge-persistence.spec.ts`. Assert the same source file, asset, revision, and binding round trip.

- [ ] **Step 2: Run repository tests and verify they fail**

Run:

```bash
pnpm --filter @medical/api test -- table-evidence
```

Expected: FAIL because the module, migration, and repositories do not exist.

- [ ] **Step 3: Add migration**

Create `apps/api/src/database/migrations/0060_table_evidence_assets.sql`:

```sql
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'table_evidence_source_kind'
  ) then
    create type table_evidence_source_kind as enum ('docx_upload');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'table_evidence_parser'
  ) then
    create type table_evidence_parser as enum ('python_docx_ooxml');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'table_evidence_fidelity_status'
  ) then
    create type table_evidence_fidelity_status as enum ('pending', 'confirmed', 'needs_review');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'table_evidence_confirmation_status'
  ) then
    create type table_evidence_confirmation_status as enum ('pending', 'confirmed', 'needs_review');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'table_evidence_binding_target_type'
  ) then
    create type table_evidence_binding_target_type as enum (
      'knowledge_revision',
      'editorial_rule',
      'rule_draft'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'table_evidence_binding_role'
  ) then
    create type table_evidence_binding_role as enum (
      'source_evidence',
      'example',
      'rule_basis',
      'format_requirement'
    );
  end if;
end
$$;

alter type knowledge_content_block_type add value if not exists 'table_evidence_block';

create table if not exists table_evidence_source_files (
  id text primary key,
  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  byte_length integer not null,
  sha256 text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  constraint table_evidence_source_files_byte_length_check
    check (byte_length > 0)
);

create unique index if not exists table_evidence_source_files_sha256_idx
  on table_evidence_source_files (sha256, file_name);

create table if not exists table_evidence_assets (
  id text primary key,
  title text not null,
  source_file_asset_id text not null,
  source_file_name text not null,
  source_kind table_evidence_source_kind not null default 'docx_upload',
  parser table_evidence_parser not null default 'python_docx_ooxml',
  parser_version text not null,
  active_revision_id text,
  fidelity_status table_evidence_fidelity_status not null default 'pending',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_evidence_assets_source_file_asset_id_fkey
    foreign key (source_file_asset_id) references table_evidence_source_files(id) on delete restrict
);

create table if not exists table_evidence_revisions (
  id text primary key,
  table_evidence_asset_id text not null,
  revision_no integer not null,
  source_snapshot jsonb not null,
  correction_patch jsonb not null,
  confirmed_snapshot jsonb,
  ai_table_package jsonb,
  fidelity_report jsonb not null,
  confirmation_status table_evidence_confirmation_status not null default 'pending',
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint table_evidence_revisions_asset_id_fkey
    foreign key (table_evidence_asset_id) references table_evidence_assets(id) on delete cascade,
  constraint table_evidence_revisions_asset_revision_no_key
    unique (table_evidence_asset_id, revision_no),
  constraint table_evidence_revisions_revision_no_check
    check (revision_no > 0),
  constraint table_evidence_revisions_confirmed_payload_check
    check (
      confirmation_status <> 'confirmed'
      or (confirmed_snapshot is not null and ai_table_package is not null and confirmed_by is not null and confirmed_at is not null)
    )
);

alter table table_evidence_assets
  add constraint table_evidence_assets_active_revision_id_fkey
  foreign key (active_revision_id) references table_evidence_revisions(id) on delete set null;

create table if not exists table_evidence_bindings (
  id text primary key,
  table_evidence_asset_id text not null,
  table_evidence_revision_id text not null,
  target_type table_evidence_binding_target_type not null,
  target_id text not null,
  binding_role table_evidence_binding_role not null,
  created_at timestamptz not null default now(),
  constraint table_evidence_bindings_asset_id_fkey
    foreign key (table_evidence_asset_id) references table_evidence_assets(id) on delete cascade,
  constraint table_evidence_bindings_revision_id_fkey
    foreign key (table_evidence_revision_id) references table_evidence_revisions(id) on delete restrict,
  constraint table_evidence_bindings_unique_target_revision_role
    unique (target_type, target_id, table_evidence_revision_id, binding_role)
);

create index if not exists table_evidence_assets_active_revision_idx
  on table_evidence_assets (active_revision_id);

create index if not exists table_evidence_assets_fidelity_status_idx
  on table_evidence_assets (fidelity_status, updated_at desc, id);

create index if not exists table_evidence_revisions_asset_created_idx
  on table_evidence_revisions (table_evidence_asset_id, created_at desc, id);

create index if not exists table_evidence_revisions_confirmation_idx
  on table_evidence_revisions (confirmation_status, created_at desc, id);

create index if not exists table_evidence_bindings_target_idx
  on table_evidence_bindings (target_type, target_id, created_at desc, id);

create index if not exists table_evidence_bindings_revision_idx
  on table_evidence_bindings (table_evidence_revision_id);
```

- [ ] **Step 4: Add records and repository interfaces**

Create `table-evidence-record.ts` by re-exporting contract shapes for the API layer:

```ts
export type {
  ConfirmedAiTablePackage,
  ConfirmedTableSnapshot,
  TableCorrectionPatch,
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingRole,
  TableEvidenceBindingTargetType,
  TableEvidenceConfirmationStatus,
  TableEvidenceFidelityStatus,
  TableEvidenceSourceFile,
  TableEvidenceRevision,
  TableFidelityReport,
  TableSourceSnapshot,
} from "@medical/contracts";
```

Create `table-evidence-repository.ts`:

```ts
import type {
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingTargetType,
  TableEvidenceRevision,
  TableEvidenceSourceFile,
} from "./table-evidence-record.ts";

export interface TableEvidenceRepository {
  saveSourceFile(record: TableEvidenceSourceFile): Promise<void>;
  findSourceFileById(id: string): Promise<TableEvidenceSourceFile | undefined>;
  saveAsset(record: TableEvidenceAsset): Promise<void>;
  findAssetById(id: string): Promise<TableEvidenceAsset | undefined>;
  searchAssets(input: {
    search?: string;
    status?: TableEvidenceAsset["fidelity_status"];
    limit: number;
  }): Promise<TableEvidenceAsset[]>;
  saveRevision(record: TableEvidenceRevision): Promise<void>;
  findRevisionById(id: string): Promise<TableEvidenceRevision | undefined>;
  listRevisionsForAsset(assetId: string): Promise<TableEvidenceRevision[]>;
  setActiveRevision(assetId: string, revisionId: string, fidelityStatus: TableEvidenceAsset["fidelity_status"]): Promise<void>;
  saveBinding(record: TableEvidenceBinding): Promise<void>;
  listBindingsForTarget(targetType: TableEvidenceBindingTargetType, targetId: string): Promise<TableEvidenceBinding[]>;
  listBindingsForRevision(revisionId: string): Promise<TableEvidenceBinding[]>;
}
```

- [ ] **Step 5: Implement in-memory and postgres repositories**

`InMemoryTableEvidenceRepository` stores cloned records in Maps:

```ts
const clone = <T>(value: T): T => structuredClone(value);
```

Postgres repository maps JSONB fields with `JSON.stringify` on writes and safe JSON parsing on reads, matching `PostgresKnowledgeRepository` style.

For `searchAssets`, use:

```sql
select *
from table_evidence_assets
where ($1::text is null or title ilike '%' || $1 || '%' or source_file_name ilike '%' || $1 || '%')
  and ($2::table_evidence_fidelity_status is null or fidelity_status = $2)
order by updated_at desc, id asc
limit $3
```

- [ ] **Step 6: Export the module**

Create `apps/api/src/modules/table-evidence/index.ts`:

```ts
export * from "./table-evidence-record.ts";
export * from "./table-evidence-repository.ts";
export * from "./in-memory-table-evidence-repository.ts";
export * from "./postgres-table-evidence-repository.ts";
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @medical/api test -- table-evidence
```

Expected: PASS for repository tests.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/database/migrations/0060_table_evidence_assets.sql apps/api/src/modules/table-evidence apps/api/test/table-evidence
git commit -m "feat: persist table evidence assets"
```

## Task 4: Source File Upload, DOCX Parsing, Patch Merge, And AI Package Builder

**Files:**
- Create: `apps/api/src/modules/table-evidence/table-evidence-source-file-service.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-worker-adapter.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-patch-service.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-package-builder.ts`
- Create: `apps/api/src/modules/table-evidence/table-evidence-service.ts`
- Modify: `apps/api/src/modules/table-evidence/index.ts`
- Test: `apps/api/test/table-evidence/table-evidence-service.spec.ts`

- [ ] **Step 1: Write service tests for upload-to-confirm flow**

Create `apps/api/test/table-evidence/table-evidence-service.spec.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import {
  InMemoryTableEvidenceRepository,
  TableEvidenceService,
} from "../../src/modules/table-evidence/index.ts";

test("table evidence service creates source snapshot and confirms AI package without losing codepoints", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const service = new TableEvidenceService({
    repository,
    sourceFileService: {
      createSourceFile: async () => ({
        id: "file-1",
        storage_key: "uploads/table.docx",
        file_name: "table.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byte_length: 100,
        sha256: "sha256-file",
        uploaded_by: "user-1",
        uploaded_at: "2026-04-29T00:00:00.000Z",
      }),
      resolveSourcePath: () => "C:/tmp/table.docx",
    },
    workerAdapter: {
      extractTables: async () => ({
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        tables: [
          {
            snapshot_id: "source-1",
            table_id: "table-1",
            source_file_asset_id: "file-1",
            parser: "python_docx_ooxml",
            parser_version: "table-evidence-v1",
            row_count: 1,
            column_count: 1,
            caption: {
              text: "表1",
              runs: [],
            },
            notes: [],
            object_evidence: [],
            warnings: [],
            grid_cells: [
              {
                cell_id: "cell-r0-c0",
                row: 0,
                column: 0,
                rowspan: 1,
                colspan: 1,
                role: "header",
                text: "Hcy–L⁻¹",
                codepoints: ["0048", "0063", "0079", "2013", "004C", "207B", "00B9"],
                paragraphs: [],
                runs: [],
                header_path: ["Hcy–L⁻¹"],
                row_header_path: [],
                column_header_path: ["Hcy–L⁻¹"],
                invisible_chars: [],
                style_summary: {},
              },
            ],
          },
        ],
      }),
    },
    createId: (() => {
      const ids = ["asset-1", "rev-1", "patch-1", "package-1"];
      return () => ids.shift() ?? "id";
    })(),
    now: () => new Date("2026-04-29T00:00:00.000Z"),
  });

  const result = await service.createAssetFromDocxUpload({
    fileName: "table.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileContentBase64: Buffer.from("fake").toString("base64"),
    actorId: "user-1",
  });

  assert.equal(result.tables.length, 1);
  assert.equal(result.asset.fidelity_status, "pending");

  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });

  assert.equal(confirmed.confirmation_status, "confirmed");
  assert.equal(confirmed.ai_table_package?.cells[0].codepoints.includes("2013"), true);
  assert.equal(confirmed.ai_table_package?.authority, "authoritative");
});
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
pnpm --filter @medical/api test -- table-evidence-service
```

Expected: FAIL because the service and package builder do not exist.

- [ ] **Step 3: Implement source file service**

Create `table-evidence-source-file-service.ts`:

```ts
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { storeInlineUpload } from "../../http/local-upload-storage.ts";
import type { TableEvidenceSourceFile } from "./table-evidence-record.ts";

export interface CreateTableEvidenceSourceFileInput {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
  actorId: string;
}

export class TableEvidenceSourceFileService {
  constructor(
    private readonly dependencies: {
      rootDir: string;
      createId?: () => string;
      now?: () => Date;
    },
  ) {}

  async createSourceFile(input: CreateTableEvidenceSourceFileInput): Promise<TableEvidenceSourceFile> {
    if (!input.fileName.toLowerCase().endsWith(".docx")) {
      throw new Error("Only .docx files can create guarantee-level table evidence.");
    }
    if (input.mimeType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      throw new Error("Only DOCX MIME type is supported for guarantee-level table evidence.");
    }

    const createId = this.dependencies.createId ?? randomUUID;
    const now = this.dependencies.now ?? (() => new Date());
    const stored = await storeInlineUpload({
      rootDir: this.dependencies.rootDir,
      fileName: input.fileName,
      fileContentBase64: input.fileContentBase64,
      now,
      createId,
    });

    return {
      id: createId(),
      storage_key: stored.storageKey,
      file_name: input.fileName,
      mime_type: input.mimeType,
      byte_length: stored.byteLength,
      sha256: createHash("sha256").update(Buffer.from(input.fileContentBase64.replace(/^data:[^;]+;base64,/i, ""), "base64")).digest("hex"),
      uploaded_by: input.actorId,
      uploaded_at: now().toISOString(),
    };
  }

  resolveSourcePath(storageKey: string): string {
    const rootDir = path.resolve(this.dependencies.rootDir);
    const absolutePath = path.resolve(rootDir, ...storageKey.replaceAll("\\", "/").split("/"));
    const relativePath = path.relative(rootDir, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`Resolved table evidence source escaped storage root: ${storageKey}`);
    }
    return absolutePath;
  }
}
```

- [ ] **Step 4: Implement worker adapter**

Create `table-evidence-worker-adapter.ts` that invokes the same Python script as `PythonDocxStructureWorkerAdapter`, but accepts a source path instead of `DocumentAsset`:

```ts
import type { TableSourceSnapshot } from "./table-evidence-record.ts";

export interface TableEvidenceWorkerResult {
  parser: "python_docx_ooxml";
  parser_version: string;
  tables: TableSourceSnapshot[];
}

export interface TableEvidenceWorkerAdapter {
  extractTables(input: {
    sourcePath: string;
    sourceFileAssetId: string;
  }): Promise<TableEvidenceWorkerResult>;
}
```

Map worker table snapshots into `TableSourceSnapshot` by copying grid cells, captions, notes, warnings, codepoints, invisible chars, `symbol_font`, and `symbol_char`. If a table is image-only, nested beyond supported extraction, or contains unknown legacy `w:sym` mapping, include a fidelity warning code in the source snapshot warnings.

- [ ] **Step 5: Implement patch and package builders**

Create `table-evidence-patch-service.ts`:

```ts
import type {
  ConfirmedTableSnapshot,
  TableCorrectionPatch,
  TableSourceSnapshot,
} from "./table-evidence-record.ts";

export function applyTableCorrectionPatch(input: {
  sourceSnapshot: TableSourceSnapshot;
  patch: TableCorrectionPatch;
}): ConfirmedTableSnapshot {
  const snapshot: ConfirmedTableSnapshot = {
    snapshot_id: `${input.sourceSnapshot.snapshot_id}:confirmed`,
    source_snapshot_id: input.sourceSnapshot.snapshot_id,
    row_count: input.sourceSnapshot.row_count,
    column_count: input.sourceSnapshot.column_count,
    caption: structuredClone(input.sourceSnapshot.caption),
    notes: structuredClone(input.sourceSnapshot.notes),
    grid_cells: structuredClone(input.sourceSnapshot.grid_cells),
  };

  for (const operation of input.patch.operations) {
    if (operation.op === "replace_caption") {
      snapshot.caption = structuredClone(operation.caption);
      continue;
    }
    if (operation.op === "replace_notes") {
      snapshot.notes = structuredClone(operation.notes);
      continue;
    }

    const cell = "cell_id" in operation
      ? snapshot.grid_cells.find((entry) => entry.cell_id === operation.cell_id)
      : undefined;
    if (!cell) {
      continue;
    }

    if (operation.op === "replace_run_text") {
      for (const paragraph of cell.paragraphs) {
        for (const run of paragraph.runs) {
          if (run.id === operation.run_id && run.text === operation.before_text) {
            run.text = operation.after_text;
            run.codepoints = operation.after_codepoints;
          }
        }
      }
      cell.text = cell.paragraphs.flatMap((paragraph) => paragraph.runs).map((run) => run.text).join("");
      cell.codepoints = cell.paragraphs.flatMap((paragraph) => paragraph.runs).flatMap((run) => run.codepoints);
    }

    if (operation.op === "set_run_style") {
      for (const paragraph of cell.paragraphs) {
        for (const run of paragraph.runs) {
          if (run.id === operation.run_id) {
            run.style = { ...run.style, ...operation.style };
          }
        }
      }
    }

    if (operation.op === "set_cell_structure") {
      cell.row = operation.row;
      cell.column = operation.column;
      cell.rowspan = operation.rowspan;
      cell.colspan = operation.colspan;
    }

    if (operation.op === "set_cell_alignment") {
      cell.style_summary.horizontal_alignment = operation.horizontal_alignment ?? cell.style_summary.horizontal_alignment;
      cell.style_summary.vertical_alignment = operation.vertical_alignment ?? cell.style_summary.vertical_alignment;
    }

    if (operation.op === "set_cell_borders") {
      cell.style_summary.border_profile = operation.border_profile;
    }
  }

  return snapshot;
}
```

Create `table-evidence-package-builder.ts`:

```ts
import { createHash } from "node:crypto";
import type {
  ConfirmedAiTablePackage,
  ConfirmedTableSnapshot,
  TableEvidenceAsset,
  TableEvidenceRevision,
  TableFidelityReport,
  TableSourceSnapshot,
} from "./table-evidence-record.ts";

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildConfirmedAiTablePackage(input: {
  packageId: string;
  asset: TableEvidenceAsset;
  revision: Pick<TableEvidenceRevision, "id" | "revision_no" | "confirmation_status" | "confirmed_by" | "confirmed_at">;
  sourceSnapshot: TableSourceSnapshot;
  confirmedSnapshot: ConfirmedTableSnapshot;
  fidelityReport: TableFidelityReport;
}): ConfirmedAiTablePackage {
  return {
    package_id: input.packageId,
    asset_id: input.asset.id,
    revision_id: input.revision.id,
    revision_no: input.revision.revision_no,
    source_file_asset_id: input.asset.source_file_asset_id,
    authority: input.revision.confirmation_status === "confirmed" ? "authoritative" : "review_required",
    confirmation_status: input.revision.confirmation_status,
    fidelity_status: input.fidelityReport.status,
    confirmed_by_human: input.revision.confirmation_status === "confirmed",
    confirmed_by: input.revision.confirmed_by,
    confirmed_at: input.revision.confirmed_at,
    parser: input.asset.parser,
    parser_version: input.asset.parser_version,
    source_snapshot_hash: hashJson(input.sourceSnapshot),
    confirmed_snapshot_hash: hashJson(input.confirmedSnapshot),
    ai_table_package_hash: "",
    caption: input.confirmedSnapshot.caption,
    notes: input.confirmedSnapshot.notes,
    structure: {
      row_count: input.confirmedSnapshot.row_count,
      column_count: input.confirmedSnapshot.column_count,
      header_depth: inferHeaderDepth(input.confirmedSnapshot),
      merged_cells: input.confirmedSnapshot.grid_cells
        .filter((cell) => cell.rowspan > 1 || cell.colspan > 1)
        .map((cell) => ({
          cell_id: cell.cell_id,
          row: cell.row,
          column: cell.column,
          rowspan: cell.rowspan,
          colspan: cell.colspan,
        })),
    },
    cells: input.confirmedSnapshot.grid_cells,
    fidelity_report: input.fidelityReport,
  };
}

function inferHeaderDepth(snapshot: ConfirmedTableSnapshot): number {
  const headerRows = snapshot.grid_cells
    .filter((cell) => cell.role === "header")
    .map((cell) => cell.row);
  return headerRows.length === 0 ? 0 : Math.max(...headerRows) + 1;
}
```

After building the package, set `ai_table_package_hash` to the hash of the package with an empty hash value.

- [ ] **Step 6: Implement service**

`TableEvidenceService` exposes:

```ts
createAssetFromDocxUpload(input): Promise<{ sourceFile; asset; revisions; tables }>
saveCorrectionPatch(input): Promise<TableEvidenceRevision>
confirmRevision(input): Promise<TableEvidenceRevision>
bindRevision(input): Promise<TableEvidenceBinding>
assertConfirmedRevision(revisionId: string): Promise<TableEvidenceRevision>
resolveConfirmedPackagesForTarget(targetType, targetId): Promise<ConfirmedAiTablePackage[]>
```

Confirmation logic:

```ts
if (!input.confirmations.invisibleCharsConfirmed || !input.confirmations.specialSymbolsConfirmed) {
  fidelityReport.status = "needs_review";
  confirmationStatus = "needs_review";
}
if (sourceSnapshot.warnings.some((warning) => warning.includes("unknown_symbol_mapping"))) {
  fidelityReport.status = "needs_review";
  confirmationStatus = "needs_review";
}
```

Only set `confirmation_status: "confirmed"` when confirmed snapshot, AI package, invisible character confirmation, special symbol confirmation, and no unsupported fact groups are present.

- [ ] **Step 7: Run service tests**

Run:

```bash
pnpm --filter @medical/api test -- table-evidence-service
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/table-evidence apps/api/test/table-evidence/table-evidence-service.spec.ts
git commit -m "feat: build confirmed table evidence packages"
```

## Task 5: Table Evidence API And HTTP Routes

**Files:**
- Create: `apps/api/src/modules/table-evidence/table-evidence-api.ts`
- Modify: `apps/api/src/modules/table-evidence/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Test: `apps/api/test/table-evidence/table-evidence-api.spec.ts`

- [ ] **Step 1: Write API tests**

Create `apps/api/test/table-evidence/table-evidence-api.spec.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createTableEvidenceApi } from "../../src/modules/table-evidence/index.ts";

test("table evidence api exposes upload, confirm, bind, and target package resolution", async () => {
  const calls: string[] = [];
  const api = createTableEvidenceApi({
    tableEvidenceService: {
      createAssetFromDocxUpload: async () => {
        calls.push("create");
        return { asset: { id: "asset-1" }, revisions: [{ id: "rev-1" }], tables: [] };
      },
      confirmRevision: async () => {
        calls.push("confirm");
        return { id: "rev-1", confirmation_status: "confirmed" };
      },
      bindRevision: async () => {
        calls.push("bind");
        return { id: "binding-1" };
      },
      resolveConfirmedPackagesForTarget: async () => {
        calls.push("packages");
        return [];
      },
    } as never,
  });

  assert.equal((await api.createAssetFromDocxUpload({} as never)).status, 201);
  assert.equal((await api.confirmRevision({ revisionId: "rev-1", actorId: "user-1", confirmations: { invisibleCharsConfirmed: true, specialSymbolsConfirmed: true } })).status, 200);
  assert.equal((await api.bindRevision({} as never)).status, 201);
  assert.equal((await api.listConfirmedPackagesForTarget({ targetType: "knowledge_revision", targetId: "knowledge-rev-1" })).status, 200);
  assert.deepEqual(calls, ["create", "confirm", "bind", "packages"]);
});
```

- [ ] **Step 2: Run API tests and verify they fail**

Run:

```bash
pnpm --filter @medical/api test -- table-evidence-api
```

Expected: FAIL because `createTableEvidenceApi` and routes are missing.

- [ ] **Step 3: Implement API wrapper**

Create `table-evidence-api.ts`:

```ts
import type { TableEvidenceService } from "./table-evidence-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export function createTableEvidenceApi(options: { tableEvidenceService: TableEvidenceService }) {
  const service = options.tableEvidenceService;
  return {
    async createAssetFromDocxUpload(input: Parameters<TableEvidenceService["createAssetFromDocxUpload"]>[0]): Promise<RouteResponse<Awaited<ReturnType<TableEvidenceService["createAssetFromDocxUpload"]>>>> {
      return { status: 201, body: await service.createAssetFromDocxUpload(input) };
    },
    async saveCorrectionPatch(input: Parameters<TableEvidenceService["saveCorrectionPatch"]>[0]): Promise<RouteResponse<Awaited<ReturnType<TableEvidenceService["saveCorrectionPatch"]>>>> {
      return { status: 200, body: await service.saveCorrectionPatch(input) };
    },
    async confirmRevision(input: Parameters<TableEvidenceService["confirmRevision"]>[0]): Promise<RouteResponse<Awaited<ReturnType<TableEvidenceService["confirmRevision"]>>>> {
      return { status: 200, body: await service.confirmRevision(input) };
    },
    async bindRevision(input: Parameters<TableEvidenceService["bindRevision"]>[0]): Promise<RouteResponse<Awaited<ReturnType<TableEvidenceService["bindRevision"]>>>> {
      return { status: 201, body: await service.bindRevision(input) };
    },
    async listConfirmedPackagesForTarget(input: { targetType: "knowledge_revision" | "editorial_rule" | "rule_draft"; targetId: string }) {
      return { status: 200, body: await service.resolveConfirmedPackagesForTarget(input.targetType, input.targetId) };
    },
  };
}
```

- [ ] **Step 4: Wire HTTP runtime**

In `apps/api/src/http/api-http-server.ts`:

- Import `createTableEvidenceApi`, `InMemoryTableEvidenceRepository`, `TableEvidenceService`, `TableEvidenceSourceFileService`, and the worker adapter.
- Instantiate them beside existing knowledge and editorial rule services.
- Add route names:
  - `table-evidence-create-asset-from-docx-upload`
  - `table-evidence-save-correction-patch`
  - `table-evidence-confirm-revision`
  - `table-evidence-bind-revision`
  - `table-evidence-list-target-packages`
- Add REST mapping:
  - `POST /api/v1/table-evidence/assets/from-docx-upload`
  - `POST /api/v1/table-evidence/revisions/:revisionId/patch`
  - `POST /api/v1/table-evidence/revisions/:revisionId/confirm`
  - `POST /api/v1/table-evidence/bindings`
  - `GET /api/v1/table-evidence/targets/:targetType/:targetId/packages`

Route bodies must pass authenticated actor ID when available; fall back to `"system"` only in demo runtime.

- [ ] **Step 5: Run API tests and typecheck**

Run:

```bash
pnpm --filter @medical/api test -- table-evidence-api
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/table-evidence/table-evidence-api.ts apps/api/src/modules/table-evidence/index.ts apps/api/src/http/api-http-server.ts apps/api/test/table-evidence/table-evidence-api.spec.ts
git commit -m "feat: expose table evidence api"
```

## Task 6: Knowledge Library Integration

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-ai-assist-service.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-content-block-normalizer.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Test: `apps/api/test/knowledge/knowledge-table-evidence-governance.spec.ts`
- Test: `apps/api/test/knowledge/knowledge-ai-assist.spec.ts`

- [ ] **Step 1: Write governance tests**

Create `apps/api/test/knowledge/knowledge-table-evidence-governance.spec.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeRevisionReviewGateError, KnowledgeService } from "../../src/modules/knowledge/index.ts";
import { InMemoryTableEvidenceRepository } from "../../src/modules/table-evidence/index.ts";

test("knowledge approval blocks table evidence blocks with unconfirmed revisions", async () => {
  const tableEvidenceRepository = new InMemoryTableEvidenceRepository();
  const knowledgeService = createKnowledgeServiceForTest({ tableEvidenceRepository });
  const draft = await knowledgeService.createLibraryDraft({
    title: "Table rule",
    canonicalText: "Use attached table",
    knowledgeKind: "rule",
    moduleScope: "editing",
    manuscriptTypes: "any",
    contentBlocks: [
      {
        blockType: "table_evidence_block",
        orderNo: 0,
        contentPayload: {
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "rev-pending",
        },
      },
    ],
  });

  await assert.rejects(
    () => knowledgeService.submitRevisionForReview({ revisionId: draft.selected_revision.id }),
    KnowledgeRevisionReviewGateError,
  );
});
```

Use existing knowledge test factory patterns for `createKnowledgeServiceForTest`. The assertion must inspect the error failure code `table_evidence_revision_not_confirmed`.

- [ ] **Step 2: Run governance tests and verify they fail**

Run:

```bash
pnpm --filter @medical/api test -- knowledge-table-evidence-governance
```

Expected: FAIL because knowledge service does not know table evidence revisions.

- [ ] **Step 3: Add record and normalizer support**

In `knowledge-record.ts`, add:

```ts
export type KnowledgeContentBlockType =
  | "text_block"
  | "table_block"
  | "table_evidence_block"
  | "image_block";
```

Define content payload guard in `knowledge-content-block-normalizer.ts`:

```ts
function normalizeTableEvidenceBlockPayload(payload: Record<string, unknown>) {
  const assetId = readRequiredString(payload.table_evidence_asset_id, "table_evidence_asset_id");
  const revisionId = readRequiredString(payload.table_evidence_revision_id, "table_evidence_revision_id");
  return {
    table_evidence_asset_id: assetId,
    table_evidence_revision_id: revisionId,
    binding_id: typeof payload.binding_id === "string" ? payload.binding_id : undefined,
  };
}
```

For `table_evidence_block`, do not populate `table_semantics` from old fields.

- [ ] **Step 4: Inject table evidence service into knowledge service**

Add an optional dependency to `KnowledgeService`:

```ts
tableEvidenceService?: Pick<
  TableEvidenceService,
  "assertConfirmedRevision" | "resolveConfirmedPackagesForTarget"
>;
```

In submit and approve gates, for each `table_evidence_block`:

```ts
const revisionId = String(block.content_payload.table_evidence_revision_id ?? "");
if (!revisionId) {
  failures.push({ code: "table_evidence_revision_missing", block_id: block.id });
  continue;
}
try {
  await this.dependencies.tableEvidenceService?.assertConfirmedRevision(revisionId);
} catch {
  failures.push({ code: "table_evidence_revision_not_confirmed", block_id: block.id, revision_id: revisionId });
}
```

Keep old `table_block` exact capture gate only for non-guarantee legacy paths. New entries use `table_evidence_block`.

- [ ] **Step 5: Inject AI packages into knowledge AI assist**

In `knowledge-ai-assist-service.ts`, before building the AI request:

```ts
const confirmedTablePackages = input.revisionId && this.dependencies.tableEvidenceService
  ? await this.dependencies.tableEvidenceService.resolveConfirmedPackagesForTarget("knowledge_revision", input.revisionId)
  : [];
```

Add to the prompt/request payload:

```ts
confirmed_table_packages: confirmedTablePackages,
table_evidence_instruction:
  "Use confirmed_table_packages as authoritative table evidence. Do not collapse U+002D, U+2013, U+2014, U+2212, U+3000, U+00A0, tabs, line breaks, or paragraph boundaries. Use run styles for superscript and subscript.",
```

Do not generate authoritative semantic table facts from unconfirmed packages.

- [ ] **Step 6: Run knowledge tests**

Run:

```bash
pnpm --filter @medical/api test -- knowledge-table-evidence-governance knowledge-ai-assist
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/knowledge apps/api/test/knowledge/knowledge-table-evidence-governance.spec.ts apps/api/test/knowledge/knowledge-ai-assist.spec.ts
git commit -m "feat: gate knowledge on confirmed table evidence"
```

## Task 7: Rule Center, Rule AI, And Published Revision Locking

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-record.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-ai-parsing-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/rule-package-compile-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-table-evidence-governance.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-ai-parsing-service.spec.ts`
- Test: `apps/api/test/editorial-rules/rule-package-compile-service.spec.ts`

- [ ] **Step 1: Write publish gate test**

Add `apps/api/test/editorial-rules/editorial-rule-table-evidence-governance.spec.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { EditorialRuleSetStatusTransitionError } from "../../src/modules/editorial-rules/index.ts";

test("publishing a rule set rejects unconfirmed table evidence revisions", async () => {
  const { editorialRuleService } = createEditorialRuleServiceForTest({
    tableEvidenceService: {
      assertConfirmedRevision: async (revisionId: string) => {
        if (revisionId === "rev-pending") {
          throw new Error("not confirmed");
        }
        return {} as never;
      },
    },
  });

  const ruleSet = await editorialRuleService.createRuleSet("admin", {
    template_family_id: "template-family-1",
    module: "editing",
  });

  await editorialRuleService.createRule("admin", {
    rule_set_id: ruleSet.id,
    order_no: 0,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {},
    selector: {},
    trigger: { kind: "always" },
    action: { kind: "manual_review_required" },
    authoring_payload: {},
    linkage_payload: {
      table_evidence_revision_ids: ["rev-pending"],
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });

  await assert.rejects(
    () => editorialRuleService.publishRuleSet("admin", ruleSet.id),
    EditorialRuleSetStatusTransitionError,
  );
});
```

Use the existing editorial rule test factory or create a local helper matching repository constructors.

- [ ] **Step 2: Run rule tests and verify they fail**

Run:

```bash
pnpm --filter @medical/api test -- editorial-rule-table-evidence-governance
```

Expected: FAIL because rule publishing does not check table evidence revisions.

- [ ] **Step 3: Extend linkage record**

In `editorial-rule-record.ts`:

```ts
export interface EditorialRuleLinkagePayload {
  source_learning_candidate_id?: string;
  source_snapshot_asset_id?: string;
  projected_knowledge_item_ids?: string[];
  evidence_package_ids?: string[];
  table_evidence_revision_ids?: string[];
  target_model_block_ids?: string[];
  overrides_rule_ids?: string[];
}
```

Postgres and in-memory repositories already persist `linkage_payload` as JSON; verify mapping keeps the new field without schema changes.

- [ ] **Step 4: Enforce backend publish gate**

Inject table evidence service into `EditorialRuleService`:

```ts
tableEvidenceService?: Pick<TableEvidenceService, "assertConfirmedRevision">;
```

Before allowing `publishRuleSet`, `transitionRuleSet` to `active` or `published`, and rule package compile to final draft, collect all linked revisions:

```ts
const revisionIds = rules.flatMap((rule) => rule.linkage_payload?.table_evidence_revision_ids ?? []);
for (const revisionId of revisionIds) {
  await this.dependencies.tableEvidenceService?.assertConfirmedRevision(revisionId);
}
```

If any fail, throw an existing rule set transition error with failure code `table_evidence_revision_not_confirmed`.

- [ ] **Step 5: Extend rule AI evidence and prompt**

In `rule-ai-parsing-service.ts`, when `RuleAiEvidenceItem.kind === "confirmed_table_package"`:

```ts
const packageJson = JSON.stringify(evidence.confirmed_table_package);
promptParts.push([
  "Confirmed table package:",
  packageJson,
  "Rules:",
  "- Treat confirmed_table_package as authoritative only when authority is authoritative.",
  "- Do not collapse U+002D, U+2013, U+2014, U+2212.",
  "- Do not collapse U+0020, U+3000, U+00A0, tabs, line breaks, or paragraph boundaries.",
  "- Use runs.style.superscript and runs.style.subscript for unit interpretation.",
].join("\n"));
```

Reject `confirmed_table_package` evidence with non-authoritative `authority` during publish paths; allow it during draft parsing with warning `table_evidence_not_authoritative`.

- [ ] **Step 6: Compile locked revision IDs into rule packages**

In `rule-package-compile-service.ts`, include:

```ts
table_evidence_revision_ids: candidate.rules.flatMap(
  (rule) => rule.linkage_payload?.table_evidence_revision_ids ?? [],
),
```

The compiled package stores exact revision IDs, not asset IDs or active revision pointers.

- [ ] **Step 7: Run rule tests**

Run:

```bash
pnpm --filter @medical/api test -- editorial-rule-table-evidence-governance rule-ai-parsing-service rule-package-compile-service
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/editorial-rules apps/api/test/editorial-rules/editorial-rule-table-evidence-governance.spec.ts apps/api/test/editorial-rules/rule-ai-parsing-service.spec.ts apps/api/test/editorial-rules/rule-package-compile-service.spec.ts
git commit -m "feat: lock rule releases to confirmed table evidence"
```

## Task 8: Frontend API, State, Patch, And Rendering Foundation

**Files:**
- Create: `apps/web/src/features/table-evidence/table-evidence-types.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-api.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-state.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-patch.ts`
- Create: `apps/web/src/features/table-evidence/table-evidence-renderer.tsx`
- Create: `apps/web/src/features/table-evidence/invisible-character-overlay.tsx`
- Create: `apps/web/src/features/table-evidence/special-codepoint-inspector.tsx`
- Create: `apps/web/src/features/table-evidence/index.ts`
- Test: `apps/web/test/table-evidence-api.spec.ts`
- Test: `apps/web/test/table-evidence-patch.spec.ts`
- Test: `apps/web/test/table-evidence-renderer.spec.tsx`

- [ ] **Step 1: Write frontend foundation tests**

Create `apps/web/test/table-evidence-patch.spec.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { applyTableEvidencePatch } from "../src/features/table-evidence/table-evidence-patch.ts";

test("applyTableEvidencePatch preserves source and updates confirmed snapshot", () => {
  const source = {
    snapshot_id: "source-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [
      {
        cell_id: "cell-1",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: "A–B",
        codepoints: ["0041", "2013", "0042"],
        paragraphs: [
          {
            id: "p-1",
            paragraph_boundary_after: true,
            runs: [
              {
                id: "run-1",
                kind: "text",
                text: "A–B",
                codepoints: ["0041", "2013", "0042"],
                style: {},
                invisible_chars: [],
              },
            ],
          },
        ],
        runs: [],
        header_path: ["A–B"],
        row_header_path: [],
        column_header_path: ["A–B"],
        invisible_chars: [],
        style_summary: {},
      },
    ],
  } as const;

  const confirmed = applyTableEvidencePatch(source, {
    patch_id: "patch-1",
    operations: [
      {
        op: "replace_run_text",
        cell_id: "cell-1",
        paragraph_id: "p-1",
        run_id: "run-1",
        before_text: "A–B",
        after_text: "A−B",
        after_codepoints: ["0041", "2212", "0042"],
      },
    ],
  });

  assert.equal(source.grid_cells[0].text, "A–B");
  assert.equal(confirmed.grid_cells[0].text, "A−B");
  assert.deepEqual(confirmed.grid_cells[0].codepoints, ["0041", "2212", "0042"]);
});
```

Create `apps/web/test/table-evidence-renderer.spec.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TableEvidenceRenderer } from "../src/features/table-evidence/table-evidence-renderer.tsx";

test("TableEvidenceRenderer renders merged cells and invisible character overlay without changing text", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceRenderer
      snapshot={{
        snapshot_id: "confirmed-1",
        source_snapshot_id: "source-1",
        row_count: 1,
        column_count: 1,
        notes: [],
        grid_cells: [
          {
            cell_id: "cell-1",
            row: 0,
            column: 0,
            rowspan: 1,
            colspan: 1,
            role: "header",
            text: " A\u00a0",
            codepoints: ["0020", "0041", "00A0"],
            paragraphs: [],
            runs: [],
            header_path: [" A\u00a0"],
            row_header_path: [],
            column_header_path: [" A\u00a0"],
            invisible_chars: [
              { kind: "leading_space", codepoint: "0020", offset: 0, length: 1 },
              { kind: "nbsp", codepoint: "00A0", offset: 2, length: 1 },
            ],
            style_summary: { border_profile: "three_line_header" },
          },
        ],
      }}
      showInvisibleCharacters={true}
      selectedCellId="cell-1"
      onSelectCell={() => undefined}
    />,
  );

  assert.match(html, /data-codepoints="0020 0041 00A0"/);
  assert.match(html, /NBSP/);
  assert.match(html, /three-line-header/);
});
```

- [ ] **Step 2: Run frontend tests and verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/table-evidence-patch.spec.ts ./test/table-evidence-renderer.spec.tsx
```

Expected: FAIL because the feature files do not exist.

- [ ] **Step 3: Implement API and types**

`table-evidence-types.ts` imports and re-exports contract types from `@medical/contracts`.

`table-evidence-api.ts` exposes:

```ts
export function createTableEvidenceFromDocxUpload(client, input) {
  return client.request({
    method: "POST",
    url: "/api/v1/table-evidence/assets/from-docx-upload",
    body: input,
  });
}

export function saveTableEvidenceCorrectionPatch(client, revisionId, input) {
  return client.request({
    method: "POST",
    url: `/api/v1/table-evidence/revisions/${revisionId}/patch`,
    body: input,
  });
}

export function confirmTableEvidenceRevision(client, revisionId, input) {
  return client.request({
    method: "POST",
    url: `/api/v1/table-evidence/revisions/${revisionId}/confirm`,
    body: input,
  });
}

export function bindTableEvidenceRevision(client, input) {
  return client.request({
    method: "POST",
    url: "/api/v1/table-evidence/bindings",
    body: input,
  });
}
```

- [ ] **Step 4: Implement frontend patch function**

Mirror backend `applyTableCorrectionPatch` in `table-evidence-patch.ts`; keep it pure and clone source snapshots before applying operations.

- [ ] **Step 5: Implement renderer and invisible overlay**

`TableEvidenceRenderer` renders a stable CSS grid/table:

- Uses `rowSpan` and `colSpan` from cells.
- Applies class names from `style_summary.border_profile`, alignment, and script positions.
- Adds `data-codepoints={cell.codepoints.join(" ")}`.
- Renders `InvisibleCharacterOverlay` only when `showInvisibleCharacters` is true.

`InvisibleCharacterOverlay` maps display marks:

```ts
const INVISIBLE_MARKS = {
  space: "·",
  leading_space: "·",
  trailing_space: "·",
  consecutive_space: "··",
  full_width_space: "□",
  nbsp: "NBSP",
  tab: "→",
  line_break: "↵",
  paragraph_boundary: "¶",
} as const;
```

These marks are rendered in sibling spans with `aria-hidden="true"` and are never used as editable value.

- [ ] **Step 6: Run frontend foundation tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/table-evidence-patch.spec.ts ./test/table-evidence-renderer.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/table-evidence apps/web/test/table-evidence-patch.spec.ts apps/web/test/table-evidence-renderer.spec.tsx
git commit -m "feat: add table evidence frontend foundation"
```

## Task 9: Shared Table Evidence Workspace

**Files:**
- Create: `apps/web/src/features/table-evidence/table-evidence-upload-entry.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-picker.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-workspace.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-table-list.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-cell-editor.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-run-toolbar.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-structure-toolbar.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-format-panel.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-diff-view.tsx`
- Create: `apps/web/src/features/table-evidence/table-evidence-fidelity-panel.tsx`
- Modify: `apps/web/src/features/table-evidence/index.ts`
- Test: `apps/web/test/table-evidence-workspace.spec.tsx`

- [ ] **Step 1: Write workspace tests**

Create `apps/web/test/table-evidence-workspace.spec.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TableEvidenceWorkspace } from "../src/features/table-evidence/table-evidence-workspace.tsx";

test("TableEvidenceWorkspace exposes source, corrected, diff, fidelity, and confirmation states", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceWorkspace
      asset={{
        id: "asset-1",
        title: "Table 1",
        source_file_asset_id: "file-1",
        source_file_name: "table.docx",
        source_kind: "docx_upload",
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        fidelity_status: "pending",
        created_by: "user-1",
        created_at: "2026-04-29T00:00:00.000Z",
        updated_at: "2026-04-29T00:00:00.000Z",
      }}
      revision={{
        id: "rev-1",
        table_evidence_asset_id: "asset-1",
        revision_no: 1,
        source_snapshot: {
          snapshot_id: "source-1",
          table_id: "table-1",
          source_file_asset_id: "file-1",
          parser: "python_docx_ooxml",
          parser_version: "table-evidence-v1",
          row_count: 1,
          column_count: 1,
          notes: [],
          object_evidence: [],
          warnings: [],
          grid_cells: [],
        },
        correction_patch: { patch_id: "patch-1", operations: [] },
        fidelity_report: {
          status: "pending",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: ["invisible_chars", "special_symbols"],
          invisible_chars_confirmed: false,
          special_symbols_confirmed: false,
        },
        confirmation_status: "pending",
        created_at: "2026-04-29T00:00:00.000Z",
      }}
      onSavePatch={() => Promise.resolve()}
      onConfirm={() => Promise.resolve()}
      onBind={() => Promise.resolve()}
    />,
  );

  assert.match(html, /data-view-mode="source"/);
  assert.match(html, /待确认/);
  assert.match(html, /不可见字符/);
  assert.match(html, /特殊符号/);
});
```

- [ ] **Step 2: Run workspace test and verify it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/table-evidence-workspace.spec.tsx
```

Expected: FAIL because workspace components do not exist.

- [ ] **Step 3: Implement upload and picker components**

`TableEvidenceUploadEntry`:

- Accepts `.docx` only.
- Supports file picker and drag-in.
- Converts file to base64.
- Calls `createTableEvidenceFromDocxUpload`.
- Shows parsed table list from response.

`TableEvidencePicker`:

- Searches confirmed table evidence.
- Returns exact `asset_id` and `revision_id`.
- Displays title, source file, confirmation state, and last updated time.

- [ ] **Step 4: Implement workspace layout**

`TableEvidenceWorkspace` state:

```ts
type ViewMode = "source" | "corrected" | "diff";
```

Controls:

- Segmented control for source/corrected/diff.
- Toggle for invisible characters.
- Cell selection state.
- Run style toolbar.
- Structure toolbar.
- Format panel.
- Fidelity panel.
- Confirm button disabled unless required confirmations are checked.

The workspace computes corrected preview with `applyTableEvidencePatch(source_snapshot, correction_patch)`.

- [ ] **Step 5: Implement correction tools**

Cell text edits create `replace_run_text` operations with explicit `before_text`, `after_text`, and `after_codepoints`.

Run style edits create `set_run_style` operations.

Merge/split/insert/delete operations update structure through `set_cell_structure` operations and regenerate row/column spans in local state.

Border and three-line table edits create `set_cell_borders`.

Alignment edits create `set_cell_alignment`.

Caption/note edits create `replace_caption` and `replace_notes`.

Invisible and special symbol confirmation create `confirm_invisible_chars` and `confirm_special_symbols`.

- [ ] **Step 6: Implement diff and fidelity views**

`TableEvidenceDiffView` compares:

- Cell text and codepoints.
- Run style.
- Structure coordinates and spans.
- Border profile.
- Caption and notes.

`TableEvidenceFidelityPanel` shows three user states:

- `待确认`
- `已确认`
- `需复核`

It also shows detailed failure codes for operators.

- [ ] **Step 7: Run workspace tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/table-evidence-workspace.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/table-evidence apps/web/test/table-evidence-workspace.spec.tsx
git commit -m "feat: add table evidence workspace"
```

## Task 10: Knowledge Library Frontend Integration

**Files:**
- Modify: `apps/web/src/features/knowledge-library/types.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-rich-content-editor.tsx`
- Modify: `apps/web/src/features/knowledge-library/knowledge-library-evidence-gate.ts`
- Test: `apps/web/test/knowledge-library-table-evidence.spec.tsx`
- Test: `apps/web/test/knowledge-library-evidence-gate.spec.ts`

- [ ] **Step 1: Write knowledge UI tests**

Create `apps/web/test/knowledge-library-table-evidence.spec.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgeLibraryRichContentEditor } from "../src/features/knowledge-library/knowledge-library-rich-content-editor.tsx";

test("knowledge rich content editor offers Word table evidence block instead of guarantee textarea path", () => {
  const html = renderToStaticMarkup(
    <KnowledgeLibraryRichContentEditor
      blocks={[]}
      onChange={() => undefined}
      imageUploadState={{ status: "idle" }}
      onUploadImage={() => undefined}
    />,
  );

  assert.match(html, /Word 表格证据/);
  assert.doesNotMatch(html, /保证级粘贴/);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-table-evidence.spec.tsx ./test/knowledge-library-evidence-gate.spec.ts
```

Expected: FAIL because the editor still routes table entry through the old table block.

- [ ] **Step 3: Update knowledge types and API**

In `types.ts`:

```ts
export type KnowledgeContentBlockType =
  | "text_block"
  | "table_block"
  | "table_evidence_block"
  | "image_block";
```

Add payload view model:

```ts
export interface KnowledgeTableEvidenceBlockPayload {
  table_evidence_asset_id: string;
  table_evidence_revision_id: string;
  binding_id?: string;
}
```

In `knowledge-library-api.ts`, keep `replaceKnowledgeRevisionContentBlocks` sending `contentPayload` unchanged for `table_evidence_block`; do not generate `tableSemantics`.

- [ ] **Step 4: Replace knowledge table entry with table evidence workspace**

In `knowledge-library-rich-content-editor.tsx`:

- Add “添加 Word 表格证据” button.
- Open `TableEvidenceUploadEntry` or `TableEvidencePicker`.
- On confirm and bind, insert:

```ts
{
  id: createClientBlockId(),
  revision_id: currentRevisionId,
  block_type: "table_evidence_block",
  order_no: nextOrderNo,
  status: "active",
  content_payload: {
    table_evidence_asset_id: asset.id,
    table_evidence_revision_id: revision.id,
    binding_id: binding.id,
  },
}
```

The old `KnowledgeLibraryBlockTableEditor` can remain in the repo for non-guarantee code paths, but the primary add-table action must create `table_evidence_block`.

- [ ] **Step 5: Update frontend gate**

In `knowledge-library-evidence-gate.ts`, treat a `table_evidence_block` as pass only when its displayed revision status is confirmed. If revision status is not loaded, show a blocking “表格证据状态未确认” message and let backend remain authoritative.

- [ ] **Step 6: Run knowledge frontend tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/knowledge-library-table-evidence.spec.tsx ./test/knowledge-library-evidence-gate.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/knowledge-library apps/web/test/knowledge-library-table-evidence.spec.tsx apps/web/test/knowledge-library-evidence-gate.spec.ts
git commit -m "feat: integrate table evidence with knowledge library"
```

## Task 11: Rule Center Frontend Integration

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Test: `apps/web/test/template-governance-table-evidence.spec.tsx`
- Test: `apps/web/test/editorial-rules-api.spec.ts`

- [ ] **Step 1: Write rule center UI tests**

Create `apps/web/test/template-governance-table-evidence.spec.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { buildRuleAiParsingRequest } from "../src/features/template-governance/template-governance-rule-wizard-api.ts";

test("rule wizard sends confirmed table package evidence instead of plain source text only", () => {
  const request = buildRuleAiParsingRequest({
    title: "Table unit rule",
    ruleBody: "Use Hcy unit exactly",
    sourceBasis: "See table",
    supplementalBlocks: [
      {
        id: "block-1",
        revision_id: "knowledge-rev-1",
        block_type: "table_evidence_block",
        order_no: 0,
        status: "active",
        content_payload: {
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "rev-1",
        },
      },
    ],
    confirmedTablePackages: [
      {
        package_id: "pkg-1",
        asset_id: "asset-1",
        revision_id: "rev-1",
        revision_no: 1,
        source_file_asset_id: "file-1",
        authority: "authoritative",
        confirmation_status: "confirmed",
        fidelity_status: "confirmed",
        confirmed_by_human: true,
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        source_snapshot_hash: "source",
        confirmed_snapshot_hash: "confirmed",
        ai_table_package_hash: "package",
        notes: [],
        structure: { row_count: 1, column_count: 1, header_depth: 1, merged_cells: [] },
        cells: [],
        fidelity_report: {
          status: "confirmed",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      },
    ],
  });

  assert.equal(
    request.rule_fields.evidence?.some((item) => item.kind === "confirmed_table_package"),
    true,
  );
});
```

- [ ] **Step 2: Run rule frontend tests and verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-table-evidence.spec.tsx ./test/editorial-rules-api.spec.ts
```

Expected: FAIL because rule wizard does not include confirmed table packages.

- [ ] **Step 3: Add rule wizard evidence state**

Extend `RuleWizardEntryFormState`:

```ts
tableEvidenceRevisionIds: string[];
confirmedTablePackages: ConfirmedAiTablePackage[];
```

When the user creates or picks table evidence in the entry step:

- Bind to target type `rule_draft`.
- Add revision ID to the draft state.
- Fetch confirmed packages for that draft target.
- Show status next to the evidence item.

- [ ] **Step 4: Update AI parsing request builder**

In `template-governance-rule-wizard-api.ts`, append evidence:

```ts
for (const tablePackage of form.confirmedTablePackages ?? []) {
  evidence.push({
    kind: "confirmed_table_package",
    source_id: tablePackage.revision_id,
    authority: tablePackage.authority,
    confirmed_table_package: tablePackage,
  });
}
```

Keep `sourceBasis` as `user_description`, but do not convert table packages to plain text.

- [ ] **Step 5: Update rule release gate**

For `save_draft`, allow pending table evidence but show `review_required`.

For `submit_review` and `publish_now`, block when any table evidence revision is missing or not confirmed in frontend precheck. Backend remains authoritative.

For `publish_now`, pass locked revision IDs into `linkage_payload.table_evidence_revision_ids`.

- [ ] **Step 6: Update ledger rendering**

In `template-governance-content-module-ledger-page.tsx`, render linked table evidence status and revision ID for rules with `linkage_payload.table_evidence_revision_ids`.

- [ ] **Step 7: Run rule frontend tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-table-evidence.spec.tsx ./test/editorial-rules-api.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/template-governance apps/web/test/template-governance-table-evidence.spec.tsx apps/web/test/editorial-rules-api.spec.ts
git commit -m "feat: integrate table evidence with rule center"
```

## Task 12: End-To-End Verification And Browser QA

**Files:**
- Create: `apps/web/test/table-evidence-browser.spec.ts`
- Modify: browser fixture files only if existing Playwright fixtures require route mocks.

- [ ] **Step 1: Add Playwright route-mocked browser tests**

Create `apps/web/test/table-evidence-browser.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("knowledge library can upload, confirm, and bind DOCX table evidence", async ({ page }) => {
  await page.route("**/api/v1/table-evidence/assets/from-docx-upload", async (route) => {
    await route.fulfill({
      json: {
        asset: {
          id: "asset-1",
          title: "Table 1",
          source_file_asset_id: "file-1",
          source_file_name: "table.docx",
          source_kind: "docx_upload",
          parser: "python_docx_ooxml",
          parser_version: "table-evidence-v1",
          fidelity_status: "pending",
          created_by: "user-1",
          created_at: "2026-04-29T00:00:00.000Z",
          updated_at: "2026-04-29T00:00:00.000Z",
        },
        revisions: [
          {
            id: "rev-1",
            table_evidence_asset_id: "asset-1",
            revision_no: 1,
            source_snapshot: {
              snapshot_id: "source-1",
              table_id: "table-1",
              source_file_asset_id: "file-1",
              parser: "python_docx_ooxml",
              parser_version: "table-evidence-v1",
              row_count: 1,
              column_count: 1,
              notes: [],
              object_evidence: [],
              warnings: [],
              grid_cells: [],
            },
            correction_patch: { patch_id: "patch-1", operations: [] },
            fidelity_report: {
              status: "pending",
              failure_codes: [],
              unsupported_fact_groups: [],
              required_confirmations: ["invisible_chars", "special_symbols"],
              invisible_chars_confirmed: false,
              special_symbols_confirmed: false,
            },
            confirmation_status: "pending",
            created_at: "2026-04-29T00:00:00.000Z",
          },
        ],
        tables: [],
      },
    });
  });

  await page.goto("/knowledge");
  await page.getByRole("button", { name: /Word 表格证据/ }).click();
  await expect(page.getByText("待确认")).toBeVisible();
});
```

- [ ] **Step 2: Run targeted browser test and verify it fails if UI route is not wired**

Run:

```bash
pnpm --filter @medsys/web test:browser -- table-evidence-browser.spec.ts
```

Expected before UI wiring: FAIL. Expected after Tasks 8-11: PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm --filter @medical/contracts test
pnpm --filter @medical/worker-py test
pnpm --filter @medical/api test -- table-evidence knowledge editorial-rules
pnpm --filter @medsys/web test
pnpm --filter @medsys/web test:browser -- table-evidence-browser.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Manual acceptance checklist**

Verify these with real or fixture DOCX files:

- Upload a `.docx` containing a three-line table; preview shows top rule, header rule, bottom rule, and no vertical rules.
- Upload a `.docx` containing merged cells; preview and AI package preserve `rowspan` and `colspan`.
- Upload a `.docx` containing `-`, `–`, `—`, `−`; AI package codepoints remain `002D`, `2013`, `2014`, `2212`.
- Upload a `.docx` containing `Alt+0150`; AI package stores `U+2013`.
- Upload a `.docx` containing half-width space, full-width space, NBSP, tab, line break, leading spaces, trailing spaces, and paragraph boundaries; overlay displays marks without changing real text.
- Upload a `.docx` containing superscript `⁻¹`; runs preserve superscript style and codepoints `207B`, `00B9`.
- Upload a `.docx` containing `<w:sym>`; package preserves decoded character, `symbol_font`, and `symbol_char`.
- Correct a misread cell; source snapshot remains unchanged, patch records operation, confirmed snapshot and AI package reflect correction.
- Bind one confirmed revision to a knowledge revision and a rule draft.
- Publish a rule; persisted linkage contains exact `table_evidence_revision_id`.
- Create a new table evidence revision; previously published rule still points to the old revision.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/table-evidence-browser.spec.ts
git commit -m "test: cover table evidence browser flow"
```

## Implementation Order

1. Contracts.
2. Worker fidelity.
3. Persistence and repository.
4. Backend service and package builder.
5. API routes.
6. Knowledge backend integration.
7. Rule backend integration.
8. Frontend foundation.
9. Shared workspace.
10. Knowledge frontend integration.
11. Rule frontend integration.
12. Browser QA and full verification.

This order prevents the biggest failure mode identified by the subagents: a polished upload UI that never becomes the authoritative AI and release-governance truth source.

## Residual Risks

- Word Symbol font historical private mappings may not always decode to Unicode. The implementation must preserve raw `symbol_font` and `symbol_char`, emit a failure code, and require manual confirmation before `confirmed`.
- Browser visual rendering will approximate Word layout. The guarantee is on OOXML evidence facts and AI package fidelity, not pixel-perfect Word pagination.
- Structural editing is high risk because row/column spans affect AI header paths. The patch service and frontend must run the same merge logic and tests before enabling publish.
