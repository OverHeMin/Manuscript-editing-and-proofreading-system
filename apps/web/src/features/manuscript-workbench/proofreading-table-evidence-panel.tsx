import React from "react";
import type { JobViewModel } from "../manuscripts/index.ts";

export interface ProofreadingTableEvidenceCharacterViewModel {
  index: number;
  char: string;
  codePoint: string;
  charClass: string;
}

export interface ProofreadingTableEvidenceStyleSpanViewModel {
  runId: string;
  startIndex: number;
  endIndex: number;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
  scriptPosition?: string;
}

export interface ProofreadingTableEvidenceCellViewModel {
  cellId: string;
  rowIndex: number;
  columnIndex: number;
  text: string;
  specialCharacters: ProofreadingTableEvidenceCharacterViewModel[];
  styleSpans: ProofreadingTableEvidenceStyleSpanViewModel[];
}

export interface ProofreadingTableEvidenceTableViewModel {
  tableId: string;
  rowCount: number;
  columnCount: number;
  fidelityStatus: string;
  warnings: string[];
  cells: ProofreadingTableEvidenceCellViewModel[];
}

export interface ProofreadingTableEvidenceViewModel {
  snapshotId: string;
  status: string;
  parserVersion?: string;
  warnings: string[];
  tables: ProofreadingTableEvidenceTableViewModel[];
}

export interface ProofreadingTableEvidencePanelProps {
  evidence?: ProofreadingTableEvidenceViewModel | null;
}

export function buildProofreadingTableEvidence(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingTableEvidenceViewModel | null {
  const payload = asRecord(job?.payload);
  const evidence = asRecord(payload?.proofreadingTableEvidence);
  if (!evidence) {
    return null;
  }

  const snapshotId = readOptionalString(evidence.snapshotId);
  const status = readOptionalString(evidence.status);
  if (!snapshotId || !status) {
    return null;
  }

  return {
    snapshotId,
    status,
    ...(readOptionalString(evidence.parserVersion)
      ? { parserVersion: readOptionalString(evidence.parserVersion) }
      : {}),
    warnings: readWarningMessages(evidence.warnings),
    tables: Array.isArray(evidence.tables)
      ? evidence.tables.flatMap(normalizeTableEvidenceTable)
      : [],
  };
}

export function ProofreadingTableEvidencePanel({
  evidence,
}: ProofreadingTableEvidencePanelProps): React.ReactElement | null {
  if (!evidence) {
    return null;
  }

  return (
    <section
      className="manuscript-workbench-detail-card manuscript-workbench-proofreading-table-evidence"
      aria-label="表格无损证据"
    >
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>表格无损证据</h4>
          <p>只读展示原生 DOCX 表格抽取状态、单元格锚点、特殊字符和样式证据。</p>
        </div>
        <span className={resolveStatusPillClassName(evidence.status)}>
          {formatFidelityStatus(evidence.status)}
        </span>
      </div>
      <dl className="manuscript-workbench-detail-metadata">
        <div>
          <dt>快照</dt>
          <dd>{evidence.snapshotId}</dd>
        </div>
        <div>
          <dt>解析器</dt>
          <dd>{evidence.parserVersion ?? "未记录"}</dd>
        </div>
        <div>
          <dt>表格数</dt>
          <dd>{evidence.tables.length}</dd>
        </div>
      </dl>
      {evidence.warnings.length > 0 ? (
        <ul className="manuscript-workbench-proofreading-table-evidence-warnings">
          {evidence.warnings.map((warning, index) => (
            <li key={`${warning}:${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {evidence.tables.length > 0 ? (
        <div className="manuscript-workbench-proofreading-table-evidence-list">
          {evidence.tables.map((table) => (
            <article key={table.tableId}>
              <header>
                <strong>{table.tableId}</strong>
                <small>
                  {`${table.rowCount} 行 × ${table.columnCount} 列 · ${formatFidelityStatus(
                    table.fidelityStatus,
                  )}`}
                </small>
              </header>
              {table.warnings.length > 0 ? (
                <p>{table.warnings.join("；")}</p>
              ) : null}
              <ul>
                {table.cells.map((cell) => (
                  <li key={cell.cellId}>
                    <div>
                      <strong>{cell.cellId}</strong>
                      <small>{`行 ${cell.rowIndex + 1} · 列 ${cell.columnIndex + 1}`}</small>
                    </div>
                    <p>{cell.text || "空单元格"}</p>
                    {cell.specialCharacters.length > 0 ? (
                      <div>
                        <span>特殊字符</span>
                        <small>
                          {cell.specialCharacters
                            .map(
                              (character) =>
                                `${character.char} ${character.codePoint} · ${character.charClass}`,
                            )
                            .join("；")}
                        </small>
                      </div>
                    ) : null}
                    {cell.styleSpans.length > 0 ? (
                      <div>
                        <span>样式证据</span>
                        <small>
                          {cell.styleSpans.map(formatStyleSpan).join("；")}
                        </small>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="manuscript-workbench-detail-empty">
          <strong>未抽取到原生 DOCX 表格</strong>
          <p>图片表格、OCR 表格和非原生表格当前只进入人工复核。</p>
        </div>
      )}
    </section>
  );
}

function normalizeTableEvidenceTable(
  value: unknown,
): ProofreadingTableEvidenceTableViewModel[] {
  const table = asRecord(value);
  const tableId = readOptionalString(table?.tableId);
  if (!tableId) {
    return [];
  }

  return [
    {
      tableId,
      rowCount: readNumber(table?.rowCount) ?? 0,
      columnCount: readNumber(table?.columnCount) ?? 0,
      fidelityStatus: readOptionalString(table?.fidelityStatus) ?? "partial",
      warnings: readStringArray(table?.warnings),
      cells: Array.isArray(table?.cells)
        ? table.cells.flatMap(normalizeTableEvidenceCell)
        : [],
    },
  ];
}

function normalizeTableEvidenceCell(
  value: unknown,
): ProofreadingTableEvidenceCellViewModel[] {
  const cell = asRecord(value);
  const cellId = readOptionalString(cell?.cellId);
  if (!cellId) {
    return [];
  }

  return [
    {
      cellId,
      rowIndex: readNumber(cell?.rowIndex) ?? 0,
      columnIndex: readNumber(cell?.columnIndex) ?? 0,
      text: readOptionalString(cell?.text) ?? "",
      specialCharacters: Array.isArray(cell?.specialCharacters)
        ? cell.specialCharacters.flatMap(normalizeSpecialCharacter)
        : [],
      styleSpans: Array.isArray(cell?.styleSpans)
        ? cell.styleSpans.flatMap(normalizeStyleSpan)
        : [],
    },
  ];
}

function normalizeSpecialCharacter(
  value: unknown,
): ProofreadingTableEvidenceCharacterViewModel[] {
  const character = asRecord(value);
  const codePoint = readOptionalString(character?.codePoint);
  const charClass = readOptionalString(character?.charClass);
  if (!codePoint || !charClass) {
    return [];
  }

  return [
    {
      index: readNumber(character?.index) ?? 0,
      char: readOptionalString(character?.char) ?? "",
      codePoint,
      charClass,
    },
  ];
}

function normalizeStyleSpan(
  value: unknown,
): ProofreadingTableEvidenceStyleSpanViewModel[] {
  const span = asRecord(value);
  const runId = readOptionalString(span?.runId);
  if (!runId) {
    return [];
  }

  return [
    {
      runId,
      startIndex: readNumber(span?.startIndex) ?? 0,
      endIndex: readNumber(span?.endIndex) ?? 0,
      ...(typeof span?.italic === "boolean" ? { italic: span.italic } : {}),
      ...(typeof span?.bold === "boolean" ? { bold: span.bold } : {}),
      ...(typeof span?.underline === "boolean" ? { underline: span.underline } : {}),
      ...(readOptionalString(span?.scriptPosition)
        ? { scriptPosition: readOptionalString(span?.scriptPosition) }
        : {}),
    },
  ];
}

function formatStyleSpan(
  span: ProofreadingTableEvidenceStyleSpanViewModel,
): string {
  const labels = [
    span.italic === true ? "斜体" : undefined,
    span.bold === true ? "加粗" : undefined,
    span.underline === true ? "下划线" : undefined,
    span.scriptPosition ? formatScriptPosition(span.scriptPosition) : undefined,
  ].filter(Boolean);
  return `${span.runId}:${span.startIndex}-${span.endIndex} ${
    labels.join("、") || "样式"
  }`;
}

function formatScriptPosition(value: string): string {
  if (value === "superscript") {
    return "上标";
  }
  if (value === "subscript") {
    return "下标";
  }
  return value;
}

function formatFidelityStatus(value: string): string {
  switch (value) {
    case "complete":
      return "完整";
    case "partial":
      return "部分";
    case "unsupported":
      return "不支持";
    case "failed":
      return "失败";
    default:
      return value;
  }
}

function resolveStatusPillClassName(status: string): string {
  return `manuscript-workbench-status-pill ${
    status === "complete"
      ? "is-success"
      : status === "failed" || status === "unsupported"
        ? "is-error"
        : "is-neutral"
  }`;
}

function readWarningMessages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    const warning = asRecord(entry);
    const message = readOptionalString(warning?.message);
    return message ? [message] : [];
  });
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
