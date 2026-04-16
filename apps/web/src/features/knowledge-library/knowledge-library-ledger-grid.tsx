import type { ReactNode } from "react";
import type { KnowledgeLibraryLedgerDensity } from "./knowledge-library-ledger-toolbar.tsx";

export type KnowledgeLibraryLedgerColumnKey =
  | "title"
  | "status"
  | "category"
  | "moduleScope"
  | "manuscriptTypes"
  | "answer"
  | "detail"
  | "attachments"
  | "semanticStatus"
  | "semanticSummary"
  | "retrievalTerms"
  | "aliases"
  | "scenarios"
  | "riskTags"
  | "contributor"
  | "revisionId"
  | "archivedAt"
  | "archivedBy"
  | "date";

export interface KnowledgeLibraryLedgerRow {
  id: string;
  title: string;
  status: string;
  category: string;
  moduleScope: string;
  manuscriptTypes: string;
  answer: string;
  detail: string;
  attachments: string;
  semanticStatus: string;
  semanticSummary: string;
  retrievalTerms: string;
  aliases: string;
  scenarios: string;
  riskTags: string;
  contributor: string;
  revisionId: string;
  archivedAt: string;
  archivedBy: string;
  date: string;
  isArchived: boolean;
  priorityRank?: number;
  canMovePriorityUp?: boolean;
  canMovePriorityDown?: boolean;
}

export interface KnowledgeLibraryLedgerColumnDefinition {
  key: KnowledgeLibraryLedgerColumnKey;
  label: string;
  minWidth: number;
  pinned?: boolean;
}

export type KnowledgeLibraryLedgerColumnWidthMap = Record<
  KnowledgeLibraryLedgerColumnKey,
  number
>;

export const KNOWLEDGE_LIBRARY_LEDGER_COLUMNS: readonly KnowledgeLibraryLedgerColumnDefinition[] =
  [
    { key: "title", label: "标题", minWidth: 320, pinned: true },
    { key: "status", label: "状态", minWidth: 120 },
    { key: "category", label: "分类", minWidth: 140 },
    { key: "moduleScope", label: "适用模块", minWidth: 140 },
    { key: "manuscriptTypes", label: "稿件类型", minWidth: 180 },
    { key: "answer", label: "标准答案", minWidth: 280 },
    { key: "detail", label: "补充说明", minWidth: 220 },
    { key: "attachments", label: "附件", minWidth: 140 },
    { key: "semanticStatus", label: "AI 语义状态", minWidth: 160 },
    { key: "semanticSummary", label: "语义摘要", minWidth: 240 },
    { key: "retrievalTerms", label: "检索词", minWidth: 220 },
    { key: "aliases", label: "别名", minWidth: 180 },
    { key: "scenarios", label: "适用场景", minWidth: 220 },
    { key: "riskTags", label: "风险标签", minWidth: 180 },
    { key: "contributor", label: "贡献人", minWidth: 160 },
    { key: "revisionId", label: "版本号", minWidth: 180 },
    { key: "archivedAt", label: "回收时间", minWidth: 160 },
    { key: "archivedBy", label: "回收角色", minWidth: 140 },
    { key: "date", label: "更新时间", minWidth: 140 },
  ] as const;

export interface KnowledgeLibraryLedgerGridProps {
  columns?: readonly KnowledgeLibraryLedgerColumnDefinition[];
  rows: readonly KnowledgeLibraryLedgerRow[];
  density: KnowledgeLibraryLedgerDensity;
  selectedAssetId: string | null;
  columnWidths: KnowledgeLibraryLedgerColumnWidthMap;
  onSelectAsset: (assetId: string) => void;
  onEditAsset: (assetId: string) => void;
  onArchiveAsset: (assetId: string) => void;
  onRestoreAsset: (assetId: string) => void;
  onMovePriorityUp: (assetId: string) => void;
  onMovePriorityDown: (assetId: string) => void;
  onColumnResizeStart: (key: KnowledgeLibraryLedgerColumnKey, startX: number) => void;
}

export function KnowledgeLibraryLedgerGrid({
  columns = KNOWLEDGE_LIBRARY_LEDGER_COLUMNS,
  rows,
  density,
  selectedAssetId,
  columnWidths,
  onSelectAsset,
  onEditAsset,
  onArchiveAsset,
  onRestoreAsset,
  onMovePriorityUp,
  onMovePriorityDown,
  onColumnResizeStart,
}: KnowledgeLibraryLedgerGridProps) {
  const stickyOffsets = computeStickyOffsets(columns, columnWidths);
  const pinnedBoundaryKey = resolvePinnedBoundaryColumnKey(columns);

  return (
    <section className="knowledge-library-ledger-grid" aria-label="知识库台账表格">
      <div className="knowledge-library-ledger-grid__scroll">
        <table className={`knowledge-library-ledger-grid__table is-${density}`}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    width: `${columnWidths[column.key]}px`,
                    minWidth: `${column.minWidth}px`,
                    left: column.pinned ? `${stickyOffsets[column.key] ?? 0}px` : undefined,
                  }}
                  data-pinned={column.pinned ? "true" : undefined}
                  data-pinned-boundary={
                    column.key === pinnedBoundaryKey ? "true" : undefined
                  }
                  data-column={column.key}
                >
                  <span>{column.label}</span>
                  <button
                    type="button"
                    className="knowledge-library-ledger-grid__resize-handle"
                    aria-label={`调整${column.label}列宽`}
                    onPointerDown={(event) =>
                      onColumnResizeStart(column.key, event.clientX)
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="knowledge-library-ledger-grid__empty" colSpan={columns.length}>
                  暂无知识记录。
                </td>
              </tr>
            ) : null}

            {rows.map((row) => {
              const isSelected = row.id === selectedAssetId;
              return (
                <tr
                  key={row.id}
                  className={isSelected ? "is-selected" : undefined}
                  onClick={() => onSelectAsset(row.id)}
                  onDoubleClick={() => {
                    if (!row.isArchived) {
                      onEditAsset(row.id);
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{
                        width: `${columnWidths[column.key]}px`,
                        minWidth: `${column.minWidth}px`,
                        left: column.pinned ? `${stickyOffsets[column.key] ?? 0}px` : undefined,
                      }}
                      data-pinned={column.pinned ? "true" : undefined}
                      data-pinned-boundary={
                        column.key === pinnedBoundaryKey ? "true" : undefined
                      }
                    >
                      {renderCellContent({
                        columnKey: column.key,
                        row,
                        onEditAsset,
                        onArchiveAsset,
                        onRestoreAsset,
                        onMovePriorityUp,
                        onMovePriorityDown,
                      })}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderCellContent(input: {
  columnKey: KnowledgeLibraryLedgerColumnKey;
  row: KnowledgeLibraryLedgerRow;
  onEditAsset: (assetId: string) => void;
  onArchiveAsset: (assetId: string) => void;
  onRestoreAsset: (assetId: string) => void;
  onMovePriorityUp: (assetId: string) => void;
  onMovePriorityDown: (assetId: string) => void;
}): ReactNode {
  const { columnKey, row } = input;

  if (columnKey !== "title") {
    return (
      <div className="knowledge-library-ledger-grid__pinned-shell">
        {formatGridValue(row[columnKey])}
      </div>
    );
  }

  return (
    <div className="knowledge-library-ledger-grid__pinned-shell">
      <div className="knowledge-library-ledger-grid__title-cell">
        <div className="knowledge-library-ledger-grid__title-meta">
          <strong>{formatGridValue(row.title)}</strong>
        </div>

        <div className="knowledge-library-ledger-grid__row-actions">
          {!row.isArchived ? (
            <>
              <button
                type="button"
                data-row-action="edit"
                onClick={(event) => {
                  event.stopPropagation();
                  input.onEditAsset(row.id);
                }}
              >
                编辑
              </button>
              <button
                type="button"
                data-row-action="archive"
                onClick={(event) => {
                  event.stopPropagation();
                  input.onArchiveAsset(row.id);
                }}
              >
                移入回收区
              </button>
            </>
          ) : (
            <button
              type="button"
              data-row-action="restore"
              onClick={(event) => {
                event.stopPropagation();
                input.onRestoreAsset(row.id);
              }}
            >
              恢复
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function computeStickyOffsets(
  columns: readonly KnowledgeLibraryLedgerColumnDefinition[],
  columnWidths: KnowledgeLibraryLedgerColumnWidthMap,
): Partial<Record<KnowledgeLibraryLedgerColumnKey, number>> {
  const offsets: Partial<Record<KnowledgeLibraryLedgerColumnKey, number>> = {};
  let currentOffset = 0;

  for (const column of columns) {
    if (!column.pinned) {
      continue;
    }

    offsets[column.key] = currentOffset;
    currentOffset += columnWidths[column.key];
  }

  return offsets;
}

function resolvePinnedBoundaryColumnKey(
  columns: readonly KnowledgeLibraryLedgerColumnDefinition[],
): KnowledgeLibraryLedgerColumnKey | null {
  const pinnedColumns = columns.filter((column) => column.pinned);
  return pinnedColumns.at(-1)?.key ?? null;
}

function formatGridValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}
