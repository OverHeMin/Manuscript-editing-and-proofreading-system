import type {
  ConfirmedAiTablePackage,
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceInvisibleChar,
  TableEvidenceRevision,
  TableEvidenceTextRun,
} from "../src/table-evidence.js";
import type {
  ConfirmedAiTablePackage as PublicConfirmedAiTablePackage,
  TableEvidenceRevision as PublicTableEvidenceRevision,
} from "../src/index.js";
import type { KnowledgeContentBlock } from "../src/knowledge.js";
import type { RuleAiEvidenceItem } from "../src/rule-ai-intake.js";
import type { EditorialRuleLinkagePayload } from "../src/editorial-rules.js";

const invisibleChar: TableEvidenceInvisibleChar = {
  id: "invisible-1",
  kind: "nbsp",
  codepoint: "00A0",
  offset: 3,
  length: 1,
};

const run: TableEvidenceTextRun = {
  id: "run-1",
  kind: "text",
  text: "L⁻¹",
  codepoints: ["004C", "207B", "00B9"],
  style: { superscript: true, bold: false, italic: false },
  invisible_chars: [invisibleChar],
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
      invisible_chars: [invisibleChar],
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
  correction_patch: {
    patch_id: "patch-1",
    operations: [
      {
        op: "confirm_invisible_chars",
        cell_ids: ["cell-r0-c0"],
        confirmed_invisible_char_ids: [invisibleChar.id],
      },
    ],
  },
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

const publicPackageRecord: PublicConfirmedAiTablePackage = packageRecord;
const publicRevision: PublicTableEvidenceRevision = revision;

void block;
void ruleEvidence;
void linkage;
void publicPackageRecord;
void publicRevision;
