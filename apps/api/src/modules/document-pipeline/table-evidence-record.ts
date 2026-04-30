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

export interface TableEvidenceWarning {
  code: string;
  message: string;
  tableId?: string;
  cellId?: string;
}

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

export interface TableEvidenceParagraph {
  paragraphId: string;
  pPath: string;
  rawPXml: string;
  pHash: string;
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
  paragraphs: TableEvidenceParagraph[];
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
  characterClasses: Array<
    Pick<TableEvidenceCharacter, "index" | "char" | "codePoint" | "charClass">
  >;
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

export interface TableEvidenceFidelityReport {
  status: TableEvidenceSnapshotStatus;
  warnings: string[];
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
  fidelityReport: TableEvidenceFidelityReport;
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
  warnings: TableEvidenceWarning[];
}
